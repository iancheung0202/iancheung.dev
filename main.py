from __future__ import annotations

import base64
import functools
import hmac
import json
import os
import re
import shutil
import struct
import threading
import time
import uuid

from contextlib import suppress
from datetime import datetime, timedelta, timezone
from urllib.parse import quote
from urllib.request import Request, urlopen
from dotenv import load_dotenv
from flask import Flask, abort, jsonify, redirect, render_template, request, send_file, session, url_for

load_dotenv()

# Configuration

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SECRET_KEY_FILE = os.path.join(BASE_DIR, ".flask_secret")
TODO_FILE = "templates/todos.json"

ADMIN_SESSION_SECONDS = 24 * 3600
TRUSTED_PROXY_HOPS = 1

LOGIN_WINDOW = 15 * 60
LOGIN_MAX_PER_IP = 5
LOGIN_MAX_GLOBAL = 40

REPORT_WINDOW = 3600
REPORT_MAX_PER_IP = 30

FRONT_MATTER_RE = re.compile(r"\A\ufeff?---[ \t]*\r?\n(?:(.*?)\r?\n)?---[ \t]*(?:\r?\n|\Z)", re.S)
FOLDER_META_FILE = "_folder.md"
FOLDER_ICON_FILE = "_icon.png"
MAX_PAGE_CHARS = 300_000

NOTES_DIR = os.path.join(BASE_DIR, "notes")
NOTES_DB = os.path.join(NOTES_DIR, "notes.json")
NOTES_IMG = os.path.join(NOTES_DIR, "img")
NOTE_COOLDOWN = 24 * 3600  # one note per device per day
NOTES_PAGE_SIZE = 60

DISCORD_REPORT_WEBHOOK = os.getenv("DISCORD_REPORT_WEBHOOK")
DISCORD_PING_ID = os.getenv("DISCORD_USER_ID")

LOGIN_LOCK = threading.Lock()
NOTES_LOCK = threading.Lock()
login_fails: dict[str, list[float]] = {}  # ip -> failure timestamps
login_fails_all: list[float] = []  # every failure, any ip
report_hits: dict[str, list[float]] = {}  # ip -> report timestamps

os.makedirs(NOTES_IMG, exist_ok=True)


# Flask setup


app = Flask(__name__, static_url_path="", static_folder="static")
app.url_map.strict_slashes = False
app.secret_key = os.getenv("FLASK_SECRET_KEY").encode()
app.config.update(
    PERMANENT_SESSION_LIFETIME=timedelta(days=400),
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE="1" != "0",
    SESSION_COOKIE_HTTPONLY=True,
)

ABOUT_DIR = os.path.join(app.static_folder, "about")


# Shared helpers


def clean_text(value: object, limit: int) -> str:
    value = re.sub(r"[\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e]", "", str(value or ""))
    return re.sub(r"\s+", " ", value).strip()[:limit]


def decode_base64(value: object) -> bytes | None:
    try:
        return base64.b64decode(str(value).split(",", 1)[-1], validate=True)
    except ValueError:
        return None


def valid_png(data: bytes, max_dim: int = 600) -> bool:
    if len(data) > 300_000 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        return False
    width, height = struct.unpack(">II", data[16:24])
    return 0 < width <= max_dim and 0 < height <= max_dim


def write_atomic(path: str, text: str) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    os.replace(tmp, path)


def client_ip() -> str:
    if TRUSTED_PROXY_HOPS > 0:
        hops = [p.strip() for p in request.headers.get("X-Forwarded-For", "").split(",") if p.strip()]
        if len(hops) >= TRUSTED_PROXY_HOPS:
            return hops[-TRUSTED_PROXY_HOPS]
    return request.remote_addr or "unknown"


# Admin authentication


PASSWORD = os.getenv("PASSWORD")


def admin_fingerprint() -> str:
    return hmac.new(app.secret_key, b"admin:" + PASSWORD.encode(), "sha256").hexdigest()


def is_admin() -> bool:
    if not PASSWORD:
        return False
    try:
        expires = float(session.get("admin_exp", 0))
    except (TypeError, ValueError):
        return False
    if expires < time.time():
        return False
    return hmac.compare_digest(str(session.get("admin_fp", "")), admin_fingerprint())


