import { useEffect, useRef, useState } from 'react';
import { aiExplain, aiExtract, aiReport, aiWeekly } from './ai';
import {
  approve, BLU, conflicts, CUST_OF, dispatch, hm, kitAction, LANE_NAME, log, makeOptions, markReplied, MODELS, parseDue,
  reschedule, setForecast, submitOrder, uid, weekStats, YEL,
} from './engine/engine';
import type { Cust as CustT, Draft, PlanOption, World } from './engine/types';
import type { Open } from './panels';
import { Gantt, simulate, type RoleSel } from './roles';
import { msgToOrder, project, skipMsg } from './engine/engine';
import { store } from './store';
import { ask, Cust, KIT_TXT, KitPill, lineState, StatusPill, toast } from './ui';

export function Drawer({ w, d, open, close, role }: { w: World; d: string; open: Open; close: () => void; role: RoleSel | null }) {
  const [kind, arg] = d.split(':');
  const titles: Record<string, string> = {
    intake: '新增變更單', plan: '試算與決定', approve: '課長核准', order: '訂單', stage: '環節', line: '產線', forecast: '甲的週預估', weekly: '週檢討', report: '日報',
  };
  return (
    <>
      <div className="scrim" onClick={close} />
      <aside className="drawer">
        <div className="dh2"><h3>{kind === 'stage' ? ({ intake: '接單', plan: '試算決策', kit: '備料', smt: 'SMT', asm: '人工站', qa: '品保', ship: '出貨' } as Record<string, string>)[arg] + ' 環節' : kind === 'line' ? `${+arg + 1} 線` : (titles[kind] || '') + (kind === 'intake' ? (arg ? `：${w.inbox.find((m) => m.id === arg)?.from || ''} 的訊息` : '') : arg ? `：${arg}` : '')}</h3><button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={close}>關閉 ✕</button></div>
        <div className="dbody">
          {kind === 'intake' && (role === '業務' || role === '全部' ? <Intake w={w} close={close} open={open} msgId={arg} /> : <div className="empty">變更單由業務新增。請在上方「我是」切換成業務。</div>)}
          {kind === 'plan' && <Plan w={w} id={arg} close={close} />}
          {kind === 'approve' && <Approve w={w} id={arg} close={close} />}
          {kind === 'order' && <OrderView w={w} id={arg} />}
          {kind === 'stage' && <StageView w={w} k={arg} open={open} role={role} />}
          {kind === 'line' && <LineView w={w} i={+arg} open={open} />}
          {kind === 'forecast' && <Forecast w={w} close={close} />}
          {kind === 'weekly' && <WeeklyView w={w} />}
          {kind === 'report' && <ReportView w={w} />}
        </div>
      </aside>
    </>
  );
}

