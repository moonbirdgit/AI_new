import { useEffect, useState } from 'react';
import type { Kit, Line, Order } from './engine/types';

export function Cust({ c }: { c?: string | null }) {
  return <span className={'cust c-' + (c || '')}>{c || '?'}</span>;
}

export const custCol = (c?: string) => (c === '甲' ? 'var(--jia)' : c === '乙' ? 'var(--yi)' : c === '丙' ? 'var(--bing)' : 'var(--ink3)');

const ST: Record<string, [string, string]> = {
  draft: ['', '退回'], submitted: ['warn', '待確認'], approval: ['warn', '待核准'], planned: ['acc', '已排程'],
  queued: ['', '排隊'], running: ['acc', '生產中'], paused: ['warn', '暫停'], done: ['ok', 'SMT 完成'], decided: ['ok', '已決定'],
};
export function StatusPill({ o }: { o: Order }) {
  if (o.shipped) return <span className="pill ok">已出貨</span>;
  const x = ST[o.status] || ['', o.status];
  return <span className={'pill ' + x[0]}>{x[1]}</span>;
}

export const KIT_TXT: Record<string, [string, string]> = {
  todo: ['', '未備'], picking: ['warn', '備料中'], ready: ['acc', '備妥待運'], fetching: ['acc', '運送中'], atline: ['ok', '已到線邊'], newpart: ['bad', '等新料'],
};
export function KitPill({ k }: { k?: Kit }) {
  const x = KIT_TXT[k?.status || ''] || ['', '—'];
  return <span className={'pill ' + x[0]}>{x[1]}</span>;
}

export function lineState(L: Line): { t: string; c: string } {
  if (L.mode === 'run') return { t: '生產中', c: 'var(--ok)' };
  if (L.mode === 'co') return { t: `換線中・剩 ${L.coLeft} 分`, c: 'var(--warn)' };
  if (L.mode === 'wait') return { t: '停機等料', c: 'var(--bad)' };
  return { t: '空著', c: 'var(--ink3)' };
}

let toastFn: ((s: string) => void) | null = null;
export function toast(s: string) { toastFn?.(s); }
export function Toaster() {
  const [msg, setMsg] = useState('');
  useEffect(() => { toastFn = (s) => { setMsg(s); window.setTimeout(() => setMsg((m) => (m === s ? '' : m)), 2400); }; return () => { toastFn = null; }; }, []);
  return msg ? <div className="toast">{msg}</div> : null;
}

let confirmFn: ((t: string, ok: () => void) => void) | null = null;
export function ask(t: string, ok: () => void) { confirmFn ? confirmFn(t, ok) : ok(); }
export function Confirmer() {
  const [st, set] = useState<{ t: string; ok: () => void } | null>(null);
  useEffect(() => { confirmFn = (t, ok) => set({ t, ok }); return () => { confirmFn = null; }; }, []);
  if (!st) return null;
  return (
    <div className="modal" onClick={() => set(null)}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <b>請確認</b>
        <p style={{ margin: '8px 0 16px', color: 'var(--ink2)' }}>{st.t}</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => set(null)}>取消</button>
          <button className="btn pri" onClick={() => { const f = st.ok; set(null); f(); }}>確定</button>
        </div>
      </div>
    </div>
  );
}
