import { useEffect, useRef, useState } from 'react';
import { checkAI } from './ai';
import { Drawer } from './drawers';
import { advance, END, hm, testMessage, uid } from './engine/engine';
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
  const [busy, setBusy] = useState(false);
  const me = useRef(uid('c'));
  const ticking = useRef(false);
  const lastMsg = useRef<string | null>(null);

  useEffect(() => { store.init(); checkAI().then(setAi); }, []);
  useEffect(() => { try { if (role) localStorage.setItem('sl-role-v2', role); } catch { /* 忽略 */ } }, [role]);
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(null); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, []);

  // 播放：同一個房間只有一台負責讓時間往前（按播放的那台；它離開 5 秒後由別台接手）
  useEffect(() => {
    const h = window.setInterval(() => {
      const x = store.world;
      if (!x || !x.play?.on || ticking.current) return;
      if (x.state.clock >= END) { store.act((y) => { y.play.on = false; }); return; }
      const lead = x.play.by === me.current || Date.now() - (x.play.beat || 0) > 5000;
      if (!lead) return;
      ticking.current = true;
      store.act((y) => {
        if (!y.play?.on) return;
        advance(y, y.play.speed || 1, y.play.auto, y.play.auto);
        y.play.by = me.current; y.play.beat = Date.now();
        if (y.state.clock >= END) y.play.on = false;
      }).finally(() => { ticking.current = false; });
    }, 1000);
    return () => window.clearInterval(h);
  }, []);

  // 新的客戶訊息進來時提醒
  useEffect(() => {
    const m = w?.inbox?.[0];
    if (!m) return;
    if (lastMsg.current && m.id !== lastMsg.current && m.status === 'new') toast(`新訊息：${m.from}（${m.ch}）→ 業務待處理`);
    lastMsg.current = m.id;
  }, [w?.inbox?.[0]?.id]);

  async function ff(m: number | 'end' | 'next') {
    if (!w || busy) return;
    if (w.state.clock >= END) { toast('已到 20:00 收工'); return; }
    setBusy(true);
    let n = 0;
    await store.act((x) => { n = advance(x, m, x.play.auto, x.play.auto); });
    setBusy(false);
    if (!store.world?.play?.on) toast(`${hm(store.world?.state.clock)}・新增 ${n} 筆紀錄`);
  }
  function togglePlay() {
    if (!w) return;
    if (w.state.clock >= END) { toast('已到 20:00 收工，按「重設」重新開始'); return; }
    store.act((x) => { x.play.on = !x.play.on; x.play.by = me.current; x.play.beat = Date.now(); });
  }
  function share() { const u = store.shareUrl(); navigator.clipboard?.writeText(u).then(() => toast('已複製連結，其他人開啟就看到同一份資料'), () => toast(u)); }

  if (!w) return <div style={{ padding: 40, color: 'var(--ink3)' }}>載入中…</div>;
  return (
    <>
      <div className="top">
        <div className="hb">
          <div className="brand"><i />昇嶺排程中樞</div>
          {(role === '業務' || role === '全部') && <button className="btn sm pri" onClick={() => setDrawer('intake')}>＋ 新增變更單</button>}
          <div className="spacer" />
          <div className="status">
            <span title={store.mode === 'remote' ? '同一個連結的人看到同一份資料' : '資料只在這個瀏覽器'}><i className="dot" style={{ background: store.mode === 'remote' ? 'var(--ok)' : 'var(--ink3)' }} />{store.mode === 'remote' ? '共用' : '本機'}</span>
            <span title={ai ? '智能體使用 ' + ai : '沒有 AI 金鑰，智能體用規則'}><i className="dot" style={{ background: ai ? 'var(--ok)' : 'var(--ink3)' }} />{ai ? 'AI' : '規則'}</span>
            {store.error && <span style={{ color: 'var(--bad)' }}>{store.error}</span>}
            <span className="room">{store.room}<button className="btn sm ghost" onClick={share}>分享</button></span>
            <button className="btn sm ghost" onClick={() => ask('回到 14:20，清除這個房間的變更單和紀錄？', async () => { await store.reset(); toast('已重設'); })}>重設</button>
          </div>
        </div>
        <RoleBar role={role} setRole={setRole}>
          <div className="demo" title="示範用：讓工廠時間自己往前，或一次跳到下一個事件">
            示範時間 <span className="clock num">{hm(w.state.clock)}</span>
            <button className={'btn sm play' + (w.play.on ? ' on' : '')} onClick={togglePlay}>{w.play.on ? '⏸ 暫停' : '▶ 播放'}</button>
            <div className="seg" title="播放速度：每秒走幾分鐘">
              {[1, 3, 10].map((v) => <button key={v} className={w.play.speed === v ? 'on' : ''} onClick={() => store.act((x) => { x.play.speed = v; })}>{v}×</button>)}
            </div>
            <div className="seg">
              <button disabled={busy || w.play.on} onClick={() => ff('next')} title="跳到下一個有事情發生的時間">⏭ 下一事件</button>
              <button disabled={busy || w.play.on} onClick={() => ff(10)}>+10 分</button>
            </div>
            <button className="btn sm" onClick={() => store.act((x) => testMessage(x)).then(() => toast('已丟進一則測試訂單訊息'))} title="隨機產生一則客戶追加訊息，業務收件匣會出現">＋ 測試訂單</button>
            <label className="switch" title="沒人按的時候：照燈號自動備料、推料；變更單放超過 30 分沒人處理，系統代業務、生管、課長按（示範用）"><input type="checkbox" checked={w.play.auto} onChange={(e) => { const v = e.target.checked; store.act((x) => { x.play.auto = v; }); }} />自動</label>
          </div>
        </RoleBar>
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
