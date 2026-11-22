import { useEffect, useState } from 'react';
import { checkAI } from './ai';
import { advance, alerts, END, hm } from './engine/engine';
import type { World } from './engine/types';
import { store, useWorld } from './store';
import { ask, Confirmer, toast, Toaster } from './ui';
import Board from './views/Board';
import Chief from './views/Chief';
import Dashboard from './views/Dashboard';
import Planner from './views/Planner';
import Sales from './views/Sales';
import Warehouse from './views/Warehouse';

type RoleKey = 'sales' | 'plan' | 'wh' | 'board' | 'chief' | 'dash';
const FLOW: { k: RoleKey; n: string }[] = [
  { k: 'sales', n: '業務' }, { k: 'plan', n: '生管' }, { k: 'wh', n: '倉庫' }, { k: 'board', n: '產線' },
];
const OTHER: { k: RoleKey; n: string }[] = [{ k: 'chief', n: '課長' }, { k: 'dash', n: '儀表板' }];
const ALL = [...FLOW, ...OTHER].map((x) => x.k);

function counts(w: World): Partial<Record<RoleKey, number>> {
  const os = Object.values(w.orders);
  return {
    sales: os.filter((o) => o.status === 'planned' && o.type !== 'base' && !o.replied).length,
    plan: os.filter((o) => o.status === 'submitted').length,
    wh: w.state.lines.filter((L) => { const nx = L.queue[0] ? w.orders[L.queue[0]] : null; return L.mode === 'wait' || (L.lampY && nx && nx.kit.status === 'todo'); }).length,
    chief: os.filter((o) => o.status === 'approval').length,
    dash: alerts(w).filter((a) => a.lv === 'bad').length,
  };
}

function guide(w: World): { i: number; title: string; desc: string; role: RoleKey } {
  const os = Object.values(w.orders).filter((o) => o.type !== 'base');
  if (!os.length) return { i: 1, title: '業務：貼一則客戶訊息', desc: '點「甲・電話追加」→「AI 整理」→ 補上交期（例如 20:00）→「送出給生管」。', role: 'sales' };
  if (os.some((o) => o.status === 'submitted')) return { i: 2, title: '生管：試算並派發', desc: '點待確認的單 →「試算」→ 比較方案 →「確認派發」。', role: 'plan' };
  if (os.some((o) => o.status === 'approval')) return { i: 3, title: '課長：核准破例', desc: '這個方案會打斷別的單，要課長按「核准」。', role: 'chief' };
  if (os.some((o) => o.status === 'planned' && !o.replied && o.reply)) return { i: 3, title: '業務：回覆客戶', desc: '回覆內容依試算結果產生。按「複製」，再按「標記已回覆」。', role: 'sales' };
  if (os.some((o) => o.status !== 'done' && o.status !== 'decided') && w.state.clock < END) return { i: 4, title: '讓時間往前走', desc: '按上方「+30 分」，到「倉庫」和「產線」看黃燈、藍燈、綠牌。', role: 'board' };
  return { i: 5, title: '儀表板：看紀錄和指標', desc: '每個動作都有紀錄。可再試「乙・正式追加」或「丙・換零件」，或到課長頁錄日報。', role: 'dash' };
}

