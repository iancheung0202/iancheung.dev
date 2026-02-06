import os
from flask import Flask, send_from_directory, render_template, request, abort

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

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8085)