/* ---------- 業務：新增變更單 ---------- */
const EX: [string, string][] = [
  ['甲・電話追加', '甲王經理來電：A1 再加 400，今天要'],
  ['乙・正式追加', '乙 正式追加單：B2 300 片，交期今天 19:00'],
  ['丙・換零件', '丙：C2 的電容 C14 改新料號，現在這批就要換'],
  ['老闆交代', '老闆說甲的 A2 先做 200 片，明天早上 10 點要'],
];
function Intake({ w, close, open, msgId }: { w: World; close: () => void; open: Open; msgId?: string }) {
  const src = msgId ? w.inbox.find((m) => m.id === msgId) : undefined;
  const [msg, setMsg] = useState(src?.text || '');
  const [busy, setBusy] = useState(false);
  const [d, setD] = useState<(Draft & { ai: boolean; raw: string; dueText: string }) | null>(null);
  async function run() {
    if (!msg.trim()) { toast('先貼上一則訊息'); return; }
    setBusy(true);
    const r = await aiExtract(msg.trim(), w.state.clock);
    setBusy(false);
    setD({ ...r.d, ai: r.ai, raw: msg.trim(), dueText: r.d.due != null ? hm(r.d.due) : '' });
    store.act((x) => log(x, '智能體', '接單', r.ai ? '整理變更單（AI）' : '整理變更單（規則）', `${[r.d.cust, r.d.model, r.d.qty && r.d.qty + ' 片'].filter(Boolean).join('、')}${r.d.missing.length ? '；缺 ' + r.d.missing.join('、') : ''}`));
  }
  async function submit() {
    if (!d) return;
    const due = parseDue(d.dueText);
    const miss: string[] = [];
    if (!d.cust) miss.push('客戶');
    if (!d.model) miss.push('機種');
    if (d.type === 'rush') { if (!d.qty) miss.push('數量'); if (due == null) miss.push('交期'); }
    if (miss.length) { toast('還缺：' + miss.join('、')); return; }
    if (CUST_OF[d.model![0]] !== d.cust) { toast(`${d.model} 是${CUST_OF[d.model![0]]}的機種`); return; }
    const id = await store.act((x) => { const nid = submitOrder(x, { cust: d.cust as CustT, model: d.model!, qty: d.qty, due, type: d.type }, d.raw, d.ai); if (msgId) msgToOrder(x, msgId, nid); return nid; });
    if (id) { toast(`${id} 已送給生管`); close(); open('order:' + id); }
  }
  const miss = (k: string) => (d && d.missing.includes(k) ? 'miss' : '');
  return (
    <>
      {src && src.status !== 'new' && <div className="note">這則訊息已處理{src.orderId ? `，變更單是 ${src.orderId}` : '（標成不用處理）'}。</div>}
      <div className="sec"><h4>1　{src ? `${src.from}（${src.ch}）${hm(src.t)} 傳來的訊息` : '貼上客戶訊息（LINE、電話、老闆交代都貼這裡）'}</h4>
        {!src && <div className="chips" style={{ marginBottom: 8 }}>{EX.map(([k, v]) => <button key={k} className="chip" onClick={() => { setMsg(v); setD(null); }}>{k}</button>)}</div>}
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="例：甲王經理來電：A1 再加 400，今天要" />
        <div className="row" style={{ marginTop: 8 }}><button className="btn pri" onClick={run} disabled={busy}>{busy ? '整理中…' : 'AI 整理成變更單'}</button>{src && src.status === 'new' && <button className="btn" onClick={() => store.act((x) => skipMsg(x, src.id)).then(close)}>不用處理</button>}<span className="hint">AI 失敗時改用規則整理</span></div>
      </div>
      {d && <div className="sec"><h4>2　確認欄位 <span className={'pill ' + (d.ai ? 'ai' : '')}>{d.ai ? 'AI 整理' : '規則整理'}</span></h4>
        <div className="fields">
          <div className={miss('cust')}><label>客戶</label><select className="f" value={d.cust || ''} onChange={(e) => setD({ ...d, cust: (e.target.value || null) as CustT | null })}><option value="">—</option>{['甲', '乙', '丙'].map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className={miss('model')}><label>機種</label><select className="f" value={d.model || ''} onChange={(e) => setD({ ...d, model: e.target.value || null })}><option value="">—</option>{MODELS.map((m) => <option key={m}>{m}</option>)}</select></div>
          <div className={miss('qty')}><label>數量</label><input type="number" value={d.qty ?? ''} onChange={(e) => setD({ ...d, qty: e.target.value ? +e.target.value : null })} /></div>
          <div className={miss('due')}><label>交期</label><input type="text" value={d.dueText} placeholder="20:00" onChange={(e) => setD({ ...d, dueText: e.target.value })} /></div>
          <div><label>類型</label><select className="f" value={d.type} onChange={(e) => setD({ ...d, type: e.target.value as Draft['type'] })}><option value="rush">追加</option><option value="ecn">換零件</option><option value="other">其他</option></select></div>
        </div>
        {d.ask && <div className="note" style={{ marginTop: 8, borderColor: '#5a4a1d', background: '#211b0c' }}><div className="lab" style={{ color: 'var(--warn)' }}>AI 追問</div>{d.ask}</div>}
        <div className="row" style={{ marginTop: 10 }}><button className="btn pri" onClick={submit}>3　送出給生管</button><span className="hint">業務按了才算成單</span></div>
      </div>}
    </>
  );
}

/* ---------- 生管：試算與決定 ---------- */
function Plan({ w, id, close }: { w: World; id: string; close: () => void }) {
  const o = w.orders[id];
  const [opts, setOpts] = useState<PlanOption[] | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [exp, setExp] = useState<{ text: string; reply: string; ai: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!o) return <div className="empty">找不到這張單。</div>;
  if (o.status !== 'submitted') return <OrderView w={w} id={id} />;
  async function calc() {
    const os = makeOptions(w, id);
    setOpts(os); setPick(os[0].id); setBusy(true);
    const e = await aiExplain(o, os, os[0], w.state.clock);
    setExp(e); setBusy(false);
    store.act((x) => log(x, '智能體', '試算', e.ai ? '方案說明（AI）' : '方案說明（規則）', `${id}：${os.length} 個方案，建議 ${os[0].id}`, { order: id }));
  }
  function go() {
    const p = opts!.find((x) => x.id === pick)!;
    const run = async () => { await store.act((x) => dispatch(x, id, p, exp)); toast(p.approval ? '已送課長核准' : '已派發：業務、倉庫、課長、產線都收到了'); close(); };
    if (p.ev.vio.length) ask(`方案 ${p.id} 違反規則：${p.ev.vio[0]}。仍要選？`, run);
    else if (p.ev.newLate.length) ask(`方案 ${p.id} 會讓 ${p.ev.newLate.join('、')} 延誤。確定？`, run);
    else run();
  }
  return (
    <>
      <div className="sec"><h4>變更單</h4>
        <div className="row"><Cust c={o.cust} /><b>{o.id}</b><span>{o.model}{o.qty ? ` × ${o.qty} 片` : ''}</span><span className="mut">交期 {hm(o.due)}</span>{(w.state.forecast[o.model] || 0) > 0 && <span className="pill ok">有週預估・料已備</span>}</div>
        {o.raw && <div className="hint" style={{ marginTop: 4 }}>原文：{o.raw}</div>}
        {!opts && <div className="row" style={{ marginTop: 10 }}><button className="btn pri" onClick={calc}>試算方案</button><button className="btn ghost" onClick={() => store.act((x) => { x.orders[id].status = 'draft'; log(x, '生管', '接單', '退回業務', id, { order: id }); }).then(close)}>退回業務</button></div>}
      </div>
      {opts && <>
        <div className="sec"><h4>方案（數字由排程演算法算）</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {opts.map((p) => { const e = p.ev; return (
              <button key={p.id} className={'opt' + (pick === p.id ? ' sel' : '')} onClick={() => setPick(p.id)}>
                <div className="oh"><b>{p.id}</b>{p.rec && <span className="pill acc">建議</span>}{p.approval && <span className="pill warn">需課長核准</span>}{e.vio.length > 0 && <span className="pill bad">違規</span>}<span style={{ fontSize: 12 }}>{p.label}</span></div>
                {p.note && <div className="hint">{p.note}</div>}
                <div className="ms">
                  <div>完成<b className={e.late ? 'bad' : ''}>{hm(e.end)}</b></div>
                  <div>新增延誤<b className={e.newLate.length ? 'bad' : ''}>{e.newLate.length ? e.newLate.join('、') : '無'}</b></div>
                  <div>增加換線<b>{e.coAdd} 次</b></div>
                  <div>等料<b className={e.wait ? 'bad' : ''}>{e.wait} 分</b></div>
                </div>
              </button>); })}
          </div>
        </div>
        {pick && (() => { const p = opts.find((x) => x.id === pick); return p && p.line != null ? (
          <div className="sec"><h4>模擬排程：選方案 {p.id} 之後（白框是這張單）</h4><Gantt w={w} P={simulate(w, id, p)} hl={id} compact />
            <details style={{ marginTop: 6 }}><summary className="hint" style={{ cursor: 'pointer' }}>對照：現在的排程</summary><Gantt w={w} P={project(w.state, w.orders)} compact /></details></div>) : null; })()}
        <div className="note"><div className="lab">試算說明 {exp && <span className={'pill ' + (exp.ai ? 'ai' : '')}>{exp.ai ? 'AI' : '規則'}</span>}</div>{busy ? '整理中…' : exp?.text}</div>
        <div className="row"><button className="btn pri" disabled={busy || !pick} onClick={go}>確認方案 {pick}，派發</button><span className="hint">派發後：業務拿到回覆草稿、倉庫拿到料單、看板更新</span></div>
      </>}
    </>
  );
}

/* ---------- 課長：核准 ---------- */
function Approve({ w, id, close }: { w: World; id: string; close: () => void }) {
  const o = w.orders[id];
  if (!o || o.status !== 'approval') return <OrderView w={w} id={id} />;
  return (
    <div className="sec"><h4>生管選的方案要打斷鎖住的單</h4>
      <div className="row"><Cust c={o.cust} /><b>{o.id}</b>{o.model} × {o.qty}</div>
      <div style={{ margin: '6px 0' }}>{o.optLabel}</div>
      <div className="note"><div className="lab">理由</div>{o.explain}</div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn pri" onClick={() => store.act((x) => approve(x, id, true)).then(() => { toast('已核准並派發'); close(); })}>核准</button>
        <button className="btn" onClick={() => store.act((x) => approve(x, id, false)).then(close)}>退回生管</button>
      </div>
    </div>
  );
}

/* ---------- 訂單：所有人都看得到的單一畫面 ---------- */
const STEPS = ['接單', '決定', '備料', 'SMT', '人工站', '品保', '出貨'];
export function OrderView({ w, id }: { w: World; id: string }) {
  const o = w.orders[id];
  if (!o) return <div className="empty">找不到這張單。</div>;
  const q = o.qty || 1;
  const idx = o.shipped ? 7 : (o.qa || 0) > 0 ? 5 : (o.asm || 0) > 0 ? 4 : o.done > 0 || o.status === 'running' ? 3 : o.kit.status !== 'todo' && o.status !== 'submitted' ? 2 : ['planned', 'queued', 'approval', 'decided'].includes(o.status) ? 1 : 0;
  const evs = w.events.filter((e) => e.order === id);
  return (
    <>
      <div className="sec">
        <div className="row"><Cust c={o.cust} /><b style={{ fontSize: 15 }}>{o.id}</b><span>{o.model}{o.qty ? ` × ${o.qty}` : ''}</span><StatusPill o={o} /></div>
        <div className="steps" style={{ marginTop: 10 }}>{STEPS.map((s, i) => <div key={s} className={i < idx ? 'done' : i === idx ? 'cur' : ''}>{s}</div>)}</div>
        <div className="kv" style={{ marginTop: 10 }}>
          <span>線</span><span>{o.line != null ? `${o.line + 1} 線` : '—'}</span>
          <span>料</span><span><KitPill k={o.kit} />{o.kit.atlineAt ? ` ${hm(o.kit.atlineAt)} 到線邊` : ''}</span>
          <span>SMT</span><span className="num">{Math.floor(o.done)} / {q} 片</span>
          <span>人工站</span><span className="num">{Math.floor(o.asm || 0)} 片</span>
          <span>品保</span><span className="num">{Math.floor(o.qa || 0)} 片通過・重測 {Math.round(o.retest || 0)} 片</span>
          <span>交期</span><span>{hm(o.due)}</span>
          <span>預計完成</span><span>{o.shipped ? `${hm(o.shipAt)} 已出貨` : hm(o.eta)}</span>
        </div>
      </div>
      {o.optLabel && <div className="note"><div className="lab">生管的決定</div><b>{o.optLabel}</b>{o.explain && <div style={{ marginTop: 4, color: 'var(--ink2)' }}>理由：{o.explain}</div>}</div>}
      {o.reply && <div className="sec"><h4>回覆客戶 {o.replyAi && <span className="pill ai">AI</span>}</h4><div>{o.reply}</div>
        <div className="row" style={{ marginTop: 8 }}><button className="btn sm" onClick={() => navigator.clipboard?.writeText(o.reply || '').then(() => toast('已複製'), () => toast('請手動複製'))}>複製</button>
          {o.replied ? <span className="pill ok">已回覆</span> : <button className="btn sm pri" onClick={() => store.act((x) => markReplied(x, id))}>標記已回覆</button>}</div></div>}
      <div className="sec"><h4>這張單的每一個動作</h4>
        {!evs.length && <div className="empty">還沒有紀錄。</div>}
        {evs.map((e) => <div key={e.id} className="fi"><time className="num">{hm(e.t)}</time><div><span className="pill" style={{ marginRight: 6 }}>{e.role}</span><b>{e.act}</b>　<span className="mut">{e.detail}</span></div></div>)}
      </div>
    </>
  );
}

/* ---------- 環節細節 ---------- */
function StageView({ w, k, open, role }: { w: World; k: string; open: Open; role: RoleSel | null }) {
  const O = Object.values(w.orders);
  const ev = (stage: string[]) => w.events.filter((e) => stage.includes(e.stage)).slice(0, 12);
  const List = ({ list, extra }: { list: typeof O; extra?: (o: (typeof O)[0]) => React.ReactNode }) => (
    <table><tbody>{list.map((o) => <tr key={o.id} className="click" onClick={() => open('order:' + o.id)}><td><span className="row"><Cust c={o.cust} />{o.id}</span></td><td className="mut">{o.model}{o.qty ? ` × ${o.qty}` : ''}</td><td>{extra ? extra(o) : <StatusPill o={o} />}</td></tr>)}</tbody></table>);
  const Feed = ({ stage }: { stage: string[] }) => (<div className="sec"><h4>最近動作</h4>{ev(stage).map((e) => <div key={e.id} className="fi"><time className="num">{hm(e.t)}</time><div><span className="pill" style={{ marginRight: 6 }}>{e.role}</span><b>{e.act}</b>　<span className="mut">{e.detail}</span></div></div>)}</div>);
  if (k === 'intake') return (<><div className="sec"><h4>客戶訊息（還沒處理 {w.inbox.filter((m) => m.status === 'new').length} 則）</h4>{w.inbox.slice(0, 8).map((m) => <div key={m.id} className="row" style={{ padding: '4px 0', borderBottom: '1px solid var(--line)', fontSize: 12 }}><span className="mut num">{hm(m.t)}</span><b>{m.from}</b><span className="mut">{m.ch}</span><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.text}</span>{m.status === 'new' ? <span className="pill warn">待處理</span> : m.orderId ? <span className="pill ok">→ {m.orderId}</span> : <span className="pill">不用處理</span>}</div>)}</div>
    <div className="sec"><h4>今天的變更單（負責：業務）</h4><List list={O.filter((o) => o.type !== 'base')} />{role === '業務' || role === '全部' ? <button className="btn pri" style={{ marginTop: 8 }} onClick={() => open('intake')}>新增變更單</button> : <div className="hint" style={{ marginTop: 6 }}>變更單由業務新增。</div>}</div>
    <div className="sec"><h4>甲的週預估</h4>{Object.keys(w.state.forecast).length ? Object.entries(w.state.forecast).map(([m, q]) => <div key={m}>{m}：{q} 片</div>) : <span className="mut">還沒填</span>}<button className="btn sm" style={{ marginLeft: 8 }} onClick={() => open('forecast')}>編輯</button></div><Feed stage={['接單']} /></>);
  if (k === 'plan') return (<><div className="sec"><h4>等決定（負責：生管、課長）</h4><List list={O.filter((o) => ['submitted', 'approval'].includes(o.status))} extra={(o) => <button className="btn sm pri" onClick={(e) => { e.stopPropagation(); open((o.status === 'approval' ? 'approve:' : 'plan:') + o.id); }}>{o.status === 'approval' ? '核准' : '試算'}</button>} /></div>
    <div className="sec"><h4>一天兩次重排（12:00、17:00 自動）</h4><div className="hint">只動沒鎖住的單，把同機種排在一起。今天已省下換線 {w.state.metrics.coSaved} 次。</div><button className="btn sm" style={{ marginTop: 6 }} onClick={() => store.act((x) => reschedule(x, 'manual'))}>現在重排一次</button></div><Feed stage={['試算']} /></>);
  if (k === 'kit') { const cf = conflicts(w); return (<>
    {cf.length > 0 && <div className="sec" style={{ borderColor: '#6b2b27' }}><h4 style={{ color: 'var(--bad)' }}>共用料不足</h4>{cf.map((c) => <div key={c.part} style={{ marginBottom: 6 }}><b>{c.part}</b>：需要 {c.need.toLocaleString()}、庫存 {c.stock.toLocaleString()}<div className="hint">一起用到的單：{c.orders.join('、')}。建議先保今天要交的單，明天的單先補料。</div></div>)}</div>}
    <div className="sec"><h4>料單（負責：倉庫）</h4><List list={O.filter((o) => o.status !== 'done' && !o.shipped && o.kit.status !== 'atline' && o.kit.status !== 'todo' || (o.kit.status === 'todo' && w.state.lines.some((L) => L.queue[0] === o.id)))} extra={(o) => <KitPill k={o.kit} />} /></div>
    <div className="sec"><h4>共用料庫存</h4><table><tbody>{w.state.parts.map((p) => <tr key={p.name}><td>{p.name}</td><td className="num">{p.stock.toLocaleString()}</td><td className="mut">{Object.keys(p.use).join('、')} 共用</td></tr>)}</tbody></table></div><Feed stage={['備料']} /></>); }
  if (k === 'smt') return (<><div className="sec"><h4>四條線（負責：產線）</h4>{w.state.lines.map((L, i) => { const s = lineState(L); const c = L.cur ? w.orders[L.cur] : null; return <div key={i} className="row" style={{ padding: '5px 0', borderBottom: '1px solid var(--line)', cursor: 'pointer' }} onClick={() => open('line:' + i)}><b style={{ width: 36 }}>{i + 1} 線</b><span style={{ color: s.c }}>{s.t}</span><span className="mut" style={{ marginLeft: 'auto' }}>{c ? `${c.id} ${Math.floor(c.done)}/${c.qty}` : '—'}</span></div>; })}</div>
    <div className="sec"><h4>今天</h4><div className="kv"><span>換線</span><span>{w.state.metrics.co} 次、共 {w.state.metrics.coMin} 分</span><span>等料</span><span>{w.state.metrics.waitMin} 分</span><span>產出</span><span>{Math.round(O.reduce((a, o) => a + o.done, 0)).toLocaleString()} 片</span></div></div><Feed stage={['換線', '生產']} /></>);
  if (k === 'asm' || k === 'qa') return (<div className="sec"><h4>{k === 'asm' ? '人工站在製（插件・測試・組裝・包裝）' : '品保待檢與重測'}</h4><List list={O.filter((o) => !o.shipped && (k === 'asm' ? o.done - (o.asm || 0) > 0.5 : (o.asm || 0) - (o.qa || 0) - (o.retest || 0) > 0.5 || (o.retest || 0) > 0))} extra={(o) => <span className="num">{k === 'asm' ? `${Math.floor(o.done - (o.asm || 0))} 片在製` : `${Math.floor((o.asm || 0) - (o.qa || 0) - (o.retest || 0))} 待檢・重測 ${Math.round(o.retest || 0)}`}</span>} /></div>);
  if (k === 'ship') return (<><div className="sec"><h4>今天已出貨 {w.state.shippedToday.toLocaleString()} 片</h4><List list={O.filter((o) => o.shipped)} extra={(o) => <span className="num">{hm(o.shipAt)}{o.due != null && !o.tmr ? ((o.shipAt || 0) <= o.due ? ' 準時' : ' 晚') : ''}</span>} /></div><Feed stage={['出貨']} /></>);
  return null;
}

