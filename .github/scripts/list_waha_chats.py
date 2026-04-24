"""List all WAHA chats/groups — run during manual workflow trigger to find correct group ID."""
import json, os, urllib.request, urllib.error

waha_url = os.environ["WAHA_URL"]
waha_key = os.environ["WAHA_KEY"]

def fetch(path, silent_404=False):
    req = urllib.request.Request(
        f"{waha_url}{path}",
        headers={"X-Api-Key": waha_key}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 404 and silent_404:
            return None
        print(f"HTTP {e.code} [{path}]: {e.read().decode()}")
        return None

print("=== Connected WhatsApp session ===")
sessions = fetch("/api/sessions")
if sessions:
    for s in (sessions if isinstance(sessions, list) else [sessions]):
        print(f"  name={s.get('name')}  status={s.get('status')}  phone={s.get('me', {}).get('id','?')}")

print("\n=== Available chats/groups ===")
# Try session-namespaced path first (newer WAHA), fall back to legacy path
chats = fetch("/api/default/chats?limit=100", silent_404=True) or fetch("/api/chats?limit=100")
if chats:
    for c in (chats if isinstance(chats, list) else []):
        cid  = c.get("id", "")
        name = c.get("name", "") or c.get("subject", "") or "(no name)"
        kind = "GROUP  " if "@g.us" in cid else "contact"
        print(f"  [{kind}]  {name!r:35}  id={cid}")
else:
    print("  No chats returned — check API key and session status")
    # Debug: list available API endpoints
    print("\n=== Debug: API root ===")
    root = fetch("/api")
    print(root)
