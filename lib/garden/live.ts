// Live: tukang kebun lain. Port 1:1 dari blok `// ---------- live ----------` di original-source.txt.
//
// Transport (interface): `local` = BroadcastChannel('tg-live') untuk ?tglocal; `none`; `supabase` =
// STUB — sengaja tidak aktif (DECISIONS D6: project Supabase remote butuh env milik Milord; key/project
// author asli DILARANG, L4). Guard klien S1 dipertahankan: skema payload ketat, clamp, batas peer.

import type { GardenEngine, PeerPos } from "./engine";
import { FLOWER_NAMES, PEER_TINTS } from "./palettes";

// ---------- util murni (diuji) ----------

/** Interval kirim pointer: clamp(1000·N²/40, 125, 10000) ms (N = jumlah orang) → ≈40 msg/s room-wide. */
export function pointerInterval(N: number): number {
  return Math.min(10000, Math.max(125, (1000 * N * N) / 40));
}

const HEX = /^#[0-9A-Fa-f]{6}$/;
const MAX_PEERS = 40; // disimpan
const MAX_SHOWN = 24; // ditampilkan
const MAX_ID = 24;
const MAX_NAME = 24;

/** Warna presence tervalidasi `#RRGGBB`, kalau tidak putih. */
export const safeTint = (c: unknown): string => (typeof c === "string" && HEX.test(c) ? c : "#FFFFFF");

/** Nama presence aman untuk textContent: string ≤ 24 char, default "visitor". */
export const safeName = (n: unknown): string =>
  typeof n === "string" && n.trim() ? n.slice(0, MAX_NAME) : "visitor";

/** Pesan pointer 'p' tervalidasi: {i} + (h:true | x,y finite) dengan x,y di-clamp −0.02..1.02. */
export type PeerMsg = { i: string; h: true } | { i: string; h?: false; x: number; y: number };

export function sanitizePeerMsg(d: unknown, selfId: string): PeerMsg | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  if (typeof o.i !== "string" || !o.i || o.i.length > MAX_ID || o.i === selfId) return null;
  if (o.h) return { i: o.i, h: true };
  if (typeof o.x !== "number" || typeof o.y !== "number") return null;
  if (!Number.isFinite(o.x) || !Number.isFinite(o.y)) return null;
  const c = (v: number) => Math.min(1.02, Math.max(-0.02, v));
  return { i: o.i, x: c(o.x), y: c(o.y) };
}

// ---------- transport ----------

export type Me = { id: string; n: string; c: string };
export type PresenceMeta = { n?: string; c?: string };

export interface Transport {
  send(ev: "p" | "r", payload: unknown): void;
  close(): void;
}

export type TransportHandlers = {
  onPeer(payload: unknown): void;
  onGift(payload: unknown): void;
  onPresence(meta: Record<string, PresenceMeta>): void;
};

export type TransportFactory = (me: Me, h: TransportHandlers) => Transport | null;

/** BroadcastChannel antar-tab (tes, tanpa project). Heartbeat 1s, roster kedaluwarsa 3.5s. */
export const localTransport: TransportFactory = (me, h) => {
  if (typeof BroadcastChannel === "undefined") return null;
  const bc = new BroadcastChannel("tg-live"),
    roster = new Map<string, { n?: string; c?: string; t: number }>();
  const publish = () => {
    const now = Date.now(),
      out: Record<string, PresenceMeta> = {};
    for (const [k, v] of roster) {
      if (now - v.t > 3500) roster.delete(k);
      else out[k] = { n: v.n, c: v.c };
    }
    h.onPresence(out);
  };
  const beat = () => {
    roster.set(me.id, { n: me.n, c: me.c, t: Date.now() });
    bc.postMessage({ k: "hello", id: me.id, n: me.n, c: me.c });
    publish();
  };
  bc.onmessage = ({ data: d }) => {
    if (!d || typeof d !== "object") return;
    if (d.k === "hello" && typeof d.id === "string" && d.id.length <= MAX_ID) {
      const had = roster.has(d.id);
      if (!had && roster.size >= MAX_PEERS + 1) return;
      roster.set(d.id, { n: d.n, c: d.c, t: Date.now() });
      if (!had) publish();
    } else if (d.k === "bye" && typeof d.id === "string") {
      roster.delete(d.id);
      publish();
    } else if (d.k === "p") h.onPeer(d.payload);
    else if (d.k === "r") h.onGift(d.payload);
  };
  beat();
  const iv = setInterval(beat, 1000);
  return {
    send: (ev, payload) => bc.postMessage({ k: ev, payload }),
    close: () => {
      bc.postMessage({ k: "bye", id: me.id });
      clearInterval(iv);
      bc.close();
    },
  };
};

