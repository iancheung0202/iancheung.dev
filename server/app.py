from __future__ import annotations

import base64
import functools
import hmac
import json
import os
import re
import shutil
import struct
import subprocess
import threading
import time
import urllib.error
import urllib.request
import uuid
from contextlib import suppress
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from dotenv import load_dotenv
from flask import (
    Flask,
    abort,
    jsonify,
    redirect,
    render_template,
    request,
    send_file,
    send_from_directory,
    session,
    url_for,
)

load_dotenv()


# Repo layout: content/ (markdown), public/ (zola build output), data/ (runtime state)
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
CONTENT_DIR = os.path.join(ROOT_DIR, "content")
DATA_DIR = os.path.join(ROOT_DIR, "data")
SECRET_KEY_FILE = os.path.join(DATA_DIR, ".flask_secret")
TODO_FILE = os.path.join(DATA_DIR, "todos.json")

ADMIN_SESSION_SECONDS = 24 * 3600
TRUSTED_PROXY_HOPS = 1

LOGIN_WINDOW = 15 * 60
LOGIN_MAX_PER_IP = 5
LOGIN_MAX_GLOBAL = 40

MAX_PAGE_CHARS = 300_000

NOTES_DIR = os.path.join(DATA_DIR, "notes")
NOTES_DB = os.path.join(NOTES_DIR, "notes.json")
NOTES_IMG = os.path.join(NOTES_DIR, "img")
NOTES_PAGE_SIZE = 60

ACCESS_STEP_SECONDS = 60
ACCESS_TICKET_TTL = 30 * 60  # 30 minutes to post after entering code

LOGIN_LOCK = threading.Lock()
NOTES_LOCK = threading.Lock()
ACCESS_LOCK = threading.Lock()
login_fails: dict[str, list[float]] = {}  # ip -> failure timestamps
login_fails_all: list[float] = []  # every failure, any ip
access_bump = 0
access_bump_time = time.time()
access_tickets: dict[str, float] = {}

os.makedirs(NOTES_IMG, exist_ok=True)  # also creates data/

app = Flask(__name__, static_folder=None)
app.url_map.strict_slashes = False
app.secret_key = os.getenv("FLASK_SECRET_KEY").encode()
app.config.update(
    PERMANENT_SESSION_LIFETIME=timedelta(days=400),
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE="1" != "0",
    SESSION_COOKIE_HTTPONLY=True,
)


def clean_text(value: object, limit: int) -> str:
    value = re.sub(r"[\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e]", "", str(value or ""))
    return re.sub(r"\s+", " ", value).strip()[:limit]


def clean_url(value: object) -> str:
    """An optional website for a note: http(s) only, with a real host, or empty."""
    raw = clean_text(value, 200)
    if not raw:
        return ""
    if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", raw):
        raw = "https://" + raw
    parts = urllib.parse.urlsplit(raw)
    host = parts.hostname or ""
    if parts.scheme not in ("http", "https") or "." not in host or " " in raw:
        return ""
    return urllib.parse.urlunsplit(parts)


def decode_base64(value: object) -> bytes | None:
    try:
        return base64.b64decode(str(value).split(",", 1)[-1], validate=True)
    except ValueError:
        return None


def valid_png(data: bytes, max_dim: int = 600) -> bool:
    if (
        len(data) > 300_000
        or data[:8] != b"\x89PNG\r\n\x1a\n"
        or data[12:16] != b"IHDR"
    ):
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
        hops = [
            p.strip()
            for p in request.headers.get("X-Forwarded-For", "").split(",")
            if p.strip()
        ]
        if len(hops) >= TRUSTED_PROXY_HOPS:
            return hops[-TRUSTED_PROXY_HOPS]
    return request.remote_addr or "unknown"


PASSWORD = os.getenv("PASSWORD")

# "Message @iancheung.dev" on the home card: visitors sign in with Discord
# (identify scope only), then the text goes to a webhook in a private channel.
DISCORD_CLIENT_ID = os.getenv("DISCORD_CLIENT_ID", "1525674572102238248")
DISCORD_CLIENT_SECRET = os.getenv("DISCORD_CLIENT_SECRET", "")
MESSAGE_WEBHOOK_URL = os.getenv("MESSAGE_WEBHOOK_URL", "")
MESSAGE_MENTION_ID = os.environ.get(
    "MESSAGE_MENTION_ID", "692254240290242601"
)  # who gets pinged: Ian
MESSAGE_MAX_CHARS = 500
MESSAGE_WINDOW = 10 * 60
MESSAGE_MAX_PER_USER = 20
MESSAGE_MAX_PER_IP = 40
message_sent: dict[str, list[float]] = {}
MESSAGE_LOCK = threading.Lock()


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
    return (
        len(login_fails[ip]) >= LOGIN_MAX_PER_IP
        or len(login_fails_all) >= LOGIN_MAX_GLOBAL
    )


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


