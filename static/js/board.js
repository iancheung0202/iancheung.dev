/*
 * The wall: sticky notes on a wooden board.
 * Notes come from /api/notes; posting needs a one-time code (or admin).
 * The code gate is a sheet peeled off the pad; the composer draws with js-draw
 * (loaded on first use) on a square sheet; notes turn over with PaperFlip.
 */
(function () {
  "use strict";
  const wall = document.getElementById("notes-wall");
  if (!wall) return;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const h = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const api = (url, opts = {}) =>
    fetch(url, {
      credentials: "same-origin",
      ...opts,
      headers: { "Content-Type": "application/json", "X-Requested-With": "fetch", ...(opts.headers || {}) },
    }).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 401 && window.SiteAdmin) window.SiteAdmin.refresh();
        throw new Error(d.error || "Something went wrong.");
      }
      return d;
    });
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let admin = false;
  const PAPERS = 4;
  const PAPER_NAMES = ["Yellow paper", "Pink paper", "Blue paper", "Green paper"];

  // each note gets its own small imperfection
  const rand = (a, b) => a + Math.random() * (b - a);
  function scatter(el) {
    el.style.setProperty("--rot", rand(-4.5, 4.5).toFixed(2) + "deg");
    el.style.setProperty("--dx", rand(-5, 5).toFixed(1) + "px");
    el.style.setProperty("--dy", rand(-6, 6).toFixed(1) + "px");
    el.style.setProperty("--scale", rand(0.96, 1.04).toFixed(3));
  }

  let toastTimer = null;
  function toast(msg) {
    let t = $(".notes-toast");
    if (!t) { t = h("div", "notes-toast"); document.body.append(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
  }

  function peelAway(noteEl, after) {
    noteEl.classList.add("peeling");
    let done = false;
    const finish = () => { if (done) return; done = true; noteEl.remove(); after && after(); };
    noteEl.addEventListener("animationend", finish, { once: true });
    setTimeout(finish, 800);
  }

  const when = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };
  const isLong = (name) => (name || "").length > 14;

  // ---- painting a note onto a canvas, for the flip ----
  const HAND = (w, s) => `${w} ${s}px Caveat, cursive`;
  function wrapLines(g, text, maxW, maxLines) {
    const words = String(text).split(/\s+/).filter(Boolean), lines = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? cur + " " + w : w;
      if (g.measureText(t).width <= maxW || !cur) cur = t;
      else { lines.push(cur); cur = w; }
      if (lines.length === maxLines) break;
    }
    if (lines.length < maxLines && cur) lines.push(cur);
    if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
      let last = lines[maxLines - 1];
      while (last && g.measureText(last + "…").width > maxW) last = last.slice(0, -1);
      lines[maxLines - 1] = last + "…";
    }
    return lines;
  }
  function paintFront(n, img) {
    return (g, w) => {
      const k = w / 190;
      g.fillStyle = "#2a2622";
      if (img && img.complete && img.naturalWidth) {
        const bx = 14 * k, by = 18 * k, bw = w - 28 * k, bh = w - 62 * k;
        const s = Math.min(bw / img.naturalWidth, bh / img.naturalHeight, 1 * k);
        const iw = img.naturalWidth * s, ih = img.naturalHeight * s;
        g.drawImage(img, bx + (bw - iw) / 2, by + (bh - ih) / 2, iw, ih);
      }
      g.font = HAND(500, 20 * k);
      g.textAlign = "center";
      g.textBaseline = "alphabetic";
      const lines = wrapLines(g, n.text, w - 20 * k, 2), lh = 21 * k;
      lines.forEach((ln, i) => g.fillText(ln, w / 2, w - 10 * k - (lines.length - 1 - i) * lh - 4 * k));
      // the lifted corner
      const c = 24 * k;
      g.fillStyle = "rgba(0,0,0,0.12)";
      g.beginPath(); g.moveTo(w - c, w); g.lineTo(w, w - c); g.lineTo(w, w); g.closePath(); g.fill();
      const grd = g.createLinearGradient(w - c, w, w, w - c);
      grd.addColorStop(0, "rgba(0,0,0,0.18)"); grd.addColorStop(0.5, "rgba(255,255,255,0.25)"); grd.addColorStop(1, "rgba(255,255,255,0.55)");
      g.fillStyle = grd;
      g.beginPath(); g.moveTo(w - c, w); g.lineTo(w, w - c); g.lineTo(w - c, w - c); g.closePath(); g.fill();
    };
  }
  function paintBack(n) {
    return (g, w) => {
      const k = w / 190, ink = "#2a2622";
      g.fillStyle = ink;
      g.textAlign = "center";
      g.textBaseline = "middle";
      const name = n.name || "Anonymous", long = isLong(name);
      g.font = HAND(700, (long ? 21 : 26) * k);
      const lines = wrapLines(g, name, w - 32 * k, 2), lh = (long ? 22 : 27) * k;
      const rows = lines.length + 1 + (n.url ? 1 : 0);
      let y = w / 2 - ((rows - 1) * 20 * k + (lines.length - 1) * (lh - 20 * k)) / 2;
      lines.forEach((ln) => {
        g.fillText(ln, w / 2, y);
        if (n.url) { const tw = g.measureText(ln).width; g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(w / 2 - tw / 2, y + lh * 0.42, tw, 2 * k); g.fillStyle = ink; }
        y += lh;
      });
      g.globalAlpha = 0.65;
      g.font = HAND(500, 16 * k);
      g.fillText(when(n.created), w / 2, y + 2 * k);
      if (n.url) { y += 20 * k; g.font = HAND(500, 14 * k); g.fillText(hostOf(n.url), w / 2, y + 2 * k); }
      g.globalAlpha = 1;
    };
  }

  function note(n, fresh) {
    const c = h("article", "note" + (fresh ? " fresh" : ""));
    scatter(c);
    c.style.setProperty("--paper", `var(--paper-${Number.isInteger(n.paper) ? n.paper % PAPERS : 0})`);
    c.tabIndex = 0;
    c.setAttribute("aria-label", "Note: " + n.text);
    const inner = h("div", "note-inner");

    const front = h("div", "note-face note-front");
    const art = h("div", "note-art");
    let im = null;
    if (n.img) {
      im = h("img");
      im.alt = "";
      im.loading = "lazy";
      im.src = n.img;
      art.append(im);
    }
    front.append(art, h("div", "note-text", n.text));

    const back = h("div", "note-face note-back");
    back.inert = true;
    const name = n.name || "Anonymous";
    const who = h(n.url ? "a" : "div", "note-from" + (isLong(name) ? " long" : ""), name);
    if (n.url) {
      who.href = n.url;
      who.target = "_blank";
      who.rel = "noopener nofollow ugc";
      who.dataset.tip = hostOf(n.url);
    }
    back.append(who, h("div", "note-when", when(n.created)));
    if (n.url) back.append(h("div", "note-www", hostOf(n.url)));
    if (admin) {
      const del = h("button", "note-del", "Tear off");
      del.type = "button";
      del.addEventListener("click", async () => {
        if (!confirm("Tear this note off the wall for good?")) return;
        try {
          await api("/api/notes/" + n.id, { method: "DELETE" });
          peelAway(c, load);
        } catch (e) { alert(e.message); }
      });
      back.append(del);
    }

    inner.append(front, back);
    c.append(inner);
    const settle = (on) => {
      c.classList.add("snap");
      c.classList.toggle("flipped", on);
      requestAnimationFrame(() => requestAnimationFrame(() => c.classList.remove("snap")));
    };
    const flip = () => {
      if (window.PaperFlip && PaperFlip.isBusy(c)) return;
      const on = !c.classList.contains("flipped");
      front.inert = on;
      back.inert = !on;
      const paper = getComputedStyle(front).backgroundColor;
      const ok = !reduced() && window.PaperFlip && PaperFlip.flip(c, { paper, toBack: on, front: paintFront(n, im), back: paintBack(n), onDone: () => settle(on) });
      if (!ok) c.classList.toggle("flipped", on);
    };
    c.addEventListener("click", (e) => { if (!e.target.closest("button, a")) flip(); });
    c.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target === c) { e.preventDefault(); flip(); }
    });
    return c;
  }

  let offset = 0, hasMore = false, moreBtn = null;
  function renderMore() {
    moreBtn?.remove();
    moreBtn = null;
    if (!hasMore) return;
    moreBtn = h("button", "btn board-more", "More notes");
    moreBtn.type = "button";
    moreBtn.addEventListener("click", async () => {
      moreBtn.disabled = true;
      moreBtn.textContent = "Loading…";
      await load(false);
    });
    wall.append(moreBtn);
  }

  async function load(initial = true) {
    try {
      const d = await api(initial ? "/api/notes" : `/api/notes?offset=${offset}`);
      admin = d.admin;
      hasMore = !!d.has_more;
      offset = initial ? d.notes.length : offset + d.notes.length;
      if (initial) {
        wall.replaceChildren(...d.notes.map((n) => note(n)));
        if (!d.notes.length) wall.append(h("p", "board-msg", "Nothing here yet. Peel a note off the pad."));
      } else {
        moreBtn?.remove();
        moreBtn = null;
        wall.append(...d.notes.map((n) => note(n)));
      }
      renderMore();
    } catch {
      if (initial) wall.replaceChildren(h("p", "board-msg", "the wall is not answering right now."));
      else toast("Couldn't load more notes right now.");
    }
  }

  // ---- the sheet: the pad's top sheet grows into the dialog's paper, and shrinks back onto the pad ----
  const pad = $("#pad"), padTop = $(".pad-top");
  const spot = (el) => {
    const r = el.getBoundingClientRect(), m = new DOMMatrix(getComputedStyle(el).transform);
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: el.offsetWidth * (Math.hypot(m.a, m.b) || 1), rot: Math.atan2(m.b, m.a) };
  };
  const FLIGHT = 620;
  // the transform that puts `el`, resting at `at`, onto the spot `s`
  const toward = (el, at, s) => `translate(${s.cx - at.cx}px, ${s.cy - at.cy}px) rotate(${s.rot}rad) scale(${s.w / el.offsetWidth})`;
  const settle = (el) => new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; el.removeEventListener("transitionend", onEnd); resolve(); };
    const onEnd = (e) => { if (e.target === el && e.propertyName === "transform") finish(); };
    el.addEventListener("transitionend", onEnd);
    setTimeout(finish, FLIGHT + 150);
  });
  // the composer is not a modal dialog (js-draw's colour picker lives in <body> and would end up under the top layer),
  // so it brings its own shade; the gate is modal
  const shade = h("div", "composer-shade");
  shade.hidden = true;
  document.body.append(shade);
  function openDialog(dlg) {
    if (dlg.dataset.modal === "no") { shade.hidden = false; dlg.show(); } else dlg.showModal();
  }
  function closeDialog(dlg) {
    if (dlg.dataset.modal === "no") shade.hidden = true;
    if (dlg.open) dlg.close();
  }
  // open a dialog: its paper `sel` starts as the small sheet at `from` and grows into place while the rest fades in
  async function openWithSheet(dlg, sel, from) {
    const paper = dlg.querySelector(sel);
    dlg.classList.add("bare");
    shade.classList.add("bare");
    openDialog(dlg);
    if (!reduced()) {
      paper.style.transition = "none";
      paper.style.transform = toward(paper, spot(paper), from);
      paper.getBoundingClientRect();
      paper.style.transition = "";
      dlg.classList.add("flying");
      paper.style.transform = "";
    }
    dlg.classList.remove("bare");
    shade.classList.remove("bare");
    if (!reduced()) await settle(paper);
    dlg.classList.remove("flying");
  }
  // close a dialog: its paper shrinks back onto the pad while the rest fades out
  function closeToPad(dlg, sel) {
    const paper = dlg.querySelector(sel);
    if (dlg.classList.contains("flying")) return;
    if (reduced()) { closeDialog(dlg); pad.classList.remove("peeled"); return; }
    dlg.classList.add("flying", "bare");
    shade.classList.add("bare");
    paper.style.transform = toward(paper, spot(paper), spot(padTop));
    settle(paper).then(() => {
      closeDialog(dlg);
      paper.style.transform = "";
      dlg.classList.remove("flying", "bare");
      shade.classList.remove("bare");
      pad.classList.remove("peeled");
    });
  }

  pad.addEventListener("click", () => {
    if (pad.classList.contains("peeled")) return;
    pad.classList.add("peeled");
    admin ? openComposer(spot(padTop)) : openAccessDialog();
  });

  $("#notes-admin").addEventListener("click", () => {
    if (!window.SiteAdmin) return alert("Admin tools failed to load. Refresh the page and try again.");
    window.SiteAdmin.toggle();
  });

  // live one-time code, admin only
  const codeEl = $("#notes-admin-code");
  const regenBtn = $("#notes-admin-regen");
  let codeTimer = null;
  function renderCode(d) {
    codeEl.hidden = false;
    codeEl.innerHTML = `One-time code: <b>${d.code}</b> (resets in ${d.seconds_left}s)`;
  }
  async function refreshCode() {
    try { renderCode(await window.SiteAdmin.api("/api/admin/wall-code")); } catch { codeEl.hidden = true; }
  }
  function startCode() { clearInterval(codeTimer); refreshCode(); codeTimer = setInterval(refreshCode, 1000); regenBtn.hidden = false; }
  function stopCode() { clearInterval(codeTimer); codeTimer = null; codeEl.hidden = true; regenBtn.hidden = true; }
  regenBtn.addEventListener("click", async () => {
    regenBtn.disabled = true;
    try { renderCode(await window.SiteAdmin.api("/api/admin/wall-code/regenerate", { method: "POST" })); }
    catch (e) { toast(e.message || "Couldn't regenerate the code."); }
    finally { regenBtn.disabled = false; }
  });
  if (window.SiteAdmin) {
    window.SiteAdmin.subscribe((isAdmin) => {
      if (isAdmin !== admin) load();
      isAdmin ? startCode() : stopCode();
    });
  }

  // ---- composer: a fresh sticky note you draw on with js-draw ----
  const dlg = $("#notes-dialog"), sheet = $("#sheet"), edHost = $("#notes-editor");
  dlg.dataset.modal = "no";
  document.body.append(dlg); // out of the page's stacking contexts, so it layers above the shade and under the flying sheet
  const S = 400;
  const st = { paper: 0 };

  for (let i = 0; i < PAPERS; i++) {
    const b = h("button", "tray-sw tray-paper");
    b.type = "button"; b.dataset.k = "paper"; b.dataset.v = String(i);
    b.setAttribute("aria-label", PAPER_NAMES[i]);
    b.dataset.tip = PAPER_NAMES[i];
    b.style.background = `var(--paper-${i})`;
    $("#notes-papers").append(b);
  }

  function sync() {
    dlg.querySelectorAll("[data-k]").forEach((b) => b.classList.toggle("on", String(st[b.dataset.k]) === b.dataset.v));
    sheet.style.setProperty("--paper", `var(--paper-${st.paper})`);
  }
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) return closeComposer();
    const b = e.target.closest("[data-k]");
    if (!b) return;
    if (b.dataset.k === "paper") st.paper = Number(b.dataset.v);
    sync();
  });

  // js-draw, loaded the first time the composer opens
  let J = null, ED = null, loading = null;
  function loadJsDraw() {
    if (window.jsdraw) return Promise.resolve(window.jsdraw);
    loading = loading || new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/vendor/js-draw/js-draw.js";
      s.onload = () => resolve(window.jsdraw);
      s.onerror = () => { loading = null; reject(new Error("The drawing tools didn't load. Check your connection and try again.")); };
      document.head.append(s);
    });
    return loading;
  }
  const sheetRect = () => new J.Rect2(0, 0, S, S);
  function fit() { if (ED) ED.viewport.resetTransform(); }
  // the sheet is always exactly the view: every viewport change js-draw or a tool asks for (pan, zoom to a
  // selection, autoscroll while dragging, a reset) lands on the same fitted transform
  function lockViewport() {
    const vp = ED.viewport, reset = vp.resetTransform.bind(vp);
    vp.resetTransform = () => {
      const area = edHost.querySelector(".imageEditorRenderArea");
      const w = area ? area.clientWidth : 0, hgt = area ? area.clientHeight : 0;
      if (!w || !hgt) return;
      // computed from the render area itself (js-draw's own screen size can lag a layout change)
      const scale = Math.min(w, hgt) / S;
      if (!isFinite(scale) || scale <= 0) return;
      reset(J.Mat33.translation(J.Vec2.of((w - S * scale) / 2, (hgt - S * scale) / 2)).rightMul(J.Mat33.scaling2D(scale)));
    };
  }
  function setupEditor() {
    J = window.jsdraw;
    ED = new J.Editor(edHost, { wheelEventsEnabled: false });
    ED.dispatch(ED.setBackgroundStyle({ color: J.Color4.transparent, autoresize: false }), false);
    ED.dispatch(ED.image.setImportExportRect(sheetRect()), false);
    ED.dispatch(ED.image.setAutoresizeEnabled(false), false);
    ED.toolController.getMatchingTools(J.PanZoomTool).forEach((t) => t.setEnabled(false));
    lockViewport();
    // js-draw outlines the page when autoresize is off; the sheet is the page, so no outline
    const rerender = ED.rerender.bind(ED);
    ED.rerender = () => rerender(false);
    const tb = J.makeEdgeToolbar(ED);
    try { tb.addWidgetsForPrimaryTools((t) => !(t instanceof J.PanZoomTool)); } catch { tb.addWidgetsForPrimaryTools(); }
    tb.addUndoRedoButtons();
    // our tooltips instead of js-draw's labels
    const TIPS = { "Pen 1": "Pen", "Pen 2": "Marker", "Pen 3": "Highlighter", Select: "Select, move, resize", Text: "Type on the note" };
    const tipify = () => {
      edHost.querySelectorAll(".toolbar-button").forEach((b) => {
        const l = b.querySelector("label");
        if (l && l.textContent.trim()) b.dataset.tip = TIPS[l.textContent.trim()] || l.textContent.trim();
        b.removeAttribute("title");
      });
      // js-draw's own title= tooltips (menus, colour picker) become the site's pill too
      edHost.querySelectorAll("[title]").forEach((el) => {
        const t = el.getAttribute("title");
        if (t) { el.dataset.tip = t; el.classList.add("has-tip"); }
        el.removeAttribute("title");
      });
    };
    tipify();
    new MutationObserver(tipify).observe(edHost, { childList: true, subtree: true });
    new ResizeObserver(() => fit()).observe(edHost.querySelector(".imageEditorRenderArea") || edHost);
    fit();
  }
  // a js-draw tool menu that is open (pen settings, text options...)
  const openMenuButton = () => edHost.querySelector(".toolbar-toolContainer.dropdownVisible .toolbar-button");
  const closeMenus = () => { const b = openMenuButton(); if (b) b.click(); };
  const hasDrawing = () => !!(ED && ED.image.getAllElements().length);
  // start over: a blank note, same paper
  $("#notes-clear").addEventListener("click", () => {
    ["#notes-text", "#notes-name", "#notes-url"].forEach((s) => ($(s).value = ""));
    err("");
    if (!ED) return;
    const all = ED.image.getAllElements();
    if (all.length) ED.dispatch(new J.Erase(all));
  });

  const err = (m) => ($("#notes-error").textContent = m || "");
  async function openComposer(from) {
    err("");
    sync();
    edHost.classList.remove("failed");
    const ready = loadJsDraw().then(() => { if (!ED) setupEditor(); }).catch((e) => { edHost.classList.add("failed"); err(e.message); });
    await openWithSheet(dlg, "#sheet", from);
    await ready;
    fit();
    $("#notes-text").focus();
  }
  function closeComposer() {
    closeMenus();
    closeToPad(dlg, "#sheet");
  }
  $("#notes-cancel").addEventListener("click", closeComposer);
  // Esc closes an open tool menu first, the composer only when none is open
  dlg.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    if (document.getElementById("clr-picker")?.classList.contains("clr-open")) return; // the colour picker closes itself
    if (openMenuButton()) closeMenus(); else closeComposer();
  }, true);
  shade.addEventListener("click", () => { if (dlg.open) closeComposer(); });
  // the colour picker lives outside the dialog and closes itself on Esc (keydown); focus then returns to the pen menu,
  // whose own Esc handling runs on keyup, so that keyup is marked handled and the menu stays open
  let escUsedByPicker = false;
  document.addEventListener("keydown", (e) => {
    const picker = document.getElementById("clr-picker");
    if (e.key === "Escape" && dlg.open && picker && picker.classList.contains("clr-open")) escUsedByPicker = true;
  }, true);
  document.addEventListener("keyup", (e) => {
    if (e.key === "Escape" && escUsedByPicker) { escUsedByPicker = false; e.preventDefault(); e.stopPropagation(); }
  }, true);

  // ---- the gate: a sheet off the pad asking for the code ----
  const accessDlg = $("#access-dialog");
  const boxes = $$(".gate-box");
  const boxWrap = $("#access-boxes");
  const accessErr = (m) => ($("#access-error").textContent = m || "");
  let ticket = null;

  async function openAccessDialog() {
    accessErr("");
    boxWrap.classList.remove("shake");
    boxes.forEach((b) => { b.value = ""; b.disabled = false; });
    await openWithSheet(accessDlg, "#gate", spot(padTop));
    boxes[0].focus();
  }
  function closeAccessDialog() { closeToPad(accessDlg, "#gate"); }
  function shake() { boxWrap.classList.remove("shake"); void boxWrap.offsetWidth; boxWrap.classList.add("shake"); }
  async function submitCode() {
    const code = boxes.map((b) => b.value).join("");
    if (code.length !== 6) return;
    accessErr("");
    boxes.forEach((b) => (b.disabled = true));
    try {
      ticket = (await api("/api/notes/access", { method: "POST", body: JSON.stringify({ code }) })).ticket;
      const from = spot($("#gate"));
      accessDlg.classList.add("bare");
      accessDlg.close();
      accessDlg.classList.remove("bare");
      openComposer(from);
    } catch (e) {
      accessErr(e.message);
      shake();
      boxes.forEach((b) => { b.value = ""; b.disabled = false; });
      boxes[0].focus();
    }
  }
  boxes.forEach((box, i) => {
    box.addEventListener("input", () => {
      box.value = box.value.replace(/\D/g, "").slice(-1);
      if (box.value && boxes[i + 1]) boxes[i + 1].focus();
      if (boxes.every((b) => b.value)) submitCode();
    });
    box.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !box.value && boxes[i - 1]) boxes[i - 1].focus();
    });
    box.addEventListener("paste", (e) => {
      const text = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "");
      if (!text) return;
      e.preventDefault();
      boxes.forEach((b, j) => (b.value = text[j] || ""));
      (boxes.find((b) => !b.value) || boxes[boxes.length - 1]).focus();
      if (boxes.every((b) => b.value)) submitCode();
    });
  });
  $("#access-cancel").addEventListener("click", closeAccessDialog);
  accessDlg.addEventListener("click", (e) => { if (e.target === accessDlg) closeAccessDialog(); });
  accessDlg.addEventListener("cancel", (e) => { e.preventDefault(); closeAccessDialog(); });

  $("#notes-submit").addEventListener("click", async (e) => {
    const text = $("#notes-text").value.trim();
    const name = $("#notes-name").value.trim();
    const url = $("#notes-url").value.trim();
    if (!text) return err("Write something on the note first.");
    if (!name) return err("Sign it with your name.");
    err("");
    e.target.disabled = true;
    try {
      const body = { text, name, url, paper: st.paper, ticket };
      if (hasDrawing()) body.image = ED.toDataURL("image/png", J.Vec2.of(S, S));
      const n = await api("/api/notes", { method: "POST", body: JSON.stringify(body) });
      ticket = null;
      closeMenus();
      closeDialog(dlg);
      pad.classList.remove("peeled");
      if (ED) { const all = ED.image.getAllElements(); if (all.length) ED.dispatch(new J.Erase(all), false); }
      $("#notes-text").value = $("#notes-name").value = $("#notes-url").value = "";
      wall.querySelector(".board-msg")?.remove();
      wall.prepend(note(n, true));
    } catch (x) {
      err(x.message);
    } finally {
      e.target.disabled = false;
    }
  });

  sync();
  load();
})();