/**
 * STUB Supabase Realtime (channel `garden`, presence key = me.id, broadcast self:false, 20 evt/s).
 * Tidak aktif: mengembalikan null. Implementasi menunggu project + env milik Milord (D6).
 * Kontrak protokol: lihat artifacts/doc/01-architecture.md §4 "Protokol realtime".
 */
export const supabaseTransport =
  (_cfg: { url: string; key: string }): TransportFactory =>
  () =>
    null;

/** Pilih transport dari query string & env. ?tglocal → local; env lengkap → supabase (stub); else none. */
export function chooseTransport(
  search: string,
  env: { url?: string; key?: string } = {},
): TransportFactory | null {
  if (/[?&]tglocal/.test(search)) return localTransport;
  if (env.url && env.key) return supabaseTransport({ url: env.url, key: env.key });
  return null;
}

// ---------- peers ----------

export type Peer = PeerPos & {
  id: string;
  el: HTMLElement;
  tx: number;
  ty: number;
  op: number;
  n?: string;
  c?: string;
};

const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

export type LiveOptions = {
  engine: GardenEngine;
  /** Layer DOM kursor peer ([data-tg=peers]). */
  layer: HTMLElement | null;
  factory: TransportFactory;
  /** Jumlah tukang kebun termasuk diri sendiri (n>1 → "N gardeners here"). */
  onCount: (n: number) => void;
};

export class LiveRoom {
  readonly me: Me;
  readonly peers = new Map<string, Peer>();
  others = 0;
  private net: Transport | null = null;
  private roster: Record<string, PresenceMeta> = {};
  private lastSend = 0;
  private sentX: number | null = null;
  private sentY: number | null = null;
  private idleT: ReturnType<typeof setTimeout> | undefined;
  private connT: ReturnType<typeof setTimeout> | undefined;
  private offs: Array<() => void> = [];

  constructor(private o: LiveOptions) {
    this.me = {
      id: Math.random().toString(36).slice(2, 10),
      n: pick(FLOWER_NAMES),
      c: pick(PEER_TINTS),
    };
  }

