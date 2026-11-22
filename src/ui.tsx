import { useEffect, useState, type ReactNode } from 'react';
import { hm, LANE_NAME, project } from './engine/engine';
import type { Kit, Line, Order, World } from './engine/types';

export function Cust({ c }: { c?: string | null }) {
  return <span className={'cust c-' + (c || '')}>{c || '?'}</span>;
}

export const custCol = (c?: string) => (c === '甲' ? 'var(--jia)' : c === '乙' ? 'var(--yi)' : c === '丙' ? 'var(--bing)' : 'var(--ink3)');
export const custBg = (c?: string) => (c === '甲' ? 'var(--jia-bg)' : c === '乙' ? 'var(--yi-bg)' : c === '丙' ? 'var(--bing-bg)' : '#f1f1ee');

const ST: Record<string, [string, string]> = {
  draft: ['', '退回'], submitted: ['warn', '待確認'], approval: ['warn', '待核准'], planned: ['line', '已排程'],
  queued: ['', '排隊中'], running: ['line', '生產中'], paused: ['warn', '暫停'], done: ['ok', '完成'], decided: ['ok', '已決定'],
};
export function StatusPill({ o }: { o: Order }) {
  const x = ST[o.status] || ['', o.status];
  return <span className={'pill ' + x[0]}>{x[1]}</span>;
}

const KS: Record<string, [string, string]> = {
  todo: ['', '未備'], picking: ['warn', '備料中'], ready: ['line', '待運'], fetching: ['line', '運送中'], atline: ['g', '已到線邊'], newpart: ['bad', '等新料'],
};
export function KitPill({ k }: { k?: Kit }) {
  const x = KS[k?.status || ''] || ['', '—'];
  return <span className={'pill ' + x[0]}>{x[1]}</span>;
}

export function ModePill({ L }: { L: Line }) {
  if (L.mode === 'run') return <span className="pill line">生產中</span>;
  if (L.mode === 'co') return <span className="pill">換線 {L.coLeft} 分</span>;
  if (L.mode === 'wait') return <span className="pill bad">等料</span>;
  return <span className="pill">空著</span>;
}

export function LampPill({ L }: { L: Line }) {
  if (L.mode === 'wait') return <span className="pill bad">等料</span>;
  if (L.lampB) return <span className="pill b">藍燈</span>;
  if (L.lampY) return <span className="pill y">黃燈</span>;
  return null;
}

export function Card({ title, sub, children, style }: { title?: ReactNode; sub?: ReactNode; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="card" style={style}>
      {title && <h2>{title}{sub && <span className="sub">{sub}</span>}</h2>}
      {children}
    </div>
  );
}

export function Head({ title, desc }: { title: string; desc: string }) {
  return <div className="head"><h1>{title}</h1><p>{desc}</p></div>;
}

export function Gantt({ w }: { w: World }) {
  const S = w.state, O = w.orders;
  const P = project(S, O);
  const t0 = Math.max(720, S.clock - 120), t1 = 1260;
  const X = (m: number) => Math.max(0, Math.min(100, ((m - t0) / (t1 - t0)) * 100));
  const ticks: number[] = [];
  for (let m = Math.ceil(t0 / 60) * 60; m <= t1; m += 60) ticks.push(m);
  return (
    <div className="gantt">
      <div className="axis"><div /><div>{ticks.map((m) => <span key={m} style={{ left: X(m) + '%' }}>{hm(m)}</span>)}</div></div>
      {P.map((items, i) => (
        <div className="lane" key={i}>
          <div className="nm">{i + 1} 線<small>{LANE_NAME[i]}</small></div>
          <div className="track">
            {Object.values(O).filter((o) => o.line === i && o.status === 'done' && (o.doneAt || 0) > t0).map((o) => {
              const s = Math.max(t0, o.startAt || t0);
              return <div key={'p' + o.id} className="bar past" style={{ left: X(s) + '%', width: Math.max(0.5, X(o.doneAt!) - X(s)) + '%' }}>{o.id}</div>;
            })}
            {items.map((x, k) => {
              const o = O[x.id];
              if (!o) return null;
              const nw = o.type !== 'base' || !!o.split;
              const s = (x.coEnd || x.start) + (x.wait || 0);
              return (
                <span key={k}>
                  {x.coEnd != null && <div className="bar co" style={{ left: X(x.start) + '%', width: Math.max(0.5, X(x.coEnd) - X(x.start)) + '%' }}>換線</div>}
                  <div className={'bar' + (nw ? ' new' : '')} title={`${o.id} ${hm(s)}–${hm(x.end)}`}
                    style={{ left: X(s) + '%', width: Math.max(0.5, X(x.end) - X(s)) + '%', background: custBg(o.cust), borderLeftColor: custCol(o.cust) }}>
                    {o.id} · {hm(x.end)}
                  </div>
                </span>
              );
            })}
            <div className="now" style={{ left: X(S.clock) + '%' }} />
          </div>
        </div>
      ))}
      <div className="legend">
        <span><i style={{ background: 'var(--jia)' }} />甲</span>
        <span><i style={{ background: 'var(--yi)' }} />乙</span>
        <span><i style={{ background: 'var(--bing)' }} />丙</span>
        <span><i style={{ background: '#e6e6e1' }} />換線</span>
        <span><i style={{ border: '1.5px dashed var(--ink)' }} />新插入或拆批</span>
        <span><i style={{ background: 'var(--bad)', width: 3 }} />現在</span>
      </div>
    </div>
  );
}

/* 小型提示與確認框 */
let toastFn: ((s: string) => void) | null = null;
export function toast(s: string) { toastFn?.(s); }
export function Toaster() {
  const [msg, setMsg] = useState('');
  useEffect(() => { toastFn = (s) => { setMsg(s); window.setTimeout(() => setMsg((m) => (m === s ? '' : m)), 2200); }; return () => { toastFn = null; }; }, []);
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