def access_touch(now: float) -> None:
    global access_bump, access_bump_time
    elapsed = now - access_bump_time
    if elapsed >= ACCESS_STEP_SECONDS:
        windows = int(elapsed // ACCESS_STEP_SECONDS)
        access_bump += windows
        access_bump_time += windows * ACCESS_STEP_SECONDS


def access_code(generation: int) -> str:
    digest = hmac.new(
        app.secret_key, f"wall-access:{generation}".encode(), "sha256"
    ).digest()
    return f"{int.from_bytes(digest[:4], 'big') % 1_000_000:06d}"


def access_seconds_left(now: float) -> int:
    return int(ACCESS_STEP_SECONDS - (now - access_bump_time))


def purge_tickets(now: float) -> None:
    for ticket, expires in list(access_tickets.items()):
        if expires < now:
            access_tickets.pop(ticket, None)


def consume_ticket(ticket: str) -> bool:
    now = time.time()
    with ACCESS_LOCK:
        purge_tickets(now)
        if ticket and ticket in access_tickets:
            access_tickets.pop(ticket, None)
            return True
    return False


@app.route("/api/notes/access", methods=["POST"])
def notes_access():
    global access_bump, access_bump_time
    data = request.get_json(silent=True) or {}
    code = re.sub(r"\D", "", str(data.get("code", "")))
    if len(code) != 6:
        return jsonify(error="Enter all 6 digits."), 400
    now = time.time()
    with ACCESS_LOCK:
        access_touch(now)
        if not hmac.compare_digest(code, access_code(access_bump)):
            return jsonify(error="Invalid code. Ask for a new one."), 401
        access_bump += 1
        access_bump_time = now
        purge_tickets(now)
        ticket = uuid.uuid4().hex
        access_tickets[ticket] = now + ACCESS_TICKET_TTL
    return jsonify(ok=True, ticket=ticket)


@app.route("/api/admin/wall-code")
@admin_required
def admin_wall_code():
    now = time.time()
    with ACCESS_LOCK:
        access_touch(now)
        code = access_code(access_bump)
    return jsonify(code=code, seconds_left=access_seconds_left(now))


@app.route("/api/admin/wall-code/regenerate", methods=["POST"])
@admin_required
def admin_wall_code_regenerate():
    global access_bump, access_bump_time
    now = time.time()
    with ACCESS_LOCK:
        access_bump += 1
        access_bump_time = now
        code = access_code(access_bump)
    return jsonify(code=code, seconds_left=access_seconds_left(now))


@app.before_request
def api_write_guard():
    if request.path.startswith("/api/") and request.method not in (
        "GET",
        "HEAD",
        "OPTIONS",
    ):
        if request.headers.get("X-Requested-With") != "fetch":
            return jsonify(error="Bad request."), 400


@app.after_request
def api_no_store(response):
    if request.path.startswith("/api/") and response.mimetype == "application/json":
        response.headers["Cache-Control"] = "private, no-store"
        response.headers["Vary"] = "Cookie"
    return response


for status in (401, 403, 404, 500):
    app.register_error_handler(
        status,
        lambda _error, status=status: (render_template(f"{status}.html"), status),
    )


def public_file(path: str):
    """Serve a file from the zola build, falling back to <path>/index.html."""
    target = os.path.normpath(os.path.join(PUBLIC_DIR, path))
    if os.path.isdir(target):
        path = os.path.join(path, "index.html")
    # the hero photos never change under a name; cached, the one carried from page to page paints at once
    max_age = 7 * 86400 if path.startswith("img/bg/") else None
    return send_from_directory(PUBLIC_DIR, path, max_age=max_age)


@app.route("/")
def home():
    return public_file("index.html")


# ---------------------------------------------------------------------------
# Site build. Zola renders content/ into public/; the editor below changes
# files under content/story and content/class and rebuilds, so saving publishes.
# ---------------------------------------------------------------------------

BUILD_LOCK = threading.Lock()
PREVIEW_DIR = os.path.join(DATA_DIR, "preview")


class BuildError(Exception):
    pass


def zola(args: list[str], cwd: str) -> None:
    try:
        run = subprocess.run(
            ["zola", *args], cwd=cwd, capture_output=True, text=True, timeout=120
        )
    except FileNotFoundError:
        raise BuildError("zola is not installed on the server.")
    except subprocess.TimeoutExpired:
        raise BuildError("zola took too long.")
    if run.returncode:
        detail = (run.stderr or run.stdout).strip().splitlines()
        raise BuildError(detail[-1] if detail else "unknown error")


def rebuild() -> None:
    """Build next to public/ and swap it in, so a failed build never leaves the
    live site half-written."""
    fresh, old = PUBLIC_DIR + ".new", PUBLIC_DIR + ".old"
    with BUILD_LOCK:
        shutil.rmtree(fresh, ignore_errors=True)
        zola(["build", "-o", fresh, "--force"], ROOT_DIR)
        shutil.rmtree(old, ignore_errors=True)
        if os.path.isdir(PUBLIC_DIR):
            os.rename(PUBLIC_DIR, old)
        os.rename(fresh, PUBLIC_DIR)
        shutil.rmtree(old, ignore_errors=True)


@app.errorhandler(BuildError)
def build_failed(error):
    return jsonify(error=f"The site did not build: {error}"), 500


# ---------------------------------------------------------------------------
# Story and class: markdown pages with TOML front matter, the format zola reads.
#   content/<section>/<folder>/_index.md   title, weight, [extra] icon
#   content/<section>/<folder>/<slug>.md   title, weight, updated, [extra] icon
#   content/<section>/<folder>/<file>      any other file, listed in the class tree
# One editor serves both sections; the routes take the section name first.
# ---------------------------------------------------------------------------

SECTIONS = {"story": "story.html", "class": "class.html"}  # folder template
SECTION_RULE = "<any(story, class):section>"
MAX_FILE_BYTES = 64 * 1024 * 1024
FILE_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,110}\.[A-Za-z0-9]{1,8}$")
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_BYTES + 1024 * 1024