  /** Pasang hook ke engine & sambung 1.2s kemudian (seperti source). */
  start(): void {
    const e = this.o.engine;
    e.peers = () => this.peers.values();
    e.onStep = (now, dt) => this.step(now, dt);
    this.offs.push(
      e.on("gift", (g) => this.send("r", g)),
      e.on("leave", () => {
        this.sentX = null;
        this.send("p", { i: this.me.id, h: 1 });
      }),
    );
    const onVis = () => {
      if (document.hidden) {
        this.send("p", { i: this.me.id, h: 1 });
        this.idleT = setTimeout(() => this.close(), 60000);
      } else {
        clearTimeout(this.idleT);
        if (!this.net) this.connect();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    this.offs.push(() => document.removeEventListener("visibilitychange", onVis));
    this.connT = setTimeout(() => this.connect(), 1200);
  }

  dispose(): void {
    clearTimeout(this.connT);
    clearTimeout(this.idleT);
    this.offs.forEach((f) => f());
    this.offs = [];
    this.close();
    const e = this.o.engine;
    e.peers = null;
    e.onStep = null;
  }

  private connect(): void {
    if (this.net) return;
    this.net = this.o.factory(this.me, {
      onPeer: (p) => this.peer(p),
      onGift: (g) => this.o.engine.receiveGift(g),
      onPresence: (m) => this.presence(m),
    });
  }

  private close(): void {
    if (this.net) {
      this.net.close();
      this.net = null;
    }
    for (const id of [...this.peers.keys()]) this.drop(id);
    this.others = 0;
    this.o.onCount(1);
  }

  private send(ev: "p" | "r", payload: unknown): void {
    if (this.net && this.others > 0) {
      try {
        this.net.send(ev, payload);
      } catch {
        /* kanal tertutup */
      }
    }
  }

  private presence(meta: Record<string, PresenceMeta>): void {
    this.roster = meta || {};
    const n = new Set([...Object.keys(this.roster), this.me.id]).size;
    this.others = n - 1;
    for (const id of [...this.peers.keys()]) if (!this.roster[id]) this.drop(id);
    for (const [id, p] of this.peers) {
      const r = this.roster[id];
      if (r && (r.n !== p.n || r.c !== p.c)) this.style(p, r);
    }
    this.o.onCount(n);
  }

  private peer(raw: unknown): void {
    const d = sanitizePeerMsg(raw, this.me.id);
    if (!d) return;
    let p = this.peers.get(d.i);
    if (!p) {
      if (this.peers.size >= MAX_PEERS) return;
      p = this.make(d.i);
    }
    p.t = performance.now();
    p.h = !!d.h;
    if (!d.h && "x" in d) {
      const W = this.o.engine.state.W,
        H = this.o.engine.state.H;
      p.tx = d.x;
      p.ty = d.y;
      if (p.x == null) {
        p.x = d.x * W;
        p.y = d.y * H;
      }
    }
  }

  private make(id: string): Peer {
    const el = document.createElement("div");
    el.className = "tg-peer";
    el.style.opacity = "0";
    el.innerHTML =
      '<svg width="18" height="20" viewBox="0 0 18 20"><path d="M1 1L1 16L5.5 12L8.5 19L11.5 17.6L8.6 11H15Z" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/></svg><span></span>';
    this.o.layer?.appendChild(el);
    const p: Peer = { id, el, x: null, y: null, tx: 0, ty: 0, t: 0, h: true, op: 0 };
    this.peers.set(id, p);
    this.style(p, this.roster[id] || {});
    return p;
  }

  private style(p: Peer, r: PresenceMeta): void {
    p.n = safeName(r.n);
    p.c = safeTint(r.c);
    p.el.querySelector("path")?.setAttribute("fill", p.c);
    const s = p.el.querySelector("span") as HTMLElement | null;
    if (s) {
      s.textContent = p.n;
      s.style.background = p.c;
    }
  }

  private drop(id: string): void {
    const p = this.peers.get(id);
    if (p) {
      p.el.remove();
      this.peers.delete(id);
    }
  }

  /** Per frame: kirim pointer (bila berubah & ada orang lain & tab terlihat) + animasi kursor peer. */
  step(now: number, dt: number): void {
    const e = this.o.engine,
      W = e.state.W,
      H = e.state.H,
      iv = pointerInterval(this.others + 1);
    if (this.net && this.others > 0 && e.mx != null && !document.hidden && now - this.lastSend >= iv) {
      const x = Math.round((e.mx / W) * 1000) / 1000,
        y = Math.round((e.my / H) * 1000) / 1000;
      if (x !== this.sentX || y !== this.sentY) {
        this.lastSend = now;
        this.sentX = x;
        this.sentY = y;
        this.send("p", { i: this.me.id, x, y });
      }
    }
    if (!this.peers.size) return;
    const tau = Math.min(900, Math.max(70, 0.55 * iv)),
      k = 1 - Math.exp(-dt / tau);
    let shown = 0;
    for (const p of [...this.peers.values()].sort((a, b) => b.t - a.t)) {
      const idle = now - p.t,
        vis = !p.h && p.x != null && idle < 45000 && shown < MAX_SHOWN;
      if (vis) {
        shown++;
        p.x = (p.x as number) + (p.tx * W - (p.x as number)) * k;
        p.y = (p.y as number) + (p.ty * H - (p.y as number)) * k;
        p.el.style.transform = `translate(${(p.x as number).toFixed(1)}px,${(p.y as number).toFixed(1)}px)`;
      }
      const op = !vis ? 0 : idle < 8000 ? 1 : 0.35;
      if (p.op !== op) {
        p.op = op;
        p.el.style.opacity = String(op);
      }
    }
  }
}
