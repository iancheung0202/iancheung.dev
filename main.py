import os
import re
import json

from datetime import datetime, timezone, timedelta
from urllib.parse import quote
from flask import Flask, render_template, render_template_string, request, abort, session, redirect, jsonify, url_for
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_url_path="", static_folder="static")
app.url_map.strict_slashes = False

# --- Session secret key -----------------------------------------------------
# NOTE: this used to be `os.urandom(24)`, regenerated every process start.
# That silently invalidated every session cookie (including the notes-wall
# device id below) on every restart, which defeats any cookie-based rate
# limiting. Prefer a key from the environment; otherwise persist a generated
# one to disk next to this file so it survives restarts/deploys.
_SECRET_KEY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".flask_secret")

def _load_secret_key():
    env_key = os.getenv("FLASK_SECRET_KEY")
    if env_key:
        return env_key.encode()
    try:
        with open(_SECRET_KEY_FILE, "rb") as f:
            key = f.read()
            if key:
                return key
    except OSError:
        pass
    key = os.urandom(32)
    try:
        with open(_SECRET_KEY_FILE, "wb") as f:
            f.write(key)
        os.chmod(_SECRET_KEY_FILE, 0o600)
    except OSError:
        pass  # worst case we fall back to an in-memory key for this run
    return key

app.secret_key = _load_secret_key()
# Keep people (and their notes-wall device id) signed in across visits instead
# of only for the browser session.
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=400)

@app.before_request
def block_backend_files():
    if request.path == '/jamie/main.py':
        abort(404)

@app.errorhandler(404)
def page_not_found(e):
    return render_template("404.html"), 404

@app.errorhandler(403)
def forbidden(e):
    return render_template("403.html"), 403

@app.errorhandler(401)
def unauthorized(e):
    return render_template("401.html"), 401

@app.errorhandler(500)
def internal_server_error(e):
    return render_template("500.html"), 500

@app.route("/")
def home():
    return app.send_static_file("index.html")

@app.route("/pricing/")
def pricing_page():
    return app.send_static_file("pricing.html")

@app.route("/class/")
def grade_page():
        class_root = os.path.join(app.static_folder, "class")
        files = []

        for root, _, filenames in os.walk(class_root):
            for filename in filenames:
                rel_path = os.path.relpath(os.path.join(root, filename), app.static_folder)
                files.append(rel_path.replace(os.sep, "/"))

        files.sort()

        return render_template_string(
            """<!doctype html><html><body><ul>{% for file in files %}<li><a href="{{ url_for('static', filename=file) }}">{{ file }}</a></li>{% endfor %}</ul></body></html>""",
            files=files,
        )

### Story Pages

ABOUT_DIR = os.path.join(app.static_folder, "about")
FRONT_MATTER_RE = re.compile(r"\A\ufeff?---[ \t]*\r?\n(?:(.*?)\r?\n)?---[ \t]*(?:\r?\n|\Z)", re.S)

def read_front_matter(path):
    """Parse simple `key: value` front matter from the top of a .md file."""
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            head = f.read(4096)
    except OSError:
        return {}

    match = FRONT_MATTER_RE.match(head)
    if not match:
        return {}

    meta = {}
    for line in (match.group(1) or "").splitlines():
        if ":" not in line or line.lstrip().startswith("#"):
            continue
        key, _, value = line.partition(":")
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        meta[key.strip().lower()] = value
    return meta

