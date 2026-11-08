"""Entry point. Run `make build` first (or `zola build`), then `python3 main.py`."""

from server.app import app

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8085)
