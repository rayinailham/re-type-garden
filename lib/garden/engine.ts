// GardenEngine — type mode hidup. TS murni (tanpa React): rAF + canvas imperatif,
// React hanya chrome (tidak ada setState per frame).
//
// Dua lapis:
//   TypeState    — model tanpa DOM: huruf, layout, smoothing, wither/cut. Bisa diuji di node.
//   GardenEngine — DOM: canvas, listener keyboard/pointer, rAF, hidden input, fauna, render.
//
// Port 1:1 dari componentDidMount/frame/paint/key/inputDiff/add/wither/near/faceTurn di
// artifacts/doc/evidence/original-source.txt. Perbaikan rebuild: A1 (reduced motion), A2 (event
// 'text' untuk aria-live), S1 (validasi gift).

import type { Letter, El, Pt, Rand } from "./types";
import type { Palette } from "./palettes";
import { MOTION } from "./palettes";
import { canvasBackend, type Backend, type Colors } from "./draw";
import { render, type RenderState, type RenderHooks } from "./render";
import { gen, genEnd, type GenCtx } from "./growth";
import { layoutCore, makeMeasure, FONT, type Measure } from "./layout";
import { Fauna, sanitizeGift, type GiftPayload } from "./fauna";
import { SENT, keyAction, diffInput } from "./input";
import { eo } from "./math";

// ---------- util murni (diuji) ----------

/** dt frame di-clamp 64ms (tab di-background → loncatan besar tak meledak). */
export function clampDt(now: number, last: number | undefined): number {
  return Math.min(MOTION.dtClampMs, now - (last ?? now));
}

/** Koefisien smoothing frame-rate independent: k = 1 − e^(−dt/τ), τ = 80ms. */
export function smoothK(dt: number, tau: number = MOTION.smoothTauMs): number {
  return 1 - Math.exp(-dt / tau);
}

/** Tint posisi peer untuk near(): subset Peer dari live.ts. */
export type PeerPos = { x: number | null; y: number | null; h: boolean; t: number };

// ---------- TypeState ----------

export type TypeDeps = {
  mw: Measure;
  /** this.rand di source: Math.random di type mode. */
  rand: Rand;
  /** props.density (0.5–1.6, default 1). */
  density: () => number;
};

export class TypeState {
  letters: Letter[] = [];
  uid = 1;
  wrapped = false;
  W = 0;
  H = 0;
  /** Ukuran huruf tersmoothing (Sd) & target (St). */
  Sd = 0;
  St = 0;
  /** Posisi caret tersmoothing & targetnya. */
  cx = 0;
  cy = 0;
  tcx = 0;
  tcy = 0;
  /** Waktu keypress terakhir (caret solid 500ms). */
  lastKey = 0;

  constructor(private deps: TypeDeps) {}

  private ctx(): GenCtx {
    return { rand: this.deps.rand, density: this.deps.density(), mw: this.deps.mw };
  }

  /** Huruf yang belum mati. */
  get live(): Letter[] {
    return this.letters.filter((l) => !l.dead);
  }

  /** Teks hidup (A2 aria-live, dan dibawa ke poster). */
  text(): string {
    return this.live
      .map((l) => l.ch)
      .join("")
      .trim();
  }

  /** Tambah satu karakter. Space = cut kata (genEnd) + spasi. */
  add(ch: string, now: number): void {
    const A = this.live,
      last = A[A.length - 1];
    if (ch === " ") {
      if (last && last.ch !== " ") {
        last.cut = now;
        genEnd(last, now - (last.birth as number), this.ctx());
      }
      this.letters.push({ ch: " ", id: this.uid++, birth: now, ws: 0, wi: 0, els: [] });
      this.layout();
      return;
    }
    const same = !!last && last.ch !== " ";
    const l: Letter = {
      ch,
      id: this.uid++,
      birth: now,
      tb: now,
      ws: same ? (last as Letter).ws : Math.floor(this.deps.rand() * 1e9),
      wi: same ? (last as Letter).wi + 1 : 0,
      prev: same ? (last as Letter) : null,
      els: [],
    };
    gen(l, this.ctx());
    this.letters.push(l);
    this.layout();
  }

