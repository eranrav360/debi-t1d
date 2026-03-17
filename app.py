from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from sqlalchemy import create_engine, text, event
from sqlalchemy.pool import NullPool, StaticPool
import os, json, statistics
from datetime import datetime, date

# --- Database setup ---
_db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'debi.db')
_raw_url = os.environ.get('DATABASE_URL', f'sqlite:///{_db_path}')
# Render provides postgres:// but SQLAlchemy needs postgresql+psycopg2://
DATABASE_URL = _raw_url.replace('postgres://', 'postgresql+psycopg2://', 1)
IS_PG = 'postgresql' in DATABASE_URL

if IS_PG:
    engine = create_engine(DATABASE_URL, poolclass=NullPool)
else:
    engine = create_engine(
        DATABASE_URL,
        connect_args={'check_same_thread': False},
        poolclass=StaticPool
    )
    @event.listens_for(engine, 'connect')
    def set_pragmas(conn, _):
        conn.execute('PRAGMA foreign_keys = ON')
        conn.execute('PRAGMA journal_mode = WAL')

# --- Flask app ---
app = Flask(__name__, static_folder='client/dist', static_url_path='')
CORS(app, origins=os.environ.get('CORS_ORIGINS', '*').split(','))

# --- DB helpers ---

def get_conn():
    return engine.connect()

def rows(result):
    return [dict(r) for r in result.mappings()]

def row(result):
    r = result.mappings().fetchone()
    return dict(r) if r else None

def db_insert(conn, sql, params):
    """Execute INSERT and return the new row id."""
    if IS_PG:
        full_sql = sql.rstrip().rstrip(';') + ' RETURNING id'
        result = conn.execute(text(full_sql), params)
        new_id = result.scalar()
    else:
        result = conn.execute(text(sql), params)
        new_id = result.lastrowid
    conn.commit()
    return new_id

def init_db():
    pk = 'SERIAL PRIMARY KEY' if IS_PG else 'INTEGER PRIMARY KEY AUTOINCREMENT'
    ddl_templates = [
        '''CREATE TABLE IF NOT EXISTS foods (
            id {PK}, name TEXT NOT NULL,
            serving_size_g REAL NOT NULL, carbs_per_serving REAL NOT NULL)''',
        '''CREATE TABLE IF NOT EXISTS novorapid_records (
            id {PK}, recorded_at TEXT NOT NULL,
            total_carbs REAL DEFAULT 0, pre_sugar INTEGER,
            dose_given REAL NOT NULL, post_1hr_sugar INTEGER, notes TEXT DEFAULT \'\')''',
        '''CREATE TABLE IF NOT EXISTS meal_items (
            id {PK},
            record_id INTEGER REFERENCES novorapid_records(id) ON DELETE CASCADE,
            food_id INTEGER, food_name TEXT NOT NULL,
            weight_g REAL NOT NULL, carbs REAL NOT NULL)''',
        '''CREATE TABLE IF NOT EXISTS tregludec_records (
            id {PK}, recorded_date TEXT NOT NULL,
            dose REAL NOT NULL, notes TEXT DEFAULT \'\')''',
    ]
    with get_conn() as conn:
        for ddl in ddl_templates:
            conn.execute(text(ddl.format(PK=pk)))
        count = conn.execute(text('SELECT COUNT(*) FROM foods')).scalar()
        if count == 0:
            foods_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'foods.json')
            if os.path.exists(foods_file):
                with open(foods_file, encoding='utf-8') as f:
                    foods_data = json.load(f)
                conn.execute(
                    text('INSERT INTO foods (name, serving_size_g, carbs_per_serving) VALUES (:n, :s, :c)'),
                    [{'n': fd['name'], 's': fd['serving_size_g'], 'c': fd['carbs_per_serving']} for fd in foods_data]
                )
        conn.commit()

# --- Foods API ---

@app.route('/api/foods', methods=['GET'])
def get_foods():
    q = request.args.get('q', '').strip()
    with get_conn() as conn:
        if q:
            result = conn.execute(
                text('SELECT * FROM foods WHERE name LIKE :q ORDER BY name LIMIT 20'),
                {'q': f'%{q}%'}
            )
        else:
            result = conn.execute(text('SELECT * FROM foods ORDER BY name'))
        return jsonify(rows(result))

@app.route('/api/foods', methods=['POST'])
def add_food():
    d = request.json
    with get_conn() as conn:
        new_id = db_insert(conn,
            'INSERT INTO foods (name, serving_size_g, carbs_per_serving) VALUES (:n, :s, :c)',
            {'n': d['name'].strip(), 's': float(d['serving_size_g']), 'c': float(d['carbs_per_serving'])}
        )
    return jsonify({'id': new_id, 'status': 'ok'})