def admin_required(view):
    @functools.wraps(view)
    def wrapper(*args, **kwargs):
        if not is_admin():
            return jsonify(error="Unauthorized"), 401
        return view(*args, **kwargs)

    return wrapper


def login_blocked(ip: str, now: float) -> bool:
    login_fails[ip] = [t for t in login_fails.get(ip, []) if now - t < LOGIN_WINDOW]
    login_fails_all[:] = [t for t in login_fails_all if now - t < LOGIN_WINDOW]
    return len(login_fails[ip]) >= LOGIN_MAX_PER_IP or len(login_fails_all) >= LOGIN_MAX_GLOBAL


@app.route("/api/admin/status")
def admin_status():
    return jsonify(admin=is_admin())


@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json(silent=True) or {}
    password = PASSWORD
    ip, now = client_ip(), time.time()
    with LOGIN_LOCK:
        if login_blocked(ip, now):
            return jsonify(error="Too many attempts. Try again in a few minutes."), 429
    supplied = str(data.get("password", ""))
    if password and hmac.compare_digest(supplied.encode(), password.encode()):
        with LOGIN_LOCK:
            login_fails.pop(ip, None)
        session.permanent = True
        session["admin_exp"] = now + ADMIN_SESSION_SECONDS
        session["admin_fp"] = admin_fingerprint()
        return jsonify(ok=True)
    with LOGIN_LOCK:
        login_fails.setdefault(ip, []).append(now)
        login_fails_all.append(now)
    time.sleep(0.5)
    return jsonify(error="Wrong password."), 401


@app.route("/api/admin/logout", methods=["POST"])
def admin_logout():
    session.pop("admin_exp", None)
    session.pop("admin_fp", None)
    return jsonify(ok=True)


# Request hooks and error pages 


@app.before_request
def api_write_guard():
    if request.path.startswith("/api/") and request.method not in ("GET", "HEAD", "OPTIONS"):
        if request.headers.get("X-Requested-With") != "fetch":
            return jsonify(error="Bad request."), 400


@app.before_request
def block_backend_files():
    if request.path == "/jamie/main.py":
        abort(404)


@app.after_request
def api_no_store(response):
    if request.path.startswith("/api/") and response.mimetype == "application/json":
        response.headers["Cache-Control"] = "private, no-store"
        response.headers["Vary"] = "Cookie"
    return response


for status in (401, 403, 404, 500):
    app.register_error_handler(status, lambda _error, status=status: (render_template(f"{status}.html"), status))


### Static pages


@app.route("/")
def home():
    return app.send_static_file("index.html")


@app.route("/pricing/")
def pricing_page():
    return app.send_static_file("pricing.html")


@app.route("/class/")
def grade_page():
    return render_template("class.html")




### Class pages


CLASS_DIR = os.path.join(app.static_folder, "class")


def class_url(*parts: str) -> str:
    return "/class/" + "/".join(quote(part) for part in parts)


def class_file_names(folder_path: str) -> list[str]:
    return [
        name
        for name in os.listdir(folder_path)
        if not name.startswith(("_", ".")) and os.path.isfile(os.path.join(folder_path, name))
    ]


@app.route("/api/class")
def class_tree():
    folders = []

    for folder in list_folders(CLASS_DIR):
        folder_path = os.path.join(CLASS_DIR, folder)
        pages = []
        for filename in class_file_names(folder_path):
            file_path = os.path.join(folder_path, filename)
            pages.append(
                {
                    "key": f"{folder}/{filename}",
                    "title": filename,
                    "url": class_url(folder, filename),
                    "updated": datetime.fromtimestamp(os.path.getmtime(file_path), tz=timezone.utc).isoformat(),
                }
            )

        if not pages:
            continue 
        pages.sort(key=lambda p: p["title"].lower())

        folder_meta = read_front_matter(os.path.join(folder_path, FOLDER_META_FILE))
        folders.append(
            {
                "id": folder,
                "label": folder_meta.get("label") or folder.replace("-", " ").replace("_", " "),
                "icon": resolve_icon(CLASS_DIR, class_url, folder, folder_meta.get("icon")),
                "order": parse_order(folder_meta.get("order")),
                "pages": pages,
            }
        )

    folders.sort(key=lambda f: (f["order"], f["label"].lower()))
    return jsonify({"folders": folders})


### Story pages


