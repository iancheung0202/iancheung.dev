/*
 * PaperFlip: turns a sticky note over like a sheet of paper.
 *
 *   PaperFlip.flip(el, { paper, toBack, front(ctx, w), back(ctx, w), onDone })
 *
 * The note itself is hidden for ~1.3s while a canvas laid over it draws a bending
 * mesh: the bottom-right corner rolls up as if pinched, the sheet comes off the
 * board, sags from the fingers with a few random wrinkles, turns over around the
 * diagonal, lands far corner first and is pressed flat (the roll unrolls as it
 * lands). Shadow is cast from the actual shape. front/back paint the two faces
 * onto a square texture (paper already filled); w is the note size in CSS px.
 */
(function () {
  "use strict";
  const N = 16, DUR = 1300, TEX = 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smoother = (x) => { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };
  const U = Math.SQRT1_2;
  const L = [-0.35, -0.5, 0.8];
  { const n = Math.hypot(...L); L[0] /= n; L[1] /= n; L[2] /= n; }

  const grainCache = new Map();
  function grain(size) {
    if (grainCache.has(size)) return grainCache.get(size);
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const id = g.createImageData(size, size), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const v = Math.random() < 0.5 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 18; }
    g.putImageData(id, 0, 0);
    grainCache.set(size, c);
    return c;
  }

  // a face texture: paper colour, grain, the glue strip, then the caller's drawing
  function texture(w, paper, paint, darken) {
    const size = Math.round(w * TEX);
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    g.fillStyle = paper;
    g.fillRect(0, 0, size, size);
    g.drawImage(grain(size), 0, 0);
    if (darken) { g.fillStyle = "rgba(0,0,0,0.04)"; g.fillRect(0, 0, size, size); }
    const gr = g.createLinearGradient(0, 0, 0, 16 * TEX);
    gr.addColorStop(0, "rgba(0,0,0,0.055)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, size, 16 * TEX);
    g.save();
    g.scale(TEX, TEX);
    try { paint && paint(g, w); } catch (e) { console.error("[paperflip]", e); }
    g.restore();
    return c;
  }

  function wrinkles() {
    const w = [];
    for (let i = 0; i < 5; i++) w.push({ a: 0.7 + Math.random() * 1.5, fx: (Math.random() - 0.5) * 2.6, fy: (Math.random() - 0.5) * 2.6, ph: Math.random() * 6.28, sp: 0.6 + Math.random() * 1.2 });
    w.crease = { ph: Math.random() * 6.28, a: 1.5 + Math.random() * 2 };
    return w;
  }

  // vertex positions at time t (0 = flat, front up; 1 = flat, back up)
  function verts(t, W, WR) {
    const dmax = W * U;
    const pinch = smoother(t / 0.42);
    const unroll = smoother((t - 0.5) / 0.5);
    const free = smoother((t - 0.08) / 0.34);
    const flip = smoother(t / 0.88);
    const ovq = clamp((t - 0.78) / 0.22, 0, 1), over = Math.sin(Math.PI * ovq) * (1 - ovq);
    const press = Math.sin(Math.PI * clamp((t - 0.86) / 0.14, 0, 1));
    const ang = Math.PI * flip + 0.11 * over;
    const lift = Math.sin(Math.PI * clamp(t / 0.96, 0, 1));
    const held = Math.max(free, lift);
    const curl = pinch * (1 - unroll) * (1 - 0.3 * free);
    const R = (0.5 * W - 0.326 * W * pinch) * (1 + 0.7 * free);
    const cline = dmax - 0.74 * dmax * pinch;
    const k = W / 190;
    const out = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const u = i / N, v = j / N;
      let x = (u - 0.5) * W, y = (v - 0.5) * W, z = 0;
      const d = (x + y) * U, q = (x - y) * U, far = (dmax - d) / (2 * dmax);
      if (curl > 0.001 && d > cline) {
        const th = (d - cline) / R, nd = cline + R * Math.sin(th), m = Math.min(1, curl * 1.6);
        z = R * (1 - Math.cos(th)) * m;
        const sh = (d - nd) * m;
        x -= sh * U; y -= sh * U;
      }
      z += pinch * (1 - free) * Math.max(0, d + dmax) * 0.08;
      z -= held * (1 - unroll) * (10 * far * far + 3 * Math.pow(Math.abs(q) / (W / 2), 2) * far) * k;
      let wr = 0;
      for (const w of WR) wr += w.a * Math.sin(w.fx * x / W * 6.28 + w.fy * y / W * 6.28 + w.ph + t * w.sp * 4);
      z += wr * k * (0.25 * pinch + held) * (1 - unroll * 0.9) * (1 - press * 0.6);
      z += WR.crease.a * k * pinch * (1 - unroll) * Math.exp(-Math.pow((q - 10 * k * Math.sin(WR.crease.ph)) / (18 * k), 2)) * Math.max(0, (d - cline + 30 * k) / dmax);
      z += press * 1.4 * k * Math.sin((d / dmax) * Math.PI * 2 + WR.crease.ph) * (1 - Math.abs(d / dmax));
      const ax = U, ay = -U, c = Math.cos(ang), s = Math.sin(ang), dot = ax * x + ay * y;
      const rx = x * c + ay * z * s + ax * dot * (1 - c), ry = y * c - ax * z * s + ay * dot * (1 - c), rz = z * c + (ax * y - ay * x) * s;
      const roll = -0.06 * lift * Math.sin(Math.PI * flip);
      const fx = rx * Math.cos(roll) - ry * Math.sin(roll) - 16 * k * lift;
      const fy = rx * Math.sin(roll) + ry * Math.cos(roll) - 12 * k * lift;
      out.push([fx, fy, rz + 95 * k * lift + 2, u, v, (i === 0 || i === N || j === 0 || j === N) ? 1 : 0]);
    }
    return out;
  }

  function tri(g, img, s0, s1, s2, p0, p1, p2, shadeA, specA, DPR, ox, oy) {
    g.save();
    g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.closePath(); g.clip();
    const [sx0, sy0] = s0, [sx1, sy1] = s1, [sx2, sy2] = s2, [x0, y0] = p0, [x1, y1] = p1, [x2, y2] = p2;
    const den = sx0 * (sy2 - sy1) - sx1 * sy2 + sx2 * sy1 + (sx1 - sx2) * sy0;
    if (Math.abs(den) < 1e-9) { g.restore(); return; }
    const a = -(sy0 * (x2 - x1) - sy1 * x2 + sy2 * x1 + (sy1 - sy2) * x0) / den;
    const b = (sy1 * y2 + sy0 * (y1 - y2) - sy2 * y1 + (sy2 - sy1) * y0) / den;
    const c = (sx0 * (x2 - x1) - sx1 * x2 + sx2 * x1 + (sx1 - sx2) * x0) / den;
    const d = -(sx1 * y2 + sx0 * (y1 - y2) - sx2 * y1 + (sx2 - sx1) * y0) / den;
    const e = (sx0 * (sy2 * x1 - sy1 * x2) + sy0 * (sx1 * x2 - sx2 * x1) + (sx2 * sy1 - sx1 * sy2) * x0) / den;
    const f = (sx0 * (sy2 * y1 - sy1 * y2) + sy0 * (sx1 * y2 - sx2 * y1) + (sx2 * sy1 - sx1 * sy2) * y0) / den;
    g.transform(a, b, c, d, e, f);
    g.drawImage(img, 0, 0);
    g.setTransform(DPR, 0, 0, DPR, ox * DPR, oy * DPR);
    if (shadeA > 0) { g.fillStyle = `rgba(40,30,0,${shadeA})`; g.fillRect(-1e4, -1e4, 2e4, 2e4); }
    if (specA > 0) { g.fillStyle = `rgba(255,255,255,${specA})`; g.fillRect(-1e4, -1e4, 2e4, 2e4); }
    g.restore();
  }

  function render(g, t, W, WR, front, back, DPR, cw, ch) {
    const ox = cw / 2, oy = ch / 2, F = 5.3 * W, TS = front.width;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.clearRect(0, 0, cw, ch);
    g.setTransform(DPR, 0, 0, DPR, ox * DPR, oy * DPR);
    const V = verts(t, W, WR), at = (i, j) => V[j * (N + 1) + i];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const p0 = at(Math.max(0, i - 1), j), p1 = at(Math.min(N, i + 1), j), q0 = at(i, Math.max(0, j - 1)), q1 = at(i, Math.min(N, j + 1));
      const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = q1[0] - q0[0], vy = q1[1] - q0[1], vz = q1[2] - q0[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      at(i, j).n = [nx / l, ny / l, nz / l];
    }
    const tris = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
      tris.push([a, b, d], [a, d, c]);
    }
    const project = (p) => { const k = F / (F - p[2]); return [p[0] * k, p[1] * k]; };
    // shadow: silhouette projected onto the board along the light
    let zs = 0;
    g.save();
    g.filter = `blur(${Math.max(3, 6 * W / 190)}px)`;
    g.beginPath();
    for (const T of tris) {
      zs += (T[0][2] + T[1][2] + T[2][2]) / 3;
      for (let k = 0; k < 3; k++) {
        const p = T[k], s = project([p[0] - p[2] * L[0] / L[2] * 0.9, p[1] - p[2] * L[1] / L[2] * 0.9, 0]);
        k ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]);
      }
      g.closePath();
    }
    g.fillStyle = `rgba(0,0,0,${0.42 * Math.max(0.15, 1 - zs / tris.length / (170 * W / 190))})`;
    g.fill();
    g.restore();
    tris.sort((p, q) => (p[0][2] + p[1][2] + p[2][2]) - (q[0][2] + q[1][2] + q[2][2]));
    for (const [a, b, c] of tris) {
      const pa = project(a), pb = project(b), pc = project(c);
      const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - a[0], vy = c[1] - a[1];
      const front_ = ux * vy - uy * vx > 0;
      const tc = (p) => front_ ? [p[3] * TS, p[4] * TS] : [(1 - p[4]) * TS, (1 - p[3]) * TS];
      const mx = (pa[0] + pb[0] + pc[0]) / 3, my = (pa[1] + pb[1] + pc[1]) / 3;
      const ex = (p, v) => v[5] ? p : [p[0] + (p[0] - mx) * 0.06, p[1] + (p[1] - my) * 0.06];
      const sgn = front_ ? 1 : -1;
      let diff = 0;
      for (const p of [a, b, c]) diff += Math.max(0, sgn * (p.n[0] * L[0] + p.n[1] * L[1] + p.n[2] * L[2]));
      diff /= 3;
      const shade = Math.min(1, 1 + 0.3 * (diff - L[2]));
      const spec = Math.max(0, diff - L[2]) * 0.22;
      tri(g, front_ ? front : back, tc(a), tc(b), tc(c), ex(pa, a), ex(pb, b), ex(pc, c), shade < 0.995 ? (1 - shade) * 0.9 : 0, spec > 0.01 ? spec : 0, DPR, ox, oy);
    }
  }

  const busy = new WeakSet();
  function flip(el, opts) {
    if (busy.has(el)) return false;
    const inner = el.querySelector(".note-inner") || el;
    const m = new DOMMatrix(getComputedStyle(el).transform);
    const scale = Math.hypot(m.a, m.b) || 1, rot = Math.atan2(m.b, m.a);
    const W = el.offsetWidth * scale;
    const r = inner.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const pad = Math.ceil(W * 0.95), cw = Math.ceil(W + 2 * pad), ch = cw;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const cv = document.createElement("canvas");
    cv.className = "paperflip";
    cv.width = Math.round(cw * DPR); cv.height = Math.round(ch * DPR);
    cv.style.cssText = `position:fixed;left:${cx - cw / 2}px;top:${cy - ch / 2}px;width:${cw}px;height:${ch}px;transform:rotate(${rot}rad);pointer-events:none;z-index:60;`;
    const g = cv.getContext("2d");
    const front = texture(W, opts.paper, opts.front, false);
    const back = texture(W, opts.paper, opts.back, true);
    const WR = wrinkles();
    busy.add(el);
    document.body.append(cv);
    inner.style.visibility = "hidden";
    const dir = opts.toBack ? 1 : -1;
    let t = opts.toBack ? 0 : 1, last = performance.now();
    render(g, t, W, WR, front, back, DPR, cw, ch);
    const step = (now) => {
      t = clamp(t + dir * (now - last) / DUR, 0, 1);
      last = now;
      render(g, t, W, WR, front, back, DPR, cw, ch);
      if (t > 0 && t < 1) return requestAnimationFrame(step);
      opts.onDone && opts.onDone();
      inner.style.visibility = "";
      requestAnimationFrame(() => { cv.remove(); busy.delete(el); });
    };
    requestAnimationFrame(step);
    return true;
  }

  window.PaperFlip = { flip, isBusy: (el) => busy.has(el) };
})();