/* ---------- 單條線 ---------- */
function LineView({ w, i, open }: { w: World; i: number; open: Open }) {
  const L = w.state.lines[i], O = w.orders;
  const c = L.cur ? O[L.cur] : null, s = lineState(L);
  return (
    <>
      <div className="sec"><h4>{i + 1} 線・{LANE_NAME[i]} 優先</h4>
        <div style={{ color: s.c, fontWeight: 700, fontSize: 15 }}>{s.t}</div>
        {c && <div className="kv" style={{ marginTop: 6 }}><span>正在做</span><span className="row"><Cust c={c.cust} />{c.id} {c.model}</span><span>進度</span><span className="num">{Math.floor(c.done)} / {c.qty} 片（剩 {Math.ceil((c.qty || 0) - c.done)}）</span><span>這張的料</span><span><KitPill k={c.kit} /></span></div>}
        {L.preempt && <div className="note" style={{ marginTop: 8 }}><div className="lab">已排定</div>{hm(L.preempt.at)} 停線，換做 {L.preempt.orderId}</div>}
      </div>
      <div className="sec"><h4>接下來</h4>{L.queue.length ? L.queue.map((id, k) => { const o = O[id]; return <div key={id} className="row click" style={{ padding: '4px 0', cursor: 'pointer' }} onClick={() => open('order:' + id)}><span className="mut" style={{ width: 40 }}>{k === 0 ? '鎖住' : `第 ${k + 1}`}</span><Cust c={o.cust} />{o.id}<span className="mut">{o.model} × {o.qty}</span><span style={{ marginLeft: 'auto' }}><KitPill k={o.kit} /></span></div>; }) : <span className="mut">沒有排單</span>}</div>
      <div className="sec"><h4>燈號規則</h4><div className="hint">剩 {YEL} 片亮黃燈：倉庫開始備料。剩 {BLU} 片亮藍燈：推料人員把料送到線邊。料和換線工具都到線邊後掛上綠牌，產線看到綠牌才拆線換線。</div>
        {L.queue[0] && O[L.queue[0]] && <div className="row" style={{ marginTop: 8 }}>{(['start', 'ready', 'atline'] as const).map((a) => <button key={a} className="btn sm" onClick={() => store.act((x) => kitAction(x, L.queue[0], a))}>{{ start: '開始備料', ready: '備妥', atline: '送達線邊' }[a]}</button>)}<span className="hint">（下一張 {L.queue[0]}：{KIT_TXT[O[L.queue[0]].kit.status]?.[1]}）</span></div>}
      </div>
    </>
  );
}