@app.errorhandler(413)
def too_large(_error):
    return jsonify(error="That file is too big (64 MB max)."), 413


def section_dir(section: str) -> str:
    return os.path.join(CONTENT_DIR, section)


FRONT_RE = re.compile(
    r"\A\ufeff?\+\+\+[ \t]*\r?\n(.*?)\r?\n\+\+\+[ \t]*(?:\r?\n|\Z)", re.S
)
KEY_ORDER = ["title", "weight", "updated", "sort_by", "template", "page_template"]


def toml_loads(text: str) -> dict:
    """Just enough TOML for front matter: key = value lines and [tables]."""
    meta: dict = {}
    table = meta
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
            table = meta.setdefault(line[1:-1].strip(), {})
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip()
        if value.startswith('"') and value.endswith('"') and len(value) >= 2:
            value = re.sub(r'\\(["\\])', r"\1", value[1:-1])
        elif re.fullmatch(r"-?\d+", value):
            value = int(value)
        elif value in ("true", "false"):
            value = value == "true"
        table[key] = value
    return meta


def toml_dumps(meta: dict) -> str:
    def fmt(key: str, value: object) -> str:
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, int) or key == "updated":
            return str(value)
        return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"') + '"'

    lines = []
    keys = [k for k in KEY_ORDER if k in meta] + [
        k for k in meta if k not in KEY_ORDER and not isinstance(meta[k], dict)
    ]
    for key in keys:
        if meta[key] not in (None, ""):
            lines.append(f"{key} = {fmt(key, meta[key])}")
    for table, values in meta.items():
        if isinstance(values, dict):
            values = {k: v for k, v in values.items() if v not in (None, "")}
            if values:
                lines.append(f"[{table}]")
                lines.extend(f"{k} = {fmt(k, v)}" for k, v in values.items())
    return "+++\n" + "\n".join(lines) + "\n+++\n"


def split_markdown(path: str) -> tuple[dict, str]:
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            text = f.read()
    except OSError:
        return {}, ""
    match = FRONT_RE.match(text)
    if not match:
        return {}, text
    return toml_loads(match.group(1)), text[match.end() :].lstrip("\n")


def write_markdown(path: str, meta: dict, body: str) -> None:
    body = (body or "").strip()
    write_atomic(path, toml_dumps(meta) + ("\n" + body + "\n" if body else ""))


def rewrite_meta(path: str, meta: dict) -> None:
    """Change front matter without touching the body or the file's mtime."""
    stat = os.stat(path) if os.path.isfile(path) else None
    body = split_markdown(path)[1] if stat else ""
    write_markdown(path, meta, body)
    if stat:
        os.utime(path, (stat.st_atime, stat.st_mtime))


def now_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


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


def icon_name(value: object) -> str:
    name = clean_text(value, 60).lower()
    return name if re.fullmatch(r"[a-z0-9-]*", name) else ""


def page_url(section: str, folder: str, slug: str) -> str:
    return f"/{section}/{quote(folder)}/{quote(slug)}/"


def file_url(section: str, folder: str, name: str) -> str:
    return f"/{section}/{quote(folder)}/?f={quote(name)}"


def folder_dir(section: str, folder: object) -> str | None:
    if not safe_name(folder):
        return None
    path = os.path.join(section_dir(section), folder)
    return path if os.path.isdir(path) else None


def file_path(folder_path: str | None, name: object) -> str | None:
    """A file kept next to a folder's pages: anything that is not markdown."""
    if not folder_path or not safe_name(name) or name.lower().endswith(".md"):
        return None
    path = os.path.join(folder_path, name)
    return path if os.path.isfile(path) else None


