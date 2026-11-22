import { useState } from 'react';
import { alerts, hm, metrics } from '../engine/engine';
import type { World } from '../engine/types';
import { Card, Cust, Head, KitPill, ModePill } from '../ui';

const ROLES = ['全部', '業務', '生管', '倉庫', '產線', '課長', '品保', '智能體', '系統'];
const STEPS = ['送出', '確認', '派發', '備料', '生產', '完成'];

export default function Dashboard({ w }: { w: World }) {
  const [f, setF] = useState('全部');
  const S = w.state, O = w.orders;
  const al = alerts(w);
  const evs = w.events.filter((e) => f === '全部' || e.role === f).sort((a, b) => b.t - a.t || b.real - a.real);
  const ch = Object.values(O).filter((o) => o.type !== 'base').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);
  return (
    <>
      <Head title="儀表板" desc="即時狀態、異常、指標、每個動作的紀錄。數字都由系統自動算。" />
      {al.length > 0 && (
        <Card title="異常" sub={`${al.length} 件`} style={{ marginBottom: 14 }}>
          {al.map((a, k) => <div key={k} className={'alert ' + a.lv}><span className="who">{a.role}</span>{a.text}</div>)}
        </Card>
      )}
      <div className="kpis" style={{ marginBottom: 14 }}>
        {metrics(w).map((m) => (
          <div key={m.label} className={'kpi ' + m.st}>
            <div className="l">{m.label}</div>
            <div className="v num">{m.value}</div>
            <div className="t">{m.st === 'ok' ? '✓ ' : m.st === 'bad' ? '✗ ' : ''}目標 {m.target}</div>
          </div>
        ))}
      </div>
      <div className="grid g4" style={{ marginBottom: 14 }}>
        {S.lines.map((L, i) => { const c = L.cur ? O[L.cur] : null; const nx = L.queue[0] ? O[L.queue[0]] : null; return (
          <div key={i} className={'linecard' + (L.mode === 'wait' ? ' wait' : '')}>
            <div className="row"><b>{i + 1} 線</b><ModePill L={L} />
              <span className="row" style={{ marginLeft: 'auto', gap: 4 }}>
                <i className="dot" title="黃燈" style={{ background: L.lampY ? 'var(--lampY)' : 'var(--line)' }} />
                <i className="dot" title="藍燈" style={{ background: L.lampB ? 'var(--lampB)' : 'var(--line)' }} />
              </span></div>
            <div className="row" style={{ marginTop: 6 }}>{c ? <><Cust c={c.cust} /><b>{c.id}</b><span className="muted">剩 {Math.ceil((c.qty || 0) - c.done)} 片</span></> : <span className="muted">空著</span>}</div>
            <div className="row muted" style={{ marginTop: 4 }}>下一張 {nx ? <>{nx.id} <KitPill k={nx.kit} /></> : '—'}</div>
          </div>); })}
      </div>
      <div className="grid" style={{ gridTemplateColumns: '1.3fr 1fr', alignItems: 'start' }}>
        <Card title="動作紀錄" sub={`${evs.length} 筆`}>
          <div className="chips" style={{ marginBottom: 6 }}>{ROLES.map((r) => <button key={r} className={'chip' + (f === r ? ' on' : '')} onClick={() => setF(r)}>{r}</button>)}</div>
          <div className="log">
            {!evs.length && <div className="empty">還沒有紀錄。</div>}
            {evs.map((e) => (
              <div key={e.id} className={'ev' + (e.warn ? ' warn' : '')}>
                <time className="num">{hm(e.t)}</time><span className="who">{e.role}</span>
                <div><span className="a">{e.act}</span>　<span className="x">{e.detail}</span></div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="變更單進度">
          {!ch.length && <div className="empty">還沒有變更單。</div>}
          {ch.map((o) => {
            const idx = o.status === 'done' || o.status === 'decided' ? 5 : o.status === 'running' ? 4 : o.status === 'planned' && ['picking', 'ready', 'fetching', 'atline'].includes(o.kit.status) ? 3 : o.status === 'planned' ? 2 : o.status === 'approval' ? 1 : 0;
            return (
              <div key={o.id} style={{ marginBottom: 12 }}>
                <div className="row" style={{ marginBottom: 4 }}><Cust c={o.cust} /><b>{o.id}</b><span className="muted">{o.model}{o.qty ? ` × ${o.qty}` : ''}</span>{o.eta != null && <span className="muted" style={{ marginLeft: 'auto' }}>預計 {hm(o.eta)}</span>}</div>
                <div className="steps">{STEPS.map((s, i) => <div key={s} className={i < idx ? 'done' : i === idx ? 'cur' : ''}>{s}</div>)}</div>
              </div>
            );
          })}
        </Card>
      </div>
    </>
  );
}