def read_front_matter(path: str) -> dict[str, str]:
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            head = f.read(16384)
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
            quote_char, value = value[0], value[1:-1]
            if quote_char == '"': 
                value = value.replace('\\"', '"').replace("\\\\", "\\")
        meta[key.strip().lower()] = value
    return meta


def parse_order(value: str | None) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 9999


def about_url(*parts: str) -> str:
    return "about/" + "/".join(quote(part) for part in parts)


def resolve_icon(base_dir: str, url_builder, folder: str, icon: str | None) -> str | None:
    if not icon:
        return None
    if icon.startswith(("http://", "https://", "/")):
        return icon
    local = os.path.join(base_dir, folder, icon)
    if os.path.isfile(local):
        return f"{url_builder(folder, icon)}?v={int(os.path.getmtime(local))}"
    return None


def resolve_folder_icon(folder: str, icon: str | None) -> str | None:
    return resolve_icon(ABOUT_DIR, about_url, folder, icon)


def list_folders(base_dir: str) -> list[str]:
    if not os.path.isdir(base_dir):
        return []
    return [
        name
        for name in os.listdir(base_dir)
        if not name.startswith((".", "_")) and os.path.isdir(os.path.join(base_dir, name))
    ]


def folder_names() -> list[str]:
    return list_folders(ABOUT_DIR)


def page_filenames(folder_path: str) -> list[str]:
    return [
        name
        for name in os.listdir(folder_path)
        if name.endswith(".md")
        and not name.startswith(("_", "."))
        and os.path.isfile(os.path.join(folder_path, name))
    ]


@app.route("/api/about")
def about_tree():
    admin = is_admin()
    folders = []

    for folder in folder_names():
        folder_path = os.path.join(ABOUT_DIR, folder)
        pages = []
        for filename in page_filenames(folder_path):
            file_path = os.path.join(folder_path, filename)
            slug = filename[:-3]
            meta = read_front_matter(file_path)
            pages.append(
                {
                    "key": f"{folder}/{slug}",
                    "slug": slug,
                    "title": meta.get("title") or slug.replace("-", " "),
                    "order": parse_order(meta.get("order")),
                    "url": about_url(folder, filename),
                    "updated": datetime.fromtimestamp(os.path.getmtime(file_path), tz=timezone.utc).isoformat(),
                }
            )

        if not pages and not admin:
            continue  # empty folders are only visible to the admin
        pages.sort(key=lambda p: (p["order"], p["title"].lower()))

        folder_meta = read_front_matter(os.path.join(folder_path, FOLDER_META_FILE))
        folders.append(
            {
                "id": folder,
                "label": folder_meta.get("label") or folder.replace("-", " ").replace("_", " "),
                "icon": resolve_folder_icon(folder, folder_meta.get("icon")),
                "order": parse_order(folder_meta.get("order")),
                "pages": pages,
            }
        )

    folders.sort(key=lambda f: (f["order"], f["label"].lower()))
    return jsonify({"folders": folders, "admin": admin})


def slugify(text: str | None, fallback: str = "page") -> str:
    text = re.sub(r"[^\w\s-]", "", (text or "").strip().lower(), flags=re.UNICODE)
    text = re.sub(r"[\s_]+", "-", text).strip("-")
    return text or fallback


def safe_name(name: object) -> bool:
    return (
        isinstance(name, str)
        and 0 < len(name) <= 120
        and name not in (".", "..")
        and not name.startswith((".", "_"))
        and not re.search(r"[\x00-\x1f/\\]", name)
    )


def folder_dir(folder: object) -> str | None:
    if not safe_name(folder):
        return None
    path = os.path.join(ABOUT_DIR, folder)
    return path if os.path.isdir(path) else None


def page_path(folder_path: str | None, slug: object) -> str | None:
    if not folder_path or not safe_name(slug):
        return None
    path = os.path.join(folder_path, slug + ".md")
    return path if os.path.isfile(path) else None


def split_markdown(path: str) -> tuple[dict[str, str], str]:
    meta = read_front_matter(path)
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            body = FRONT_MATTER_RE.sub("", f.read(), count=1)
    except OSError:
        body = ""
    return meta, body.lstrip("\n") 