  /** Backspace: huruf terakhir layu; huruf sebelumnya (jika bukan spasi) tendril tumbuh lagi. */
  wither(now: number): void {
    const A = this.live,
      last = A[A.length - 1];
    if (!last) return;
    last.dead = now;
    const pv = A[A.length - 2];
    if (pv && pv.ch !== " ") {
      pv.cut = null;
      pv.endEls = null;
      pv.tb = now;
    }
    this.layout();
  }

  /** Enter: hapus semua huruf seketika (tanpa animasi). */
  clear(): void {
    this.letters = [];
    this.layout();
  }

  resize(W: number, H: number): void {
    this.W = W;
    this.H = H;
    this.layout(true);
  }

  layout(snap = false): void {
    if (!this.W) return;
    const A = this.live;
    const res = layoutCore(A, this.W, this.H, this.wrapped, this.deps.mw);
    this.wrapped = res.wrapped;
    A.forEach((l) => {
      if (l.x == null) {
        l.x = l.tx;
        l.y = l.ty;
      }
    });
    const S = res.S,
      last = A[A.length - 1];
    this.St = S;
    this.tcx = last ? (last.tx as number) + (last.tw as number) / 2 + 0.07 * S : this.W / 2;
    this.tcy = last ? (last.ty as number) - 0.33 * S : this.H / 2;
    if (snap || !this.Sd) {
      this.Sd = S;
      this.cx = this.tcx;
      this.cy = this.tcy;
      A.forEach((l) => {
        l.x = l.tx;
        l.y = l.ty;
      });
    }
  }

  /** Satu langkah frame: smoothing ukuran/caret/posisi + buang huruf mati > 300ms. Kembalikan yang dibuang. */
  step(now: number, dt: number): Letter[] {
    const k = smoothK(dt);
    this.Sd += (this.St - this.Sd) * k;
    this.cx += (this.tcx - this.cx) * k;
    this.cy += (this.tcy - this.cy) * k;
    for (const l of this.letters)
      if (!l.dead && l.tx != null) {
        l.x = (l.x as number) + (l.tx - (l.x as number)) * k;
        l.y = (l.y as number) + ((l.ty as number) - (l.y as number)) * k;
      }
    const removed: Letter[] = [];
    this.letters = this.letters.filter((l) => {
      const gone = !!l.dead && now - l.dead > MOTION.witherMs.removeAfter;
      if (gone) removed.push(l);
      return !gone;
    });
    return removed;
  }
}

// ---------- GardenEngine ----------

export type EngineProps = { boil: boolean; recoil: number; density: number };

export type EngineOptions = {
  canvas: HTMLCanvasElement;
  /** Elemen app (pointerdown/click → fokus input & kupu-kupu). */
  root?: HTMLElement | null;
  /** Hidden input 1×1 (sumber keyboard HP/IME). */
  input?: HTMLInputElement | null;
  palette: Palette;
  /** font-family canvas (hasil resolve next/font). Default FONT. */
  font?: string;
  props?: Partial<EngineProps>;
};

export type EngineEvents = {
  /** Teks hidup berubah (A2 aria-live). */
  text: string;
  /** Ctrl/Cmd+S (+Shift = svg). */
  save: "png" | "svg";
  /** Rose gift ditanam lokal (untuk broadcast). */
  gift: GiftPayload;
  /** Pointer meninggalkan jendela. */
  leave: undefined;
  /** Font display selesai dimuat (cache ukuran huruf di-reset). */
  fonts: undefined;
};

type Listener<K extends keyof EngineEvents> = (v: EngineEvents[K]) => void;

export class GardenEngine {
  readonly canvas: HTMLCanvasElement;
  readonly state: TypeState;
  readonly fauna = new Fauna();
  props: EngineProps = { boil: true, recoil: MOTION.tendril.recoilPx, density: 1 };
  palette: Palette;
  font: string;
  /** Pointer (client px) — null jika tak ada / jari diangkat. */
  mx: number | null = null;
  my = 0;
  dpr = 1;
  /** Preferensi reduced motion (A1). */
  reduced = false;
  /** Callback per frame (live.step). */
  onStep: ((now: number, dt: number) => void) | null = null;
  /** Sumber posisi peer untuk near() (live.ts). */
  peers: (() => Iterable<PeerPos>) | null = null;

