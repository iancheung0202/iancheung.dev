# iancheung.dev

Personal site. Zola builds the pages, Flask serves them and adds the dynamic bits.

## Layout

```
config.toml        zola settings
content/           markdown. _index.md is home, wall.md, colophon.md,
                   story/<folder>/<page>.md and class/<course>/... the explorers
                   (TOML front matter: title, weight, updated, [extra] icon)
templates/         zola (tera) templates: base.html, home.html, wall.html,
                   story*.html, class*.html, macros/ (icon, explorer tree), shortcodes/
static/            copied into public/ as-is: css/ js/ img/ fonts/ audio/ icons/
                   vendor/ archive/ plus index.html, pricing.html, resume.pdf
public/            zola build output (gitignored)
server/app.py      flask: serves public/, wall, admin, one-time codes, todo,
                   and the story editor API (writes content/story, runs
                   `zola build`, renders previews in data/preview)
server/templates/  jinja templates flask renders itself (class, todo, errors)
data/              runtime state written by the server (gitignored):
                   notes/ todos.json .flask_secret preview/
main.py            entry point: python3 main.py
```

## Workflow

### Once, on your laptop

```
git clone git@github.com:iancheung0202/iancheung.dev.git && cd iancheung.dev
pip install -r requirements.txt     # flask, python-dotenv
# zola: brew install zola  (or the release tarball from getzola.org, 0.21+)
cp .env.example .env                # fill in FLASK_SECRET_KEY and PASSWORD (Discord values optional, see "Message box")
pre-commit install                  # formats python and fixes whitespace on commit
```

### Every change

1. Edit. Pages are markdown in `content/`, layout in `templates/`, styles in
   `static/css/` (tokens first, see `/colophon`), server in `server/app.py`.
2. Run it: `make run` (same as `zola build && python3 main.py`), open
   http://localhost:8085. `make dev` rebuilds `public/` on every file save
   (needs `inotify-tools`); the browser still needs a refresh.
3. Check the pages you touched in light and dark, and on a narrow window.
4. Commit and push:
   ```
   git add -A
   git commit -m "what changed"
   git push
   ```

### Workflow: patch, preview, push, auto-deploy

1. Apply a patch: `git am --keep-cr slice.patch`.
2. Preview it exactly as the VPS will run it: `docker compose up --build`
   (then <http://localhost:8085>; Ctrl-C stops it). `.env` needs
   `FLASK_SECRET_KEY` and `PASSWORD`; `data/` holds your local wall notes.
3. Happy: `git push`. GitHub Actions (`.github/workflows/site.yml`) then
   - runs pre-commit (black, isort, whitespace), `zola build`, `docker build`,
   - starts the image and runs `scripts/smoke.sh` against it (home, story,
     wall, class, colophon, archive, css, `/api/notes`, `/api/activity`, a 404,
     and the home `<title>`),
   - on `main` only, SSHes into the VPS and runs `scripts/deploy.sh`.
4. `scripts/deploy.sh` on the VPS: fast-forwards `main`, `docker compose up -d --build`,
   runs the same smoke test against the live container, and if that fails
   puts the previous image back and exits non-zero (the Actions run goes red).

Branches and pull requests get the checks without the deploy.

### VPS setup (once)

```
# as root on the VPS
apt-get install -y docker.io docker-compose-v2 git
cd ~ && git clone https://github.com/iancheung0202/iancheung.dev.git && cd iancheung.dev
cp .env.example .env && nano .env            # FLASK_SECRET_KEY, PASSWORD, Discord values
mkdir -p data                                # wall notes live in data/notes
# a key GitHub will log in with (no passphrase)
ssh-keygen -t ed25519 -N "" -f ~/.ssh/github-deploy -C github-deploy
cat ~/.ssh/github-deploy.pub >> ~/.ssh/authorized_keys
docker compose up -d --build
```

Repository secrets (GitHub → Settings → Secrets and variables → Actions):

| secret            | value                                              |
|-------------------|----------------------------------------------------|
| `VPS_HOST`        | the VPS IP or hostname                             |
| `VPS_USER`        | `root` (or the user that owns the checkout)        |
| `VPS_APP_DIR`     | `/root/iancheung.dev`                              |
| `VPS_SSH_KEY`     | contents of `~/.ssh/github-deploy` (private key)   |
| `VPS_KNOWN_HOSTS` | output of `ssh-keyscan -t ed25519 <host>` run locally |

Also create an environment named `production` (Settings → Environments); the
deploy job runs in it, so you can add required reviewers there later.

Deploy by hand if ever needed: `ssh root@<host> 'cd iancheung.dev && scripts/deploy.sh'`.

### Story pages written in the browser

Saving in the editor writes `content/story/...` on the server and rebuilds
the site inside the container, so the page is live at once. Those files sit
in the VPS checkout as uncommitted changes. Now and then, on the VPS:

```
git add content/story && git commit -m "story: new pages" && git push
```

and `git pull` on your laptop. If you also edited story files on your
laptop, pull before the next `git pull` on the VPS would conflict; keep
story writing to one place at a time.

### Without Docker

`zola` and Python on the box: `git pull`, then
`zola build && python3 main.py`. If `public/` is missing the server builds it
on start, and the editor rebuilds it on every save, so `zola` must be on PATH.

## Editing story pages

Open any `/story/` page, click "Last updated:" under the text and log in.
Folders get move, rename, icon, new page and delete buttons; "Edit page"
opens the split editor (markdown left, the real zola-rendered page right,
Ctrl/Cmd+S saves, Esc cancels). Saving writes the markdown file and rebuilds
`public/`, so the page is live immediately. Icons are Phosphor names
(phosphoricons.com), e.g. `map-pin`. Images go in the folder directory and
are referenced as `/story/<folder>/<file>`.

## Design rules

See `/colophon` on the live site, or `content/colophon.md`. Tokens live in
`static/css/tokens.css`; `static/css/style.css` is the older stylesheet that
shrinks as pages move onto the tokens.

## Message box

The home card has a "Message @iancheung.dev" field. A visitor types, signs in with Discord once (a popup, `identify` scope only), and the text is posted to a webhook in a private channel with their Discord name, avatar and user id, so it is clear who wrote it. Three env values turn it on; without them the field is hidden:

- `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`: from the Discord developer portal. Under OAuth2 -> Redirects add `https://iancheung.dev/api/message/callback` (and `http://localhost:8085/api/message/callback` for local runs).
- `MESSAGE_WEBHOOK_URL`: channel settings -> Integrations -> Webhooks in the channel the messages should land in.

Limits: 500 characters, 20 messages per Discord user and 40 per IP every 10 minutes (flood protection only). Mentions in the text are never pinged.
