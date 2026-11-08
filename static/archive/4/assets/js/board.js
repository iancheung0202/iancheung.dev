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

  // A pencil, not a camera — this wall is about leaving a mark, not a photo.
  const PENCIL = '<svg viewBox="0 0 64 52" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 38l2.5-12.5L39 3a4.2 4.2 0 0 1 6 0l3 3a4.2 4.2 0 0 1 0 6L25.5 34.5z"/><path d="M32 9.5l9.5 9.5"/><path d="M11 44.5h24"/></svg>';
  let admin = false;

  function randomTilt() {
    return (Math.random() * 9 - 4.5).toFixed(2) + "deg";
  }

  function trashAndRemove(cardEl, after) {
    cardEl.classList.add("trashing");
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      cardEl.remove();
      after && after();
    };
    cardEl.addEventListener("animationend", done, { once: true });
    setTimeout(done, 900);
  }

  let toastTimer = null;
  function toast(msg) {
    let t = document.querySelector(".notes-toast");
    if (!t) { t = h("div", "notes-toast"); document.body.append(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
  }

  function addTile() {
    const b = h("button", "pcard pcard-add");
    b.type = "button";
    b.setAttribute("aria-label", "Leave a message");
    const f = h("div", "pface");
    f.innerHTML = PENCIL;
    // f.append(h("div", "pcap", "leave a message"));
    b.append(h("div", "pcard-inner"));
    b.firstChild.append(f);
    b.addEventListener("click", () => (admin ? openComposer() : openAccessDialog()));
    return b;
  }

  function card(n, fresh) {
    const c = h("article", "pcard" + (fresh ? " printing" : ""));
    c.style.setProperty("--rot", randomTilt());
    c.tabIndex = 0;
    c.setAttribute("aria-label", "Note: " + n.text);
    const inner = h("div", "pcard-inner");
    const front = h("div", "pface");
    const photo = h("div", "pphoto");
    if (n.img) {
      const im = h("img");
      im.alt = "";
      im.loading = "lazy";
      const dev = () => setTimeout(() => photo.classList.add("developed"), 250 + Math.random() * 600);
      im.addEventListener("load", dev);
      im.addEventListener("error", dev);
      im.src = n.img;
      photo.append(im);
    }
    front.append(photo, h("div", "pcap", n.text));

    const back = h("div", "pface pback");
    back.inert = true;
    const date = new Date(n.created).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    back.append(h("div", "pdate", date.toUpperCase()), h("div", "pname", n.name ? "— " + n.name : "— anonymous"));
    if (admin) {
      const del = h("button", "pbtn", "Delete");
      del.type = "button";
      del.addEventListener("click", async () => {
        if (!confirm("Delete this note for good?")) return;
        try {
          await api("api/notes/" + n.id, { method: "DELETE" });
          trashAndRemove(c, load);
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

  let offset = 0;
  let hasMore = false;
  let loadMoreBtn = null;

  function renderLoadMore() {
    loadMoreBtn?.remove();
    loadMoreBtn = null;
    if (!hasMore) return;
    loadMoreBtn = h("button", "notes-more", "Load more");
    loadMoreBtn.type = "button";
    loadMoreBtn.addEventListener("click", async () => {
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = "Loading…";
      await load(false);
    });
    wall.append(loadMoreBtn);
  }

  async function load(initial = true) {
    try {
      const url = initial ? "api/notes" : `api/notes?offset=${offset}`;
      const d = await api(url);
      admin = d.admin;
      hasMore = !!d.has_more;
      if (initial) offset = d.notes.length;
      else offset += d.notes.length;

      if (initial) {
        wall.replaceChildren(addTile(), ...d.notes.map((n) => card(n)));
        if (!d.notes.length) wall.append(h("p", "notes-msg", "the wall is empty. be the first to leave something."));
      } else {
        loadMoreBtn?.remove();
        loadMoreBtn = null;
        wall.append(...d.notes.map((n) => card(n)));
      }
      renderLoadMore();
    } catch {
      if (initial) wall.replaceChildren(addTile(), h("p", "notes-msg", "couldn't load the wall right now."));
      else toast("Couldn't load more notes right now.");
    }
  }

  $("#notes-admin").addEventListener("click", () => {
    if (!window.SiteAdmin) return alert("Admin tools failed to load. Refresh the page and try again.");
    window.SiteAdmin.toggle();
  });

  // Live-updating access code, visible only in admin mode.
  const codeEl = $("#notes-admin-code");
  const regenBtn = $("#notes-admin-regen");
  let codeTimer = null;
  function renderCode(d) {
    codeEl.hidden = false;
    codeEl.innerHTML = `One-time code: <b>${d.code}</b> (resets in ${d.seconds_left}s)`;
  }
  async function refreshCode() {
    try {
      renderCode(await window.SiteAdmin.api("api/admin/wall-code"));
    } catch {
      codeEl.hidden = true;
    }
  }
  function startCodePolling() {
    clearInterval(codeTimer);
    refreshCode();
    codeTimer = setInterval(refreshCode, 1000);
    if (regenBtn) regenBtn.hidden = false;
  }
  function stopCodePolling() {
    clearInterval(codeTimer);
    codeTimer = null;
    codeEl.hidden = true;
    if (regenBtn) regenBtn.hidden = true;
  }
  regenBtn?.addEventListener("click", async () => {
    regenBtn.disabled = true;
    try {
      renderCode(await window.SiteAdmin.api("api/admin/wall-code/regenerate", { method: "POST" }));
    } catch (e) {
      toast(e.message || "Couldn't regenerate the code.");
    } finally {
      regenBtn.disabled = false;
    }
  });

  if (window.SiteAdmin) {
    window.SiteAdmin.subscribe((isAdmin) => {
      if (isAdmin !== admin) load();
      isAdmin ? startCodePolling() : stopCodePolling();
    });
  }

  const dlg = $("#notes-dialog"), cv = $("#notes-canvas"), ctx = cv.getContext("2d");
  const S = 400;
  cv.width = cv.height = S;
  const INKS = ["#1b1b1b", "#e5484d", "#f5a524", "#18d26e", "#2b7fff", "#a855f7"];
  const PAPERS = ["#ffffff", "#fff4c2", "#d9ecff", "#ffd9e6", "#dff5e1", "#1b1b1b"];
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
  const st = { tool: "pen", ink: INKS[0], paper: PAPERS[0], stamp: STAMPS[0], size: 6 };
  let undo = [], drawing = false, last = null;

  const fill = (box, list, cls, style) => list.forEach((v) => {
    const b = h("button", cls);
    b.type = "button";
    b.dataset.k = box.id === "notes-inks" ? "ink" : box.id === "notes-papers" ? "paper" : "stamp";
    b.dataset.v = v;
    b.setAttribute("aria-label", v);
    style ? (b.style.background = v) : (b.textContent = v);
    box.append(b);
  });
  fill($("#notes-inks"), INKS, "notes-sw", true);
  fill($("#notes-papers"), PAPERS, "notes-sw", true);
  fill($("#notes-stamps"), STAMPS, "notes-stamp", false);

  function sync() {
    dlg.querySelectorAll("[data-k]").forEach((b) => b.classList.toggle("on", String(st[b.dataset.k]) === b.dataset.v));
    cv.style.background = st.paper;
  }
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) return dlg.close();
    const b = e.target.closest("[data-k]");
    if (!b) return;
    st[b.dataset.k] = b.dataset.v;
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

  function exportPng() {
    const o = document.createElement("canvas");
    o.width = o.height = S;
    const c = o.getContext("2d");
    c.fillStyle = st.paper;
    c.fillRect(0, 0, S, S);
    c.drawImage(cv, 0, 0);
    return o.toDataURL("image/png");
  }

  // ---- access code: a little keypad, not a login form ----
  const accessDlg = $("#access-dialog");
  const accessBoxes = $$(".access-box");
  const accessBoxWrap = $("#access-boxes");
  const accessErr = (m) => ($("#access-error").textContent = m || "");
  let accessTicket = null;

  function openAccessDialog() {
    accessErr("");
    accessBoxes.forEach((b) => { b.value = ""; b.disabled = false; });
    accessDlg.showModal();
    accessBoxes[0].focus();
  }

  function shakeBoxes() {
    accessBoxWrap.classList.remove("shake");
    void accessBoxWrap.offsetWidth; // restart the animation
    accessBoxWrap.classList.add("shake");
  }

  async function submitAccessCode() {
    const code = accessBoxes.map((b) => b.value).join("");
    if (code.length !== 6) return;
    accessErr("");
    accessBoxes.forEach((b) => (b.disabled = true));
    try {
      const d = await api("api/notes/access", { method: "POST", body: JSON.stringify({ code }) });
      accessTicket = d.ticket;
      accessDlg.close();
      openComposer();
    } catch (e) {
      accessErr(e.message);
      shakeBoxes();
      accessBoxes.forEach((b) => { b.value = ""; b.disabled = false; });
      accessBoxes[0].focus();
    }
  }

  accessBoxes.forEach((box, i) => {
    box.addEventListener("input", () => {
      box.value = box.value.replace(/\D/g, "").slice(-1);
      if (box.value && accessBoxes[i + 1]) accessBoxes[i + 1].focus();
      if (accessBoxes.every((b) => b.value)) submitAccessCode();
    });
    box.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !box.value && accessBoxes[i - 1]) accessBoxes[i - 1].focus();
    });
    box.addEventListener("paste", (e) => {
      const text = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "");
      if (!text) return;
      e.preventDefault();
      accessBoxes.forEach((b, j) => (b.value = text[j] || ""));
      (accessBoxes.find((b) => !b.value) || accessBoxes[accessBoxes.length - 1]).focus();
      if (accessBoxes.every((b) => b.value)) submitAccessCode();
    });
  });
  $("#access-cancel").addEventListener("click", () => accessDlg.close());
  accessDlg.addEventListener("click", (e) => { if (e.target === accessDlg) accessDlg.close(); });

  $("#notes-submit").addEventListener("click", async (e) => {
    const text = $("#notes-text").value.trim();
    if (!text) return err("write a caption first ✍️");
    err("");
    e.target.disabled = true;
    try {
      const n = await api("api/notes", {
        method: "POST",
        body: JSON.stringify({ text, name: $("#notes-name").value, image: exportPng(), ticket: accessTicket }),
      });
      accessTicket = null;
      dlg.close();
      ctx.clearRect(0, 0, S, S);
      undo = [];
      $("#notes-text").value = $("#notes-name").value = "";
      wall.querySelector(".notes-msg")?.remove();
      wall.querySelector(".pcard-add").replaceWith(addTile());
      wall.querySelector(".pcard-add").after(card(n, true));
    } catch (x) {
      err(x.message);
    } finally {
      e.target.disabled = false;
    }
  });

  sync();
  load();
})();
