/*
 * Story and class editor. Only does anything once SiteAdmin says you are
 * logged in. Clicking "Last updated:" under a page opens the login.
 *
 * Tree tools: move folders and pages, rename a folder and pick its icon,
 * add or delete folders, add pages. Class folders also take files (pdf,
 * html, mp4...): upload (button or drag and drop), replace, delete.
 * Page editor: EasyMDE (vendored, MIT) on the left for the markdown, the
 * real rendered page on the right (built by zola on the server),
 * Ctrl/Cmd+S saves, Esc cancels.
 */
(function () {
  "use strict";
  const Admin = window.SiteAdmin;
  const tree = document.getElementById('tree');
  const article = document.getElementById('page');
  const kind = tree && tree.dataset.kind;
  if (!Admin || !tree || !article || !['story', 'class'].includes(kind)) return;

  const API = '/api/' + kind;
  const ROOT = '/' + kind + '/';
  const hasFiles = kind === 'class'; // the class tree lists the files kept next to the pages
  const html = document.documentElement;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const call = (url, method, body) => Admin.api(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  const enc = encodeURIComponent;
  const folderApi = (id) => `${API}/folders/${enc(id)}`;
  const pageApi = (folder, slug) => `${folderApi(folder)}/pages/${enc(slug)}`;
  const assetUrl = (folder, name) => `${ROOT}${enc(folder)}/${enc(name)}`;

  // one small message at the bottom of the screen: progress, errors, confirmations
  let toastEl = null, toastTimer = null;
  const toast = (text, mood = '') => {
    if (!toastEl) { toastEl = el('div', 'admin-toast'); toastEl.setAttribute('role', 'status'); document.body.append(toastEl); }
    toastEl.textContent = text;
    toastEl.className = `admin-toast ${mood}`.trim();
    clearTimeout(toastTimer);
    if (mood !== 'busy') toastTimer = setTimeout(() => { toastEl.remove(); toastEl = null; }, 4500); // 'busy' stays until the next message
  };
  const oops = (err) => toast((err && err.message) || 'Something went wrong.', 'err');

  let icons = null;
  const loadIcons = async () => {
    if (icons) return icons;
    try { icons = await (await fetch('/icons/phosphor-regular.json')).json(); } catch (_) { icons = {}; }
    return icons;
  };
  const svg = (name) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'icon'); s.setAttribute('viewBox', '0 0 256 256'); s.setAttribute('fill', 'currentColor');
    s.setAttribute('width', '1em'); s.setAttribute('height', '1em');
    s.innerHTML = (icons && icons[name]) || (icons && icons.question) || '';
    return s;
  };
  // every control carries the site's pill tooltip (data-tip), never a browser title
  const iconBtn = (name, label, onClick, { cls = '', disabled = false } = {}) => {
    const b = el('button', `tool-btn ${cls}`.trim());
    b.type = 'button'; b.dataset.tip = label; b.setAttribute('aria-label', label); b.disabled = disabled;
    b.append(svg(name));
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); Promise.resolve(onClick()).catch(oops); });
    return b;
  };
  const textBtn = (label, onClick, cls = '') => {
    const b = el('button', `btn ${cls}`.trim(), label);
    b.type = 'button';
    b.addEventListener('click', () => Promise.resolve(onClick()).catch(oops));
    return b;
  };

  // The server rebuilt the site, so a full reload shows the real result.
  const go = (url) => { window.location.href = url || window.location.pathname; };

  const folders = () => [...tree.querySelectorAll('.tree-folder')].map((li) => ({
    id: li.dataset.folder, label: li.dataset.label, icon: li.dataset.icon, el: li,
    pages: [...li.querySelectorAll('.tree-page[data-slug]')].map((p) => ({ slug: p.dataset.slug, el: p, href: p.querySelector('a').getAttribute('href') })),
    files: [...li.querySelectorAll('.tree-page[data-file]')].map((p) => ({ name: p.dataset.file, el: p })),
  }));

  // ---- files: a picker or a drop, then a multipart upload with progress ----
  const pickFiles = (multiple = true) => new Promise((resolve) => {
    const input = el('input'); input.type = 'file'; input.multiple = multiple; input.hidden = true;
    input.addEventListener('change', () => { resolve([...input.files]); input.remove(); });
    input.addEventListener('cancel', () => { resolve([]); input.remove(); });
    document.body.append(input); input.click();
  });
  const upload = (folderId, file, name) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${folderApi(folderId)}/files`);
    xhr.setRequestHeader('X-Requested-With', 'fetch');
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) toast(`Uploading ${file.name}: ${Math.round((e.loaded / e.total) * 100)}%`, 'busy');
    });
    xhr.addEventListener('load', () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch (_) { /* not json */ }
      if (xhr.status === 401) { Admin.refresh(); reject(new Error('Your admin session has ended. Please log in again.')); return; }
      if (xhr.status >= 400) { reject(new Error(data.error || 'Something went wrong.')); return; }
      resolve(data);
    });
    xhr.addEventListener('error', () => reject(new Error('The upload did not go through.')));
    const body = new FormData();
    body.append('file', file);
    if (name) body.append('name', name);
    toast(`Uploading ${file.name}…`, 'busy');
    xhr.send(body);
  });
  // upload one or more files into a folder, then show the folder (or the last file); replaceName targets one existing file
  async function uploadFiles(folderId, files, replaceName = null) {
    files = [...files].filter(Boolean);
    if (!files.length) return;
    if (replaceName) {
      files = files.slice(0, 1);
      if (!confirm(`Replace "${replaceName}" with "${files[0].name}"?`)) return;
    }
    let last = null;
    for (const file of files) {
      try { last = await upload(folderId, file, replaceName); }
      catch (err) { oops(err); return; }
    }
    toast(files.length === 1 ? `Added ${last.name}.` : `Added ${files.length} files.`, 'ok');
    go(last.url);
  }
  async function deleteFile(folderId, name) {
    if (!confirm(`Delete the file "${name}"?\n\nThis cannot be undone.`)) return;
    await call(`${folderApi(folderId)}/files/${enc(name)}`, 'DELETE');
    go(`${ROOT}${enc(folderId)}/`);
  }
  // drop files on a folder row (or on the page of that folder) to upload them there
  const dropZone = (node, folderId) => {
    if (node.dataset.dropReady) return;
    node.dataset.dropReady = '1';
    const hasFilesDragged = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    node.addEventListener('dragover', (e) => { if (!hasFilesDragged(e) || !html.classList.contains('is-admin')) return; e.preventDefault(); node.classList.add('is-dropping'); });
    node.addEventListener('dragleave', () => node.classList.remove('is-dropping'));
    node.addEventListener('drop', (e) => {
      node.classList.remove('is-dropping');
      if (!hasFilesDragged(e) || !html.classList.contains('is-admin')) return;
      e.preventDefault();
      uploadFiles(folderId, e.dataTransfer.files);
    });
  };

  // ---- the tree ----
  // small inline form for a folder's name and icon; replaces the row until saved or cancelled
  function folderForm(host, folder, onSave) {
    if (host.querySelector('.folder-form')) return;
    const hidden = [...host.children];
    hidden.forEach((c) => (c.hidden = true));
    const form = el('form', 'folder-form');
    const name = el('input', 'field'); name.type = 'text'; name.maxLength = 60; name.placeholder = hasFiles ? 'course, e.g. CS 61A' : 'folder name'; name.value = folder.label; name.required = true;
    // class: the directory is the course number (61a, c100); the label above is what the tree shows
    const idIn = hasFiles && !folder.id ? el('input', 'field') : null;
    if (idIn) { idIn.type = 'text'; idIn.maxLength = 40; idIn.placeholder = 'folder id, e.g. 61a'; idIn.pattern = '[A-Za-z0-9-]+'; idIn.autocapitalize = 'off'; idIn.spellcheck = false; }
    const iconWrap = el('div', 'editor-icon');
    let glyph = svg(folder.icon || 'folder');
    const icon = el('input', 'field'); icon.type = 'text'; icon.placeholder = 'icon, e.g. map-pin'; icon.value = folder.icon || '';
    const glyphWrap = el('span', 'editor-glyph'); glyphWrap.dataset.tip = 'Phosphor icon name (phosphoricons.com)'; glyphWrap.append(glyph);
    icon.addEventListener('input', () => { const g = svg(icon.value.trim() || 'folder'); glyph.replaceWith(g); glyph = g; });
    iconWrap.append(glyphWrap, icon);
    const row = el('div', 'folder-form-actions');
    const save = el('button', 'btn btn-primary', 'Save'); save.type = 'submit';
    const cancel = textBtn('Cancel', () => { form.remove(); hidden.forEach((c) => (c.hidden = false)); });
    const error = el('p', 'editor-error');
    row.append(save, cancel);
    form.append(name, ...(idIn ? [idIn] : []), iconWrap, row, error);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const label = name.value.trim();
      const ic = icon.value.trim().toLowerCase().replace(/^ph-/, '');
      const id = idIn ? idIn.value.trim().toLowerCase() : '';
      if (!label) { error.textContent = 'Give the folder a name.'; return; }
      if (idIn && !/^[a-z0-9-]+$/.test(id)) { error.textContent = 'Give the folder an id: the course number, like 61a or c100.'; return; }
      if (ic && icons && !icons[ic]) { error.textContent = `No Phosphor icon called "${ic}".`; return; }
      save.disabled = true;
      try { await onSave(idIn ? { label, icon: ic, id } : { label, icon: ic }); } catch (err) { error.textContent = err.message; save.disabled = false; }
    });
    form.addEventListener('keydown', (e) => { if (e.key === 'Escape') cancel.click(); });
    host.append(form);
    name.focus(); name.select();
  }

  function decorateTree() {
    tree.querySelectorAll('.tree-tools, .tree-add-row').forEach((n) => n.remove());
    const list = folders();
    list.forEach((folder, fi) => {
      const row = folder.el.querySelector('.tree-folder-row');
      const tools = el('span', 'tree-tools');
      tools.append(
        iconBtn('arrow-up', 'Move folder up', () => call(`${folderApi(folder.id)}/move`, 'POST', { direction: 'up' }).then(() => go()), { disabled: fi === 0 }),
        iconBtn('arrow-down', 'Move folder down', () => call(`${folderApi(folder.id)}/move`, 'POST', { direction: 'down' }).then(() => go()), { disabled: fi === list.length - 1 }),
        iconBtn('pencil-simple', 'Rename folder or change its icon', () => folderForm(row, folder, async (v) => {
          await call(folderApi(folder.id), 'PUT', v); go();
        })),
        iconBtn('plus', 'New page in this folder', () => openEditor({ folderId: folder.id })),
        ...(hasFiles ? [iconBtn('upload-simple', 'Upload files (or drop them here)', async () => uploadFiles(folder.id, await pickFiles()))] : []),
        iconBtn('trash', 'Delete folder', async () => {
          const count = (n, word) => (n ? `${n} ${word}${n === 1 ? '' : 's'}` : '');
          const inside = [count(folder.pages.length, 'page'), count(folder.files.length, 'file')].filter(Boolean).join(' and ');
          if (!confirm(`Delete the folder "${folder.label}"${inside ? ` and its ${inside}` : ''}?\n\nThis cannot be undone.`)) return;
          await call(folderApi(folder.id), 'DELETE'); go(ROOT);
        }, { cls: 'tool-danger' }),
      );
      row.append(tools);
      if (hasFiles) dropZone(row, folder.id);

      folder.pages.forEach((page, pi) => {
        const t = el('span', 'tree-tools');
        t.append(
          iconBtn('arrow-up', 'Move page up', () => call(`${pageApi(folder.id, page.slug)}/move`, 'POST', { direction: 'up' }).then(() => go()), { disabled: pi === 0 }),
          iconBtn('arrow-down', 'Move page down', () => call(`${pageApi(folder.id, page.slug)}/move`, 'POST', { direction: 'down' }).then(() => go()), { disabled: pi === folder.pages.length - 1 }),
        );
        page.el.append(t);
      });
      folder.files.forEach((file) => {
        const t = el('span', 'tree-tools');
        t.append(
          iconBtn('swap', 'Replace this file', async () => uploadFiles(folder.id, await pickFiles(false), file.name)),
          iconBtn('trash', 'Delete this file', () => deleteFile(folder.id, file.name), { cls: 'tool-danger' }),
        );
        file.el.append(t);
      });
    });
    const li = el('li', 'tree-add-row');
    const add = textBtn('+ New folder', () => folderForm(li, { label: '', icon: '' }, async (v) => {
      await call(`${API}/folders`, 'POST', v); go();
    }), 'tree-add');
    li.append(add); tree.append(li);
  }

  // ---- the page: edit it, or replace/delete the file being shown ----
  function decoratePage() {
    article.querySelectorAll('.page-tools').forEach((n) => n.remove());
    const { folder, slug, file } = article.dataset;
    if (hasFiles && folder) dropZone(article, folder); // also on a folder's landing page, before it has any page
    const bar = el('div', 'page-tools');
    if (folder && file) {
      bar.append(
        textBtn('Replace file', async () => uploadFiles(folder, await pickFiles(false), file)),
        textBtn('Delete file', () => deleteFile(folder, file), 'btn-danger'),
      );
    } else if (folder && slug) {
      bar.append(textBtn('Edit page', () => openEditor({ folderId: folder, slug })));
    } else return;
    article.prepend(bar);
  }

  // ---- EasyMDE, loaded the first time the editor opens ----
  let mdeReady = null;
  const loadEasyMDE = () => {
    if (window.EasyMDE) return Promise.resolve();
    if (!mdeReady) {
      mdeReady = new Promise((resolve, reject) => {
        const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/vendor/easymde/easymde.min.css';
        const s = document.createElement('script'); s.src = '/vendor/easymde/easymde.min.js';
        s.onload = resolve; s.onerror = () => reject(new Error('The editor did not load.'));
        document.head.append(css, s);
      });
    }
    return mdeReady;
  };
  // toolbar: the site's Phosphor icons, the site's tooltips; math and file upload added to EasyMDE's own actions
  const wrapSelection = (cm, before, after, placeholder) => {
    const sel = cm.getSelection();
    if (sel) { cm.replaceSelection(before + sel + after); }
    else {
      const from = cm.getCursor();
      cm.replaceSelection(before + placeholder + after);
      cm.setSelection({ line: from.line, ch: from.ch + before.length }, { line: from.line, ch: from.ch + before.length + placeholder.length });
    }
    cm.focus();
  };
  const toolbarFor = (folderOf) => {
    const E = window.EasyMDE;
    const item = (name, action, icon, title) => ({ name, action, className: `ph-${icon}`, title });
    return [
      item('bold', E.toggleBold, 'text-b', 'Bold'),
      item('italic', E.toggleItalic, 'text-italic', 'Italic'),
      item('strikethrough', E.toggleStrikethrough, 'text-strikethrough', 'Strikethrough'),
      item('heading', E.toggleHeadingSmaller, 'text-h', 'Heading'),
      '|',
      item('quote', E.toggleBlockquote, 'quotes', 'Quote'),
      item('unordered-list', E.toggleUnorderedList, 'list-bullets', 'Bullet list'),
      item('ordered-list', E.toggleOrderedList, 'list-numbers', 'Numbered list'),
      item('code', E.toggleCodeBlock, 'code', 'Code'),
      item('table', E.drawTable, 'table', 'Table'),
      item('horizontal-rule', E.drawHorizontalRule, 'minus', 'Rule'),
      '|',
      item('link', E.drawLink, 'link', 'Link'),
      item('image', E.drawImage, 'image', 'Image'),
      item('upload', async (editor) => {
        const files = await pickFiles();
        const folder = folderOf();
        for (const file of files) {
          try {
            const r = await upload(folder, file);
            const url = assetUrl(folder, r.name);
            editor.codemirror.replaceSelection(/\.(png|jpe?g|gif|webp|svg)$/i.test(r.name) ? `![](${url})` : `[${r.name}](${url})`);
            toast(`Added ${r.name}.`, 'ok');
          } catch (err) { oops(err); return; }
        }
        editor.codemirror.focus();
      }, 'upload-simple', 'Upload and link a file'),
      '|',
      item('math', (editor) => wrapSelection(editor.codemirror, '$', '$', 'x^2'), 'function', 'Inline math'),
      item('math-block', (editor) => wrapSelection(editor.codemirror, '$$\n', '\n$$', '\\frac{a}{b}'), 'sigma', 'Math block'),
      '|',
      item('undo', E.undo, 'arrow-counter-clockwise', 'Undo'),
      item('redo', E.redo, 'arrow-clockwise', 'Redo'),
    ];
  };
  const dressToolbar = (container) => {
    container.querySelectorAll('.editor-toolbar button').forEach((b) => {
      // EasyMDE puts the item's className on the button itself; ours names the Phosphor icon
      const ph = [...b.classList].find((c) => c.startsWith('ph-'));
      if (ph) b.replaceChildren(svg(ph.slice(3)));
      const title = b.getAttribute('title');
      if (title) { b.dataset.tip = title; b.setAttribute('aria-label', title); b.removeAttribute('title'); }
    });
    // a pill hangs from its button's left edge; near the right edge of the bar it would run off, so anchor those right
    const place = () => {
      const bar = container.querySelector('.editor-toolbar');
      if (!bar) return;
      const edge = bar.getBoundingClientRect().right;
      bar.querySelectorAll('button[data-tip]').forEach((b) => {
        const guess = b.dataset.tip.length * 7 + 24;
        b.classList.toggle('tip-end', b.getBoundingClientRect().left + guess > edge);
      });
    };
    place();
    window.addEventListener('resize', place);
  };

  let dirty = () => false;
  window.addEventListener('beforeunload', (e) => { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });
  const confirmDiscard = () => !dirty() || confirm('Discard your unsaved changes?');

  async function openEditor({ folderId, slug = null }) {
    if (!confirmDiscard()) return;
    let data = { title: '', content: '', icon: '' };
    if (slug) data = await call(pageApi(folderId, slug), 'GET');

    const form = el('div', 'editor');
    const head = el('div', 'editor-head');
    const titleIn = el('input', 'field field-title'); titleIn.type = 'text'; titleIn.maxLength = 120; titleIn.placeholder = 'Page title'; titleIn.value = data.title;
    const folderSel = el('select', 'field');
    folders().forEach((f) => { const o = el('option', null, f.label); o.value = f.id; folderSel.append(o); });
    folderSel.value = folderId;
    const iconWrap = el('div', 'editor-icon');
    const iconIn = el('input', 'field'); iconIn.type = 'text'; iconIn.placeholder = 'icon (optional)'; iconIn.value = data.icon || '';
    let iconPreview = svg(data.icon || 'file-text');
    const glyphWrap = el('span', 'editor-glyph'); glyphWrap.dataset.tip = 'Phosphor icon name (phosphoricons.com)'; glyphWrap.append(iconPreview);
    iconIn.addEventListener('input', () => { const g = svg(iconIn.value.trim() || 'file-text'); iconPreview.replaceWith(g); iconPreview = g; });
    iconWrap.append(glyphWrap, iconIn);
    head.append(titleIn, folderSel, iconWrap);

    const panes = el('div', 'editor-panes');
    const write = el('div', 'editor-write');
    const ta = el('textarea'); ta.value = data.content;
    write.append(ta);
    const render = el('div', 'editor-render');
    const pvTitle = el('h1', 'page-title', titleIn.value || 'Untitled');
    const pvBody = el('div', 'prose');
    render.append(pvTitle, pvBody);
    panes.append(write, render);

    const foot = el('div', 'editor-foot');
    const status = el('p', 'editor-status'); status.setAttribute('role', 'status');
    const saveBtn = textBtn('Save', () => save(), 'btn-primary');
    const cancelBtn = textBtn('Cancel', () => cancel());
    foot.append(saveBtn, cancelBtn);
    if (slug) foot.append(textBtn('Delete', () => remove(), 'btn-danger'));
    foot.append(status, el('span', 'editor-hint', 'Ctrl+S saves, Esc cancels'));
    form.append(head, panes, foot);

    article.replaceChildren(form);
    html.classList.add('is-editing');
    window.scrollTo({ top: 0 });

    let mde = null;
    const text = () => (mde ? mde.value() : ta.value);
    try {
      await loadEasyMDE();
      mde = new window.EasyMDE({
        element: ta,
        initialValue: data.content,
        autoDownloadFontAwesome: false,
        spellChecker: false,
        nativeSpellcheck: true,
        status: false,
        toolbarTips: true,
        tabSize: 2,
        indentWithTabs: false,
        lineWrapping: true,
        unorderedListStyle: '-',
        minHeight: '420px',
        placeholder: `Write markdown here. Files you upload land in this folder: ![](${ROOT}${folderId}/photo.jpg)`,
        toolbar: toolbarFor(() => folderSel.value),
        shortcuts: { toggleSideBySide: null, toggleFullScreen: null, togglePreview: null },
      });
      dressToolbar(write);
      mde.codemirror.on('change', () => schedule());
    } catch (err) {
      status.textContent = `${err.message} Plain text box instead.`; status.classList.add('err');
      ta.className = 'editor-source';
      ta.addEventListener('input', schedule);
    }

    dirty = () => titleIn.value !== data.title || text() !== data.content || folderSel.value !== folderId || iconIn.value.trim() !== (data.icon || '');

    // preview: debounce, send to the server, drop out-of-order answers
    let timer = null, seq = 0;
    const refresh = async () => {
      const mine = ++seq;
      render.classList.add('is-stale');
      try {
        const r = await call(`${API}/preview`, 'POST', { content: text() });
        if (mine !== seq) return;
        pvBody.innerHTML = r.html;
        if (/\$|\\\(|\\\[/.test(text())) await typeset(pvBody);
      } catch (err) {
        if (mine === seq) pvBody.replaceChildren(el('p', 'editor-error', err.message));
      } finally {
        if (mine === seq) render.classList.remove('is-stale');
      }
    };
    function schedule() { clearTimeout(timer); timer = setTimeout(refresh, 350); }
    titleIn.addEventListener('input', () => { pvTitle.textContent = titleIn.value || 'Untitled'; });

    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
      else if (e.key === 'Escape' && !e.target.closest('.folder-form')) { e.preventDefault(); cancel(); }
    };
    document.addEventListener('keydown', onKey, true);

    const save = async () => {
      const title = titleIn.value.trim();
      if (!title) { status.textContent = 'Give the page a title.'; status.classList.add('err'); titleIn.focus(); return; }
      status.textContent = 'Saving…'; status.classList.remove('err');
      saveBtn.disabled = true;
      try {
        const icon = iconIn.value.trim();
        if (icon && icons && !icons[icon]) throw new Error(`No Phosphor icon called "${icon}".`);
        let r;
        if (!slug) {
          r = await call(`${folderApi(folderSel.value)}/pages`, 'POST', { title, content: text(), icon });
        } else {
          r = await call(pageApi(folderId, slug), 'PUT', { title, content: text(), icon });
          if (folderSel.value !== folderId) r = await call(`${pageApi(folderId, slug)}/relocate`, 'POST', { folder: folderSel.value });
        }
        dirty = () => false;
        status.textContent = 'Saved.';
        go(r.url);
      } catch (err) {
        status.textContent = err.message; status.classList.add('err');
        saveBtn.disabled = false;
      }
    };
    const cancel = () => { if (!confirmDiscard()) return; dirty = () => false; document.removeEventListener('keydown', onKey, true); go(); };
    const remove = async () => {
      if (!confirm(`Delete the page "${data.title}"?\n\nThis cannot be undone.`)) return;
      await call(pageApi(folderId, slug), 'DELETE');
      dirty = () => false;
      go(`${ROOT}${enc(folderId)}/`);
    };

    refresh();
    if (slug && mde) mde.codemirror.focus(); else titleIn.focus();
  }

  let katexReady = null;
  const typeset = (node) => {
    if (!katexReady) {
      katexReady = new Promise((resolve) => {
        const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
        const a = document.createElement('script'); a.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';
        a.onload = () => { const b = document.createElement('script'); b.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js'; b.onload = resolve; document.head.append(b); };
        document.head.append(css, a);
      });
    }
    return katexReady.then(() => window.renderMathInElement(node, {
      delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }, { left: '\\(', right: '\\)', display: false }, { left: '\\[', right: '\\]', display: true }],
      throwOnError: false,
    }));
  };

  const trigger = document.getElementById('admin-trigger');
  if (trigger) trigger.addEventListener('click', () => Admin.toggle());

  Admin.subscribe(async (isAdmin) => {
    if (isAdmin) { await loadIcons(); decorateTree(); decoratePage(); }
    else { tree.querySelectorAll('.tree-tools, .tree-add-row').forEach((n) => n.remove()); article.querySelectorAll('.page-tools').forEach((n) => n.remove()); }
  });
  Admin.refresh();
})();