def parse_order(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return 9999

def about_url(*parts):
    return "about/" + "/".join(quote(part) for part in parts)

def resolve_folder_icon(folder, icon):
    if not icon:
        return None
    if icon.startswith(("http://", "https://", "/")):
        return icon
    if os.path.isfile(os.path.join(ABOUT_DIR, folder, icon)):
        return about_url(folder, icon)
    return None 

@app.route("/api/about")
def about_tree():
    folders = []

    if os.path.isdir(ABOUT_DIR):
        for folder in os.listdir(ABOUT_DIR):
            folder_path = os.path.join(ABOUT_DIR, folder)
            if folder.startswith(("_", ".")) or not os.path.isdir(folder_path):
                continue

            pages = []
            for filename in os.listdir(folder_path):
                file_path = os.path.join(folder_path, filename)
                if (
                    not filename.endswith(".md")
                    or filename.startswith(("_", "."))
                    or not os.path.isfile(file_path)
                ):
                    continue

                slug = filename[:-3]
                meta = read_front_matter(file_path)
                pages.append({
                    "key": f"{folder}/{slug}",
                    "title": meta.get("title") or slug.replace("-", " "),
                    "order": parse_order(meta.get("order")),
                    "url": about_url(folder, filename),
                    "updated": datetime.fromtimestamp(os.path.getmtime(file_path), tz=timezone.utc).isoformat(),
                })

            if not pages:
                continue
            pages.sort(key=lambda p: (p["order"], p["title"].lower()))

            meta = read_front_matter(os.path.join(folder_path, "_folder.md"))
            folders.append({
                "id": folder,
                "label": meta.get("label") or folder.replace("-", " ").replace("_", " "),
                "icon": resolve_folder_icon(folder, meta.get("icon")),
                "order": parse_order(meta.get("order")),
                "pages": pages,
            })

    folders.sort(key=lambda f: (f["order"], f["label"].lower()))
    return jsonify({"folders": folders})

### Todo List

TODO_FILE = 'templates/todos.json'

def get_todos():
    if not os.path.exists(TODO_FILE):
        return []
    with open(TODO_FILE, 'r') as f:
        try:
            return json.load(f)
        except:
            return []

def save_todos(todos):
    with open(TODO_FILE, 'w') as f:
        json.dump(todos, f)

@app.route("/todo", methods=["GET", "POST"])
def todo():
    if request.method == "POST":
        if request.is_json:
            if not session.get('todo_logged_in'):
                 return jsonify({"error": "Unauthorized"}), 401
            
            data = request.get_json()
            if data.get('action') == 'get':
                return jsonify(get_todos())
            elif data.get('action') == 'save':
                new_todos = data.get('todos')
                if new_todos is not None:
                    save_todos(new_todos)
                return jsonify({"status": "ok"})
            return jsonify({"error": "Invalid action"}), 400

        password = request.form.get("password")
        if password:
            if password == os.getenv("TODO_PASSWORD"):
                session['todo_logged_in'] = True
                return redirect(url_for('todo'))
            else:
                 return render_template("todo.html", error="Incorrect Password", logged_in=False)
        
        if request.form.get("logout"):
             session.pop('todo_logged_in', None)
             return redirect(url_for('todo'))

    logged_in = session.get('todo_logged_in', False)
    return render_template("todo.html", logged_in=logged_in)

### Notes Wall (polaroid guestbook)

import base64, hashlib, hmac, struct, threading, time, uuid
from flask import send_file

NOTES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "notes")
NOTES_DB = os.path.join(NOTES_DIR, "notes.json")
NOTES_IMG = os.path.join(NOTES_DIR, "img")
NOTES_LOCK = threading.Lock()
NOTE_COOLDOWN = 24 * 3600   # one note per device per day
NOTE_HIDE_AT = 3            # this many reports auto-hides a note until an admin reviews it
NOTES_PAGE_SIZE = 60
os.makedirs(NOTES_IMG, exist_ok=True)
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.getenv("NOTES_COOKIE_SECURE", "1") != "0"

def _db_load():
    try:
        with open(NOTES_DB, encoding="utf-8") as f:
            db = json.load(f)
    except (OSError, ValueError):
        db = {}
    db.setdefault("notes", [])
    db.setdefault("devices", {})   # device_id -> last note timestamp (cooldown)
    return db

def _db_save(db):
    tmp = NOTES_DB + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(db, f)
    os.replace(tmp, NOTES_DB)

def _device_id():
    session.permanent = True
    did = session.get("nid")
    if not did:
        did = uuid.uuid4().hex
        session["nid"] = did
    return did

def _clean(value, limit):
    value = re.sub(r"[\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e]", "", str(value or ""))
    return re.sub(r"\s+", " ", value).strip()[:limit]

def _valid_png(data):
    if len(data) > 300_000 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        return False
    w, h = struct.unpack(">II", data[16:24])
    return 0 < w <= 600 and 0 < h <= 600

def _public(n, admin=False):
    out = {k: n[k] for k in ("id", "text", "name", "created")}
    out["img"] = f"api/notes/{n['id']}.png" if n.get("img") else None
    if admin:
        out.update(status=n["status"], reports=len(n["reports"]))
    return out

def _find(db, nid):
    return next((n for n in db["notes"] if n["id"] == nid), None)