@app.route('/api/foods/<int:food_id>', methods=['DELETE'])
def delete_food(food_id):
    with get_conn() as conn:
        conn.execute(text('DELETE FROM foods WHERE id=:id'), {'id': food_id})
        conn.commit()
    return jsonify({'status': 'ok'})

# --- Dose recommendation ---

@app.route('/api/recommend', methods=['POST'])
def recommend():
    d = request.json
    total_carbs = float(d.get('total_carbs', 0))
    pre_sugar = float(d.get('pre_sugar', 100))
    s = _calc_stats()
    icr = s['icr'] or 15.0
    isf = s['isf'] or 50.0
    meal_dose = total_carbs / icr if total_carbs > 0 else 0.0
    correction = max(0.0, (pre_sugar - 100.0) / isf)
    return jsonify({
        'meal_dose': round(meal_dose, 1),
        'correction_dose': round(correction, 1),
        'total_dose': round(meal_dose + correction, 1),
        'icr_used': icr, 'isf_used': isf, 'confidence': s['confidence']
    })

# --- NovoRapid API ---

@app.route('/api/novorapid', methods=['GET'])
def list_novorapid():
    limit = int(request.args.get('limit', 50))
    with get_conn() as conn:
        result = conn.execute(
            text('SELECT * FROM novorapid_records ORDER BY recorded_at DESC LIMIT :lim'),
            {'lim': limit}
        )
        records = rows(result)
        for r in records:
            r['meal_items'] = rows(conn.execute(
                text('SELECT * FROM meal_items WHERE record_id=:rid'), {'rid': r['id']}
            ))
    return jsonify(records)

@app.route('/api/novorapid', methods=['POST'])
def add_novorapid():
    d = request.json
    now = datetime.now().strftime('%Y-%m-%d %H:%M')
    with get_conn() as conn:
        record_id = db_insert(conn,
            'INSERT INTO novorapid_records (recorded_at, total_carbs, pre_sugar, dose_given, notes) VALUES (:at, :carbs, :pre, :dose, :notes)',
            {'at': d.get('recorded_at', now), 'carbs': float(d.get('total_carbs', 0)),
             'pre': int(d['pre_sugar']) if d.get('pre_sugar') else None,
             'dose': float(d['dose_given']), 'notes': d.get('notes', '')}
        )
        for item in d.get('meal_items', []):
            conn.execute(
                text('INSERT INTO meal_items (record_id, food_id, food_name, weight_g, carbs) VALUES (:rid, :fid, :fn, :wg, :c)'),
                {'rid': record_id, 'fid': item.get('food_id'), 'fn': item['food_name'],
                 'wg': float(item['weight_g']), 'c': float(item['carbs'])}
            )
        conn.commit()
    return jsonify({'id': record_id, 'status': 'ok'})

@app.route('/api/novorapid/<int:record_id>/post_sugar', methods=['PATCH'])
def update_post_sugar(record_id):
    d = request.json
    with get_conn() as conn:
        conn.execute(
            text('UPDATE novorapid_records SET post_1hr_sugar=:v WHERE id=:id'),
            {'v': int(d['post_1hr_sugar']), 'id': record_id}
        )
        conn.commit()
    return jsonify({'status': 'ok'})

@app.route('/api/novorapid/<int:record_id>', methods=['DELETE'])
def delete_novorapid(record_id):
    with get_conn() as conn:
        conn.execute(text('DELETE FROM novorapid_records WHERE id=:id'), {'id': record_id})
        conn.commit()
    return jsonify({'status': 'ok'})

# --- Tregludec API ---

@app.route('/api/tregludec', methods=['GET'])
def list_tregludec():
    with get_conn() as conn:
        result = conn.execute(
            text('SELECT * FROM tregludec_records ORDER BY recorded_date DESC LIMIT 30')
        )
        return jsonify(rows(result))

@app.route('/api/tregludec', methods=['POST'])
def add_tregludec():
    d = request.json
    with get_conn() as conn:
        db_insert(conn,
            'INSERT INTO tregludec_records (recorded_date, dose, notes) VALUES (:d, :dose, :notes)',
            {'d': d.get('recorded_date', date.today().isoformat()),
             'dose': float(d['dose']), 'notes': d.get('notes', '')}
        )
    return jsonify({'status': 'ok'})