  private g: CanvasRenderingContext2D;
  private root: HTMLElement | null;
  private input: HTMLInputElement | null;
  private cache: Record<string, number> = {};
  private fa: Record<number, [number, number]> = {};
  private hooks: RenderHooks;
  private t0 = 0;
  private lt: number | undefined;
  private raf = 0;
  private active = true;
  private touch = false;
  private ptype = "mouse";
  private composing = false;
  private iv: string = SENT;
  private kd = false;
  private lastTap: { t: number; x: number; y: number } | null = null;
  private lastPlant = 0;
  private cleanup: Array<() => void> = [];
  private listeners = new Map<keyof EngineEvents, Set<(v: never) => void>>();
  private vv: VisualViewport | null = null;
  private vvMax = 0;
  private vvW = 0;
  private kbWas = false;
  private mounted = false;

  constructor(opts: EngineOptions) {
    this.canvas = opts.canvas;
    const g = opts.canvas.getContext("2d");
    if (!g) throw new Error("GardenEngine: canvas 2D context tidak tersedia");
    this.g = g;
    this.root = opts.root ?? null;
    this.input = opts.input ?? null;
    this.palette = opts.palette;
    this.font = opts.font || FONT;
    Object.assign(this.props, opts.props);
    this.state = new TypeState({
      mw: (ch) => this.mw(ch),
      rand: Math.random,
      density: () => this.props.density,
    });
    this.hooks = {
      near: (x, y) => this.near(x, y),
      faceTurn: (e, x, y) => this.faceTurn(e, x, y),
      perch: this.fauna.perch,
    };
  }

  // ---------- events ----------

  on<K extends keyof EngineEvents>(k: K, fn: Listener<K>): () => void {
    let set = this.listeners.get(k);
    if (!set) this.listeners.set(k, (set = new Set()));
    set.add(fn as (v: never) => void);
    return () => set.delete(fn as (v: never) => void);
  }

  private emit<K extends keyof EngineEvents>(k: K, v: EngineEvents[K]): void {
    this.listeners.get(k)?.forEach((fn) => (fn as Listener<K>)(v));
  }

  // ---------- lifecycle ----------

