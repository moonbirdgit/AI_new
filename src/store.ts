import { useEffect, useState } from 'react';
import { clone, seed } from './engine/engine';
import type { World } from './engine/types';

/*
  資料同步：
  - 有設定資料庫（Vercel + Upstash）→ 同一個房間的人看到同一份資料，每 2 秒同步一次
  - 沒有設定 → 本機模式，資料存在這個瀏覽器
  每次動作都是「拿最新資料 → 套用動作 → 版本 +1 → 存回去」；版本衝突就拿新資料重做。
*/

export type Mode = 'loading' | 'remote' | 'local';
type Listener = () => void;

/** 舊版資料缺新欄位時，換成新的示範資料（保留版本號） */
function normalize(w: World | null): World | null {
  if (!w) return w;
  if (!w.state || !Array.isArray(w.state.parts) || !w.weekly || !w.state.forecast) { const s = seed(); s.version = w.version || 1; return s; }
  return w;
}

function getRoom(): string {
  const u = new URL(location.href);
  let r = (u.searchParams.get('room') || '').toLowerCase();
  if (!/^[a-z0-9]{4,16}$/.test(r)) {
    r = Math.random().toString(36).slice(2, 8);
    u.searchParams.set('room', r);
    history.replaceState(null, '', u.toString());
  }
  return r;
}

class Store {
  room = getRoom();
  world: World | null = null;
  mode: Mode = 'loading';
  error = '';
  private listeners = new Set<Listener>();
  private timer: number | undefined;
  private busy = false;

  subscribe(f: Listener) { this.listeners.add(f); return () => { this.listeners.delete(f); }; }
  private emit() { this.listeners.forEach((f) => f()); }

  private localKey() { return 'sl-world-' + this.room; }
  private loadLocal(): World {
    try { const s = localStorage.getItem(this.localKey()); if (s) return normalize(JSON.parse(s)) || seed(); } catch { /* 無法讀取就用新的 */ }
    return seed();
  }
  private saveLocal(w: World) { try { localStorage.setItem(this.localKey(), JSON.stringify(w)); } catch { /* 忽略 */ } }

  async init() {
    try {
      const r = await fetch(`/api/world?room=${this.room}`);
      if (r.status === 503 || r.status === 404 || !r.ok) throw new Error('no_store');
      const j = await r.json();
      this.mode = 'remote';
      if (j.world) this.world = normalize(j.world);
      else { const w = seed(); await this.push(w, -1); this.world = w; }
      this.timer = window.setInterval(() => this.poll(), 2000);
    } catch {
      this.mode = 'local';
      this.world = this.loadLocal();
    }
    this.emit();
  }

  private async poll() {
    if (this.busy || !this.world || document.hidden) return;
    try {
      const r = await fetch(`/api/world?room=${this.room}&v=${this.world.version}`);
      if (!r.ok) return;
      const j = await r.json();
      if (!j.same && j.world && j.world.version !== this.world.version) { this.world = normalize(j.world); this.emit(); }
      this.error = '';
    } catch { this.error = '連線中斷，稍後重試'; this.emit(); }
  }

  private async push(w: World, base: number): Promise<{ ok: boolean; world?: World }> {
    const r = await fetch('/api/world', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: this.room, base, world: w }),
    });
    if (r.status === 409) { const j = await r.json(); return { ok: false, world: j.world }; }
    if (!r.ok) throw new Error('save_failed');
    return { ok: true };
  }

  /** 套用一個動作。fn 會拿到最新資料的複本，直接改它即可。 */
  async act<T>(fn: (w: World) => T): Promise<T | undefined> {
    if (!this.world) return;
    this.busy = true;
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const prev: World = this.world!;
        const base = prev.version;
        const w: World = clone(prev);
        const out = fn(w);
        w.version = base + 1;
        this.world = w; this.emit();
        if (this.mode === 'local') { this.saveLocal(w); return out; }
        try {
          const r = await this.push(w, base);
          if (r.ok) return out;
          this.world = normalize(r.world || null) || prev; this.emit();
        } catch {
          this.world = prev; this.error = '儲存失敗，請再按一次'; this.emit();
          return;
        }
      }
    } finally { this.busy = false; }
  }

  async reset() { await this.act((w) => { const s = seed(); s.version = w.version; Object.assign(w, s); }); }

  shareUrl() { const u = new URL(location.href); u.searchParams.set('room', this.room); u.hash = ''; return u.toString(); }
  newRoomUrl() { const u = new URL(location.href); u.searchParams.set('room', Math.random().toString(36).slice(2, 8)); u.hash = ''; return u.toString(); }
}

export const store = new Store();

export function useWorld(): World | null {
  const [, set] = useState(0);
  useEffect(() => store.subscribe(() => set((x) => x + 1)), []);
  return store.world;
}