@app.route("/api/notes")
def notes_list():
    admin = bool(session.get("notes_admin"))
    device = _device_id()
    before = request.args.get("before")
    try:
        limit = min(max(int(request.args.get("limit", NOTES_PAGE_SIZE)), 1), 100)
    except ValueError:
        limit = NOTES_PAGE_SIZE

    with NOTES_LOCK:
        db = _db_load()
        notes = db["notes"]
        cooldown_started = db["devices"].get(device)

    shown = [n for n in notes if admin or n["status"] == "visible"]
    shown.sort(key=lambda n: n["created"], reverse=True)
    if before:
        shown = [n for n in shown if n["created"] < before]
    page = shown[:limit]

    cooldown_seconds = 0
    if cooldown_started:
        remaining = NOTE_COOLDOWN - (time.time() - cooldown_started)
        if remaining > 0:
            cooldown_seconds = int(remaining)

    return jsonify({
        "admin": admin,
        "notes": [_public(n, admin) for n in page],
        "has_more": len(shown) > limit,
        "cooldown_seconds": cooldown_seconds,
    })

@app.route("/api/notes", methods=["POST"])
def notes_create():
    if request.content_length and request.content_length > 400_000:
        return jsonify(error="That drawing is too big."), 413
    d = request.get_json(silent=True) or {}
    if d.get("website"): 
        return jsonify(ok=True)
    text, name = _clean(d.get("text"), 44), _clean(d.get("name"), 24)
    if not text:
        return jsonify(error="Write a caption first."), 400
    png = None
    if d.get("image"):
        try:
            png = base64.b64decode(str(d["image"]).split(",", 1)[-1], validate=True)
        except ValueError:
            return jsonify(error="Bad image."), 400
        if not _valid_png(png):
            return jsonify(error="Bad image."), 400

    device, now = _device_id(), time.time()
    with NOTES_LOCK:
        db = _db_load()
        db["devices"] = {k: t for k, t in db["devices"].items() if now - t < NOTE_COOLDOWN}
        if device in db["devices"]:
            hours = int((NOTE_COOLDOWN - (now - db["devices"][device])) // 3600) + 1
            return jsonify(error=f"You already left a note today. Come back in about {hours}h."), 429
        nid = uuid.uuid4().hex[:12]
        if png:
            with open(os.path.join(NOTES_IMG, nid + ".png"), "wb") as f:
                f.write(png)
        note = {"id": nid, "text": text, "name": name, "img": bool(png), "status": "visible",
                "reports": [], "created": datetime.now(timezone.utc).isoformat()}
        db["notes"].append(note)
        db["devices"][device] = now
        _db_save(db)
    return jsonify(_public(note)), 201

@app.route("/api/notes/<nid>.png")
def notes_image(nid):
    path = os.path.join(NOTES_IMG, nid + ".png")
    if not re.fullmatch(r"[0-9a-f]{12}", nid) or not os.path.isfile(path):
        abort(404)
    resp = send_file(path, mimetype="image/png", max_age=86400)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    return resp

@app.route("/api/notes/<nid>/report", methods=["POST"])
def notes_report(nid):
    device = _device_id()
    with NOTES_LOCK:
        db = _db_load()
        n = _find(db, nid)
        if not n:
            abort(404)
        if device not in n["reports"]:
            n["reports"].append(device)
        hidden_for_all = len(n["reports"]) >= NOTE_HIDE_AT
        if hidden_for_all:
            n["status"] = "hidden"
        _db_save(db)
    return jsonify(ok=True, hidden_for_all=hidden_for_all)

@app.route("/api/notes/admin", methods=["POST"])
def notes_admin():
    d = request.get_json(silent=True) or {}
    pw = os.getenv("NOTES_PASSWORD") or os.getenv("TODO_PASSWORD") or ""
    if pw and hmac.compare_digest(str(d.get("password", "")).encode(), pw.encode()):
        session["notes_admin"] = True
        return jsonify(ok=True)
    return jsonify(error="Wrong password."), 401

@app.route("/api/notes/<nid>", methods=["DELETE", "PATCH"])
def notes_moderate(nid):
    if not session.get("notes_admin"):
        return jsonify(error="Unauthorized"), 401
    with NOTES_LOCK:
        db = _db_load()
        n = _find(db, nid)
        if not n:
            abort(404)
        if request.method == "DELETE":
            db["notes"].remove(n)
            try:
                os.remove(os.path.join(NOTES_IMG, nid + ".png"))
            except OSError:
                pass
        else: 
            n["status"], n["reports"] = "visible", []
        _db_save(db)
    return jsonify(ok=True)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8085)