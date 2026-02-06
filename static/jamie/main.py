import os
from flask import Flask, request, jsonify, render_template_string, send_from_directory, flash, redirect, url_for
from flask_login import LoginManager, UserMixin, login_user, login_required, current_user
from flask_wtf import FlaskForm, CSRFProtect
from flask_wtf.csrf import generate_csrf
from wtforms import StringField, PasswordField, SubmitField
from wtforms.validators import DataRequired
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_url_path="", static_folder="static")
app.secret_key = os.urandom(24)
app.url_map.strict_slashes = False

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

csrf = CSRFProtect(app)

class User(UserMixin):
    def __init__(self, id):
        self.id = id

@login_manager.user_loader
def load_user(user_id):
    return User(user_id)

class LoginForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired()])
    submit = SubmitField('Login')

LOGIN_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Login</title>
    <style>
        body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: 'Segoe UI', sans-serif; background: #1e1e1e; color: #ccc; }
        .login-container { background: #2d2d2d; padding: 40px; border-radius: 8px; box-shadow: 0 0 20px rgba(0,0,0,0.5); min-width: 300px; }
        h2 { text-align: center; margin-bottom: 20px; color: white; }
        form { display: flex; flex-direction: column; }
        label { color: #ccc; }
        input { padding: 10px; margin-bottom: 15px; border: 1px solid #444; border-radius: 4px; background: #1e1e1e; color: white; font-size: 14px; }
        input:focus { outline: none; border-color: #007acc; }
        button { padding: 10px; background: #007acc; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
        button:hover { background: #005f9e; }
        .flash { color: #d9534f; text-align: center; margin-bottom: 15px; }
    </style>
</head>
<body>
    <div class="login-container">
        <h2>Login to Brother Byte Builder</h2>
        {% with messages = get_flashed_messages() %}
            {% if messages %}
                <div class="flash">{{ messages[0] }}</div>
            {% endif %}
        {% endwith %}
        <form method="post">
            {{ form.hidden_tag() }}
            {{ form.username.label }}<br>
            {{ form.username }}<br>
            {{ form.password.label }}<br>
            {{ form.password }}<br>
            {{ form.submit }}
        </form>
    </div>
</body>
</html>
"""

STATIC_DIR = os.path.join(app.root_path, 'static')
QUOTA_BYTES = 25 * 1024 * 1024

USERNAME = os.environ.get('USERNAME')
PASSWORD = os.environ.get('PASSWORD')

EDITOR_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Brother Byte Builder</title>
    <style>
        body { margin: 0; display: flex; flex-direction: column; height: 100vh; font-family: 'Segoe UI', sans-serif; overflow: hidden; }
        #toolbar { padding: 10px 20px; background: #2d2d2d; color: white; display: flex; gap: 15px; align-items: center; height: 50px; box-sizing: border-box; }
        button { padding: 6px 12px; cursor: pointer; background: #007acc; color: white; border: none; border-radius: 3px; font-size: 14px; display: flex; align-items: center; gap: 5px; }
        button:hover { background: #005f9e; }
        button.secondary { background: #444; }
        button.secondary:hover { background: #555; }
        button.danger { background: #d9534f; }
        button.danger:hover { background: #c9302c; }
        #main { display: flex; flex: 1; height: calc(100vh - 50px); }
        .column { display: flex; flex-direction: column; border-right: 1px solid #444; overflow: hidden; position: relative; }
        #col-files { width: 20%; background: #1e1e1e; color: #ccc; min-width: 200px; resize: horizontal; overflow: auto; }
        #col-editor { width: 40%; background: #1e1e1e; min-width: 300px; resize: horizontal; overflow: auto; }
        #col-preview { flex: 1; background: white; min-width: 300px; display: flex; flex-direction: column; }
        
        /* File List */
        .file-item { padding: 8px 15px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; }
        .file-item:hover { background: #2a2d2e; }
        .file-item.active { background: #37373d; color: white; border-left: 3px solid #007acc; }
        .file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        
        /* Usage Bar */
        #usage-container { padding: 15px; border-top: 1px solid #444; background: #252526; font-size: 12px; }
        #usage-bar { height: 6px; background: #444; border-radius: 3px; margin-top: 5px; overflow: hidden; }
        #usage-fill { height: 100%; background: #007acc; width: 0%; transition: width 0.3s; }
        
        /* Editor */
        #editor { flex: 1; }
        #media-preview { flex: 1; display: none; justify-content: center; align-items: center; background: #1e1e1e; overflow: hidden; }
        
        /* URL Bar */
        #url-bar-container { display: flex; align-items: center; background: #f0f0f0; padding: 5px 10px; border-bottom: 1px solid #ccc; gap: 5px; }
        #url-bar { flex: 1; padding: 5px 10px; border: 1px solid #ccc; border-radius: 3px; font-size: 14px; color: #333; }
        .url-btn { background: none; border: none; cursor: pointer; padding: 4px; color: #555; border-radius: 3px; }
        .url-btn:hover { background: #e0e0e0; color: #000; }
        
        iframe { width: 100%; flex: 1; border: none; }
        
        .actions { display: flex; gap: 5px; }
        .icon-btn { background: none; border: none; color: #aaa; cursor: pointer; padding: 2px; font-size: 12px; display: flex; align-items: center; }
        .icon-btn:hover { color: white; }
        
        svg { width: 16px; height: 16px; fill: currentColor; }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/ace/1.4.12/ace.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/ace/1.4.12/ext-language_tools.js"></script>
</head>
<body>
    <div id="toolbar">
        <div style="flex:1">
            <h3 style="margin:0;">Brother Byte Builder</h3>
        </div>
        <div style="display: flex; gap: 15px;">
            <button onclick="runSite()">
                <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> Run & Save
            </button>
            <button id="btn-save" class="secondary" onclick="saveCurrentFile()">
                <svg viewBox="0 0 24 24"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg> Save
            </button>
        </div>
        <div style="flex:1"></div>
    </div>
    
    <div id="main">
        <div id="col-files" class="column">
            <div style="padding: 10px; font-weight: bold; background: #252526; display: flex; justify-content: space-between; align-items: center;">
                <span>FILES</span>
                <div class="actions">
                    <button class="icon-btn" title="New File" onclick="createFile()">
                        <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                    </button>
                    <button class="icon-btn" title="Upload File" onclick="document.getElementById('file-upload').click()">
                        <svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
                    </button>
                </div>
            </div>
            <input type="file" id="file-upload" style="display:none" onchange="handleUpload(this)">
            <div id="file-list-container" style="flex:1; overflow-y: auto;"></div>
            <div id="usage-container">
                <div style="display:flex; justify-content:space-between;">
                    <span>Folder Storage</span>
                    <span id="usage-text">0 / 25 MB</span>
                </div>
                <div id="usage-bar"><div id="usage-fill"></div></div>
            </div>
        </div>
        
        <div id="col-editor" class="column">
            <div id="editor"></div>
            <div id="media-preview"></div>
        </div>
        
        <div id="col-preview" class="column">
            <div id="url-bar-container">
                <input type="text" id="url-bar" value="https://jamiecheung.site" spellcheck="false" onkeydown="if(event.key==='Enter') runSite()">
                <button class="url-btn" title="Copy URL" onclick="copyUrl()">
                    <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                </button>
                <button class="url-btn" title="Open in New Tab" onclick="openNewTab()">
                    <svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
                </button>
            </div>
            <iframe id="site-frame" src="/"></iframe>
        </div>
    </div>

    <script>
        let editor = ace.edit("editor");
        editor.setTheme("ace/theme/monokai");
        editor.session.setMode("ace/mode/html");
        editor.setOptions({ 
            fontSize: "14px",
            enableBasicAutocompletion: true,
            enableSnippets: true,
            enableLiveAutocompletion: true
        });
        
        // Override browser find when editor is focused
        document.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                if (editor.isFocused()) {
                    e.preventDefault();
                    editor.execCommand('find');
                }
            }
        });
        
        let currentFile = null;
        let files = [];
        const BASE_URL = "https://jamiecheung.site";
        const csrfToken = "{{ csrf_token }}";

        async function loadFiles() {
            const res = await fetch('/api/files');
            const data = await res.json();
            files = data.files;
            renderFileList();
            updateUsage(data.usage, data.quota);

            if (!currentFile) {
                const index = files.find(f => f.name === 'index.html');
                if (index) openFile('index.html');
            }
        }

        function renderFileList() {
            const container = document.getElementById('file-list-container');
            container.innerHTML = '';
            files.forEach(f => {
                const div = document.createElement('div');
                div.className = `file-item ${currentFile === f.name ? 'active' : ''}`;
                div.onclick = () => openFile(f.name);
                div.innerHTML = `
                    <span class="file-name" title="${f.name}">${f.name}</span>
                    <div class="actions">
                        ${f.name !== 'index.html' ? `<button class="icon-btn" onclick="event.stopPropagation(); renameFile('${f.name}')">
                            <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                        </button>` : ''}
                        ${f.name !== 'index.html' ? `<button class="icon-btn" onclick="event.stopPropagation(); deleteFile('${f.name}')">
                            <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>` : ''}
                    </div>
                `;
                container.appendChild(div);
            });
        }

        function updateUsage(usage, quota) {
            const pct = Math.min(100, (usage / quota) * 100);
            document.getElementById('usage-fill').style.width = pct + '%';
            document.getElementById('usage-text').innerText = `${(usage/1024/1024).toFixed(2)} / ${(quota/1024/1024).toFixed(0)} MB`;
            if (pct > 90) document.getElementById('usage-fill').style.background = '#d9534f';
            else document.getElementById('usage-fill').style.background = '#007acc';
        }

        function getFileType(name) {
            if (name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return 'image';
            if (name.match(/\.(mp4|webm|ogg)$/i)) return 'video';
            if (name.match(/\.pdf$/i)) return 'pdf';
            return 'text';
        }

        async function openFile(name) {
            currentFile = name;
            renderFileList();
            
            const type = getFileType(name);
            const previewContainer = document.getElementById('media-preview');
            const editorContainer = document.getElementById('editor');
            
            if (type === 'text') {
                editorContainer.style.display = 'block';
                previewContainer.style.display = 'none';
                const res = await fetch('/api/file/' + name);
                const text = await res.text();
                editor.setValue(text, -1);
                
                if (name.endsWith('.html')) editor.session.setMode("ace/mode/html");
                else if (name.endsWith('.css')) editor.session.setMode("ace/mode/css");
                else if (name.endsWith('.js')) editor.session.setMode("ace/mode/javascript");
                else editor.session.setMode("ace/mode/text");
            } else {
                editorContainer.style.display = 'none';
                previewContainer.style.display = 'flex';
                previewContainer.innerHTML = '';
                const url = '/' + name + '?t=' + new Date().getTime();
                
                if (type === 'image') {
                    previewContainer.innerHTML = `<img src="${url}" style="max-width:90%; max-height:90%; box-shadow: 0 0 20px rgba(0,0,0,0.5);">`;
                } else if (type === 'video') {
                    previewContainer.innerHTML = `<video src="${url}" controls style="max-width:90%; max-height:90%"></video>`;
                } else if (type === 'pdf') {
                    previewContainer.innerHTML = `<embed src="${url}" type="application/pdf" style="width:100%; height:100%">`;
                }
            }
        }

        async function saveCurrentFile() {
            if (!currentFile || getFileType(currentFile) !== 'text') return;
            const content = editor.getValue();
            const res = await fetch('/api/file/' + currentFile, {
                method: 'POST',
                headers: {'Content-Type': 'text/plain', 'X-CSRFToken': csrfToken},
                body: content
            });
            if (res.ok) {
                const btn = document.getElementById('btn-save');
                const origHtml = btn.innerHTML;
                const origBg = btn.style.background;
                
                btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Saved';
                btn.style.background = '#28a745';
                
                setTimeout(() => {
                    btn.innerHTML = origHtml;
                    btn.style.background = origBg;
                }, 1000);
            } else {
                alert('Error saving file');
            }
        }

        async function runSite() {
            await saveCurrentFile();
            const urlInput = document.getElementById('url-bar').value;
            let path = '/';
            if (urlInput.startsWith(BASE_URL)) {
                path = urlInput.substring(BASE_URL.length);
                if (!path.startsWith('/')) path = '/' + path;
            } else if (urlInput.startsWith('/')) {
                path = urlInput;
            } else {
                // Assume relative path
                path = '/' + urlInput;
            }
            // Clean up double slashes
            path = path.replace(/\/+/g, '/');
            if (path === '') path = '/';
            
            document.getElementById('site-frame').src = path;
        }
        
        function copyUrl() {
            const url = document.getElementById('url-bar').value;
            navigator.clipboard.writeText(url);
        }
        
        function openNewTab() {
            // Open the actual iframe src in new tab
            const frame = document.getElementById('site-frame');
            // frame.src is absolute url (e.g. http://localhost:2009/index.html)
            window.open(frame.src, '_blank');
        }

        async function createFile() {
            const name = prompt("New file name (e.g. about.html):");
            if (!name) return;
            if (files.find(f => f.name === name)) {
                alert("File already exists");
                return;
            }
            
            // Create empty file
            const res = await fetch('/api/file/' + name, {
                method: 'POST',
                headers: {'Content-Type': 'text/plain', 'X-CSRFToken': csrfToken},
                body: ''
            });
            
            if (res.ok) {
                await loadFiles();
                openFile(name);
            } else {
                alert("Error creating file");
            }
        }

        async function handleUpload(input) {
            if (!input.files.length) return;
            const formData = new FormData();
            formData.append('file', input.files[0]);
            formData.append('csrf_token', csrfToken);
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            if (res.ok) {
                loadFiles();
                input.value = '';
            } else {
                const err = await res.json();
                alert('Upload failed: ' + err.error);
            }
        }

        async function deleteFile(name) {
            if (!confirm(`Delete ${name}?`)) return;
            const res = await fetch('/api/file/' + name, { method: 'DELETE', headers: {'X-CSRFToken': csrfToken} });
            if (res.ok) {
                if (currentFile === name) {
                    currentFile = null;
                    editor.setValue('');
                }
                loadFiles();
            }
        }

        async function renameFile(oldName) {
            const newName = prompt("New file name:", oldName);
            if (!newName || newName === oldName) return;
            const res = await fetch('/api/rename', {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'X-CSRFToken': csrfToken},
                body: JSON.stringify({old: oldName, new: newName})
            });
            if (res.ok) {
                if (currentFile === oldName) currentFile = newName;
                loadFiles();
            } else {
                alert('Rename failed');
            }
        }

        // Init
        loadFiles();
    </script>
</body>
</html>
"""

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('edit_route'))
    form = LoginForm()
    if form.validate_on_submit():
        if form.username.data == USERNAME and form.password.data == PASSWORD:
            user = User('admin')
            login_user(user)
            return redirect(url_for('edit_route'))
        else:
            flash('Invalid credentials')
    return render_template_string(LOGIN_HTML, form=form)

@app.route("/")
def home():
    return app.send_static_file("index.html")

@app.route("/editor")
@login_required
def edit_route():
    return render_template_string(EDITOR_HTML, csrf_token=generate_csrf())

def get_static_files():
    files = []
    total_size = 0
    if os.path.exists(STATIC_DIR):
        for f in os.listdir(STATIC_DIR):
            path = os.path.join(STATIC_DIR, f)
            if os.path.isfile(path):
                size = os.path.getsize(path)
                files.append({'name': f, 'size': size})
                total_size += size
    return files, total_size

@app.route("/api/files")
@login_required
def api_files():
    files, usage = get_static_files()
    files.sort(key=lambda x: x['name'])
    return jsonify({'files': files, 'usage': usage, 'quota': QUOTA_BYTES})

@app.route("/api/file/<path:filename>", methods=['GET', 'POST', 'DELETE'])
@login_required
def api_file(filename):
    filename = os.path.basename(filename) # Security: prevent directory traversal
    path = os.path.join(STATIC_DIR, filename)
    
    if request.method == 'GET':
        if not os.path.exists(path): return "Not found", 404
        return send_from_directory(STATIC_DIR, filename)
    
    if request.method == 'POST':
        # Check quota before saving? 
        # If editing, we are replacing. 
        # If we want to be strict:
        content = request.data
        current_size = os.path.getsize(path) if os.path.exists(path) else 0
        _, usage = get_static_files()
        if (usage - current_size + len(content)) > QUOTA_BYTES:
            return jsonify({'error': 'Quota exceeded'}), 400
            
        with open(path, 'wb') as f:
            f.write(content)
        return jsonify({'success': True})
    
    if request.method == 'DELETE':
        if os.path.exists(path):
            os.remove(path)
        return jsonify({'success': True})

@app.route("/api/upload", methods=['POST'])
@login_required
def api_upload():
    if 'file' not in request.files: return jsonify({'error': 'No file'}), 400
    f = request.files['file']
    if f.filename == '': return jsonify({'error': 'No filename'}), 400
    
    filename = os.path.basename(f.filename)
    path = os.path.join(STATIC_DIR, filename)
    
    # Check quota
    f.seek(0, os.SEEK_END)
    size = f.tell()
    f.seek(0)
    
    _, usage = get_static_files()
    if (usage + size) > QUOTA_BYTES:
        return jsonify({'error': 'Quota exceeded'}), 400
        
    f.save(path)
    return jsonify({'success': True})

@app.route("/api/rename", methods=['POST'])
@login_required
def api_rename():
    data = request.json
    old = os.path.basename(data.get('old'))
    new = os.path.basename(data.get('new'))
    
    old_path = os.path.join(STATIC_DIR, old)
    new_path = os.path.join(STATIC_DIR, new)
    
    if not os.path.exists(old_path): return jsonify({'error': 'File not found'}), 404
    if os.path.exists(new_path): return jsonify({'error': 'Destination exists'}), 400
    
    os.rename(old_path, new_path)
    return jsonify({'success': True})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=2009)
