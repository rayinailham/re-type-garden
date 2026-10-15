/*! typegarden.js — dependency-free "type garden" engine (single file, no build, works from file:// or http).
 *
 * Technique after Type Garden by Akshat Agarwal (x.com/art_akshat) — personal / portfolio use, see SOURCE.md.
 *
 * Text is the hero. Vines grow out of the letters, weave in front of / behind the glyph bodies, carry leaves,
 * and end in blooms (or a leaf fan, or a curl). Growth is spring-driven, the line "boils" like hand-drawn
 * animation, and everything withers away on delete / loop end.
 *
 *   const tg = TypeGarden.mount(canvas, {
 *     text: 'midnight',                     // '\n' = new line
 *     font: 'Playfair Display', fontUrl: 'fonts/PlayfairDisplay.ttf', weight: 700,   // YOUR typography
 *     bloom: 'rose' | 'poppy' | 'daisy' | 'tulip' | '<custom key of opts.blooms>',
 *     style: 'flat' | 'ink' | 'papercut' | 'neon' | 'watercolor' | 'pixel',
 *     palette: { bg, text, stem, leaf, bloom, bloom2, line, center, vein },     // hex only (#rgb / #rrggbb)
 *     mode: 'autoplay' | 'type',           // autoplay = grow → hold → wither → loop; type = keyboard driven
 *     glow: 1 (neon halo strength, 0 = none), pixel: px size of 'pixel' style,
 *     legible: 0.04 (max share of an average letter's ink a bloom may hide in front; 1 = off),
 *     seed: 1, density: 1, bloomChance: 0.45, bloomScale: 1, boil: true,
 *     stagger: 150, hold: 2600, wither: 900, loop: true,
 *     blooms: { mybloom(P, x, y, R, rot, e, a, C, o) { ... } }   // custom species
 *   });
 *   tg.ready            // Promise: font loaded + first layout done
 *   tg.seek(ms)         // freeze at ms since start (deterministic frames for screenshots / tests)
 *   tg.play()           // resume real-time
 *   tg.stats()          // machine-readable state used by verify.py (counts, growth, config)
 *   window.__tg = tg    // set automatically (opts.expose === false disables)
 */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;

  // ---------- math ----------
  const eo = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));
  const spr = (t, k = 7, w = 16) => (t <= 0 ? 0 : 1 - Math.exp(-t * k) * Math.cos(t * w));
  const hash = (n) => { const x = Math.sin(n) * 43758.5453; return x - Math.floor(x); };
  function rng(seed) {
    let s = seed | 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hex = (c) => {
    c = c.replace('#', '');
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    const n = parseInt(c, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const mix = (a, b, t) => {
    const A = hex(a), B = hex(b);
    return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')';
  };

  // ---------- geometry ----------
  function vine(b, dir, len, amp, waves, ph, bend, n) {
    n = n || 40;
    const P = [[b[0], b[1]]], step = len / n;
    let x = b[0], y = b[1];
    for (let i = 1; i <= n; i++) {
      const u = i / n, a = dir + bend * u + amp * Math.sin(u * Math.PI * waves + ph) * Math.min(1, u * 3);
      x += Math.cos(a) * step; y += Math.sin(a) * step; P.push([x, y]);
    }
    return P;
  }
  function curl(P, sign, rad) {
    const n = P.length, e = P[n - 1], a = Math.atan2(e[1] - P[n - 2][1], e[0] - P[n - 2][0]);
    const c = [e[0] - Math.sin(a) * sign * rad, e[1] + Math.cos(a) * sign * rad];
    const a0 = Math.atan2(e[1] - c[1], e[0] - c[0]);
    for (let i = 1; i <= 14; i++) {
      const u = i / 14, t = a0 + sign * u * Math.PI * 1.6, rr = rad * (1 - 0.5 * u);
      P.push([c[0] + Math.cos(t) * rr, c[1] + Math.sin(t) * rr]);
    }
    return P;
  }
  function bez(a, b, c, d, n) {
    const P = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      P.push([
        u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
        u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
      ]);
    }
    return P;
  }
  function at(P, u) {
    const n = P.length, i = Math.min(n - 2, Math.max(1, Math.round(u * (n - 1))));
    return [P[i], Math.atan2(P[i + 1][1] - P[i - 1][1], P[i + 1][0] - P[i - 1][0])];
  }
  // cut a stem into 1–3 segments that alternate layer (behind / in front of the glyph) = the "weave"
  function weave(r, startLayer) {
    const cuts = [], nc = 1 + Math.floor(r() * 3);
    for (let i = 0; i < nc; i++) cuts.push(0.15 + r() * 0.7);
    cuts.sort((a, b) => a - b);
    const segs = [];
    let u0 = 0, layer = startLayer;
    for (const c of cuts) {
      if (c <= u0) continue;
      segs.push({ u0, u1: c, layer });
      u0 = r() < 0.3 ? Math.min(0.98, c + 0.02 + r() * 0.03) : c;
      layer = 1 - layer;
    }
    segs.push({ u0, u1: 1, layer });
    return segs;
  }
  const layerAt = (segs, u) => { for (const s of segs) if (u >= s.u0 && u <= s.u1) return s.layer; return segs[segs.length - 1].layer; };

  function tracePoly(g, p, closed) {
    const n = p.length;
    if (n < 2) return;
    const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (closed) {
      const s = m(p[n - 1], p[0]);
      g.moveTo(s[0], s[1]);
      for (let i = 0; i < n; i++) { const q = m(p[i], p[(i + 1) % n]); g.quadraticCurveTo(p[i][0], p[i][1], q[0], q[1]); }
      g.closePath();
    } else {
      g.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < n - 1; i++) { const q = m(p[i], p[i + 1]); g.quadraticCurveTo(p[i][0], p[i][1], q[0], q[1]); }
      g.lineTo(p[n - 1][0], p[n - 1][1]);
    }
  }
  function sub(P, a, b) {
    const n = P.length - 1, ia = a * n, ib = b * n;
    const lerp = (t) => { const i = Math.min(n - 1, Math.floor(t)), f = t - i; return [P[i][0] + (P[i + 1][0] - P[i][0]) * f, P[i][1] + (P[i + 1][1] - P[i][1]) * f]; };
    const pts = [lerp(ia)];
    for (let i = Math.floor(ia) + 1; i < ib; i++) pts.push(P[i]);
    pts.push(lerp(ib));
    return pts;
  }

  // ---------- painters (art style = how fill()/stroke() reach the canvas) ----------
  function painter(g, style, C, S, glow) {
    glow = glow == null ? 1 : glow;
    const line = (p, col, w, alpha) => {
      g.beginPath(); tracePoly(g, p, false);
      g.globalAlpha = alpha == null ? 1 : alpha; g.strokeStyle = col; g.lineWidth = w; g.lineCap = g.lineJoin = 'round'; g.stroke();
      g.globalAlpha = 1;
    };
    const area = (p, col, alpha) => {
      g.beginPath(); tracePoly(g, p, true);
      g.globalAlpha = alpha == null ? 1 : alpha; g.fillStyle = col; g.fill(); g.globalAlpha = 1;
    };
    const outline = (p, col, w, alpha) => {
      g.beginPath(); tracePoly(g, p, true);
      g.globalAlpha = alpha == null ? 1 : alpha; g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.stroke(); g.globalAlpha = 1;
    };
    const text = (ch, x, y, col, font) => {
      g.font = font; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = col; g.fillText(ch, x, y);
    };
    const base = { stroke: line, text, fill: area };
    switch (style) {
      case 'ink': // hollow shapes: bg-colour fill occludes what is behind, coloured outline carries the drawing
        return Object.assign(base, { fill: (p, col) => { area(p, C.bg); outline(p, col, Math.max(1, S * 0.011)); } });
      case 'papercut': // flat cut paper with a hard drop shadow
        return Object.assign(base, {
          fill: (p, col) => {
            g.save(); g.shadowColor = 'rgba(0,0,0,.30)'; g.shadowOffsetX = S * 0.008; g.shadowOffsetY = S * 0.013; g.shadowBlur = 0;
            area(p, col); g.restore();
          },
        });
      case 'neon': // glowing wire: faint body + bright outline + bloom
        return Object.assign(base, {
          fill: (p, col) => {
            area(p, col, 0.14);
            g.save(); g.shadowColor = col; g.shadowBlur = S * 0.05 * glow; outline(p, col, Math.max(1.2, S * 0.007)); g.restore();
          },
          stroke: (p, col, w) => { g.save(); g.shadowColor = col; g.shadowBlur = S * 0.045 * glow; line(p, col, Math.max(1.2, w * 0.7)); g.restore(); },
          text: (ch, x, y, col, font) => { g.save(); g.shadowColor = col; g.shadowBlur = S * 0.06 * glow; text(ch, x, y, col, font); g.restore(); },
        });
      case 'watercolor': // translucent washes: bleed halo, body, offset second wash, darker pooled edge
        return Object.assign(base, {
          fill: (p, col) => {
            let cx = 0, cy = 0;
            for (const q of p) { cx += q[0]; cy += q[1]; }
            cx /= p.length; cy /= p.length;
            area(p.map((q) => [cx + (q[0] - cx) * 1.08, cy + (q[1] - cy) * 1.08]), col, 0.16); // pigment bleeding past the line
            area(p, col, 0.5);
            area(p.map((q) => [cx + (q[0] - cx) * 0.82 + S * 0.005, cy + (q[1] - cy) * 0.82 + S * 0.007]), col, 0.34);
            outline(p, '#000', Math.max(0.9, S * 0.0055), 0.2); // pigment pooling at the edge
          },
          stroke: (p, col, w) => line(p, col, w * 1.1, 0.72),
        });
      default: // flat
        return base;
    }
  }

  // ---------- blooms (species) ----------
  // signature: (P painter, x, y, R px, rot, e {ph1,ph2,turns}, a age ms, C palette, o {calm})
  function blob(cx, cy, rx, ry, ang, ph, wob, lobes, n) {
    n = n || 26;
    const ca = Math.cos(ang), sa = Math.sin(ang), pts = [];
    for (let k = 0; k < n; k++) {
      const th = (k / n) * TAU, rr = 1 + wob * Math.sin(lobes * th + ph) + wob * 0.5 * Math.sin((lobes + 2) * th + ph * 1.7);
      const lx = Math.cos(th) * rx * rr, ly = Math.sin(th) * ry * rr;
      pts.push([cx + lx * ca - ly * sa, cy + lx * sa + ly * ca]);
    }
    return pts;
  }
  function teardrop(cx, cy, len, wid, ang, n) { // pointed tip at local (0,-1) rotated by ang
    n = n || 14;
    const ca = Math.cos(ang), sa = Math.sin(ang), L = [], Rr = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, w = wid * Math.sin(Math.PI * Math.pow(u, 0.75)) * (1 - 0.15 * u), y = -u * len;
      L.push([cx + (-w) * ca - y * sa, cy + (-w) * sa + y * ca]);
      Rr.push([cx + w * ca - y * sa, cy + w * sa + y * ca]);
    }
    return L.concat(Rr.reverse());
  }
  const frame = (x, y, R, rot) => {
    const cr = Math.cos(rot), sr = Math.sin(rot);
    return (px, py) => [x + (px * cr - py * sr) * R, y + (px * sr + py * cr) * R];
  };
  const open = (a, i, st, o, k, w) => (o.calm ? eo((a - i * st) / 1000 * (k || 8) / 3.5) : spr((a - i * st) / 1000, k || 8, w || 14));
  const place = (T, pts, s, ax, ay) => pts.map((q) => T(ax + (q[0] - ax) * s, ay + (q[1] - ay) * s));
  const tone = (C, i, n) => (C.bloom2 ? mix(C.bloom, C.bloom2, n > 1 ? i / (n - 1) : 0) : C.bloom);

  const BLOOMS = {
    rose(P, x, y, R, rot, e, a, C, o) {
      const T = frame(x, y, R, rot);
      const pet = [[0, -0.36, 0.56, 0.54, 0], [-0.5, -0.06, 0.6, 0.6, -0.35], [0.52, -0.06, 0.6, 0.6, 0.35],
        [-0.42, 0.3, 0.62, 0.48, 0.2], [0.47, 0.3, 0.62, 0.48, -0.2], [0.05, 0.42, 0.56, 0.38, 0]];
      pet.forEach((q, i) => {
        const s = open(a, i, 85, o, 8, 14);
        if (s <= 0.001) return;
        const ang = q[4] + (1 - Math.min(1, s)) * (q[0] < 0 ? 0.5 : -0.5);
        P.fill(place(T, blob(q[0], q[1], q[2], q[3], ang, e.ph1 + i, 0.08, 3), s, 0, 0.5), tone(C, i, pet.length));
      });
      const fr = eo((a - pet.length * 85 - 80) / 520);
      if (fr > 0 && R > 3) {
        const sp = [], turns = R < 20 ? Math.min(e.turns, 1.3) : e.turns;
        for (let i = 0; i <= 70 * fr; i++) {
          const u = i / 70, th = e.ph1 + u * turns * TAU, rr = 0.08 + 0.57 * u;
          sp.push(T(Math.cos(th) * rr * 1.05, Math.sin(th) * rr * 0.72 - 0.12));
        }
        if (sp.length > 2) P.stroke(sp, C.line, Math.max(0.8, R * 0.045));
        if (R >= 14) {
          const sc = [];
          for (let i = 0; i <= 36 * fr; i++) { const u = i / 36; sc.push(T(-0.72 + 1.5 * u, 0.36 + 0.16 * Math.abs(Math.sin(u * Math.PI * 3)))); }
          if (sc.length > 2) P.stroke(sc, C.line, Math.max(0.8, R * 0.045));
        }
      }
    },
    poppy(P, x, y, R, rot, e, a, C, o) {
      const T = frame(x, y, R, rot);
      const pet = [[-0.5, -0.12, 0.74, 0.66, -0.45], [0.5, -0.12, 0.74, 0.66, 0.45], [-0.36, 0.28, 0.7, 0.58, 0.3], [0.4, 0.26, 0.7, 0.58, -0.3]];
      pet.forEach((q, i) => {
        const s = open(a, i, 90, o, 8, 12);
        if (s <= 0.001) return;
        P.fill(place(T, blob(q[0], q[1], q[2], q[3], q[4], e.ph1 + i * 1.3, 0.13, 5, 34), s, 0, 0.3), tone(C, i, pet.length));
      });
      const fr = eo((a - pet.length * 90 - 60) / 380);
      if (fr > 0) {
        P.fill(place(T, blob(0, 0, 0.2, 0.2, 0, 0, 0.04, 3, 18), fr, 0, 0), C.center || C.line);
        for (let i = 0; i < 12; i++) {
          const th = (i / 12) * TAU + e.ph2, l0 = 0.2, l1 = (0.38 + 0.08 * hash(i + e.ph1)) * fr;
          P.stroke([T(Math.cos(th) * l0, Math.sin(th) * l0), T(Math.cos(th) * l1, Math.sin(th) * l1)], C.center || C.line, Math.max(0.8, R * 0.03));
          if (fr > 0.6) P.fill(blob(0, 0, 1, 1, 0, 0, 0, 3, 8).map((q) => { const c = T(Math.cos(th) * l1, Math.sin(th) * l1); return [c[0] + q[0] * R * 0.035, c[1] + q[1] * R * 0.035]; }), C.center || C.line);
        }
      }
    },
    daisy(P, x, y, R, rot, e, a, C, o) {
      const T = frame(x, y, R, rot), n = 14;
      for (let i = 0; i < n; i++) {
        const s = open(a, i, 32, o, 8, 13);
        if (s <= 0.001) continue;
        const th = (i / n) * TAU + e.ph1 * 0.1, r0 = 0.5;
        P.fill(place(T, blob(Math.cos(th) * r0, Math.sin(th) * r0, 0.5, 0.135, th, 0, 0.03, 2, 18), s, 0, 0), tone(C, i, n));
      }
      const fr = eo((a - n * 32 - 40) / 340);
      if (fr > 0) {
        P.fill(place(T, blob(0, 0, 0.3, 0.3, 0, e.ph2, 0.05, 6, 26), fr, 0, 0), C.center || C.line);
        P.stroke(sub(blob(0, 0, 0.18, 0.18, 0, 0, 0, 3, 20).map((q) => T(q[0] - 0.02, q[1] - 0.04)).slice(2, 12), 0, 1), C.line, Math.max(0.8, R * 0.04));
      }
    },
    tulip(P, x, y, R, rot, e, a, C, o) {
      const T = frame(x, y, R, rot - 0.0);
      const pet = [[-0.2, 0.45, 1.25, 0.5, -0.3], [0.2, 0.45, 1.25, 0.5, 0.3], [0, 0.5, 1.3, 0.46, 0]];
      pet.forEach((q, i) => {
        const s = open(a, i, 110, o, 7, 12);
        if (s <= 0.001) return;
        const ang = q[4] * (0.6 + 0.4 * Math.min(1.2, s)) + (1 - Math.min(1, s)) * (i === 0 ? -0.5 : i === 1 ? 0.5 : 0);
        const poly = teardrop(q[0], q[1], q[2] * Math.min(1.1, s), q[3], ang, 14);
        P.fill(poly.map((p) => T(p[0], p[1])), tone(C, i, pet.length));
      });
      const fr = eo((a - 330) / 300);
      if (fr > 0) P.stroke([T(0, 0.46), T(-0.05, 0.1 * fr), T(0, -0.55 * fr)], C.line, Math.max(0.8, R * 0.04));
    },
  };

  // ---------- leaf ----------
  function leaf(P, bx, by, a, L, bend, C, shape) {
    if (L < 0.5) return;
    const ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca, N = 12, s1 = [], s2 = [];
    const ax = (u) => { const b = Math.sin(Math.PI * u) * bend * 0.15 * L; return [bx + ca * u * L + px * b, by + sa * u * L + py * b]; };
    const hw = (u) => (shape === 'round' ? L * 0.3 * Math.pow(Math.sin(Math.PI * u), 0.6) : L * 0.18 * Math.sin(Math.PI * Math.pow(u, 0.8)));
    for (let i = 0; i <= N; i++) { const u = i / N, c = ax(u), w = hw(u); s1.push([c[0] + px * w, c[1] + py * w]); s2.push([c[0] - px * w, c[1] - py * w]); }
    const tip = ax(1), b0 = ax(0);
    P.fill([b0].concat(s1.slice(1, N), [tip, tip], s2.slice(1, N).reverse(), [b0]), C.leaf || C.stem);
    if (L > 6) { const v = []; for (let i = 0; i <= 8; i++) v.push(ax(0.08 + (0.72 * i) / 8)); P.stroke(v, C.vein || C.bg, Math.max(0.8, L * 0.03)); }
  }

  // ---------- growth ----------
  function wordParams(ws, o) {
    const r = rng(ws * 7 + 13);
    return {
      bloomP: Math.min(0.9, (0.3 + r() * 0.3) * (o.bloomChance / 0.45)),
      leafy: (0.6 + r() * 0.8) * o.density, dens: o.density, lean: (r() - 0.5) * 0.6,
      big: (0.85 + r() * 0.45) * o.bloomScale, curvy: 0.8 + r() * 0.6,
      bridgeP: Math.min(0.95, (0.45 + r() * 0.35) * o.density), w: 0.5,
    };
  }
  function grow(r, E, nid, p, o) {
    const tip = o.tip || (r() < p.bloomP ? 'bloom' : r() < 0.45 ? 'fan' : r() < 0.6 ? 'leaf' : 'curl');
    let P = o.pts || vine(o.base, o.dir, o.len, (0.35 + r() * 0.45) * p.curvy, 1 + r() * 1.6, r() * 6.28, (r() - 0.5) * 1.2, 40);
    if (tip === 'curl') P = curl(P, r() < 0.5 ? -1 : 1, 0.05 + r() * 0.05);
    const segs = weave(r, o.layer0 != null ? o.layer0 : r() < 0.5 ? 0 : 1);
    const dur = Math.max(320, (o.len || 0.8) * 620), thorns = [], nt = Math.floor(r() * 2.5);
    for (let i = 0; i < nt; i++) thorns.push({ u: 0.15 + r() * 0.65, s: r() < 0.5 ? -1 : 1 });
    E.push({ t: 'stem', id: nid(), pts: P, segs, d0: o.d0, dur, w: o.depth ? 0.82 : 1, thorns });
    const nl = Math.floor(r() * 2.8 * p.leafy);
    let sd = r() < 0.5 ? -1 : 1;
    for (let i = 0; i < nl; i++) {
      const u = 0.25 + r() * 0.6, qa = at(P, u);
      sd = -sd;
      E.push({ t: 'leaf', id: nid(), x: qa[0][0], y: qa[0][1], a: qa[1] + sd * (0.55 + r() * 0.5), L: (0.14 + r() * 0.2) * (o.depth ? 0.8 : 1), bend: (r() - 0.5) * 1.2, layer: layerAt(segs, u), d0: o.d0 + dur * u });
    }
    const ta = at(P, 1), tp = ta[0], tang = ta[1], td = o.d0 + dur * 0.8, tl = layerAt(segs, 1);
    if (tip === 'bloom') {
      const R = (0.13 + r() * 0.15) * p.big * (o.depth ? 0.75 : 1);
      const over = tp[1] > -0.78 && tp[1] < 0.05 && Math.abs(tp[0]) < p.w * 0.5; // sits on the glyph body → mostly behind
      const layer = over ? (r() < 0.22 ? 1 : 0) : r() < 0.6 ? 1 : tl;
      E.push({ t: 'bloom', id: nid(), x: tp[0], y: tp[1], R, rot: tang + Math.PI / 2 + (r() - 0.5) * 0.6, ph1: r() * 6.28, ph2: r() * 6.28, turns: 1.8 + r() * 1, layer, d0: td });
      if (r() < 0.2) {
        const oo = tang + (r() < 0.5 ? 1 : -1) * 1.3;
        E.push({ t: 'bloom', id: nid(), x: tp[0] + Math.cos(oo) * R * 1.4, y: tp[1] + Math.sin(oo) * R * 1.4, R: R * (0.6 + r() * 0.3), rot: tang + Math.PI / 2 + (r() - 0.5) * 1.2, ph1: r() * 6.28, ph2: r() * 6.28, turns: 1.8 + r(), layer, d0: td + 120 });
      }
    } else if (tip === 'fan') {
      const spread = 0.6 + r() * 0.3;
      for (let j = 0; j < 2; j++) E.push({ t: 'leaf', id: nid(), x: tp[0], y: tp[1], a: tang + (j - 0.5) * spread, L: 0.2 + r() * 0.2, bend: (j - 0.5) * 0.8, layer: tl, d0: td + j * 60 });
    } else if (tip === 'leaf') {
      E.push({ t: 'leaf', id: nid(), x: tp[0], y: tp[1], a: tang + (r() - 0.5) * 0.3, L: 0.16 + r() * 0.16, bend: r() - 0.5, layer: tl, d0: td });
    }
    if (!o.depth && r() < 0.3) {
      const u = 0.35 + r() * 0.35, qa = at(P, u);
      grow(r, E, nid, p, { base: qa[0], dir: qa[1] + (r() < 0.5 ? -1 : 1) * (0.7 + r() * 0.4), len: (o.len || 0.8) * (0.35 + r() * 0.2), d0: o.d0 + dur * u, depth: 1, layer0: layerAt(segs, u) });
    }
  }
  function genLetter(L, o, mw) {
    const r = rng((L.ws ^ Math.imul(L.i + 1, 2654435761)) >>> 0), p = wordParams(L.ws, o), E = [];
    let k = 0;
    const nid = () => L.i * 100 + k++, w = L.w, inX = () => (r() - 0.5) * w * 0.7;
    p.w = w;
    const nUp = 1 + (r() < 0.45 * p.dens ? 1 : 0);
    for (let i = 0; i < nUp; i++) grow(r, E, nid, p, { base: [inX(), -r() * 0.3], dir: -Math.PI / 2 + p.lean * 0.5 + (r() - 0.5) * 0.7, len: 0.6 + r() * 0.5, d0: 40 + i * 130, tip: L.wi === 0 && i === 0 ? 'bloom' : null });
    if (r() < 0.4 * p.dens) grow(r, E, nid, p, { base: [inX(), -0.1 - r() * 0.35], dir: Math.PI / 2 + (r() - 0.5) * 0.8, len: 0.35 + r() * 0.35, d0: 160 });
    if (L.prev && r() < p.bridgeP) { // arc to the previous letter
      const px = -(L.prev.w + w) / 2, a = [inX(), -0.05 - r() * 0.55], b = [px + (r() - 0.5) * 0.25, -0.05 - r() * 0.55];
      const bulge = (r() < 0.55 ? -1 : 1) * (0.4 + r() * 0.4), dx = b[0] - a[0];
      let P = bez(a, [a[0] + dx * 0.15, a[1] + bulge], [b[0] - dx * 0.15, b[1] + bulge * 0.9], b, 40);
      if (r() < 0.45) P = P.slice(0, Math.floor(P.length * (0.7 + r() * 0.2)));
      grow(r, E, nid, p, { pts: P, len: Math.abs(dx) + Math.abs(bulge), d0: 90, tip: r() < 0.5 ? 'curl' : r() < 0.5 ? 'leaf' : 'bloom' });
    }
    if (L.wi === 0) grow(r, E, nid, p, { base: [-w * 0.3, -0.15 - r() * 0.4], dir: Math.PI + (r() - 0.5) * 1.2, len: 0.45 + r() * 0.3, d0: 120, tip: 'curl' });
    if (L.last) { // end-of-word bouquet
      k = 50;
      const n = 1 + Math.floor(r() * 2.5);
      for (let i = 0; i < n; i++) grow(r, E, nid, p, { base: [(r() - 0.2) * w * 0.6, -r() * 0.5], dir: -Math.PI / 2 + 0.6 + (i - (n - 1) / 2) * 0.9 + (r() - 0.5) * 0.4, len: 0.4 + r() * 0.45, d0: 260 + i * 90, depth: 1, tip: i === 0 || r() < 0.5 ? 'bloom' : 'fan' });
    }
    L.els = E;
  }

  // ---------- mount ----------
  const DEFAULTS = {
    text: 'garden', font: 'Georgia', fontUrl: null, fallback: 'Georgia, serif', weight: 700, fontStyle: 'normal',
    bloom: 'rose', style: 'flat', mode: 'autoplay', seed: 1, density: 1, bloomChance: 0.45, bloomScale: 1,
    boil: true, stagger: 150, hold: 2600, wither: 900, loop: true, maxWidth: 0.8, thorns: null, leafShape: 'pointed',
    calm: null, expose: true, blooms: null, pixel: null, glow: 1, quantize: true, legible: 0.04,
    palette: { bg: '#000000', text: '#ffffff', stem: '#3257ff', leaf: null, bloom: '#ff1400', bloom2: null, line: '#ffb4a8', center: null, vein: null },
  };

  function mount(canvas, opts) {
    opts = opts || {};
    const o = Object.assign({}, DEFAULTS, opts);
    o.palette = Object.assign({}, DEFAULTS.palette, opts.palette || {});
    const C = o.palette;
    if (o.thorns == null) o.thorns = o.bloom === 'rose';
    const blooms = Object.assign({}, BLOOMS, o.blooms || {});
    if (!blooms[o.bloom]) throw new Error('typegarden: unknown bloom "' + o.bloom + '"');
    const calm = o.calm != null ? o.calm : !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const g = canvas.getContext('2d');
    const lo = { c: null, g: null };
    const fam = '"' + o.font + '", ' + o.fallback;
    const cssFont = (S) => o.fontStyle + ' ' + o.weight + ' ' + S + 'px ' + fam;

    let W = 0, H = 0, dpr = 1, S = 100, px = 4;
    const ink = { c: null };
    let letters = [], ghosts = [], typed = '', cycle = 1, tGrown = 1;
    let t0 = performance.now(), manual = null, raf = 0, ws0 = 0;
    const clock = () => (manual != null ? manual : performance.now() - t0);

    function words() { // assign word seed / index-in-word / last flag
      let ws = 0, wi = 0, prev = null;
      letters.forEach((L, i) => {
        if (L.ch === ' ' || L.ch === '\n') { wi = 0; ws++; prev = null; L.prev = null; return; }
        L.ws = (o.seed * 1000003 + ws * 7919) | 0; L.wi = wi++; L.prev = prev; prev = L;
        const nx = letters[i + 1];
        L.last = !nx || nx.ch === ' ' || nx.ch === '\n';
      });
    }
    function build(str) {
      const old = letters;
      letters = Array.from(str).map((ch, i) => (old[i] && old[i].ch === ch ? old[i] : { ch, i, birth: null, els: null, dead: null }));
      words();
    }
    function layout() {
      W = canvas.clientWidth || root.innerWidth; H = canvas.clientHeight || root.innerHeight;
      dpr = Math.min(2, root.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      const src = o.mode === 'type' ? typed : o.text, lines = src.split('\n');
      g.font = cssFont(100);
      const lw = lines.map((l) => g.measureText(l || ' ').width / 100), maxLW = Math.max(0.5, ...lw);
      S = Math.min((W * o.maxWidth) / maxLW, (H * 0.28) / (1 + 0.45 * (lines.length - 1)));
      const gap = 1.3 * S, y0 = H * (0.6 - 0.03 * (lines.length - 1)) - ((lines.length - 1) * gap) / 2 + S * 0.36;
      g.font = cssFont(100);
      let idx = 0;
      lines.forEach((ln, li) => {
        const x0 = (W - lw[li] * S) / 2, chars = Array.from(ln);
        let pre = '';
        chars.forEach((ch) => {
          const L = letters[idx++];
          if (!L) return;
          const wA = g.measureText(pre).width / 100, wB = g.measureText(pre + ch).width / 100;
          L.w = (g.measureText(ch).width / 100) || 0.3;
          L.x = x0 + ((wA + wB) / 2) * S; L.y = y0 + li * gap; // center of the glyph advance, baseline
          pre += ch;
        });
        idx++; // the '\n'
      });
      px = o.pixel || Math.max(3, Math.round(S / 34));
      if (o.style === 'pixel') {
        lo.c = lo.c || document.createElement('canvas');
        lo.c.width = Math.ceil(W / px); lo.c.height = Math.ceil(H / px); lo.g = lo.c.getContext('2d', { willReadFrequently: true });
      }
      // (re)generate elements — S independent (units of S), so only when missing
      letters.forEach((L) => { if (L.ch !== ' ' && L.ch !== '\n' && !L.els) { L.w = L.w || 0.5; genLetter(L, o); } });
      guard();
      // timeline (autoplay)
      const n = letters.length;
      tGrown = Math.max(1, (n - 1) * o.stagger + 2000);
      cycle = tGrown + o.hold + o.wither + 350;
      letters.forEach((L, i) => { if (o.mode === 'autoplay') L.birth = i * o.stagger; });
    }

    // soft wall: whatever the vines do, nothing is drawn closer than one bloom radius to the canvas edge
    function squash(v, D) {
      const M = 0.46 * S * Math.max(1, o.bloomScale), Z = 0.35 * M, lo = M + Z, hi = D - M - Z;
      if (hi <= lo) return v;
      return v > hi ? hi + Z * Math.tanh((v - hi) / Z) : v < lo ? lo - Z * Math.tanh((lo - v) / Z) : v;
    }
    // legibility: a bloom may sit in front of the glyphs only if it hides ≤ o.legible of an average letter's ink
    function guard() {
      if (!(o.legible < 1) || !(W > 0 && H > 0)) return;
      const cs = Math.max(2, Math.round(S / 40)), cw = Math.ceil(W / cs), ch = Math.ceil(H / cs);
      ink.c = ink.c || document.createElement('canvas'); ink.c.width = cw; ink.c.height = ch;
      const m = ink.c.getContext('2d', { willReadFrequently: true });
      m.setTransform(1 / cs, 0, 0, 1 / cs, 0, 0); m.font = cssFont(S); m.textAlign = 'center'; m.textBaseline = 'alphabetic'; m.fillStyle = '#000';
      let n = 0;
      letters.forEach((L) => { if (L.x != null && L.ch.trim()) { m.fillText(L.ch, L.x, L.y); n++; } });
      const d = m.getImageData(0, 0, cw, ch).data;
      let tot = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 127) tot++;
      const budget = o.legible * (tot / Math.max(1, n));
      letters.forEach((L) => {
        if (!L.els || L.x == null) return;
        for (const e of L.els) {
          if (e.t !== 'bloom') continue;
          e.fl = e.layer;
          if (e.layer !== 1) continue;
          const q = sq(L.x + e.x * S, L.y + e.y * S), r = e.R * S, x0 = Math.max(0, Math.floor((q[0] - r) / cs)), x1 = Math.min(cw - 1, Math.ceil((q[0] + r) / cs));
          const y0 = Math.max(0, Math.floor((q[1] - r) / cs)), y1 = Math.min(ch - 1, Math.ceil((q[1] + r) / cs));
          let hit = 0;
          for (let y = y0; y <= y1 && hit <= budget; y++) for (let x = x0; x <= x1; x++) {
            const dx = (x + 0.5) * cs - q[0], dy = (y + 0.5) * cs - q[1];
            if (dx * dx + dy * dy <= r * r && d[(y * cw + x) * 4 + 3] > 127) hit++;
          }
          if (hit > budget) e.fl = 0;
        }
      });
    }
    const sq = (x, y) => [squash(x, W), squash(y, H)];

    function drawEl(P, e, L, age, kk, fr, amp, layer, tt) {
      const jit = amp ? [(hash(e.id * 1.37 + fr * 7.13) * 2 - 1) * amp, (hash(e.id * 2.71 + fr * 3.11) * 2 - 1) * amp, (hash(e.id * 5.3 + fr * 1.7) * 2 - 1) * 0.035] : [0, 0, 0];
      const wp = (x, y) => { const q = sq(L.x + x * S, L.y + y * S); return [q[0] + jit[0], q[1] + jit[1]]; };
      if (e.t === 'stem') {
        const f = eo((age - e.d0) / e.dur) * kk;
        if (f <= 0) return;
        const pts = e.pts.map((p) => wp(p[0], p[1]));
        for (const sg of e.segs) {
          if (sg.layer !== layer) continue;
          const b = Math.min(sg.u1, f);
          if (b <= sg.u0) continue;
          P.stroke(sub(pts, sg.u0, b), C.stem, S * 0.022 * e.w);
        }
        if (o.thorns) for (const th of e.thorns) {
          if (f > th.u && layerAt(e.segs, th.u) === layer) {
            const q = at(pts, th.u), d = q[1] + th.s * 2.3, l = S * 0.045;
            P.stroke([q[0], [q[0][0] + Math.cos(d) * l, q[0][1] + Math.sin(d) * l]], C.stem, S * 0.022);
          }
        }
      } else if ((e.fl != null ? e.fl : e.layer) === layer) {
        if (e.t === 'leaf') {
          const sc = (calm ? eo((age - e.d0) / 500) : spr((age - e.d0) / 1000, 7, 15)) * kk;
          if (sc <= 0) return;
          const q = wp(e.x, e.y);
          leaf(P, q[0], q[1], e.a + jit[2], e.L * S * sc, e.bend, C, o.leafShape);
        } else {
          const a = age - e.d0;
          if (a < 0 || kk <= 0.001) return;
          const q = wp(e.x, e.y);
          blooms[o.bloom](P, q[0], q[1], e.R * S * kk, e.rot + jit[2], e, a, C, { calm });
        }
      }
    }

    function render(tt) {
      const pixel = o.style === 'pixel' && lo.g, T = pixel ? lo.g : g;
      if (pixel) T.setTransform(1 / px, 0, 0, 1 / px, 0, 0); else T.setTransform(dpr, 0, 0, dpr, 0, 0);
      T.globalAlpha = 1; T.fillStyle = C.bg; T.fillRect(0, 0, W + px, H + px); // +px: cover the partial edge cell of the low-res canvas
      const P = painter(T, o.style, C, S, o.glow), fr = o.boil && !calm ? Math.floor(tt / 120) : 0;
      const amp = o.boil && !calm ? Math.max(0.8, S * 0.01) : 0;
      let ts = tt, wStart = Infinity;
      if (o.mode === 'autoplay') { ts = o.loop ? tt % cycle : Math.min(tt, tGrown + o.hold); wStart = tGrown + o.hold; }
      const rows = letters.concat(ghosts);
      const kd = (L, i) => (L.dead != null ? 1 - eo((tt - L.dead) / o.wither) : o.mode === 'autoplay' ? 1 - eo((ts - wStart - i * 30) / o.wither) : 1);
      const draw = (layer) => {
        rows.forEach((L, i) => {
          if (!L.els || L.birth == null || L.x == null) return;
          const age = ts - L.birth, kk = kd(L, i);
          if (age < 0 || kk <= 0) return;
          for (const e of L.els) drawEl(P, e, L, age, kk, fr, amp, layer, ts);
        });
      };
      draw(0);
      rows.forEach((L, i) => {
        if (L.ch === ' ' || L.ch === '\n' || L.x == null || L.birth == null || ts - L.birth < 0) return;
        if (L.dead != null && kd(L, i) <= 0) return;
        P.text(L.ch, L.x, L.y, C.text, cssFont(S));
      });
      draw(1);
      if (pixel && o.quantize !== false) { // hard 8-bit: snap each cell to the nearer end of the closest palette PAIR (so a text/bg edge never turns green)
        const cols = [C.bg, C.text, C.stem, C.leaf, C.bloom, C.bloom2, C.line, C.center].filter(Boolean).map(hex), n = cols.length;
        const id = lo.g.getImageData(0, 0, lo.c.width, lo.c.height), d = id.data;
        for (let i = 0; i < d.length; i += 4) {
          let best = 1e12, pick = 0;
          for (let a = 0; a < n; a++) for (let b = a; b < n; b++) {
            const A = cols[a], B = cols[b], vx = B[0] - A[0], vy = B[1] - A[1], vz = B[2] - A[2], L = vx * vx + vy * vy + vz * vz;
            const px_ = d[i] - A[0], py_ = d[i + 1] - A[1], pz_ = d[i + 2] - A[2];
            let t = L ? (px_ * vx + py_ * vy + pz_ * vz) / L : 0;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const ex = px_ - vx * t, ey = py_ - vy * t, ez = pz_ - vz * t, dd = ex * ex + ey * ey + ez * ez;
            if (dd < best - 1e-6) { best = dd; pick = t < 0.5 ? a : b; }
          }
          const c = cols[pick];
          d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
        }
        lo.g.putImageData(id, 0, 0);
      }
      if (pixel) { g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(lo.c, 0, 0, canvas.width, canvas.height); }
      ghosts = ghosts.filter((L) => tt - L.dead < o.wither + 50);
    }
    function loop() { render(clock()); raf = requestAnimationFrame(loop); }

    // ---------- interactive (mode: 'type') ----------
    function onKey(ev) {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const now = clock();
      if (ev.key === 'Backspace') {
        const L = letters.pop();
        typed = Array.from(typed).slice(0, -1).join('');
        if (L) { L.dead = now; ghosts.push(L); }
      } else if (ev.key === 'Enter') {
        letters.forEach((L) => { L.dead = now; ghosts.push(L); });
        letters = []; typed = '';
      } else if (ev.key.length === 1) {
        typed += ev.key;
      } else return;
      ev.preventDefault();
      const nOld = letters.length;
      build(typed);
      layout();
      for (let i = nOld; i < letters.length; i++) letters[i].birth = now;
    }

    // ---------- public ----------
    const api = {
      opts: o,
      seek(ms) { manual = ms; cancelAnimationFrame(raf); render(ms); return api; },
      play() { if (manual != null) { t0 = performance.now() - manual; manual = null; } cancelAnimationFrame(raf); loop(); return api; },
      destroy() { cancelAnimationFrame(raf); root.removeEventListener('resize', onResize); root.removeEventListener('keydown', onKey); },
      stats() {
        const tt = clock(), ts = o.mode === 'autoplay' ? (o.loop ? tt % cycle : Math.min(tt, tGrown + o.hold)) : tt;
        const s = { t: tt, phase: 'grow', letters: letters.filter((L) => L.els).length, total: { stem: 0, leaf: 0, bloom: 0 }, shown: { stem: 0, leaf: 0, bloom: 0 }, S, W, H };
        if (o.mode === 'autoplay') s.phase = ts >= tGrown + o.hold ? 'wither' : ts >= tGrown ? 'hold' : 'grow';
        letters.forEach((L) => {
          if (!L.els || L.birth == null) return;
          const age = ts - L.birth;
          L.els.forEach((e) => { s.total[e.t]++; if (age > e.d0) s.shown[e.t]++; });
        });
        s.config = { text: o.mode === 'type' ? typed : o.text, font: o.font, weight: o.weight, bloom: o.bloom, style: o.style, mode: o.mode, seed: o.seed, palette: C, density: o.density, bloomChance: o.bloomChance };
        s.cycle = cycle; s.tGrown = tGrown; s.hold = o.hold; s.wither = o.wither;
        s.boxes = letters.filter((L) => L.x != null && L.ch.trim()).map((L) => [L.ch, L.x - (L.w * S) / 2, L.y - 0.95 * S, L.x + (L.w * S) / 2, L.y + 0.3 * S]);
        s.weave = { behind: 0, front: 0 };
        letters.forEach((L) => (L.els || []).forEach((e) => { if (e.t === 'stem') e.segs.forEach((sg) => { s.weave[sg.layer ? 'front' : 'behind']++; }); }));
        return s;
      },
    };
    const onResize = () => { layout(); if (manual != null) render(manual); };

    api.ready = (async () => {
      if (o.fontUrl) {
        const ff = new FontFace(o.font, 'url(' + o.fontUrl + ')', { weight: String(o.weight), style: o.fontStyle });
        await ff.load(); document.fonts.add(ff);
      }
      try { await document.fonts.load(o.fontStyle + ' ' + o.weight + ' 100px ' + fam, o.mode === 'type' ? 'abc' : o.text); } catch (e) { /* fallback font */ }
      if (o.mode === 'autoplay') build(o.text); else build('');
      layout();
      root.addEventListener('resize', onResize);
      if (o.mode === 'type') root.addEventListener('keydown', onKey);
      t0 = performance.now();
      if (manual == null) loop(); else render(manual);
      return api;
    })();
    if (o.expose) root.__tg = api;
    return api;
  }

  // helpers for custom blooms: TypeGarden.util.{blob,teardrop,frame,place,tone,open,mix,hex,spr,eo,hash,TAU}
  const util = { blob, teardrop, frame, place, tone, open, mix, hex, spr, eo, hash, TAU };
  root.TypeGarden = { mount, BLOOMS, util, version: '1.2.0' };
})(typeof window !== 'undefined' ? window : this);
