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

print("\n=== Available chats/groups (searching for שניידר) ===")
# Try session-namespaced path first (newer WAHA), fall back to legacy path
# Use a large limit to catch all chats; WAHA may also support ?filter=
chats = fetch("/api/default/chats?limit=1000", silent_404=True) or fetch("/api/chats?limit=1000")
if chats:
    items = chats if isinstance(chats, list) else []
    # Print all groups, highlighting שניידר
    for c in items:
        cid  = c.get("id", "")
        name = c.get("name", "") or c.get("subject", "") or "(no name)"
        if "@g.us" not in cid:
            continue   # skip non-groups
        kind = "GROUP"
        marker = " <<<" if "שניידר" in name else ""
        print(f"  [{kind}]  {name!r:40}  id={cid}{marker}")
    # Also explicitly search
    matches = [c for c in items if "שניידר" in (c.get("name","") or c.get("subject",""))]
    if matches:
        print(f"\n=== FOUND {len(matches)} match(es) for שניידר ===")
        for c in matches:
            print(f"  id={c.get('id')}  name={c.get('name') or c.get('subject')}")
    else:
        print("\n  !! No group named שניידר found in the returned list.")
        print(f"  Total chats returned: {len(items)}")
else:
    print("  No chats returned — check API key and session status")
