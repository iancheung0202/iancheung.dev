(function () {
  "use strict";
  const wall = document.getElementById("notes-wall");
  if (!wall) return;

  const $ = (s) => document.querySelector(s);
  const h = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const api = (url, opts = {}) =>
    fetch(url, { headers: { "Content-Type": "application/json" }, credentials: "same-origin", ...opts })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Something went wrong.");
        return d;
      });
  const ls = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };
  const rot = (id) => (parseInt(id.slice(0, 4), 16) % 90) / 10 - 4.5; 
  const CAMERA = '<svg viewBox="0 0 64 52" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="12" width="58" height="37" rx="6"/><path d="M20 12l4-8h16l4 8"/><circle cx="32" cy="30" r="10"/><circle cx="32" cy="30" r="4"/><circle cx="52" cy="21" r="2" fill="currentColor"/></svg>';
  let admin = false;
  let cooldownUntil = 0; 

  const REPORTED_KEY = "notes:reported";
  const getReportedIds = () => { try { return JSON.parse(ls.get(REPORTED_KEY) || "[]"); } catch { return []; } };
  const addReportedId = (id) => {
    const ids = getReportedIds();
    if (!ids.includes(id)) ls.set(REPORTED_KEY, JSON.stringify([...ids, id].slice(-500)));
  };

  function trashAndRemove(cardEl, after) {
    cardEl.classList.add("trashing");
    const done = () => { cardEl.remove(); after && after(); };
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

  function cooldownLabel() {
    const hrs = Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 3600000));
    return `${hrs}h`;
  }

  /* ---------- wall ---------- */
  function addTile() {
    const limited = !admin && cooldownUntil > Date.now();
    const b = h("button", "pcard pcard-add" + (limited ? " pcard-cooldown" : ""));
    b.type = "button";
    b.setAttribute("aria-label", limited ? "Come back later to leave another note" : "Leave a note");
    const f = h("div", "pface");
    f.innerHTML = CAMERA;
    f.append(h("div", "pcap", limited ? `back in ${cooldownLabel()}` : "leave a note"));
    b.append(h("div", "pcard-inner"));
    b.firstChild.append(f);
    b.addEventListener("click", () => {
      if (!admin && cooldownUntil > Date.now()) {
        toast(`Come back in about ${cooldownLabel()} before you can leave another note.`);
        return;
      }
      openComposer();
    });
    return b;
  }

  function card(n, fresh) {
    const c = h("article", "pcard" + (fresh ? " printing" : ""));
    c.style.setProperty("--rot", rot(n.id) + "deg");
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
    const btn = (label, fn) => {
      const b = h("button", "pbtn", label);
      b.type = "button";
      b.addEventListener("click", () => fn(b));
      return b;
    };
    const act = async (method) => {
      try {
        await api("api/notes/" + n.id, { method });
        if (method === "DELETE") trashAndRemove(c, load);
        else load();
      } catch (e) { alert(e.message); }
    };
    if (admin) {
      if (n.status === "hidden") {
        back.append(h("div", "pdate", "HIDDEN · " + n.reports + " REPORTS"), btn("Restore", () => act("PATCH")));
      }
      back.append(btn("Delete", () => confirm("Delete this note for good?") && act("DELETE")));
    } else {
      back.append(btn("Report", async (b) => {
        b.disabled = true;
        try {
          await api(`api/notes/${n.id}/report`, { method: "POST" });
          addReportedId(n.id);
          trashAndRemove(c);
        } catch {
          b.textContent = "Try again";
          b.disabled = false;
        }
      }));
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

  let cursor = null;
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
      const url = initial ? "api/notes" : `api/notes?before=${encodeURIComponent(cursor)}`;
      const d = await api(url);
      admin = d.admin;
      cooldownUntil = d.cooldown_seconds > 0 ? Date.now() + d.cooldown_seconds * 1000 : 0;
      hasMore = !!d.has_more;
      if (d.notes.length) cursor = d.notes[d.notes.length - 1].created;

      const reported = new Set(getReportedIds());
      const visible = d.notes.filter((n) => admin || !reported.has(n.id));

      if (initial) {
        wall.replaceChildren(addTile(), ...visible.map((n) => card(n)));
        if (!d.notes.length) wall.append(h("p", "notes-msg", "the wall is empty. be the first to pin something."));
      } else {
        loadMoreBtn?.remove();
        loadMoreBtn = null;
        wall.append(...visible.map((n) => card(n)));
      }
      renderLoadMore();
    } catch {
      if (initial) wall.replaceChildren(addTile(), h("p", "notes-msg", "couldn't load the wall right now."));
      else toast("Couldn't load more notes right now.");
    }
  }

  $("#notes-admin").addEventListener("click", async () => {
    if (admin) return alert("You're in admin mode. Flip a note to moderate it.");
    const password = prompt("Enter the admin password to moderate notes:");
    if (!password) return;
    try { await api("api/notes/admin", { method: "POST", body: JSON.stringify({ password }) }); load(); }
    catch (e) { alert(e.message); }
  });

  const dlg = $("#nc-dialog"), cv = $("#nc-canvas"), ctx = cv.getContext("2d");
  const S = 400;
  cv.width = cv.height = S;
  const INKS = ["#1b1b1b", "#e5484d", "#f5a524", "#18d26e", "#2b7fff", "#a855f7"];
  const PAPERS = ["#ffffff", "#fff4c2", "#d9ecff", "#ffd9e6", "#dff5e1", "#1b1b1b"];
  const STAMPS = ["🐳", "🍵", "🌸", "⭐", "☁️", "🔥", "⛰️", "🎉", "🤠", "💙"];
  const st = { tool: "pen", ink: INKS[0], paper: PAPERS[0], stamp: STAMPS[0], size: 6 };
  let undo = [], drawing = false, last = null;

  const fill = (box, list, cls, style) => list.forEach((v) => {
    const b = h("button", cls);
    b.type = "button";
    b.dataset.k = box.id === "nc-inks" ? "ink" : box.id === "nc-papers" ? "paper" : "stamp";
    b.dataset.v = v;
    b.setAttribute("aria-label", v);
    style ? (b.style.background = v) : (b.textContent = v);
    box.append(b);
  });
  fill($("#nc-inks"), INKS, "nc-sw", true);
  fill($("#nc-papers"), PAPERS, "nc-sw", true);
  fill($("#nc-stamps"), STAMPS, "nc-stamp", false);

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
  $("#nc-size").addEventListener("input", (e) => (st.size = +e.target.value));

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
      ctx.font = `${st.size * 5 + 24}px serif`;
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
  $("#nc-undo").addEventListener("click", () => { const s = undo.pop(); if (s) ctx.putImageData(s, 0, 0); });
  $("#nc-clear").addEventListener("click", () => { snap(); ctx.clearRect(0, 0, S, S); });
  $("#nc-cancel").addEventListener("click", () => dlg.close());

  const err = (m) => ($("#nc-error").textContent = m || "");
  function openComposer() {
    err("");
    sync();
    dlg.showModal();
    $("#nc-text").focus();
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

  $("#nc-submit").addEventListener("click", async (e) => {
    const text = $("#nc-text").value.trim();
    if (!text) return err("write a caption first ✍️");
    err("");
    e.target.disabled = true;
    try {
      const n = await api("api/notes", {
        method: "POST",
        body: JSON.stringify({ text, name: $("#nc-name").value, website: $("#nc-site").value, image: exportPng() }),
      });
      cooldownUntil = Date.now() + 24 * 3600 * 1000; 
      dlg.close();
      ctx.clearRect(0, 0, S, S);
      undo = [];
      $("#nc-text").value = $("#nc-name").value = "";
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