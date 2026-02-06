import os
import json
from flask import Flask, send_from_directory, render_template, request, abort, session, redirect, jsonify, url_for
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_url_path="", static_folder="static")
app.secret_key = os.urandom(24)
app.url_map.strict_slashes = False

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
    return send_from_directory("static/pricing", "index.html")

@app.route("/privacy/")
def privacy_page():
    return send_from_directory("static/privacy", "index.html")

@app.route("/jamie/")
def jamie_page():
    return send_from_directory("static/jamie", "index.html")

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

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8085)