def write_markdown(path: str, meta: dict, body: str) -> None:
    lines = ["---"]
    for key, value in meta.items():
        if value is None or value == "":
            continue
        value = str(value)
        if re.search(r'[:#"\']', value) or value != value.strip():
            value = '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'
        lines.append(f"{key}: {value}")
    lines.append("---")
    write_atomic(path, "\n".join(lines) + "\n\n" + (body or "").lstrip("\n"))


def rewrite_meta(path: str, meta: dict) -> None:
    stat = os.stat(path) if os.path.isfile(path) else None
    body = split_markdown(path)[1] if stat else ""
    write_markdown(path, meta, body)
    if stat:
        os.utime(path, (stat.st_atime, stat.st_mtime))


def next_slug(folder_path: str, base: str) -> str:
    slug, n = base, 2
    while os.path.exists(os.path.join(folder_path, slug + ".md")):
        slug = f"{base}-{n}"
        n += 1
    return slug


def sorted_pages(folder_path: str) -> list[tuple[str, dict, str]]:
    items = []
    for filename in page_filenames(folder_path):
        path = os.path.join(folder_path, filename)
        items.append((path, read_front_matter(path), filename[:-3]))
    items.sort(key=lambda t: (parse_order(t[1].get("order")), (t[1].get("title") or t[2]).lower()))
    return items


def sorted_folders() -> list[tuple[str, dict, str]]:
    items = []
    for folder in folder_names():
        meta_path = os.path.join(ABOUT_DIR, folder, FOLDER_META_FILE)
        items.append((meta_path, read_front_matter(meta_path), folder))
    items.sort(key=lambda t: (parse_order(t[1].get("order")), (t[1].get("label") or t[2]).lower()))
    return items


def renumber(items: list[tuple[str, dict, str]]) -> None:
    for position, (path, meta, _) in enumerate(items):
        if os.path.isfile(path) and str(meta.get("order", "")) == str(position):
            continue
        meta["order"] = position
        rewrite_meta(path, meta)


def move_item(items: list[tuple[str, dict, str]], name: str, direction: object) -> bool:
    names = [item[2] for item in items]
    if name not in names:
        return False
    i = names.index(name)
    j = i - 1 if direction == "up" else i + 1 if direction == "down" else i
    if 0 <= j < len(items):
        items[i], items[j] = items[j], items[i]
    renumber(items)
    return True


@app.route("/api/about/folders", methods=["POST"])
@admin_required
def about_create_folder():
    data = request.get_json(silent=True) or {}
    label = clean_text(data.get("label"), 60)
    if not label:
        return jsonify(error="Folder needs a name."), 400
    base = slugify(label, fallback="folder")
    folder, n = base, 2
    while os.path.exists(os.path.join(ABOUT_DIR, folder)):
        folder = f"{base}-{n}"
        n += 1
    position = len(folder_names())
    folder_path = os.path.join(ABOUT_DIR, folder)
    os.makedirs(folder_path, exist_ok=True)
    write_markdown(os.path.join(folder_path, FOLDER_META_FILE), {"label": label, "order": position}, "")
    return jsonify(ok=True, id=folder), 201


@app.route("/api/about/folders/<folder>", methods=["PUT"])
@admin_required
def about_update_folder(folder):
    folder_path = folder_dir(folder)
    if not folder_path:
        abort(404)
    data = request.get_json(silent=True) or {}
    meta_path = os.path.join(folder_path, FOLDER_META_FILE)
    meta = read_front_matter(meta_path)
    if "label" in data:
        label = clean_text(data["label"], 60)
        if not label:
            return jsonify(error="Folder needs a name."), 400
        meta["label"] = label
    write_markdown(meta_path, meta, "")
    return jsonify(ok=True)


@app.route("/api/about/folders/<folder>/icon", methods=["POST"])
@admin_required
def about_folder_icon(folder):
    folder_path = folder_dir(folder)
    if not folder_path:
        abort(404)
    image = (request.get_json(silent=True) or {}).get("image")
    meta_path = os.path.join(folder_path, FOLDER_META_FILE)
    icon_path = os.path.join(folder_path, FOLDER_ICON_FILE)
    meta = read_front_matter(meta_path)

    if image is None:  # remove the icon
        meta.pop("icon", None)
        write_markdown(meta_path, meta, "")
        with suppress(OSError):
            os.remove(icon_path)
        return jsonify(ok=True)

    png = decode_base64(image)
    if png is None:
        return jsonify(error="Bad image."), 400
    if not valid_png(png, max_dim=512):
        return jsonify(error="Bad image. Use a PNG under 300KB and 512x512."), 400
    with open(icon_path, "wb") as f:
        f.write(png)
    meta["icon"] = FOLDER_ICON_FILE
    write_markdown(meta_path, meta, "")
    return jsonify(ok=True)


