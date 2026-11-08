/*
 * Story editor. Only does anything once SiteAdmin says you are logged in.
 * Clicking "Last updated:" under a page opens the login.
 *
 * Tree tools: move folders and pages, rename a folder and pick its icon,
 * add or delete folders, add pages. Page editor: markdown on the left,
 * the real rendered page on the right (built by zola on the server),
 * Ctrl/Cmd+S saves, Esc cancels, Tab indents.
 */
(function () {
  "use strict";
  const Admin = window.SiteAdmin;
  const tree = document.getElementById('tree');
  const article = document.getElementById('page');
  if (!Admin || !tree || !article || tree.dataset.kind !== 'story') return;

  const API = '/api/story';
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const call = (url, method, body) => Admin.api(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  const oops = (err) => alert((err && err.message) || 'Something went wrong.');
  const enc = encodeURIComponent;
  const folderApi = (id) => `${API}/folders/${enc(id)}`;
  const pageApi = (folder, slug) => `${folderApi(folder)}/pages/${enc(slug)}`;

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
  const iconBtn = (name, title, onClick, { cls = '', disabled = false } = {}) => {
    const b = el('button', `tool-btn ${cls}`.trim());
    b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); b.disabled = disabled;
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
  }));

  // small inline form for a folder's name and icon; replaces the row until saved or cancelled
  function folderForm(host, folder, onSave) {
    if (host.querySelector('.folder-form')) return;
    const hidden = [...host.children];
    hidden.forEach((c) => (c.hidden = true));
    const form = el('form', 'folder-form');
    const name = el('input', 'field'); name.type = 'text'; name.maxLength = 60; name.placeholder = 'folder name'; name.value = folder.label; name.required = true;
    const iconWrap = el('div', 'editor-icon');
    let glyph = svg(folder.icon || 'folder');
    const icon = el('input', 'field'); icon.type = 'text'; icon.placeholder = 'icon, e.g. map-pin'; icon.value = folder.icon || ''; icon.title = 'Phosphor icon name (phosphoricons.com)';
    icon.addEventListener('input', () => { const g = svg(icon.value.trim() || 'folder'); glyph.replaceWith(g); glyph = g; });
    iconWrap.append(glyph, icon);
    const row = el('div', 'folder-form-actions');
    const save = el('button', 'btn btn-primary', 'Save'); save.type = 'submit';
    const cancel = textBtn('Cancel', () => { form.remove(); hidden.forEach((c) => (c.hidden = false)); });
    const error = el('p', 'editor-error');
    row.append(save, cancel);
    form.append(name, iconWrap, row, error);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const label = name.value.trim();
      const ic = icon.value.trim().toLowerCase().replace(/^ph-/, '');
      if (!label) { error.textContent = 'Give the folder a name.'; return; }
      if (ic && icons && !icons[ic]) { error.textContent = `No Phosphor icon called "${ic}".`; return; }
      save.disabled = true;
      try { await onSave({ label, icon: ic }); } catch (err) { error.textContent = err.message; save.disabled = false; }
    });
    form.addEventListener('keydown', (e) => { if (e.key === 'Escape') cancel.click(); });
    host.append(form);
    name.focus(); name.select();
  }

  function decorateTree() {
    tree.querySelectorAll('.tree-tools, .tree-add').forEach((n) => n.remove());
    const list = folders();
    list.forEach((folder, fi) => {
      const tools = el('span', 'tree-tools');
      tools.append(
        iconBtn('arrow-up', 'Move folder up', () => call(`${folderApi(folder.id)}/move`, 'POST', { direction: 'up' }).then(() => go()), { disabled: fi === 0 }),
        iconBtn('arrow-down', 'Move folder down', () => call(`${folderApi(folder.id)}/move`, 'POST', { direction: 'down' }).then(() => go()), { disabled: fi === list.length - 1 }),
        iconBtn('pencil-simple', 'Rename folder or change its icon', () => folderForm(folder.el.querySelector('.tree-folder-row'), folder, async (v) => {
          await call(folderApi(folder.id), 'PUT', v); go();
        })),
        iconBtn('plus', 'New page in this folder', () => openEditor({ folderId: folder.id })),
        iconBtn('trash', 'Delete folder', async () => {
          const n = folder.pages.length;
          if (!confirm(`Delete the folder "${folder.label}"${n ? ` and its ${n} page${n === 1 ? '' : 's'}` : ''}?\n\nThis cannot be undone.`)) return;
          await call(folderApi(folder.id), 'DELETE'); go('/story/');
        }, { cls: 'tool-danger' }),
      );
      folder.el.querySelector('.tree-folder-row').append(tools);

      folder.pages.forEach((page, pi) => {
        const t = el('span', 'tree-tools');
        t.append(
          iconBtn('arrow-up', 'Move page up', () => call(`${pageApi(folder.id, page.slug)}/move`, 'POST', { direction: 'up' }).then(() => go()), { disabled: pi === 0 }),
          iconBtn('arrow-down', 'Move page down', () => call(`${pageApi(folder.id, page.slug)}/move`, 'POST', { direction: 'down' }).then(() => go()), { disabled: pi === folder.pages.length - 1 }),
        );
        page.el.append(t);
      });
    });
    const li = el('li', 'tree-add-row');
    const add = textBtn('+ New folder', () => folderForm(li, { label: '', icon: '' }, async (v) => {
      await call(`${API}/folders`, 'POST', v); go();
    }), 'tree-add');
    li.append(add); tree.append(li);
  }

  function decoratePage() {
    article.querySelectorAll('.page-tools').forEach((n) => n.remove());
    const { folder, slug } = article.dataset;
    if (!folder || !slug) return;
    const bar = el('div', 'page-tools');
    bar.append(textBtn('Edit page', () => openEditor({ folderId: folder, slug })));
    article.prepend(bar);
  }

  let dirty = () => false;
  window.addEventListener('beforeunload', (e) => { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });
  const confirmDiscard = () => !dirty() || confirm('Discard your unsaved changes?');

  async function openEditor({ folderId, slug = null }) {
    if (!confirmDiscard()) return;
    let data = { title: '', content: '', icon: '' };
    if (slug) data = await call(pageApi(folderId, slug), 'GET');

    const form = el('div', 'editor');
    const head = el('div', 'editor-head');
    const titleIn = el('input', 'field'); titleIn.type = 'text'; titleIn.maxLength = 120; titleIn.placeholder = 'Page title'; titleIn.value = data.title;
    const folderSel = el('select', 'field');
    folders().forEach((f) => { const o = el('option', null, f.label); o.value = f.id; folderSel.append(o); });
    folderSel.value = folderId;
    const iconWrap = el('div', 'editor-icon');
    const iconIn = el('input', 'field'); iconIn.type = 'text'; iconIn.placeholder = 'icon (optional)'; iconIn.value = data.icon || ''; iconIn.title = 'Phosphor icon name';
    let iconPreview = svg(data.icon || 'file-text');
    iconIn.addEventListener('input', () => { iconPreview.replaceWith(iconPreview = svg(iconIn.value.trim() || 'file-text')); });
    iconWrap.append(iconPreview, iconIn);
    head.append(titleIn, folderSel, iconWrap);

    const panes = el('div', 'editor-panes');
    const src = el('textarea', 'editor-source'); src.value = data.content; src.spellcheck = false; src.placeholder = 'Write markdown here. Images: ![](/story/' + folderId + '/photo.jpg)';
    const preview = el('div', 'editor-preview');
    const pvTitle = el('h1', 'page-title', titleIn.value || 'Untitled');
    const pvBody = el('div', 'prose');
    preview.append(pvTitle, pvBody);
    panes.append(src, preview);

    const foot = el('div', 'editor-foot');
    const error = el('p', 'editor-error'); error.setAttribute('role', 'alert');
    const hint = el('span', 'editor-hint', 'Ctrl+S saves, Esc cancels, Tab indents');
    const saveBtn = textBtn('Save', () => save(), 'btn-primary');
    const cancelBtn = textBtn('Cancel', () => cancel());
    foot.append(saveBtn, cancelBtn);
    if (slug) foot.append(textBtn('Delete', () => remove(), 'btn-danger'));
    foot.append(error, hint);
    form.append(head, panes, foot);

    dirty = () => titleIn.value !== data.title || src.value !== data.content || folderSel.value !== folderId || iconIn.value.trim() !== (data.icon || '');

    // preview: debounce, send to the server, drop out-of-order answers
    let timer = null, seq = 0;
    const refresh = async () => {
      const mine = ++seq;
      preview.classList.add('is-stale');
      try {
        const r = await call(`${API}/preview`, 'POST', { content: src.value });
        if (mine !== seq) return;
        pvBody.innerHTML = r.html;
        if (/\$|\\\(|\\\[/.test(src.value)) await typeset(pvBody);
      } catch (err) {
        if (mine === seq) pvBody.replaceChildren(el('p', 'editor-error', err.message));
      } finally {
        if (mine === seq) preview.classList.remove('is-stale');
      }
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(refresh, 400); };
    src.addEventListener('input', schedule);
    titleIn.addEventListener('input', () => { pvTitle.textContent = titleIn.value || 'Untitled'; });

    src.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const { selectionStart: a, selectionEnd: b } = src;
        src.setRangeText('  ', a, b, 'end');
        schedule();
      }
    });
    form.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });

    const save = async () => {
      const title = titleIn.value.trim();
      if (!title) { error.textContent = 'Give the page a title.'; titleIn.focus(); return; }
      error.textContent = '';
      saveBtn.disabled = true;
      try {
        const icon = iconIn.value.trim();
        if (icon && icons && !icons[icon]) throw new Error(`No Phosphor icon called "${icon}".`);
        let r;
        if (!slug) {
          r = await call(`${folderApi(folderSel.value)}/pages`, 'POST', { title, content: src.value, icon });
        } else {
          r = await call(pageApi(folderId, slug), 'PUT', { title, content: src.value, icon });
          if (folderSel.value !== folderId) r = await call(`${pageApi(folderId, slug)}/relocate`, 'POST', { folder: folderSel.value });
        }
        dirty = () => false;
        go(r.url);
      } catch (err) {
        error.textContent = err.message;
        saveBtn.disabled = false;
      }
    };
    const cancel = () => { if (!confirmDiscard()) return; dirty = () => false; go(); };
    const remove = async () => {
      if (!confirm(`Delete the page "${data.title}"?\n\nThis cannot be undone.`)) return;
      await call(pageApi(folderId, slug), 'DELETE');
      dirty = () => false;
      go(`/story/${enc(folderId)}/`);
    };

    article.replaceChildren(form);
    refresh();
    (slug ? src : titleIn).focus();
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
    else { tree.querySelectorAll('.tree-tools, .tree-add').forEach((n) => n.remove()); article.querySelectorAll('.page-tools').forEach((n) => n.remove()); }
  });
  Admin.refresh();
})();
