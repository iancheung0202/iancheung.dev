/*
 * The wall: sticky notes on a wooden board.
 * Notes come from /api/notes; posting needs a one-time code (or admin).
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

  let admin = false;
  const PAPERS = 4;

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

  const when = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toLowerCase();

  function note(n, fresh) {
    const c = h("article", "note" + (fresh ? " fresh" : ""));
    scatter(c);
    c.style.setProperty("--paper", `var(--paper-${Number.isInteger(n.paper) ? n.paper % PAPERS : 0})`);
    c.tabIndex = 0;
    c.setAttribute("aria-label", "Note: " + n.text);
    const inner = h("div", "note-inner");

    const front = h("div", "note-face note-front");
    const art = h("div", "note-art");
    if (n.img) {
      const im = h("img");
      im.alt = "";
      im.loading = "lazy";
      im.src = n.img;
      art.append(im);
    }
    front.append(art, h("div", "note-text", n.text));

    const back = h("div", "note-face note-back");
    back.inert = true;
    back.append(h("div", "note-from", n.name || "Anonymous"), h("div", "note-when", when(n.created)));
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
    const flip = () => {
      const on = c.classList.toggle("flipped");
      front.inert = on;
      back.inert = !on;
    };
    c.addEventListener("click", (e) => { if (!e.target.closest("button")) flip(); });
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

  $("#pad").addEventListener("click", () => (admin ? openComposer() : openAccessDialog()));

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

  // ---- composer: a fresh sticky note you can draw on ----
  const dlg = $("#notes-dialog"), sheet = $("#sheet"), cv = $("#notes-canvas"), ctx = cv.getContext("2d");
  const S = 400;
  cv.width = cv.height = S;
  const INKS = ["#2a2622", "#c0392b", "#d98e04", "#1f8a4c", "#2b6cb0", "#7c3aed"];
  const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif';
  const ALL_STAMPS = ["🐳", "🍵", "🌸", "⭐", "☁️", "🔥", "⛰️", "🎉", "🤠", "💙", "🖥️", "👀", "🐻", "🐾", "❗", "🎻", "🎵", "🫡"];
  function supportedEmoji(list) {
    try {
      const probe = document.createElement("canvas");
      probe.width = probe.height = 40;
      const px = probe.getContext("2d", { willReadFrequently: true });
      const sig = (ch) => {
        px.clearRect(0, 0, 40, 40);
        px.font = `28px ${EMOJI_FONT}`;
        px.textBaseline = "top";
        px.fillStyle = "#000";
        px.fillText(ch, 2, 2);
        return px.getImageData(0, 0, 40, 40).data;
      };
      const same = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
      const blank = (a) => { for (let i = 3; i < a.length; i += 4) if (a[i]) return false; return true; };
      const tofu = [sig("\u{10FFFF}"), sig("\u{FFFFD}")];
      const ok = list.filter((ch) => { const d = sig(ch); return !blank(d) && !tofu.some((t) => same(d, t)); });
      return ok.length ? ok : list;
    } catch { return list; }
  }
  const STAMPS = supportedEmoji(ALL_STAMPS);
  const st = { tool: "pen", ink: INKS[0], paper: 0, stamp: STAMPS[0], size: 6 };
  let undo = [], drawing = false, last = null;

  for (let i = 0; i < PAPERS; i++) {
    const b = h("button", "tray-sw tray-paper");
    b.type = "button"; b.dataset.k = "paper"; b.dataset.v = String(i);
    b.setAttribute("aria-label", "paper " + (i + 1));
    b.style.background = `var(--paper-${i})`;
    $("#notes-papers").append(b);
  }
  INKS.forEach((v) => {
    const b = h("button", "tray-sw");
    b.type = "button"; b.dataset.k = "ink"; b.dataset.v = v; b.setAttribute("aria-label", v); b.style.background = v;
    $("#notes-inks").append(b);
  });
  STAMPS.forEach((v) => {
    const b = h("button", "tray-stamp", v);
    b.type = "button"; b.dataset.k = "stamp"; b.dataset.v = v; b.setAttribute("aria-label", v);
    $("#notes-stamps").append(b);
  });

  function sync() {
    dlg.querySelectorAll("[data-k]").forEach((b) => b.classList.toggle("on", String(st[b.dataset.k]) === b.dataset.v));
    sheet.style.setProperty("--paper", `var(--paper-${st.paper})`);
  }
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) return dlg.close();
    const b = e.target.closest("[data-k]");
    if (!b) return;
    st[b.dataset.k] = b.dataset.k === "paper" ? Number(b.dataset.v) : b.dataset.v;
    if (b.dataset.k === "ink" && st.tool !== "pen") st.tool = "pen";
    if (b.dataset.k === "stamp") st.tool = "stamp";
    sync();
  });
  $("#notes-size").addEventListener("input", (e) => (st.size = +e.target.value));

  const pos = (e) => {
    const r = cv.getBoundingClientRect();
    return [((e.clientX - r.left) * S) / r.width, ((e.clientY - r.top) * S) / r.height];
  };
  const snap = () => { undo.push(ctx.getImageData(0, 0, S, S)); if (undo.length > 25) undo.shift(); };
  function stroke(x, y) {
    ctx.globalCompositeOperation = st.tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = st.ink;
    ctx.lineWidth = st.tool === "eraser" ? st.size * 3 : st.size;
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(...last);
    ctx.lineTo(x, y);
    ctx.stroke();
    last = [x, y];
  }
  cv.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    snap();
    const [x, y] = pos(e);
    if (st.tool === "stamp") {
      ctx.globalCompositeOperation = "source-over";
      ctx.font = `${st.size * 5 + 24}px ${EMOJI_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(st.stamp, x, y);
      return;
    }
    drawing = true;
    last = [x, y];
    stroke(x, y);
  });
  cv.addEventListener("pointermove", (e) => { if (drawing) stroke(...pos(e)); });
  ["pointerup", "pointercancel"].forEach((t) => cv.addEventListener(t, () => (drawing = false)));
  $("#notes-undo").addEventListener("click", () => { const s = undo.pop(); if (s) ctx.putImageData(s, 0, 0); });
  $("#notes-clear").addEventListener("click", () => { snap(); ctx.clearRect(0, 0, S, S); });
  $("#notes-cancel").addEventListener("click", () => dlg.close());

  const err = (m) => ($("#notes-error").textContent = m || "");
  function openComposer() {
    err("");
    sync();
    dlg.showModal();
    $("#notes-text").focus();
  }
  const hasDrawing = () => ctx.getImageData(0, 0, S, S).data.some((v, i) => i % 4 === 3 && v);

  // ---- access code ----
  const accessDlg = $("#access-dialog");
  const boxes = $$(".access-box");
  const boxWrap = $("#access-boxes");
  const accessErr = (m) => ($("#access-error").textContent = m || "");
  let ticket = null;

  function openAccessDialog() {
    accessErr("");
    boxes.forEach((b) => { b.value = ""; b.disabled = false; });
    accessDlg.showModal();
    boxes[0].focus();
  }
  function shake() { boxWrap.classList.remove("shake"); void boxWrap.offsetWidth; boxWrap.classList.add("shake"); }
  async function submitCode() {
    const code = boxes.map((b) => b.value).join("");
    if (code.length !== 6) return;
    accessErr("");
    boxes.forEach((b) => (b.disabled = true));
    try {
      ticket = (await api("/api/notes/access", { method: "POST", body: JSON.stringify({ code }) })).ticket;
      accessDlg.close();
      openComposer();
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
  $("#access-cancel").addEventListener("click", () => accessDlg.close());
  accessDlg.addEventListener("click", (e) => { if (e.target === accessDlg) accessDlg.close(); });

  $("#notes-submit").addEventListener("click", async (e) => {
    const text = $("#notes-text").value.trim();
    const name = $("#notes-name").value.trim();
    if (!text) return err("Write something on the note first.");
    if (!name) return err("Sign it with your name.");
    err("");
    e.target.disabled = true;
    try {
      const body = { text, name, paper: st.paper, ticket };
      if (hasDrawing()) body.image = cv.toDataURL("image/png");
      const n = await api("/api/notes", { method: "POST", body: JSON.stringify(body) });
      ticket = null;
      dlg.close();
      ctx.clearRect(0, 0, S, S);
      undo = [];
      $("#notes-text").value = $("#notes-name").value = "";
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