@app.route('/api/tregludec/<int:record_id>', methods=['DELETE'])
def delete_tregludec(record_id):
    with get_conn() as conn:
        conn.execute(text('DELETE FROM tregludec_records WHERE id=:id'), {'id': record_id})
        conn.commit()
    return jsonify({'status': 'ok'})

# --- Statistics ---

@app.route('/api/statistics', methods=['GET'])
def get_statistics():
    return jsonify(_calc_stats())

def _calc_stats():
    with get_conn() as conn:
        records = rows(conn.execute(text('''
            SELECT total_carbs, dose_given, pre_sugar, post_1hr_sugar
            FROM novorapid_records
            WHERE post_1hr_sugar IS NOT NULL AND dose_given > 0
            ORDER BY recorded_at DESC LIMIT 100
        ''')))
        tregludec = row(conn.execute(text(
            'SELECT dose FROM tregludec_records ORDER BY recorded_date DESC LIMIT 1'
        )))
        fasting_records = rows(conn.execute(text('''
            SELECT pre_sugar FROM novorapid_records
            WHERE (total_carbs = 0 OR total_carbs IS NULL) AND pre_sugar IS NOT NULL
            ORDER BY recorded_at DESC LIMIT 14
        ''')))

    icr_values, isf_values = [], []
    for r in records:
        carbs = r['total_carbs'] or 0.0
        dose = r['dose_given']
        pre = r['pre_sugar'] or 100
        post = r['post_1hr_sugar']
        if carbs == 0 and dose > 0 and pre and post:
            isf = (pre - post) / dose
            if 5 < isf < 200:
                isf_values.append(isf)
        elif carbs > 0 and dose > 0 and 80 <= (pre or 0) <= 120:
            icr = carbs / dose
            if 3 < icr < 50:
                icr_values.append(icr)

    icr = round(statistics.median(icr_values), 1) if icr_values else None
    isf = round(statistics.median(isf_values), 1) if isf_values else None
    current_tregludec = tregludec['dose'] if tregludec else None

    fasting_avg = None
    tregludec_recommendation = None
    if fasting_records:
        sugars = [r['pre_sugar'] for r in fasting_records if r['pre_sugar']]
        if sugars:
            fasting_avg = round(statistics.mean(sugars), 1)
            if current_tregludec:
                if fasting_avg > 130:
                    tregludec_recommendation = f"שקול להגדיל מינון ל-{int(current_tregludec)+1}-{int(current_tregludec)+2} יחידות (סוכר בצום: {fasting_avg})"
                elif fasting_avg < 80:
                    tregludec_recommendation = f"שקול להקטין מינון ל-{max(1,int(current_tregludec)-1)}-{max(1,int(current_tregludec)-2)} יחידות (סוכר בצום: {fasting_avg})"
                else:
                    tregludec_recommendation = f"המינון הנוכחי נראה מתאים (סוכר בצום ממוצע: {fasting_avg})"

    confidence = 'high' if len(icr_values) >= 10 else 'medium' if len(icr_values) >= 3 else 'low'
    return {
        'icr': icr, 'isf': isf, 'tregludec_current': current_tregludec,
        'tregludec_recommendation': tregludec_recommendation, 'fasting_avg': fasting_avg,
        'data_points': {'icr': len(icr_values), 'isf': len(isf_values)},
        'confidence': confidence, 'total_records': len(records)
    }

# --- Dashboard ---

@app.route('/api/dashboard', methods=['GET'])
def dashboard():
    today = date.today().isoformat()
    with get_conn() as conn:
        today_novo = rows(conn.execute(
            text("SELECT * FROM novorapid_records WHERE recorded_at LIKE :d ORDER BY recorded_at DESC"),
            {'d': f'{today}%'}
        ))
        today_treg = row(conn.execute(
            text('SELECT * FROM tregludec_records WHERE recorded_date=:d'), {'d': today}
        ))
        last_record = row(conn.execute(
            text('SELECT * FROM novorapid_records ORDER BY recorded_at DESC LIMIT 1')
        ))
    return jsonify({
        'today_novorapid': today_novo, 'today_tregludec': today_treg,
        'last_record': last_record, 'stats': _calc_stats()
    })

# --- Serve React SPA ---

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    dist = app.static_folder
    if path and os.path.exists(os.path.join(dist, path)):
        return send_from_directory(dist, path)
    return send_from_directory(dist, 'index.html')

if __name__ == '__main__':
    init_db()
    print("דבי | ניהול סוכרת סוג 1 — http://localhost:5000")
    app.run(debug=True, port=5000)