def page_path(folder_path: str | None, slug: object) -> str | None:
    if not folder_path or not safe_name(slug):
        return None
    path = os.path.join(folder_path, slug + ".md")
    return path if os.path.isfile(path) else None


def weight_of(meta: dict) -> int:
    value = meta.get("weight")
    return value if isinstance(value, int) else 9999


def sorted_folders(section: str) -> list[tuple[str, dict, str]]:
    """(path to _index.md, meta, folder name) ordered like the tree."""
    root = section_dir(section)
    items = []
    for name in os.listdir(root) if os.path.isdir(root) else []:
        path = os.path.join(root, name, "_index.md")
        if not name.startswith((".", "_")) and os.path.isfile(path):
            items.append((path, split_markdown(path)[0], name))
    items.sort(key=lambda t: (weight_of(t[1]), str(t[1].get("title", t[2])).lower()))
    return items


def sorted_pages(folder_path: str) -> list[tuple[str, dict, str]]:
    """(path, meta, slug) ordered like the tree."""
    items = []
    for name in os.listdir(folder_path):
        if name.endswith(".md") and not name.startswith((".", "_")):
            path = os.path.join(folder_path, name)
            items.append((path, split_markdown(path)[0], name[:-3]))
    items.sort(key=lambda t: (weight_of(t[1]), str(t[1].get("title", t[2])).lower()))
    return items


def renumber(items: list[tuple[str, dict, str]]) -> None:
    for position, (path, meta, _) in enumerate(items):
        if os.path.isfile(path) and meta.get("weight") != position:
            meta["weight"] = position
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


def next_slug(folder_path: str, base: str) -> str:
    slug, n = base, 2
    while os.path.exists(os.path.join(folder_path, slug + ".md")):
        slug = f"{base}-{n}"
        n += 1
    return slug


def folder_meta(section: str, label: str, weight: int, icon: str = "") -> dict:
    return {
        "title": label,
        "weight": weight,
        "sort_by": "weight",
        "template": SECTIONS[section],
        "extra": {"icon": icon},
    }


@app.route(f"/api/{SECTION_RULE}/folders", methods=["POST"])
@admin_required
def create_folder(section):
    data = request.get_json(silent=True) or {}
    label = clean_text(data.get("label"), 60)
    if not label:
        return jsonify(error="Folder needs a name."), 400
    # class folders go by course number (61a, c100) and keep the label in _index.md
    wanted = clean_text(data.get("id"), 40)
    base = slugify(wanted) if wanted else slugify(label, fallback="folder")
    folder, n = base, 2
    while os.path.exists(os.path.join(section_dir(section), folder)):
        folder = f"{base}-{n}"
        n += 1
    folder_path = os.path.join(section_dir(section), folder)
    os.makedirs(folder_path, exist_ok=True)
    write_markdown(
        os.path.join(folder_path, "_index.md"),
        folder_meta(
            section, label, len(sorted_folders(section)), icon_name(data.get("icon"))
        ),
        "",
    )
    rebuild()
    return jsonify(ok=True, id=folder), 201


@app.route(f"/api/{SECTION_RULE}/folders/<folder>", methods=["PUT"])
@admin_required
def update_folder(section, folder):
    folder_path = folder_dir(section, folder)
    if not folder_path:
        abort(404)
    data = request.get_json(silent=True) or {}
    meta_path = os.path.join(folder_path, "_index.md")
    meta = split_markdown(meta_path)[0]
    if "label" in data:
        label = clean_text(data["label"], 60)
        if not label:
            return jsonify(error="Folder needs a name."), 400
        meta["title"] = label
    if "icon" in data:
        meta.setdefault("extra", {})["icon"] = icon_name(data["icon"])
    write_markdown(meta_path, meta, "")
    rebuild()
    return jsonify(ok=True)


@app.route(f"/api/{SECTION_RULE}/folders/<folder>/move", methods=["POST"])
@admin_required
def move_folder(section, folder):
    direction = (request.get_json(silent=True) or {}).get("direction")
    if not move_item(sorted_folders(section), folder, direction):
        abort(404)
    rebuild()
    return jsonify(ok=True)


@app.route(f"/api/{SECTION_RULE}/folders/<folder>", methods=["DELETE"])
@admin_required
def delete_folder(section, folder):
    folder_path = folder_dir(section, folder)
    if not folder_path:
        abort(404)
    shutil.rmtree(folder_path, ignore_errors=True)
    renumber(sorted_folders(section))
    rebuild()
    return jsonify(ok=True)


@app.route(f"/api/{SECTION_RULE}/folders/<folder>/pages", methods=["POST"])
@admin_required
def create_page(section, folder):
    folder_path = folder_dir(section, folder)
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
    write_markdown(
        os.path.join(folder_path, slug + ".md"),
        {
            "title": title,
            "weight": len(sorted_pages(folder_path)),
            "updated": now_stamp(),
            "extra": {"icon": icon_name(data.get("icon"))},
        },
        content,
    )
    rebuild()
    return jsonify(ok=True, url=page_url(section, folder, slug)), 201