@app.route("/api/about/folders/<folder>/move", methods=["POST"])
@admin_required
def about_move_folder(folder):
    direction = (request.get_json(silent=True) or {}).get("direction")
    if not move_item(sorted_folders(), folder, direction):
        abort(404)
    return jsonify(ok=True)


@app.route("/api/about/folders/<folder>", methods=["DELETE"])
@admin_required
def about_delete_folder(folder):
    folder_path = folder_dir(folder)
    if not folder_path:
        abort(404)
    shutil.rmtree(folder_path, ignore_errors=True)
    renumber(sorted_folders())
    return jsonify(ok=True)


@app.route("/api/about/folders/<folder>/pages", methods=["POST"])
@admin_required
def about_create_page(folder):
    folder_path = folder_dir(folder)
    if not folder_path:
        abort(404)
    data = request.get_json(silent=True) or {}
    title = clean_text(data.get("title"), 120)
    content = str(data.get("content") or "")
    if not title:
        return jsonify(error="Page needs a title."), 400
    if len(content) > MAX_PAGE_CHARS:
        return jsonify(error="That page is too long."), 413
    slug = next_slug(folder_path, slugify(title))
    write_markdown(os.path.join(folder_path, slug + ".md"), {"title": title, "order": len(page_filenames(folder_path))}, content)
    return jsonify(ok=True, key=f"{folder}/{slug}"), 201


@app.route("/api/about/folders/<folder>/pages/<slug>")
@admin_required
def about_get_page(folder, slug):
    path = page_path(folder_dir(folder), slug)
    if not path:
        abort(404)
    meta, body = split_markdown(path)
    return jsonify(title=meta.get("title") or slug.replace("-", " "), content=body, key=f"{folder}/{slug}")


@app.route("/api/about/folders/<folder>/pages/<slug>", methods=["PUT"])
@admin_required
def about_update_page(folder, slug):
    path = page_path(folder_dir(folder), slug)
    if not path:
        abort(404)
    data = request.get_json(silent=True) or {}
    meta, body = split_markdown(path)
    if "title" in data:
        title = clean_text(data["title"], 120)
        if not title:
            return jsonify(error="Page needs a title."), 400
        meta["title"] = title
    if data.get("content") is not None:
        body = str(data["content"])
        if len(body) > MAX_PAGE_CHARS:
            return jsonify(error="That page is too long."), 413
    write_markdown(path, meta, body)
    return jsonify(ok=True)


@app.route("/api/about/folders/<folder>/pages/<slug>", methods=["DELETE"])
@admin_required
def about_delete_page(folder, slug):
    folder_path = folder_dir(folder)
    path = page_path(folder_path, slug)
    if not path:
        abort(404)
    try:
        os.remove(path)
    except OSError:
        abort(404)
    renumber(sorted_pages(folder_path))
    return jsonify(ok=True)


@app.route("/api/about/folders/<folder>/pages/<slug>/move", methods=["POST"])
@admin_required
def about_move_page(folder, slug):
    folder_path = folder_dir(folder)
    if not folder_path:
        abort(404)
    direction = (request.get_json(silent=True) or {}).get("direction")
    if not move_item(sorted_pages(folder_path), slug, direction):
        abort(404)
    return jsonify(ok=True)


@app.route("/api/about/folders/<folder>/pages/<slug>/relocate", methods=["POST"])
@admin_required
def about_relocate_page(folder, slug):
    src_dir = folder_dir(folder)
    src = page_path(src_dir, slug)
    target = (request.get_json(silent=True) or {}).get("folder")
    dst_dir = folder_dir(target)
    if not src or not dst_dir:
        abort(404)
    if os.path.samefile(src_dir, dst_dir):
        return jsonify(ok=True, key=f"{folder}/{slug}")
    new_slug = next_slug(dst_dir, slug)
    position = len(page_filenames(dst_dir))
    dst = os.path.join(dst_dir, new_slug + ".md")
    shutil.move(src, dst)  # rename on the same filesystem, so mtime is kept
    meta = read_front_matter(dst)
    meta["order"] = position
    rewrite_meta(dst, meta)
    renumber(sorted_pages(src_dir))
    return jsonify(ok=True, key=f"{target}/{new_slug}")


