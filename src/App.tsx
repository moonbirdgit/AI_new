import { useEffect, useState } from 'react';
import { checkAI } from './ai';
import { Drawer } from './drawers';
import { advance, END, hm, START } from './engine/engine';
import { Lines, Orders, Side, Stages, Todo } from './panels';
import { BossView, ChiefView, LineDesk, PlannerView, RoleBar, RolePicker, SalesView, WarehouseView, type RoleSel } from './roles';
import { store, useWorld } from './store';
import { ask, Confirmer, toast, Toaster } from './ui';

const ROLES: RoleSel[] = ['業務', '生管', '倉庫', '產線', '課長', '老闆', '全部'];

function loadRole(): RoleSel | null {
  try { const r = localStorage.getItem('sl-role-v2'); if (r && (ROLES as string[]).includes(r)) return r as RoleSel; } catch { /* 無法讀取 */ }
  return null;
}

export default function App() {
  const w = useWorld();
  const [role, setRole] = useState<RoleSel | null>(loadRole);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [ai, setAi] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => { store.init(); checkAI().then(setAi); }, []);
  useEffect(() => { try { if (role) localStorage.setItem('sl-role-v2', role); } catch { /* 忽略 */ } }, [role]);
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(null); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, []);

  async function ff(m: number | 'end' | 'next') {
    if (!w || busy) return;
    if (w.state.clock >= END) { toast('已到 20:00 收工'); return; }
    setBusy(true);
    let n = 0;
    await store.act((x) => { n = advance(x, m, auto); });
    setBusy(false);
    toast(`${hm(store.world?.state.clock)}・新增 ${n} 筆紀錄`);
  }
  function scrub(v: number) { if (w && v > w.state.clock) ff(v - w.state.clock); }
  function share() { const u = store.shareUrl(); navigator.clipboard?.writeText(u).then(() => toast('已複製連結，其他人開啟就看到同一份資料'), () => toast(u)); }

  if (!w) return <div style={{ padding: 40, color: 'var(--ink3)' }}>載入中…</div>;
  return (
    <>
      <div className="top">
        <div className="hb">
          <div className="brand"><i />昇嶺排程中樞</div>
          {(role === '業務' || role === '全部') && <button className="btn sm pri" onClick={() => setDrawer('intake')}>＋ 新增變更單</button>}
          <div className="spacer" />
          <div className="demo" title="示範用：讓工廠時間往前，觀察燈號、備料、出貨怎麼變">
            示範時間 <span className="clock num">{hm(w.state.clock)}</span>
            <input type="range" min={START} max={END} value={w.state.clock} onChange={(e) => scrub(+e.target.value)} disabled={busy} style={{ width: 110, accentColor: 'var(--accent)' }} />
            <div className="seg">
              <button disabled={busy} onClick={() => ff('next')} title="跳到下一個有事情發生的時間">⏭ 下一事件</button>
              <button disabled={busy} onClick={() => ff(10)}>+10 分</button>
              <button disabled={busy} onClick={() => ff(60)}>+1 小時</button>
            </div>
            <label className="switch" title="沒人按的時候照規則自動備料、推料"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />自動</label>
          </div>
          <div className="status">
            <span title={store.mode === 'remote' ? '同一個連結的人看到同一份資料' : '資料只在這個瀏覽器'}><i className="dot" style={{ background: store.mode === 'remote' ? 'var(--ok)' : 'var(--ink3)' }} />{store.mode === 'remote' ? '共用' : '本機'}</span>
            <span title={ai ? '智能體使用 ' + ai : '沒有 AI 金鑰，智能體用規則'}><i className="dot" style={{ background: ai ? 'var(--ok)' : 'var(--ink3)' }} />{ai ? 'AI' : '規則'}</span>
            {store.error && <span style={{ color: 'var(--bad)' }}>{store.error}</span>}
            <span className="room">{store.room}<button className="btn sm ghost" onClick={share}>分享</button></span>
            <button className="btn sm ghost" onClick={() => ask('回到 14:20，清除這個房間的變更單和紀錄？', async () => { await store.reset(); toast('已重設'); })}>重設</button>
          </div>
        </div>
        <RoleBar role={role} setRole={setRole} />
      </div>
      <main>
        {!role && <RolePicker setRole={setRole} />}
        <Stages w={w} open={setDrawer} />
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.75fr) minmax(0, 1fr)' }}>
          <div className="col">
            {role === '生管' && <PlannerView w={w} open={setDrawer} />}
            {role === '倉庫' && <WarehouseView w={w} />}
            {role === '業務' && <SalesView w={w} open={setDrawer} />}
            {role === '產線' && <LineDesk w={w} />}
            {role === '課長' && <ChiefView w={w} open={setDrawer} />}
            {role === '老闆' && <BossView w={w} open={setDrawer} />}
            {role !== '產線' && <Lines w={w} open={setDrawer} />}
          </div>
          <Todo w={w} role={role || '全部'} open={setDrawer} />
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.75fr) minmax(0, 1fr)' }}>
          <Orders w={w} open={setDrawer} />
          <Side w={w} open={setDrawer} />
        </div>
      </main>
      {drawer && <Drawer w={w} d={drawer} open={setDrawer} close={() => setDrawer(null)} role={role} />}
      <Toaster />
      <Confirmer />
    </>
  );
}