export default function App() {
  const w = useWorld();
  const [role, setRole] = useState<RoleKey>(() => (ALL.includes(location.hash.slice(1) as RoleKey) ? (location.hash.slice(1) as RoleKey) : 'sales'));
  const [auto, setAuto] = useState(true);
  const [ai, setAi] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gmin, setGmin] = useState(false);

  useEffect(() => { store.init(); checkAI().then(setAi); }, []);
  useEffect(() => { const f = () => { const h = location.hash.slice(1) as RoleKey; if (ALL.includes(h)) setRole(h); }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const go = (k: RoleKey) => { setRole(k); history.replaceState(null, '', location.pathname + location.search + '#' + k); window.scrollTo(0, 0); };

  async function ff(m: number | 'end') {
    if (!w) return;
    if (w.state.clock >= END) { toast('已到 20:00 收工'); return; }
    setBusy(true);
    let n = 0;
    await store.act((x) => { n = advance(x, m, auto); });
    setBusy(false);
    toast(`${hm(store.world?.state.clock)}，新增 ${n} 筆紀錄`);
  }

  function share() {
    const u = store.shareUrl();
    navigator.clipboard?.writeText(u).then(() => toast('已複製房間連結，另一台裝置開啟即可同步'), () => toast(u));
  }

  if (!w) return <div style={{ padding: 40, color: 'var(--ink3)' }}>載入中…</div>;
  const c = counts(w);
  const g = guide(w);
  const tab = (x: { k: RoleKey; n: string }, i?: number) => (
    <button key={x.k} className={'tab' + (role === x.k ? ' on' : '')} onClick={() => go(x.k)}>
      {i != null && <span className="step">{i + 1}</span>}{x.n}{c[x.k] ? <span className="cnt">{c[x.k]}</span> : null}
    </button>
  );

  return (
    <>
      <div className="top">
        <div className="hb" style={{ borderBottom: '1px solid var(--line)' }}>
          <div className="brand"><i />昇嶺排程中樞</div>
          <span className="muted">先算再答應，料比線先到</span>
          <div className="spacer" />
          <div className="status">
            <span><i className="dot" style={{ background: store.mode === 'remote' ? 'var(--ok)' : 'var(--ink3)' }} />{store.mode === 'remote' ? '共用資料' : '本機資料'}</span>
            <span title={ai ? '智能體使用 ' + ai : '未設定 AI 金鑰，智能體改用規則'}><i className="dot" style={{ background: ai ? 'var(--ok)' : 'var(--ink3)' }} />{ai ? 'AI 已連線' : 'AI 未設定・用規則'}</span>
            {store.error && <span style={{ color: 'var(--bad)' }}>{store.error}</span>}
            <span className="room">房間 <b>{store.room}</b><button className="btn sm ghost" onClick={share}>分享</button></span>
            {gmin && <button className="btn sm ghost" onClick={() => setGmin(false)}>導覽</button>}
            <button className="btn sm" onClick={() => ask('回到 14:20，清除這個房間的所有變更單、紀錄和日報？', async () => { await store.reset(); toast('已重設'); })}>重設</button>
          </div>
        </div>
        <div className="hb" style={{ height: 48 }}>
          <nav className="nav">
            {FLOW.map((x, i) => <span key={x.k} style={{ display: 'flex' }}>{tab(x, i)}{i < FLOW.length - 1 && <span className="arrow">›</span>}</span>)}
            <span className="sep" />
            {OTHER.map((x) => tab(x))}
          </nav>
          <div className="spacer" />
          <div className="clockbar">
            <span className="clock num"><small>工廠時間</small>{hm(w.state.clock)}</span>
            <div className="seg">
              {([10, 30, 60] as const).map((m) => <button key={m} disabled={busy} onClick={() => ff(m)}>+{m === 60 ? '1 小時' : m + ' 分'}</button>)}
              <button disabled={busy} onClick={() => ff('end')}>到收工</button>
            </div>
            <label className="switch" title="沒人按的時候，照規則自動備料、推料"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />自動</label>
          </div>
        </div>
        {!gmin && (
          <div className="guidebar"><div className="in">
            <span className="tag">Demo 導覽</span>
            <span className="dots">{[1, 2, 3, 4, 5].map((k) => <i key={k} className={k <= g.i ? 'on' : ''} />)}</span>
            <b>{g.i}. {g.title}</b>
            <span className="gd">{g.desc}</span>
            <span className="spacer" />
            {role !== g.role && <button className="btn sm pri" onClick={() => go(g.role)}>前往{[...FLOW, ...OTHER].find((x) => x.k === g.role)?.n}</button>}
            <button className="btn sm ghost" onClick={() => setGmin(true)}>隱藏</button>
          </div></div>
        )}
      </div>
      <main>
        {role === 'sales' && <Sales w={w} />}
        {role === 'plan' && <Planner w={w} />}
        {role === 'wh' && <Warehouse w={w} />}
        {role === 'board' && <Board w={w} />}
        {role === 'chief' && <Chief w={w} />}
        {role === 'dash' && <Dashboard w={w} />}
      </main>
      <Toaster />
      <Confirmer />
    </>
  );
}