@app.route(f"/api/{SECTION_RULE}/folders/<folder>/pages/<slug>")
@admin_required
def get_page(section, folder, slug):
    path = page_path(folder_dir(section, folder), slug)
    if not path:
        abort(404)
    meta, body = split_markdown(path)
    return jsonify(
        title=meta.get("title") or slug.replace("-", " "),
        content=body,
        icon=(meta.get("extra") or {}).get("icon", ""),
        url=page_url(section, folder, slug),
    )


@app.route(f"/api/{SECTION_RULE}/folders/<folder>/pages/<slug>", methods=["PUT"])
@admin_required
def update_page(section, folder, slug):
    path = page_path(folder_dir(section, folder), slug)
    if not path:
        abort(404)
    data = request.get_json(silent=True) or {}
    meta, body = split_markdown(path)
    if "title" in data:
        title = clean_text(data["title"], 120)
        if not title:
            return jsonify(error="Page needs a title."), 400
        meta["title"] = title
    if "icon" in data:
        meta.setdefault("extra", {})["icon"] = icon_name(data["icon"])
    if data.get("content") is not None:
        body = str(data["content"])
        if len(body) > MAX_PAGE_CHARS:
            return jsonify(error="That page is too long."), 413
    meta["updated"] = now_stamp()
    write_markdown(path, meta, body)
    rebuild()
    return jsonify(ok=True, url=page_url(section, folder, slug))


@app.route(f"/api/{SECTION_RULE}/folders/<folder>/pages/<slug>", methods=["DELETE"])
@admin_required
def delete_page(section, folder, slug):
    folder_path = folder_dir(section, folder)
    path = page_path(folder_path, slug)
    if not path:
        abort(404)
    os.remove(path)
    renumber(sorted_pages(folder_path))
    rebuild()
    return jsonify(ok=True)


@app.route(f"/api/{SECTION_RULE}/folders/<folder>/pages/<slug>/move", methods=["POST"])
@admin_required
def move_page(section, folder, slug):
    folder_path = folder_dir(section, folder)
    if not folder_path:
        abort(404)
    direction = (request.get_json(silent=True) or {}).get("direction")
    if not move_item(sorted_pages(folder_path), slug, direction):
        abort(404)
    rebuild()
    return jsonify(ok=True)


@app.route(
    f"/api/{SECTION_RULE}/folders/<folder>/pages/<slug>/relocate", methods=["POST"]
)
@admin_required
def relocate_page(section, folder, slug):
    src_dir = folder_dir(section, folder)
    src = page_path(src_dir, slug)
    target = (request.get_json(silent=True) or {}).get("folder")
    dst_dir = folder_dir(section, target)
    if not src or not dst_dir:
        abort(404)
    if os.path.samefile(src_dir, dst_dir):
        return jsonify(ok=True, url=page_url(section, folder, slug))
    new_slug = next_slug(dst_dir, slug)
    position = len(sorted_pages(dst_dir))
    dst = os.path.join(dst_dir, new_slug + ".md")
    shutil.move(src, dst)
    meta = split_markdown(dst)[0]
    meta["weight"] = position
    rewrite_meta(dst, meta)
    renumber(sorted_pages(src_dir))
    rebuild()
    return jsonify(ok=True, url=page_url(section, target, new_slug))


@app.route(f"/api/{SECTION_RULE}/folders/<folder>/files", methods=["POST"])
@admin_required
def upload_file(section, folder):
    """A file kept next to a folder's pages (pdf, html, mp4...). Uploading a
    name that already exists replaces that file."""
    folder_path = folder_dir(section, folder)
    if not folder_path:
        abort(404)
    upload = request.files.get("file")
    if not upload or not upload.filename:
        return jsonify(error="Pick a file first."), 400
    name = clean_text(request.form.get("name") or upload.filename, 120)
    name = re.sub(r"\s+", "-", os.path.basename(name.replace("\\", "/")))
    if (
        not safe_name(name)
        or not FILE_NAME_RE.match(name)
        or name.lower().endswith(".md")
    ):
        return (
            jsonify(
                error="Name it with letters, digits, dots or dashes, plus an extension."
            ),
            400,
        )
    path = os.path.join(folder_path, name)
    tmp = path + ".tmp"
    upload.save(tmp)
    if os.path.getsize(tmp) > MAX_FILE_BYTES:
        os.remove(tmp)
        return jsonify(error="That file is too big (64 MB max)."), 413
    os.replace(tmp, path)
    rebuild()
    return jsonify(ok=True, name=name, url=file_url(section, folder, name)), 201