# Todo list


def load_todos() -> list:
    try:
        with open(TODO_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, ValueError):
        return []


@app.route("/todo", methods=["GET", "POST"])
def todo():
    if request.method == "POST":
        if request.is_json:
            if not session.get("todo_logged_in"):
                return jsonify({"error": "Unauthorized"}), 401
            data = request.get_json()
            if data.get("action") == "get":
                return jsonify(load_todos())
            if data.get("action") == "save":
                new_todos = data.get("todos")
                if new_todos is not None:
                    with open(TODO_FILE, "w", encoding="utf-8") as f:
                        json.dump(new_todos, f)
                return jsonify({"status": "ok"})
            return jsonify({"error": "Invalid action"}), 400

        password = request.form.get("password")
        if password:
            if password != os.getenv("PASSWORD"):
                return render_template("todo.html", error="Incorrect Password", logged_in=False)
            session["todo_logged_in"] = True
            return redirect(url_for("todo"))

        if request.form.get("logout"):
            session.pop("todo_logged_in", None)
            return redirect(url_for("todo"))

    return render_template("todo.html", logged_in=session.get("todo_logged_in", False))


### Notes section


def load_db() -> dict:
    try:
        with open(NOTES_DB, encoding="utf-8") as f:
            db = json.load(f)
    except (OSError, ValueError):
        db = {}
    db.setdefault("notes", [])
    db.setdefault("devices", {})  # device id -> last note timestamp (cooldown)
    for note in db["notes"]:
        note.pop("status", None)
        note.setdefault("pinned", False)
        note.setdefault("reports", [])
    return db


def save_db(db: dict) -> None:
    write_atomic(NOTES_DB, json.dumps(db))


def get_device_id() -> str:
    session.permanent = True
    device = session.get("nid")
    if not device:
        device = uuid.uuid4().hex
        session["nid"] = device
    return device


def image_path(note_id: str) -> str:
    return os.path.join(NOTES_IMG, note_id + ".png")


def find_note(db: dict, note_id: str) -> dict | None:
    return next((n for n in db["notes"] if n["id"] == note_id), None)


def public_note(note: dict, admin: bool = False) -> dict:
    out = {
        "id": note["id"],
        "text": note["text"],
        "name": note["name"],
        "created": note["created"],
        "img": f"api/notes/{note['id']}.png" if note.get("img") else None,
        "pinned": bool(note.get("pinned")),
    }
    if admin:
        out["reports"] = len(note.get("reports", []))
    return out


def report_limited(ip: str) -> bool:
    now = time.time()
    hits = [t for t in report_hits.get(ip, []) if now - t < REPORT_WINDOW]
    limited = len(hits) >= REPORT_MAX_PER_IP
    if not limited:
        hits.append(now)
    report_hits[ip] = hits
    return limited


@app.route("/api/notes")
def notes_list():
    admin = is_admin()
    device = get_device_id()
    offset = max(request.args.get("offset", 0, type=int), 0)
    limit = min(max(request.args.get("limit", NOTES_PAGE_SIZE, type=int), 1), 100)

    with NOTES_LOCK:
        db = load_db()
    notes = db["notes"]

    notes.sort(key=lambda n: n["created"], reverse=True)
    notes.sort(key=lambda n: not n.get("pinned"))

    cooldown_started = db["devices"].get(device)
    cooldown_seconds = 0
    if cooldown_started:
        cooldown_seconds = max(int(NOTE_COOLDOWN - (time.time() - cooldown_started)), 0)

    return jsonify(
        {
            "admin": admin,
            "notes": [public_note(n, admin) for n in notes[offset : offset + limit]],
            "has_more": offset + limit < len(notes),
            "cooldown_seconds": cooldown_seconds,
        }
    )


