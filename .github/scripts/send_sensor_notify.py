"""Send a Dexcom sensor replacement WhatsApp alert via WAHA."""
import json, os, sys, urllib.request, urllib.error

waha_url  = os.environ["WAHA_URL"]
waha_key  = os.environ["WAHA_KEY"]
group_id  = os.environ["GROUP_ID"]
hours_str = os.environ.get("HOURS", "null")
is_manual = os.environ.get("IS_MANUAL", "false") == "true"
status_raw = os.environ.get("STATUS_JSON", "{}")

if not hours_str or hours_str == "null":
    print("No sensor data recorded yet — log a sensor change in the app first.")
    sys.exit(0)

hours = float(hours_str)
print(f"Hours remaining: {hours:.1f}  |  Manual run: {is_manual}")

# Scheduled runs: only fire in the 23-25h window to avoid duplicate messages
if not is_manual and not (23 <= hours <= 25):
    print("Scheduled run: outside 23-25h notification window. Skipping.")
    sys.exit(0)

status     = json.loads(status_raw)
expires    = status.get("expires_at", "")
days_left  = int(hours // 24)
hours_left = int(hours % 24)

if is_manual:
    if hours <= 0:
        time_str = "החיישן פג תוקף!"
    elif days_left > 0:
        time_str = f"עוד {days_left} ימים ו-{hours_left} שעות"
    else:
        time_str = f"עוד {hours_left} שעות"
    msg = (
        "📡 *בדיקת חיישן דקסקום* (הודעת בדיקה)\n\n"
        f"זמן עד להחלפה: *{time_str}*\n"
        f"פג תוקף: {expires}\n\n"
        "_(התראה אמיתית תישלח 24 שעות לפני)_"
    )
else:
    msg = (
        "📡 *תזכורת החלפת חיישן דקסקום*\n\n"
        f"עוד ~24 שעות ({expires}) צריך להחליף את החיישן של דבי.\n"
        "יש להכין חיישן חדש מראש! 💙"
    )

payload = json.dumps({
    "chatId":  group_id,
    "text":    msg,
    "session": "default"
}).encode()

req = urllib.request.Request(
    f"{waha_url}/api/sendText",
    data=payload,
    headers={
        "Content-Type": "application/json",
        "X-Api-Key": waha_key
    },
    method="POST"
)
try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        print(f"WAHA response ({resp.status}): {resp.read().decode()}")
        print("Message sent successfully!")
except urllib.error.HTTPError as e:
    print(f"WAHA error {e.code}: {e.read().decode()}")
    sys.exit(1)