@app.route(f"/api/{SECTION_RULE}/folders/<folder>/files/<name>", methods=["DELETE"])
@admin_required
def delete_file(section, folder, name):
    path = file_path(folder_dir(section, folder), name)
    if not path:
        abort(404)
    os.remove(path)
    rebuild()
    return jsonify(ok=True)


@app.route(f"/api/{SECTION_RULE}/preview", methods=["POST"])
@admin_required
def preview_page(section):
    """Render a draft with zola itself, in a scratch copy of the site that
    holds only this one page, and return the page body."""
    content = str((request.get_json(silent=True) or {}).get("content") or "")
    if len(content) > MAX_PAGE_CHARS:
        return jsonify(error="That page is too long."), 413
    scratch = PREVIEW_DIR
    with BUILD_LOCK:
        shutil.rmtree(os.path.join(scratch, "content"), ignore_errors=True)
        draft_dir = os.path.join(scratch, "content", section, "preview")
        os.makedirs(draft_dir, exist_ok=True)
        shutil.copy(os.path.join(ROOT_DIR, "config.toml"), scratch)
        shutil.copytree(
            os.path.join(ROOT_DIR, "templates"),
            os.path.join(scratch, "templates"),
            dirs_exist_ok=True,
        )
        os.makedirs(os.path.join(scratch, "static", "icons"), exist_ok=True)
        shutil.copy(
            os.path.join(ROOT_DIR, "static", "icons", "phosphor-regular.json"),
            os.path.join(scratch, "static", "icons"),
        )
        shutil.copy(
            os.path.join(section_dir(section), "_index.md"), os.path.dirname(draft_dir)
        )
        write_markdown(
            os.path.join(draft_dir, "_index.md"), folder_meta(section, "preview", 0), ""
        )
        write_markdown(
            os.path.join(draft_dir, "draft.md"),
            {"title": "preview", "weight": 0},
            content,
        )
        zola(["build"], scratch)
        with open(
            os.path.join(scratch, "public", section, "preview", "draft", "index.html"),
            encoding="utf-8",
        ) as f:
            html = f.read()
    match = re.search(r"<!--content-start-->(.*)<!--content-end-->", html, re.S)
    return jsonify(html=match.group(1) if match else "")


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
                return render_template(
                    "todo.html", error="Incorrect Password", logged_in=False
                )
            session["todo_logged_in"] = True
            return redirect(url_for("todo"))

        if request.form.get("logout"):
            session.pop("todo_logged_in", None)
            return redirect(url_for("todo"))

    return render_template("todo.html", logged_in=session.get("todo_logged_in", False))


def load_db() -> dict:
    try:
        with open(NOTES_DB, encoding="utf-8") as f:
            db = json.load(f)
    except (OSError, ValueError):
        db = {}
    db.setdefault("notes", [])
    for note in db["notes"]:
        note.pop("status", None)
        note.pop("pinned", None)
        note.pop("reports", None)
        note.pop("device", None)
        note.pop("ip", None)
        note.pop("ua", None)
    return db


def save_db(db: dict) -> None:
    write_atomic(NOTES_DB, json.dumps(db))


def image_path(note_id: str) -> str:
    return os.path.join(NOTES_IMG, note_id + ".png")


def find_note(db: dict, note_id: str) -> dict | None:
    return next((n for n in db["notes"] if n["id"] == note_id), None)


def public_note(note: dict) -> dict:
    return {
        "id": note["id"],
        "text": note["text"],
        "name": note["name"],
        "created": note["created"],
        "img": f"/api/notes/{note['id']}.png" if note.get("img") else None,
        "paper": note.get("paper", 0),
        "url": note.get("url") or None,
    }


_activity_cache = {"at": 0.0, "body": None}


@app.route("/api/activity")
def activity():
    """Discord presence for the home card, fetched server-side (upstream has no CORS)."""
    now = time.time()
    if _activity_cache["body"] is None or now - _activity_cache["at"] > 5:
        try:
            req = urllib.request.Request(
                "https://activity.fischl.app",
                headers={"User-Agent": "iancheung.dev (+https://iancheung.dev)"},
            )
            with urllib.request.urlopen(req, timeout=5) as r:
                _activity_cache["body"] = r.read()
        except (urllib.error.URLError, OSError):
            return jsonify(error="upstream unavailable"), 502
        _activity_cache["at"] = now
    return app.response_class(_activity_cache["body"], mimetype="application/json")


def message_enabled() -> bool:
    return bool(DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET and MESSAGE_WEBHOOK_URL)


def external_url(path: str) -> str:
    proto = (
        request.headers.get("X-Forwarded-Proto", "") if TRUSTED_PROXY_HOPS > 0 else ""
    )
    scheme = proto or request.scheme
    return f"{scheme}://{request.host}{path}"


