import { useEffect, useState } from 'react';
import { checkAI } from './ai';
import { Drawer } from './drawers';
import { advance, END, hm, START } from './engine/engine';
import { Lines, Orders, Side, Stages, Todo, type Role } from './panels';
import { store, useWorld } from './store';
import { ask, Confirmer, toast, Toaster } from './ui';

const ROLES: (Role | '全部')[] = ['全部', '業務', '生管', '倉庫', '產線', '課長', '老闆'];

function loadRole(): Role | '全部' {
  try { const r = localStorage.getItem('sl-role'); if (r && (ROLES as string[]).includes(r)) return r as Role; } catch { /* 無法讀取 */ }
  return '全部';
}

export default function App() {
  const w = useWorld();
  const [role, setRole] = useState<Role | '全部'>(loadRole);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [ai, setAi] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => { store.init(); checkAI().then(setAi); }, []);
  useEffect(() => { try { localStorage.setItem('sl-role', role); } catch { /* 忽略 */ } }, [role]);
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
          <label className="me">我是<select value={role} onChange={(e) => setRole(e.target.value as Role)}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></label>
          <button className="btn sm pri" onClick={() => setDrawer('intake')}>＋ 新增變更單</button>
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
      </div>
      <main>
        <Stages w={w} open={setDrawer} />
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.75fr) minmax(0, 1fr)' }}>
          <Lines w={w} open={setDrawer} />
          <Todo w={w} role={role} open={setDrawer} />
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.75fr) minmax(0, 1fr)' }}>
          <Orders w={w} open={setDrawer} />
          <Side w={w} open={setDrawer} />
        </div>
      </main>
      {drawer && <Drawer w={w} d={drawer} open={setDrawer} close={() => setDrawer(null)} />}
      <Toaster />
      <Confirmer />
    </>
  );
}