@app.route("/api/notes", methods=["POST"])
def notes_create():
    if request.content_length and request.content_length > 400_000:
        return jsonify(error="That drawing is too big."), 413
    data = request.get_json(silent=True) or {}
    if data.get("website"):
        return jsonify(ok=True)  # honeypot
    text, name = clean_text(data.get("text"), 44), clean_text(data.get("name"), 24)
    if not text:
        return jsonify(error="Write a caption first."), 400
    png = None
    if data.get("image"):
        png = decode_base64(data["image"])
        if png is None or not valid_png(png):
            return jsonify(error="Bad image."), 400

    admin = is_admin()
    device = get_device_id()
    now = time.time()
    with NOTES_LOCK:
        db = load_db()
        db["devices"] = {k: t for k, t in db["devices"].items() if now - t < NOTE_COOLDOWN}
        if device in db["devices"] and not admin:  # the admin isn't rate limited (matches the UI)
            hours = int((NOTE_COOLDOWN - (now - db["devices"][device])) // 3600) + 1
            return jsonify(error=f"You already left a note today. Come back in about {hours}h."), 429
        note_id = uuid.uuid4().hex[:12]
        if png:
            with open(image_path(note_id), "wb") as f:
                f.write(png)
        note = {
            "id": note_id,
            "text": text,
            "name": name,
            "img": bool(png),
            "pinned": False,
            "created": datetime.now(timezone.utc).isoformat(),
            "device": device,
            "ip": client_ip(),
            "ua": request.headers.get("User-Agent", "")[:400],
            "reports": [],
        }
        db["notes"].append(note)
        if not admin:
            db["devices"][device] = now
        save_db(db)
    return jsonify(public_note(note)), 201


@app.route("/api/notes/<nid>.png")
def notes_image(nid):
    path = image_path(nid)
    if not re.fullmatch(r"[0-9a-f]{12}", nid) or not os.path.isfile(path):
        abort(404)
    response = send_file(path, mimetype="image/png", max_age=86400)
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.route("/api/notes/<nid>/report", methods=["POST"])
def notes_report(nid):
    ip = client_ip()
    if report_limited(ip):
        return jsonify(error="Too many reports. Try again later."), 429
    device = get_device_id()
    with NOTES_LOCK:
        db = load_db()
        note = find_note(db, nid)
        if not note:
            abort(404)
        repeat = device in note["reports"]
        if not repeat:
            note["reports"].append(device)
            save_db(db)
        author = note.get("device")
        author_notes = [m for m in db["notes"] if author and m.get("device") == author]
        ctx = {
            "reporter_device": device,
            "reporter_ip": ip,
            "reporter_ua": request.headers.get("User-Agent", ""),
            "reporter_lang": request.headers.get("Accept-Language", ""),
            "reporter_referer": request.headers.get("Referer", ""),
            "site_url": request.host_url,
            "repeat": repeat,
            "report_count": len(note["reports"]),
            "reporter_total_reports": sum(device in m.get("reports", []) for m in db["notes"]),
            "reporter_is_author": author == device,
            "author_note_count": len(author_notes),
            "author_total_reports": sum(len(m.get("reports", [])) for m in author_notes),
            "image_bytes": None,
        }
    if note.get("img"):
        with suppress(OSError), open(image_path(nid), "rb") as f:
            ctx["image_bytes"] = f.read()
    if not repeat:  # a device re-reporting the same note doesn't re-ping you
        send_report_webhook(note, ctx)
    return jsonify(ok=True)


@app.route("/api/notes/<nid>", methods=["DELETE", "PATCH"])
@admin_required
def notes_moderate(nid):
    with NOTES_LOCK:
        db = load_db()
        note = find_note(db, nid)
        if not note:
            abort(404)
        if request.method == "DELETE":
            db["notes"].remove(note)
            with suppress(OSError):
                os.remove(image_path(nid))
        else:
            action = (request.get_json(silent=True) or {}).get("action")
            if action not in ("pin", "unpin"):
                return jsonify(error="Invalid action"), 400
            note["pinned"] = action == "pin"
        save_db(db)
    return jsonify(ok=True)


### Discord report webhook


def trim(value: object, limit: int) -> str:
    value = str(value or "")
    return value if len(value) <= limit else value[: limit - 1] + "…"


def discord_timestamp(iso: str | None) -> str:
    try:
        unix = int(datetime.fromisoformat(iso).timestamp())
    except (TypeError, ValueError):
        return trim(iso or "unknown", 100)
    return f"<t:{unix}:F> (<t:{unix}:R>)"


def encode_multipart(fields: dict, files: dict) -> tuple[bytes, str]:
    boundary = "----report" + uuid.uuid4().hex
    parts = []
    for name, value in fields.items():
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n'
            f"Content-Type: application/json\r\n\r\n{value}\r\n".encode()
        )
    for name, (filename, data, content_type) in files.items():
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; '
            f'filename="{filename}"\r\nContent-Type: {content_type}\r\n\r\n'.encode()
            + data
            + b"\r\n"
        )
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def field(name: str, value: object, inline: bool = True) -> dict:
    return {"name": name, "value": str(value), "inline": inline}