def discord_json(req: urllib.request.Request) -> dict:
    req.add_header("User-Agent", "iancheung.dev (+https://iancheung.dev)")
    with urllib.request.urlopen(req, timeout=8) as r:
        return json.loads(r.read().decode("utf-8"))


def message_user_public() -> dict | None:
    user = session.get("dm_user")
    if not isinstance(user, dict) or "id" not in user:
        return None
    return {
        "id": user["id"],
        "name": user["name"],
        "handle": user["handle"],
        "avatar": user["avatar"],
    }


@app.route("/api/message/me")
def message_me():
    return jsonify(enabled=message_enabled(), user=message_user_public())


@app.route("/api/message/login")
def message_login():
    if not message_enabled():
        abort(404)
    state = uuid.uuid4().hex
    session["dm_state"] = state
    params = {
        "response_type": "code",
        "client_id": DISCORD_CLIENT_ID,
        "scope": "identify",
        "state": state,
        "redirect_uri": external_url("/api/message/callback"),
        "prompt": "none",
    }
    return redirect(
        "https://discord.com/oauth2/authorize?"
        + "&".join(f"{k}={quote(v, safe='')}" for k, v in params.items())
    )


@app.route("/api/message/callback")
def message_callback():
    if not message_enabled():
        abort(404)
    state = session.pop("dm_state", None)
    code = request.args.get("code", "")
    ok = (
        bool(state)
        and hmac.compare_digest(str(request.args.get("state", "")), state)
        and bool(code)
    )
    if ok:
        try:
            body = "&".join(
                f"{k}={quote(v, safe='')}"
                for k, v in {
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": external_url("/api/message/callback"),
                }.items()
            ).encode()
            auth = base64.b64encode(
                f"{DISCORD_CLIENT_ID}:{DISCORD_CLIENT_SECRET}".encode()
            ).decode()
            token = discord_json(
                urllib.request.Request(
                    "https://discord.com/api/oauth2/token",
                    data=body,
                    headers={
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Authorization": f"Basic {auth}",
                    },
                )
            )
            me = discord_json(
                urllib.request.Request(
                    "https://discord.com/api/users/@me",
                    headers={"Authorization": f"Bearer {token['access_token']}"},
                )
            )
            uid = str(me["id"])
            avatar = (
                f"https://cdn.discordapp.com/avatars/{uid}/{me['avatar']}.png?size=64"
                if me.get("avatar")
                else f"https://cdn.discordapp.com/embed/avatars/{(int(uid) >> 22) % 6}.png"
            )
            session["dm_user"] = {
                "id": uid,
                "name": clean_text(me.get("global_name") or me.get("username"), 40),
                "handle": clean_text(me.get("username"), 40),
                "avatar": avatar,
            }
        except (urllib.error.URLError, OSError, KeyError, ValueError, TypeError):
            ok = False
    return render_template(
        "message_callback.html", ok=ok, user=message_user_public() if ok else None
    )


@app.route("/api/message/logout", methods=["POST"])
def message_logout():
    session.pop("dm_user", None)
    return jsonify(ok=True)


def device_of(agent: str) -> str:
    """'Safari on iPhone' from a user agent; the raw string is kept alongside."""
    ua = agent or ""
    browser = next(
        (
            name
            for probe, name in (
                ("Edg/", "Edge"),
                ("OPR/", "Opera"),
                ("SamsungBrowser", "Samsung Internet"),
                ("Firefox/", "Firefox"),
                ("Chrome/", "Chrome"),
                ("CriOS/", "Chrome"),
                ("Safari/", "Safari"),
            )
            if probe in ua
        ),
        "Unknown browser",
    )
    system = next(
        (
            name
            for probe, name in (
                ("iPhone", "iPhone"),
                ("iPad", "iPad"),
                ("Android", "Android"),
                ("Windows", "Windows"),
                ("Mac OS X", "Mac"),
                ("CrOS", "ChromeOS"),
                ("Linux", "Linux"),
            )
            if probe in ua
        ),
        "unknown device",
    )
    return f"{browser} on {system}"


def discord_created(uid: str) -> int:
    """Unix seconds the account was made, read off the snowflake."""
    return ((int(uid) >> 22) + 1_420_070_400_000) // 1000


def message_payload(user: dict, text: str, ip: str, agent: str) -> dict:
    """The webhook post: the sender's name and avatar, the text as typed, a quiet
    ping for Ian under it, and one embed field per detail about the sender."""
    created = discord_created(user["id"])
    agent = clean_text(agent, 300) or "unknown"
    return {
        "username": user["name"],
        "avatar_url": user["avatar"],
        "content": f"{text}\n-# <@{MESSAGE_MENTION_ID}>",
        "allowed_mentions": {"users": [MESSAGE_MENTION_ID]},
        "embeds": [
            {
                "color": 0x043A74,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "fields": [
                    {"name": "Display name", "value": user["name"], "inline": True},
                    {"name": "Username", "value": user["handle"], "inline": True},
                    {"name": "User ID", "value": user["id"], "inline": True},
                    {
                        "name": "Account created",
                        "value": f"<t:{created}:D> (<t:{created}:R>)",
                        "inline": True,
                    },
                    {"name": "IP address", "value": ip or "unknown", "inline": True},
                    {
                        "name": "Device",
                        "value": f"{device_of(agent)}\n`{agent}`",
                        "inline": False,
                    },
                ],
            }
        ],
    }


