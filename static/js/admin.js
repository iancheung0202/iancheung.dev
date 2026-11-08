/*
 * Shared admin mode for the portfolio
 *
 *   SiteAdmin.isAdmin()          -> boolean
 *   SiteAdmin.promptLogin()      -> opens the password dialog, resolves true/false
 *   SiteAdmin.login(password)    -> resolves on success, rejects with Error(message)
 *   SiteAdmin.logout()
 *   SiteAdmin.toggle()           -> login dialog, or a log-out confirmation
 *   SiteAdmin.refresh()          -> re-check the session with the server
 *   SiteAdmin.subscribe(fn)      -> fn(isAdmin) on every change; returns an unsubscribe fn
 *   SiteAdmin.api(url, opts)     -> fetch JSON with the CSRF header; a 401 drops admin mode
 */
(function () {
  "use strict";

  let admin = false;
  const subscribers = new Set();

  async function api(url, opts = {}) {
    const res = await fetch(url, {
      credentials: "same-origin",
      ...opts,
      headers: { "Content-Type": "application/json", "X-Requested-With": "fetch", ...(opts.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const isLogin = String(url).endsWith("api/admin/login");
      if (res.status === 401 && !isLogin) {
        set(false);
        throw new Error("Your admin session has ended. Please log in again.");
      }
      const err = new Error(data.error || "Something went wrong.");
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function set(value) {
    value = !!value;
    if (value === admin) return;
    admin = value;
    document.documentElement.classList.toggle("is-admin", admin);
    subscribers.forEach((fn) => {
      try { fn(admin); } catch (e) { console.error("[admin]", e); }
    });
  }

  async function refresh() {
    try {
      const d = await api("/api/admin/status");
      set(d.admin);
    } catch (_) { /* offline or server error: keep whatever we had */ }
    return admin;
  }

  async function login(password) {
    await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });
    set(true);
  }

  async function logout() {
    try { await api("/api/admin/logout", { method: "POST" }); } catch (_) { /* still leave locally */ }
    set(false);
  }

  let dialog = null;
  function buildDialog() {
    const d = document.createElement("dialog");
    d.className = "dialog admin-dialog";
    d.setAttribute("aria-label", "Admin login");
    d.innerHTML =
      '<div class="term">' +
      '<div class="term-bar" aria-hidden="true"><i></i><i></i><i></i></div>' +
      '<div class="term-line"><span class="term-user">ian@iancheung.dev</span><span class="term-dim">:~$</span> sudo unlock</div>' +
      '<div class="term-line term-prompt"><label class="term-dim" for="admin-pw">[sudo] password for ian:</label>' +
      '<input id="admin-pw" class="term-input admin-dialog-input" type="password" autocomplete="current-password" spellcheck="false" enterkeyhint="go">' +
      '</div>' +
      '<div class="term-out admin-dialog-error" role="alert"></div>' +
      '</div>';
    document.body.append(d);
    return d;
  }

  function promptLogin() {
    if (admin) return Promise.resolve(true);
    dialog = dialog || buildDialog();
    const input = dialog.querySelector(".admin-dialog-input");
    const error = dialog.querySelector(".admin-dialog-error");
    input.value = "";
    input.disabled = false;
    error.textContent = "";
    error.classList.remove("err");

    return new Promise((resolve) => {
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        input.removeEventListener("keydown", onKey);
        dialog.removeEventListener("close", onCancel);
        dialog.removeEventListener("click", onBackdrop);
        input.value = "";
        input.disabled = false;
        if (dialog.open) dialog.close();
        resolve(ok);
      };
      const onCancel = () => finish(false);
      const onKey = (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } };
      const onBackdrop = (e) => { if (e.target === dialog) finish(false); };
      let busy = false;
      const submit = async () => {
        if (!input.value || busy) return;
        busy = true;
        input.disabled = true;
        try {
          await login(input.value);
          finish(true);
        } catch (e) {
          // sudo's own words for a wrong password; anything else as the server said it
          error.textContent = e.status === 401 || e.status === 403 ? "Sorry, try again." : e.message;
          error.classList.add("err");
          input.disabled = false;
          input.value = "";
          input.focus();
        } finally {
          busy = false;
          if (!done) input.disabled = false;
        }
      };
      input.addEventListener("keydown", onKey);
      dialog.addEventListener("close", onCancel);
      dialog.addEventListener("click", onBackdrop);
      dialog.showModal();
      input.focus();
    });
  }

  async function toggle() {
    if (admin) {
      if (confirm("Log out of admin mode?")) await logout();
    } else {
      await promptLogin();
    }
  }

  window.SiteAdmin = {
    isAdmin: () => admin,
    promptLogin,
    login,
    logout,
    toggle,
    refresh,
    api,
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };

  refresh();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
})();
