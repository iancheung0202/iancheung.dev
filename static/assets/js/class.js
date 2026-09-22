(() => {
    const button = document.getElementById('class-theme-toggle');
    if (!button) return;
    const icon = button.querySelector('i');

    const sync = () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const label = isDark ? 'Enable Light Mode' : 'Enable Dark Mode';
        button.title = label;
        button.setAttribute('aria-label', label);
        icon.className = isDark ? 'bi bi-moon-stars-fill' : 'bi bi-sun-fill';
    };
    sync();

    button.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const next = isDark ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('theme', next); } catch (_) { /* ignore */ }
        sync();
    });
})();

document.addEventListener('DOMContentLoaded', () => {
    const treeEl = document.getElementById('class-tree');
    const pageEl = document.getElementById('class-page');
    if (!treeEl || !pageEl) return;

    let folders = [];
    const pages = new Map();
    const bodyCache = new Map();
    let currentKey = null;
    let renderToken = 0;
    const openFolders = new Set(); 

    const isMobile = window.matchMedia('(max-width: 768px)');
    const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' });
    const FRONT_MATTER = /^\uFEFF?---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

    const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };

    const folderArrow = () => {
        const span = el('span', 'story-folder-arrow');
        span.innerHTML = '<svg viewBox="0 0 6 10" aria-hidden="true"><path d="M0 0 L6 5 L0 10 Z"/></svg>';
        return span;
    };

    const isMarkdownFile = (page) => /\.md$/i.test(page.title || page.url || '');

    const isPlainClick = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

    const pageHref = (key) => `#${key.split('/').map(encodeURIComponent).join('/')}`;
    const keyFromHash = () => {
        const raw = location.hash.replace(/^#/, '');
        if (!raw) return null;
        try {
            const key = raw.split('/').map(decodeURIComponent).join('/');
            return pages.has(key) ? key : null;
        } catch (_) {
            return null;
        }
    };

    const firstKey = () => {
        for (const folder of folders) if (folder.pages.length) return folder.pages[0].key;
        return null;
    };

    const externalLinkIcon = () => {
        const icon = document.createElement('i');
        icon.className = 'bi bi-box-arrow-up-right class-title-icon';
        icon.setAttribute('aria-hidden', 'true');
        return icon;
    };

    const buildTitle = (page) => {
        const h3 = el('h3', 'story-page-title');
        const link = el('a', 'class-title-link');
        link.href = page.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.title = 'Open in a new tab';
        link.append(el('span', null, page.title), externalLinkIcon());
        h3.append(link);
        return h3;
    };

    const buildMeta = (updated) => {
        const meta = el('div', 'story-meta');
        if (updated && !isNaN(updated)) {
            const time = el('time', null, `Last updated: ${dateFormat.format(updated)}`);
            time.dateTime = updated.toISOString();
            meta.append(time);
        }
        return meta;
    };

    const buildSidebar = () => {
        treeEl.replaceChildren();

        if (!folders.length) {
            treeEl.append(el('li', 'story-status', 'nothing here yet.'));
            return;
        }

        folders.forEach((folder) => {
            const folderEl = el('li', 'story-folder');
            folderEl.dataset.folderId = folder.id;

            if (folder.pages.some((p) => p.key === currentKey)) openFolders.add(folder.id);
            const isOpen = openFolders.has(folder.id);
            folderEl.classList.toggle('is-open', isOpen);

            const label = el('span', 'story-folder-label');
            label.setAttribute('role', 'button');
            label.tabIndex = 0;
            label.setAttribute('aria-expanded', String(isOpen));
            label.append(folderArrow());

            const fallbackIcon = () => el('span', 'story-folder-icon', '📁');
            if (folder.icon) {
                const img = el('img', 'story-folder-icon');
                img.alt = '';
                img.src = folder.icon;
                img.addEventListener('error', () => img.replaceWith(fallbackIcon()));
                label.append(img);
            } else {
                label.append(fallbackIcon());
            }
            label.append(el('span', null, folder.label));

            const list = el('ul');
            folder.pages.forEach((page) => {
                const item = el('li');
                const link = el('a', 'story-link', page.title);
                link.href = pageHref(page.key);
                link.dataset.page = page.key;
                item.append(link);
                list.append(item);
            });

            folderEl.append(label, list);
            treeEl.append(folderEl);
        });

        treeEl.querySelectorAll('.story-link').forEach((link) => {
            link.classList.toggle('active', link.dataset.page === currentKey);
        });
    };

    treeEl.addEventListener('click', (e) => {
        const link = e.target.closest('a.story-link');
        if (!link || !isPlainClick(e)) return;
        e.preventDefault();
        showPage(link.dataset.page, { scroll: true });
    });

    const toggleFolder = (label) => {
        const folderEl = label.closest('.story-folder');
        if (!folderEl) return;
        const id = folderEl.dataset.folderId;
        const nowOpen = !openFolders.has(id);
        if (nowOpen) openFolders.add(id); else openFolders.delete(id);
        folderEl.classList.toggle('is-open', nowOpen);
        label.setAttribute('aria-expanded', String(nowOpen));
    };

    treeEl.addEventListener('click', (e) => {
        const label = e.target.closest('.story-folder-label');
        if (!label || !isPlainClick(e)) return;
        toggleFolder(label);
    });

    treeEl.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const label = e.target.closest('.story-folder-label');
        if (!label) return;
        e.preventDefault();
        toggleFolder(label);
    });

    const loadTree = async () => {
        const res = await fetch('/api/class', { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status} for /api/class`);
        const data = await res.json();
        folders = data.folders || [];
        pages.clear();
        folders.forEach((folder) => folder.pages.forEach((page) => {
            page.folderId = folder.id;
            page.folderLabel = folder.label;
            pages.set(page.key, page);
        }));
        buildSidebar();
    };

    const renderEmpty = () => {
        currentKey = null;
        pageEl.replaceChildren(el('div', 'story-status', 'no files have been posted yet.'));
    };

    const loadMarkdown = async (page) => {
        if (bodyCache.has(page.key)) return bodyCache.get(page.key);
        const res = await fetch(page.url, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${page.url}`);
        const text = (await res.text()).replace(FRONT_MATTER, '');
        bodyCache.set(page.key, text);
        return text;
    };

    if (typeof marked !== 'undefined' && typeof markedKatex !== 'undefined' && !marked.__katexInstalled) {
        marked.use(markedKatex({ throwOnError: false }));
        marked.__katexInstalled = true;
    }

    const renderMarkdown = (md, page) => {
        if (typeof marked === 'undefined') throw new Error('marked failed to load');

        const tpl = document.createElement('template');
        tpl.innerHTML = marked.parse(md);
        const mdUrl = new URL(page.url, document.baseURI);

        tpl.content.querySelectorAll('img[src]').forEach((img) => {
            try {
                img.setAttribute('src', new URL(img.getAttribute('src'), mdUrl).href);
            } catch (_) { /* leave as written */ }
        });

        tpl.content.querySelectorAll('a[href]').forEach((a) => {
            const href = a.getAttribute('href');
            if (href.startsWith('#')) return;

            let url;
            try { url = new URL(href, mdUrl); } catch (_) { return; }
            if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

            if (url.origin !== location.origin) {
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
            } else {
                a.setAttribute('href', url.href);
            }
        });

        return tpl.content;
    };

    const showPage = async (key, { updateUrl = true, scroll = false } = {}) => {
        const page = pages.get(key);
        if (!page) return;
        const token = ++renderToken;
        currentKey = key;

        treeEl.querySelectorAll('.story-link').forEach((link) => {
            link.classList.toggle('active', link.dataset.page === key);
        });

        if (updateUrl && location.hash !== pageHref(key)) history.pushState(null, '', pageHref(key));

        const article = el('article', 'story-page-inner');

        if (isMarkdownFile(page)) {
            let body;
            try {
                const md = await loadMarkdown(page);
                body = renderMarkdown(md, page);
            } catch (err) {
                console.error('[class]', err);
                body = el('p', 'story-status', 'this file could not be loaded.');
            }
            if (token !== renderToken) return;

            const content = el('div', 'story-content');
            content.append(body);

            article.append(
                el('div', 'story-breadcrumb', `${page.folderLabel} /`),
                el('h3', null, page.title),
                content,
                buildMeta(new Date(page.updated))
            );
        } else {
            const frame = document.createElement('iframe');
            frame.className = 'class-frame';
            frame.src = page.url;
            frame.title = page.title;
            frame.loading = 'lazy';

            article.append(
                el('div', 'story-breadcrumb', `${page.folderLabel} /`),
                buildTitle(page),
                frame,
                buildMeta(new Date(page.updated))
            );
        }

        pageEl.replaceChildren(article);

        if (scroll && (isMobile.matches || pageEl.getBoundingClientRect().top < 0)) {
            pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const onLocationChange = () => {
        const key = keyFromHash();
        if (key && key !== currentKey) showPage(key, { updateUrl: false });
    };
    window.addEventListener('popstate', onLocationChange);
    window.addEventListener('hashchange', onLocationChange);

    (async () => {
        try {
            await loadTree();
            const first = keyFromHash() || firstKey();
            if (!first) {
                renderEmpty();
                return;
            }
            await showPage(first, { updateUrl: false });
        } catch (err) {
            console.error('[class]', err);
            treeEl.replaceChildren(el('li', 'story-status', "couldn't load the file list."));
            pageEl.replaceChildren(el('div', 'story-status', 'something went wrong while loading files.'));
        }
    })();
});