def build_report_payload(note: dict, ctx: dict) -> dict:
    has_img = bool(ctx.get("image_bytes"))
    note_text = trim((note.get("text") or "(empty)").replace("```", "'''"), 500)
    reporter_is_author = "**yes, reported their own note**" if ctx["reporter_is_author"] else "no"
    repeat = "yes (same device already reported this)" if ctx["repeat"] else "no, first from this device"

    note_embed = {
        "title": "🚩 Note reported",
        "url": ctx["site_url"] + "#notes",
        "color": 0xE5484D,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "description": f"**Note text**\n```\n{note_text}\n```",
        "fields": [
            field("Note ID", f"`{note['id']}`"),
            field("Unique reports", ctx["report_count"]),
            field("Pinned", "yes" if note.get("pinned") else "no"),
            field("Signed as", trim(note.get("name") or "_anonymous_", 100)),
            field("Has drawing", "yes" if has_img else "no"),
            field("Posted", discord_timestamp(note.get("created")), inline=False),
        ],
    }
    if has_img:
        note_embed["image"] = {"url": "attachment://note.png"}

    reporter_embed = {
        "title": "👤 Reporting user",
        "color": 0xF5A524,
        "fields": [
            field("Device ID", f"`{ctx['reporter_device']}`", inline=False),
            field("IP", f"`{trim(ctx['reporter_ip'], 100)}`"),
            field("Language", trim(ctx.get("reporter_lang") or "unknown", 100)),
            field("Reports filed (all notes)", ctx["reporter_total_reports"]),
            field("Is the note's author?", reporter_is_author),
            field("Repeat report", repeat),
            field("Referrer", trim(ctx.get("reporter_referer") or "none", 300), inline=False),
            field("User agent", trim(ctx.get("reporter_ua") or "unknown", 400), inline=False),
        ],
    }

    if note.get("device"):
        author_fields = [
            field("Device ID", f"`{note['device']}`", inline=False),
            field("IP at posting", f"`{trim(note.get('ip') or 'unknown', 100)}`"),
            field("Notes on the wall", ctx["author_note_count"]),
            field("Reports on all their notes", ctx["author_total_reports"]),
            field("User agent at posting", trim(note.get("ua") or "unknown", 400), inline=False),
        ]
    else:
        author_fields = [field("Device ID", "unknown (posted before author tracking)", inline=False)]
    author_embed = {"title": "📝 Reported user (note author)", "color": 0x2B7FFF, "fields": author_fields}

    return {
        "content": f"<@{DISCORD_PING_ID}> a note was just reported.",
        "allowed_mentions": {"users": [DISCORD_PING_ID]},
        "embeds": [note_embed, reporter_embed, author_embed],
        "attachments": [{"id": 0, "filename": "note.png"}] if has_img else [],
    }


def send_report_webhook(note: dict, ctx: dict) -> None:
    if not DISCORD_REPORT_WEBHOOK:
        app.logger.warning("DISCORD_REPORT_WEBHOOK is not set; skipping report notification.")
        return

    def worker() -> None:
        try:
            files = {}
            if ctx.get("image_bytes"):
                files["files[0]"] = ("note.png", ctx["image_bytes"], "image/png")
            body, content_type = encode_multipart({"payload_json": json.dumps(build_report_payload(note, ctx))}, files)
            req = Request(
                DISCORD_REPORT_WEBHOOK,
                data=body,
                headers={
                    "Content-Type": content_type,
                    "User-Agent": "NotesReportBot (https://www.iancheung.dev, 1.0)",
                },
                method="POST",
            )
            urlopen(req, timeout=8).close()
        except Exception as exc:
            app.logger.warning("Discord report webhook failed: %s", exc)

    threading.Thread(target=worker, daemon=True).start()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8085)