/* ---------- 甲的週預估 ---------- */
function Forecast({ w, close }: { w: World; close: () => void }) {
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(['A1', 'A2'].map((m) => [m, String(w.state.forecast[m] || '')])));
  return (
    <div className="sec"><h4>甲每週給一次下週追加預估</h4>
      <div className="hint" style={{ marginBottom: 8 }}>有預估的機種，倉庫會先把料備在 1 線旁。甲追加時不用等 90 分鐘備料，15 分鐘內就能上線。</div>
      <div className="fields" style={{ gridTemplateColumns: '1fr 1fr' }}>{['A1', 'A2'].map((m) => <div key={m}><label>{m} 本週預估追加（片）</label><input type="number" value={v[m]} onChange={(e) => setV({ ...v, [m]: e.target.value })} /></div>)}</div>
      <button className="btn pri" style={{ marginTop: 10 }} onClick={() => store.act((x) => { ['A1', 'A2'].forEach((m) => { const q = +(v[m] || 0); if ((x.state.forecast[m] || 0) !== q) setForecast(x, m, q); }); }).then(() => { toast('已更新預估'); close(); })}>儲存</button>
    </div>
  );
}

/* ---------- 週檢討智能體 ---------- */
function WeeklyView({ w }: { w: World }) {
  const [busy, setBusy] = useState(false);
  const st = weekStats(w);
  async function run() {
    setBusy(true);
    const r = await aiWeekly(st.text, st.suggest, w.reports.slice(0, 5).map((x) => x.summary).join('；'));
    setBusy(false);
    await store.act((x) => { x.weekly.unshift({ id: uid('wk'), t: x.state.clock, real: Date.now(), summary: r.summary, findings: r.findings, suggest: r.suggest, ai: r.ai }); log(x, '智能體', '回報', r.ai ? '週報（AI）' : '週報（規則）', r.summary.slice(0, 50)); });
  }
  return (
    <>
      <div className="sec"><h4>系統自動統計</h4><div style={{ fontSize: 12.5 }}>{st.text}</div>
        <div className="note" style={{ marginTop: 8 }}><div className="lab">參數建議（規則）</div>{st.suggest.map((s) => <div key={s}>・{s}</div>)}</div>
        <button className="btn pri" style={{ marginTop: 10 }} disabled={busy} onClick={run}>{busy ? '整理中…' : '請週檢討智能體寫週報'}</button></div>
      {w.weekly.map((r) => (
        <div className="sec" key={r.id}><h4>{hm(r.t)} 週報 <span className={'pill ' + (r.ai ? 'ai' : '')}>{r.ai ? 'AI' : '規則'}</span></h4>
          <div>{r.summary}</div>
          {r.findings.length > 0 && <><div className="hint" style={{ marginTop: 6 }}>發現</div><ul style={{ margin: 0, paddingLeft: 18 }}>{r.findings.map((x, k) => <li key={k}>{x}</li>)}</ul></>}
          {r.suggest.length > 0 && <><div className="hint" style={{ marginTop: 6 }}>建議週會決定</div><ul style={{ margin: 0, paddingLeft: 18 }}>{r.suggest.map((x, k) => <li key={k}>{x}</li>)}</ul></>}
        </div>
      ))}
    </>
  );
}