  mount(): void {
    if (this.mounted) return;
    this.mounted = true;
    const w = window;
    const add = <T extends EventTarget>(
      t: T,
      type: string,
      fn: (e: never) => void,
      o?: boolean | AddEventListenerOptions,
    ) => {
      t.addEventListener(type, fn as EventListener, o);
      this.cleanup.push(() => t.removeEventListener(type, fn as EventListener, o));
    };

    this.t0 = performance.now();
    this.touch = !!(w.matchMedia && w.matchMedia("(pointer: coarse)").matches);
    if (this.touch) document.documentElement.setAttribute("data-touch", "");
    if (w.matchMedia) {
      const mq = w.matchMedia("(prefers-reduced-motion: reduce)");
      this.reduced = mq.matches;
      const onMq = () => (this.reduced = mq.matches);
      mq.addEventListener?.("change", onMq);
      this.cleanup.push(() => mq.removeEventListener?.("change", onMq));
    }

    this.resize();
    add(w, "resize", () => this.resize());
    add(w, "keydown", (e: KeyboardEvent) => this.key(e));
    add(w, "pointermove", (e: PointerEvent) => {
      this.mx = e.clientX;
      this.my = e.clientY;
    });
    add(w, "pointerdown", (e: PointerEvent) => (this.ptype = e.pointerType || "mouse"), true);
    // mawar relaks saat jari diangkat
    const up = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== "mouse") this.mx = null;
    };
    add(w, "pointerup", up);
    add(w, "pointercancel", up);
    add(w, "pointerdown", (e: PointerEvent) => this.onPlant(e));
    add(document, "mouseout", (e: MouseEvent) => {
      if (!e.relatedTarget) {
        this.mx = null;
        this.emit("leave", undefined);
      }
    });
    if (this.root) {
      add(this.root, "pointerdown", (e: PointerEvent) => this.onFocus(e));
      add(this.root, "click", (e: MouseEvent) => this.onTap(e));
    }
    const fld = this.input;
    if (fld) {
      fld.value = SENT;
      add(fld, "input", () => this.inputDiff(fld));
      add(fld, "compositionstart", () => (this.composing = true));
      add(fld, "compositionend", () => {
        this.composing = false;
        setTimeout(() => {
          if (this.input && !this.composing) this.inputDiff(this.input);
        }, 0);
      });
    }
    this.vv = w.visualViewport || null;
    if (this.vv && this.touch) {
      add(this.vv, "resize", () => this.syncVV());
      add(this.vv, "scroll", () => this.syncVV());
      this.syncVV();
    }
    void this.fontReady();

    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.frame();
    };
    loop();
    if (!this.touch) {
      const t = setTimeout(() => this.focus(), 50);
      this.cleanup.push(() => clearTimeout(t));
    }
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.cleanup.forEach((fn) => fn());
    this.cleanup = [];
    this.listeners.clear();
    this.mounted = false;
  }

  /** Aktif = type mode tampil. Nonaktif (poster): berhenti paint & abaikan input. */
  setActive(on: boolean): void {
    if (on === this.active) return;
    this.active = on;
    if (on) {
      this.resize();
      this.focus();
    }
  }

  setPalette(p: Palette): void {
    this.palette = p;
  }

  setProps(p: Partial<EngineProps>): void {
    Object.assign(this.props, p);
  }

  focus(): void {
    this.input?.focus({ preventScroll: true });
  }

  /** Setelah klik tombol: kembalikan fokus ke field (hanya mouse). */
  refocus(): void {
    if (this.ptype === "mouse" && this.active) this.focus();
  }

  liveText(): string {
    return this.state.text();
  }

  // ---------- ukuran / font ----------

  private mw(ch: string): number {
    return makeMeasure(this.g, this.cache, this.font)(ch);
  }

  /**
   * Tunggu font display (hanya keluarga utama — face fallback `local()` bisa gagal load dan
   * menolak seluruh promise), lalu refreshFont(). Tak pernah menolak.
   */
  async fontReady(): Promise<void> {
    if (!document.fonts) return;
    const primary = this.font.split(",")[0].trim();
    try {
      await document.fonts.load(`700 100px ${primary}`);
    } catch {
      /* pakai fallback; ukur ulang tetap aman */
    }
    this.refreshFont();
  }

  /** Font display siap/berubah: reset cache ukuran, layout ulang, kabari poster. */
  refreshFont(): void {
    this.cache = {};
    this.state.layout();
    this.emit("fonts", undefined);
  }

  /** Pengukur huruf yang sama dipakai poster (cache bersama). */
  measure(): Measure {
    return (ch) => this.mw(ch);
  }

  resize(): void {
    const c = this.canvas,
      r = c.getBoundingClientRect(),
      d = window.devicePixelRatio || 1;
    if (!r.width) return;
    this.dpr = d;
    c.width = Math.round(r.width * d);
    c.height = Math.round(r.height * d);
    this.state.resize(r.width, r.height);
  }

  /** Port syncVV: viewport visual HP (keyboard) → --tg-top/--tg-h, data-kb. */
  private syncVV(): void {
    const vv = this.vv;
    if (!vv) return;
    const w = Math.round(vv.width);
    if (this.vvW !== w) {
      this.vvW = w;
      this.vvMax = 0; // diputar: ukur ulang
    }
    this.vvMax = Math.max(this.vvMax, vv.height);
    const kb = this.vvMax - vv.height > 120,
      de = document.documentElement;
    de.style.setProperty("--tg-top", vv.offsetTop + "px");
    de.style.setProperty("--tg-h", vv.height + "px");
    if (kb) de.setAttribute("data-kb", "");
    else de.removeAttribute("data-kb");
    // keyboard ditutup tapi field masih fokus (gesture back Android): lepas agar tap berikutnya membukanya lagi
    if (!kb && this.kbWas && document.activeElement === this.input) this.input?.blur();
    this.kbWas = kb;
    this.resize();
  }

  // ---------- input ----------

  /** Port key(): keydown global (hanya type mode). */
  key(e: KeyboardEvent): void {
    if (!this.active) return;
    const a = keyAction({
      key: e.key,
      metaKey: e.metaKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
      targetTag: (e.target as HTMLElement | null)?.tagName,
    });
    if (a.prevent) e.preventDefault();
    const now = performance.now();
    switch (a.kind) {
      case "save":
        this.emit("save", a.svg ? "svg" : "png");
        return;
      case "backspace":
        this.mark();
        this.state.wither(now);
        break;
      case "clear":
        this.mark();
        this.state.clear();
        break;
      case "char":
        this.mark();
        this.state.add(a.ch, now);
        break;
      default:
        return;
    }
    this.emit("text", this.state.text());
  }

  /** keydown sudah menangani → abaikan event `input` yang menyusul pada tick yang sama. */
  private mark(): void {
    this.state.lastKey = performance.now();
    this.kd = true;
    setTimeout(() => {
      this.kd = false;
    }, 0);
  }

  /**
   * Keyboard HP sering tak mengirim key event, malah menulis ke field (bahkan menulis ulang
   * seluruh kata saat prediksi): cerminkan field, terapkan selisihnya.
   */
  inputDiff(el: HTMLInputElement): void {
    if (!this.active || this.kd) {
      this.iv = this.composing ? el.value : SENT;
      if (!this.composing) el.value = SENT;
      return;
    }
    const { dels, adds } = diffInput(this.iv, el.value);
    const now = performance.now();
    this.state.lastKey = now;
    for (let i = 0; i < dels; i++) this.state.wither(now);
    for (const ch of adds) {
      if (ch.charCodeAt(0) === 10) this.state.clear();
      else this.state.add(ch, now);
    }
    if (this.composing) this.iv = el.value;
    else {
      el.value = SENT;
      this.iv = SENT;
    }
    this.emit("text", this.state.text());
  }

  // ---------- pointer ----------

  /** pointerdown di app: fokus input (mouse) + kupu-kupu di titik klik (canvas). */
  private onFocus(ev: PointerEvent): void {
    if (!this.active || !this.input) return;
    const touch = !!ev.pointerType && ev.pointerType !== "mouse",
      target = ev.target as HTMLElement | null,
      onCanvas = target === this.canvas;
    // touch: biarkan fokus (dan keyboard) di tempatnya selama tap; click yang membuka keyboard
    if (touch) {
      if (ev.cancelable && (onCanvas || target?.closest?.("button"))) ev.preventDefault();
    } else this.focus();
    if (onCanvas && !this.reduced)
      this.fauna.spawn(ev.clientX, ev.clientY, this.state.W, this.state.H, this.state.Sd, performance.now());
  }

  private onTap(ev: MouseEvent): void {
    if (this.active && this.input && this.ptype !== "mouse" && ev.target === this.canvas) this.focus();
  }

  /** Double-tap (<340ms, <40px, cooldown 1800ms) di canvas → rose gift lokal. */
  private onPlant(e: PointerEvent): void {
    if (!this.active || e.target !== this.canvas) return;
    const G = MOTION.gift,
      now = performance.now(),
      lp = this.lastTap;
    this.lastTap = { t: now, x: e.clientX, y: e.clientY };
    if (
      lp &&
      now - lp.t < G.doubleTapMs &&
      Math.hypot(e.clientX - lp.x, e.clientY - lp.y) < G.doubleTapPx &&
      now - this.lastPlant > G.cooldownMs
    ) {
      this.lastPlant = now;
      this.lastTap = null;
      const g = sanitizeGift({
        x: Math.round((e.clientX / this.state.W) * 1000) / 1000,
        y: Math.round((e.clientY / this.state.H) * 1000) / 1000,
        s: Math.floor(Math.random() * 1e6),
      });
      if (g) {
        this.fauna.addGift(g, now);
        this.emit("gift", g);
      }
    }
  }

  /** Gift dari peer: validasi + clamp (S1) lalu tanam. */
  receiveGift(raw: unknown): void {
    const g = sanitizeGift(raw);
    if (g) this.fauna.addGift(g, performance.now());
  }

  /** Pointer terdekat: milikmu, atau peer yang bergerak ≤ 8 detik terakhir. */
  near(x: number, y: number): Pt | null {
    let best: Pt | null = this.mx != null ? [this.mx, this.my] : null,
      bd = best ? Math.hypot(best[0] - x, best[1] - y) : 1e9;
    const ps = this.peers?.();
    if (ps) {
      const now = performance.now();
      for (const p of ps) {
        if (p.h || p.x == null || p.y == null || now - p.t > 8000) continue;
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bd) {
          bd = d;
          best = [p.x, p.y];
        }
      }
    }
    return best;
  }

  /** Mawar menoleh ke pointer terdekat (cache per elemen, lerp 0.09/frame). */
  faceTurn(e: El, x: number, y: number): Pt {
    let wx = 0,
      wy = 0;
    const A = this.near(x, y);
    if (A) {
      const dx = A[0] - x,
        dy = A[1] - y,
        d = Math.hypot(dx, dy),
        reach = 300;
      if (d < reach && d > 0.001) {
        const w = 1 - d / reach,
          s = w * w * (3 - 2 * w) * Math.min(1, d / 40);
        wx = (dx / d) * s;
        wy = (dy / d) * s;
      }
    }
    const c = this.fa[e.id] || [0, 0];
    c[0] += (wx - c[0]) * 0.09;
    c[1] += (wy - c[1]) * 0.09;
    this.fa[e.id] = c;
    return c;
  }

  // ---------- frame / paint ----------

  colors(): Colors {
    const p = this.palette;
    return { red: p.flower, blue: p.stem, line: p.line, text: p.text, vein: p.bg };
  }

  /** State render type mode (padanan mainState()). A1: boil off & spring → eo saat reduced. */
  mainState(): RenderState {
    return {
      letters: this.state.letters,
      S: this.state.Sd,
      C: this.colors(),
      boil: this.props.boil && !this.reduced,
      recoil: this.props.recoil,
      speed: 1,
      wither: MOTION.witherMs.type,
      face: true,
      calm: this.reduced,
    };
  }

  frame(): void {
    const now = performance.now(),
      dt = clampDt(now, this.lt);
    this.lt = now;
    if (!this.active) return;
    const removed = this.state.step(now, dt);
    // cache face-turn per elemen: buang milik huruf yang sudah dihapus
    for (const l of removed) for (let k = 0; k < 100; k++) delete this.fa[l.id * 100 + k];
    this.onStep?.(now, dt);
    this.paint(now, true);
  }

  /** Render taman ke Backend lain (SVG export) memakai state & hook hidup. */
  renderTo(B: Backend, now: number): void {
    render(B, now, this.mainState(), this.hooks);
  }

  /** Gambar satu frame. caret=false untuk export PNG (tanpa caret & gift, seperti source). */
  paint(now: number, caret: boolean): void {
    const st = this.state;
    if (!st.W) return;
    const g = this.g,
      d = this.dpr;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.fillStyle = this.palette.bg;
    g.fillRect(0, 0, st.W, st.H);
    const B = canvasBackend(g, this.font),
      rs = this.mainState();
    render(B, now, rs, this.hooks);
    this.fauna.drawFlies(B, now, rs.C, st.W, st.H);
    if (caret) {
      if (this.fauna.gifts.length)
        this.fauna.drawGifts(g, B, now, st.W, st.H, st.Sd, rs.C, this.reduced);
      const S = st.Sd,
        solid = this.reduced || now - st.lastKey < MOTION.caret.solidAfterKeyMs,
        on = solid || Math.floor(now / MOTION.caret.blinkMs) % 2 === 0,
        hf = eo((now - this.t0) / MOTION.caret.fadeInMs);
      if (on && hf > 0) {
        const h = 0.8 * S * hf,
          w = Math.max(2, S * 0.03);
        B.rect(st.cx - w / 2, st.cy - h / 2, w, h, rs.C.text);
      }
    }
  }
}