@app.route("/api/message", methods=["POST"])
def message_send():
    if not message_enabled():
        return jsonify(error="Messages are off right now."), 503
    user = session.get("dm_user")
    if not isinstance(user, dict) or "id" not in user:
        return jsonify(error="Sign in with Discord first."), 401
    data = request.get_json(silent=True) or {}
    text = clean_text(data.get("text"), MESSAGE_MAX_CHARS)
    if not text:
        return jsonify(error="Write something first."), 400
    ip, now = client_ip(), time.time()
    with MESSAGE_LOCK:
        for key, cap in (
            (f"u:{user['id']}", MESSAGE_MAX_PER_USER),
            (f"ip:{ip}", MESSAGE_MAX_PER_IP),
        ):
            message_sent[key] = [
                t for t in message_sent.get(key, []) if now - t < MESSAGE_WINDOW
            ]
            if len(message_sent[key]) >= cap:
                return (
                    jsonify(
                        error="That is plenty for now. Try again in a few minutes."
                    ),
                    429,
                )
        message_sent[f"u:{user['id']}"].append(now)
        message_sent[f"ip:{ip}"].append(now)
    payload = message_payload(user, text, ip, request.headers.get("User-Agent", ""))
    try:
        discord_json(
            urllib.request.Request(
                MESSAGE_WEBHOOK_URL
                + ("&" if "?" in MESSAGE_WEBHOOK_URL else "?")
                + "wait=true",
                data=json.dumps(payload).encode(),
                headers={"Content-Type": "application/json"},
            )
        )
    except (urllib.error.URLError, OSError, ValueError):
        return jsonify(error="Discord did not take it. Try again in a moment."), 502
    return jsonify(ok=True)


@app.route("/api/notes")
def notes_list():
    admin = is_admin()
    offset = max(request.args.get("offset", 0, type=int), 0)
    limit = min(max(request.args.get("limit", NOTES_PAGE_SIZE, type=int), 1), 100)

    with NOTES_LOCK:
        db = load_db()
    notes = sorted(db["notes"], key=lambda n: n["created"], reverse=True)

    return jsonify(
        {
            "admin": admin,
            "notes": [public_note(n) for n in notes[offset : offset + limit]],
            "has_more": offset + limit < len(notes),
        }
    )


@app.route("/api/notes", methods=["POST"])
def notes_create():
    if request.content_length and request.content_length > 400_000:
        return jsonify(error="That drawing is too big."), 413
    data = request.get_json(silent=True) or {}
    admin = is_admin()
    if not admin and not consume_ticket(str(data.get("ticket") or "")):
        return (
            jsonify(error="Your access code expired. Ask for a new one and try again."),
            401,
        )
    text, name = clean_text(data.get("text"), 44), clean_text(data.get("name"), 24)
    if not text:
        return jsonify(error="Write a caption first."), 400
    if not name:
        return jsonify(error="Sign the note with your name."), 400
    url = clean_url(data.get("url"))
    if clean_text(data.get("url"), 200) and not url:
        return jsonify(error="That website link doesn't look right."), 400
    png = None
    if data.get("image"):
        png = decode_base64(data["image"])
        if png is None or not valid_png(png):
            return jsonify(error="Bad image."), 400

    paper = data.get("paper", 0)
    if not isinstance(paper, int) or not 0 <= paper <= 3:
        paper = 0
    note_id = uuid.uuid4().hex[:12]
    with NOTES_LOCK:
        db = load_db()
        if png:
            with open(image_path(note_id), "wb") as f:
                f.write(png)
        note = {
            "id": note_id,
            "text": text,
            "name": name,
            "img": bool(png),
            "paper": paper,
            "url": url,
            "created": datetime.now(timezone.utc).isoformat(),
        }
        db["notes"].append(note)
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


@app.route("/api/notes/<nid>", methods=["DELETE"])
@admin_required
def notes_delete(nid):
    with NOTES_LOCK:
        db = load_db()
        note = find_note(db, nid)
        if not note:
            abort(404)
        db["notes"].remove(note)
        with suppress(OSError):
            os.remove(image_path(nid))
        save_db(db)
    return jsonify(ok=True)


@app.route("/<path:path>")
def public_catch_all(path):
    return public_file(path)


if not os.path.exists(os.path.join(PUBLIC_DIR, "index.html")):
    with suppress(BuildError):
        rebuild()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8085)