/* ---------- 日報（語音） ---------- */
type SR = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null };
function ReportView({ w }: { w: World }) {
  const m = w.state.metrics;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState(false);
  const sr = useRef<SR | null>(null);
  useEffect(() => () => { sr.current?.stop(); }, []);
  const stats = `14:20 起產出 ${Math.round(m.out)} 片，換線 ${m.co} 次共 ${m.coMin} 分，等料 ${m.waitMin} 分`;
  function mic() {
    if (rec) { sr.current?.stop(); return; }
    const C = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!C) { toast('這個瀏覽器不支援語音，請用 Chrome 或直接打字'); return; }
    const r: SR = new C(); r.lang = 'zh-TW'; r.continuous = true; r.interimResults = false;
    r.onresult = (e) => { let s = ''; for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) s += e.results[i][0].transcript; if (s) setText((t) => (t ? t + ' ' : '') + s); };
    r.onend = () => setRec(false); r.onerror = () => setRec(false);
    sr.current = r; r.start(); setRec(true);
  }
  async function make() {
    if (!text.trim()) { toast('先講或打幾句'); return; }
    setBusy(true);
    const r = await aiReport(text.trim(), stats);
    setBusy(false);
    await store.act((x) => { x.reports.unshift({ id: uid('r'), t: x.state.clock, real: Date.now(), raw: text.trim(), ...r }); log(x, '課長', '回報', r.ai ? '日報（AI 整理）' : '日報', r.summary); });
    setText('');
  }
  return (
    <>
      <div className="sec"><h4>下班前講兩分鐘，AI 整理成日報</h4><div className="hint" style={{ marginBottom: 6 }}>系統已知：{stats}</div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="例：1 線下午插了甲的追加，換線順利沒等料；4 線換 C2 少一個飛達，晚了 10 分鐘。" />
        <div className="row" style={{ marginTop: 8 }}><button className="btn" onClick={mic}>{rec ? '■ 停止' : '● 錄音'}</button><button className="btn pri" disabled={busy} onClick={make}>{busy ? '整理中…' : 'AI 整理成日報'}</button></div></div>
      {w.reports.slice(0, 5).map((r) => <div className="sec" key={r.id}><h4>{hm(r.t)} 日報 <span className={'pill ' + (r.ai ? 'ai' : '')}>{r.ai ? 'AI' : '原文'}</span></h4><div>{r.summary}</div>{r.issues.length > 0 && <ul style={{ margin: '4px 0', paddingLeft: 18 }}>{r.issues.map((x, k) => <li key={k}>{x}</li>)}</ul>}{r.tomorrow && <div className="hint">明天：{r.tomorrow}</div>}</div>)}
    </>
  );
}
