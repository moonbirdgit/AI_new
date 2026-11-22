import { useState } from 'react';
import { alerts, BLU, conflicts, hm, LANE_NAME, metrics, YEL } from './engine/engine';
import type { Order, World } from './engine/types';
import { kitAction } from './engine/engine';
import { store } from './store';
import { Cust, custCol, KIT_TXT, KitPill, lineState, StatusPill } from './ui';

export type Open = (d: string) => void;
export type Role = '業務' | '生管' | '倉庫' | '產線' | '課長' | '老闆';

/* ===================== 環節資訊流：每個環節現在的狀況 ===================== */
export function Stages({ w, open }: { w: World; open: Open }) {
  const S = w.state, O = Object.values(w.orders);
  const ch = O.filter((o) => o.type !== 'base');
  const sub = O.filter((o) => o.status === 'submitted').length;
  const appr = O.filter((o) => o.status === 'approval').length;
  const decided = w.events.filter((e) => e.role === '生管' && (e.act === '確認派發' || e.act === '送課長核准')).length;
  const kits = O.filter((o) => o.status !== 'done' && o.kit && ['picking', 'ready', 'fetching'].includes(o.kit.status));
  const picking = kits.filter((o) => o.kit.status === 'picking').length;
  const moving = kits.filter((o) => o.kit.status !== 'picking').length;
  const cf = conflicts(w).length;
  const co = S.lines.filter((L) => L.mode === 'co');
  const wait = S.lines.filter((L) => L.mode === 'wait');
  const smtToday = Math.round(O.reduce((a, o) => a + o.done, 0));
  const asmWip = Math.round(O.reduce((a, o) => a + Math.max(0, o.done - (o.asm || 0)), 0));
  const qaWip = Math.round(O.reduce((a, o) => a + Math.max(0, (o.asm || 0) - (o.qa || 0) - (o.retest || 0)), 0));
  const retest = Math.round(O.reduce((a, o) => a + (o.retest || 0), 0));
  const noReply = ch.filter((o) => o.reply && !o.replied).length;
  const items = [
    { k: 'intake', n: '接單', who: '業務', big: ch.length, unit: '張變更', ln: noReply ? `${noReply} 張待回覆客戶` : '全部已回覆', cls: noReply ? 'busy' : '' },
    { k: 'plan', n: '試算決策', who: '生管', big: sub + appr, unit: '待決定', ln: appr ? `${appr} 張等課長核准` : `今天決定 ${decided} 次`, cls: sub + appr ? 'busy' : '' },
    { k: 'kit', n: '備料', who: '倉庫', big: kits.length, unit: '張料單', ln: cf ? `⚠ 共用料不足 ${cf} 項` : `備料中 ${picking}・運送 ${moving}`, cls: cf ? 'alert' : '' },
    { k: 'smt', n: 'SMT', who: '產線', big: smtToday.toLocaleString(), unit: '片', ln: wait.length ? `⚠ ${wait.map((L) => L.i + 1).join('、')} 線等料` : co.length ? `${co.map((L) => L.i + 1).join('、')} 線換線中` : '四條線生產中', cls: wait.length ? 'alert' : co.length ? 'busy' : '' },
    { k: 'asm', n: '人工站', who: '作業員', big: asmWip.toLocaleString(), unit: '片在製', ln: '插件・測試・組裝・包裝', cls: '' },
    { k: 'qa', n: '品保', who: '品保', big: qaWip.toLocaleString(), unit: '片待檢', ln: `重測 ${retest} 片（7%）`, cls: '' },
    { k: 'ship', n: '出貨', who: '業務', big: S.shippedToday.toLocaleString(), unit: '片', ln: '今天已出貨', cls: '' },
  ];
  return (
    <div className="flow">
      {items.map((x) => (
        <button key={x.k} className={'stg ' + x.cls} onClick={() => open('stage:' + x.k)}>
          <div className="sh"><b>{x.n}</b><em>{x.who}</em></div>
          <div className="big num">{x.big}<small>{x.unit}</small></div>
          <div className="ln">{x.ln}</div>
        </button>
      ))}
    </div>
  );
}

/* ===================== 四條線 ===================== */
export function Lines({ w, open }: { w: World; open: Open }) {
  const S = w.state, O = w.orders;
  return (
    <div className="pn">
      <div className="ph"><h2>四條 SMT 線</h2><div className="r">黃燈＝剩 {YEL} 片開始備料　藍燈＝剩 {BLU} 片把料推到線邊　綠牌＝料和工具到線邊，才能換線</div></div>
      <div className="lines">
        {S.lines.map((L, i) => {
          const c = L.cur ? O[L.cur] : null;
          const nx = L.queue[0] ? O[L.queue[0]] : null;
          const st = lineState(L);
          const rem = c ? Math.ceil((c.qty || 0) - c.done) : 0;
          const green = L.mode === 'wait' || L.mode === 'co' ? c?.kit?.status === 'atline' : !!(nx && c && nx.model !== c.model && nx.kit?.status === 'atline');
          return (
            <div key={i} className={'lr ' + (L.mode === 'wait' ? 'wait' : L.mode === 'co' ? 'co' : '')} onClick={() => open('line:' + i)}>
              <div className="nm"><b>{i + 1} 線</b><div>{LANE_NAME[i]} 優先</div></div>
              <div><span className="st" style={{ color: st.c }}><i style={{ background: st.c }} />{st.t}</span>
                <div className="mut" style={{ fontSize: 11 }}>{L.preempt ? `${hm(L.preempt.at)} 停線換 ${L.preempt.orderId}` : c?.kit && L.mode !== 'run' ? `料：${KIT_TXT[c.kit.status]?.[1]}` : ' '}</div></div>
              <div>{c ? <><div className="row"><Cust c={c.cust} /><b>{c.id}</b><span className="mut">{c.model}</span><span className="num" style={{ marginLeft: 'auto' }}><b>{Math.floor(c.done)}</b><span className="mut"> / {c.qty} 片・剩 {rem}</span></span></div>
                <div className="prog"><i style={{ width: Math.round((c.done / (c.qty || 1)) * 100) + '%', background: custCol(c.cust) }} /></div></> : <span className="mut">沒有單</span>}</div>
              <div className="lamps"><span className={'lamp y' + (L.lampY ? ' on' : '')}>黃</span><span className={'lamp b' + (L.lampB ? ' on' : '')}>藍</span><span className={'lamp g' + (green ? ' on' : '')}>綠</span></div>
              <div className="nx" style={{ fontSize: 12 }}>{nx ? <div className="row"><span className="mut">下一張</span><Cust c={nx.cust} />{nx.id}<span className="mut">{nx.model}</span>{c && nx.model === c.model ? <span className="pill">同機種</span> : <KitPill k={nx.kit} />}</div> : <span className="mut">下一張：—</span>}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ===================== 我的待辦 ===================== */
interface Todo { role: Role; text: string; hint?: string; act?: string; label?: string; run?: () => void; hot?: boolean }
export function todos(w: World): Todo[] {
  const S = w.state, O = Object.values(w.orders), out: Todo[] = [];
  out.push({ role: '業務', text: '貼上新的客戶訊息', hint: 'AI 整理成變更單', act: 'intake', label: '新增', hot: !O.some((o) => o.type !== 'base') });
  O.filter((o) => o.status === 'submitted').forEach((o) => out.push({ role: '生管', text: `${o.id} 等你試算`, hint: `${o.model}${o.qty ? ' × ' + o.qty : ''}・交期 ${hm(o.due)}`, act: 'plan:' + o.id, label: '試算', hot: true }));
  O.filter((o) => o.status === 'approval').forEach((o) => out.push({ role: '課長', text: `${o.id} 要打斷 ${o.stops}`, hint: o.optLabel, act: 'approve:' + o.id, label: '核准', hot: true }));
  O.filter((o) => o.type !== 'base' && !o.replied && o.reply).forEach((o) => out.push({ role: '業務', text: `回覆客戶 ${o.id}`, hint: `預計 ${hm(o.eta)} 完成`, act: 'order:' + o.id, label: '回覆', hot: true }));
  S.lines.forEach((L, i) => {
    const c = L.cur ? O.find((x) => x.id === L.cur) : null;
    const nx = L.queue[0] ? w.orders[L.queue[0]] : null;
    const need = c && (L.mode === 'wait' || (L.mode === 'co' && c.kit.status !== 'atline')) ? c : nx && L.lampY && (!c || nx.model !== c.model) ? nx : null;
    if (!need) return;
    const k = need.kit.status;
    if (k === 'todo' || k === 'newpart') out.push({ role: '倉庫', text: `備 ${need.id} 的料（${i + 1} 線）`, hint: L.lampB ? '已藍燈，要快' : '黃燈', label: '開始備料', run: () => store.act((x) => kitAction(x, need.id, 'start')), hot: L.lampB || L.mode === 'wait' });
    if (k === 'picking') out.push({ role: '倉庫', text: `${need.id} 備料中（${i + 1} 線）`, hint: `預計 ${hm((need.kit.startAt || 0) + (need.kit.need || 70))} 備好`, label: '備妥', run: () => store.act((x) => kitAction(x, need.id, 'ready')) });
    if (k === 'ready' || k === 'fetching') out.push({ role: '產線', text: `把 ${need.id} 的料推到 ${i + 1} 線`, hint: '前段作業員', label: '送達', run: () => store.act((x) => kitAction(x, need.id, 'atline')), hot: L.lampB || L.mode === 'wait' });
  });
  if (conflicts(w).length) out.push({ role: '倉庫', text: '共用料不足', hint: conflicts(w).map((c) => c.part).join('、'), act: 'stage:kit', label: '查看' });
  if (!Object.keys(S.forecast).length) out.push({ role: '業務', text: '填甲的本週追加預估', hint: '有預估，1 線旁先備料', act: 'forecast', label: '填寫' });
  out.push({ role: '生管', text: '週檢討：AI 整理本週數據', hint: '換線參數要不要改', act: 'weekly', label: '產生' });
  out.push({ role: '課長', text: '下班前講一段日報', hint: '語音或打字', act: 'report', label: '日報' });
  const late = O.filter((o) => !o.shipped && !o.tmr && o.due != null && o.eta != null && o.eta > o.due);
  if (late.length) out.push({ role: '老闆', text: `${late.length} 張單可能延誤`, hint: late.map((o) => o.id).join('、'), act: 'order:' + late[0].id, label: '查看', hot: true });
  out.push({ role: '老闆', text: '看本週週報', hint: '換線、等料、準時率和建議', act: 'weekly', label: '週報' });
  if (O.some((o) => o.status === 'approval')) out.push({ role: '老闆', text: '有破例等課長核准', hint: '可以看理由', act: 'approve:' + O.find((o) => o.status === 'approval')!.id, label: '看' });
  return out;
}
export function Todo({ w, role, open }: { w: World; role: Role | '全部'; open: Open }) {
  const list = todos(w).filter((t) => role === '全部' || t.role === role);
  return (
    <div className="pn">
      <div className="ph"><h2>{role === '全部' ? '大家的待辦' : `${role}的待辦`}</h2><div className="r">{list.filter((t) => t.hot).length} 件要先處理</div></div>
      <div className="todo">
        {!list.length && <div className="empty">目前沒有要你處理的事。</div>}
        {list.map((t, k) => (
          <div key={k} className={'td' + (t.hot ? ' hot' : '')}>
            <span className="who">{t.role}</span>
            <div className="tx">{t.text}{t.hint && <small>{t.hint}</small>}</div>
            <button className={'btn sm' + (t.hot ? ' pri' : '')} onClick={() => (t.run ? t.run() : t.act && open(t.act))}>{t.label}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===================== 訂單追蹤 ===================== */
function Mini({ v, of }: { v: number; of: number }) {
  return <span className="mini num"><span className="bar"><i style={{ width: Math.min(100, Math.round((v / (of || 1)) * 100)) + '%' }} /></span>{Math.floor(v)}</span>;
}
export function Orders({ w, open }: { w: World; open: Open }) {
  const [f, setF] = useState<'today' | 'all'>('today');
  const list = Object.values(w.orders).filter((o) => f === 'all' || !o.tmr || o.type !== 'base' || o.status === 'running')
    .sort((a, b) => rank(a) - rank(b) || (a.due || 0) - (b.due || 0));
  return (
    <div className="pn">
      <div className="ph"><h2>訂單追蹤</h2><div className="r">
        <button className={'btn sm' + (f === 'today' ? ' pri' : '')} onClick={() => setF('today')}>今天相關</button>
        <button className={'btn sm' + (f === 'all' ? ' pri' : '')} onClick={() => setF('all')}>全部</button></div></div>
      <table>
        <thead><tr><th>單號</th><th>機種・數量</th><th>線</th><th>狀態</th><th>料</th><th>SMT</th><th>人工站</th><th>品保</th><th>交期</th><th>預計</th></tr></thead>
        <tbody>{list.map((o) => (
          <tr key={o.id} className="click" onClick={() => open('order:' + o.id)}>
            <td><span className="row"><Cust c={o.cust} /><b>{o.id}</b>{o.type === 'rush' && <span className="pill acc">追加</span>}{o.type === 'ecn' && <span className="pill warn">換料</span>}</span></td>
            <td className="mut">{o.model}{o.qty ? ` × ${o.qty}` : ''}</td>
            <td>{o.line != null ? o.line + 1 : '—'}</td>
            <td><StatusPill o={o} /></td>
            <td><KitPill k={o.kit} /></td>
            <td><Mini v={o.done} of={o.qty || 1} /></td>
            <td><Mini v={o.asm || 0} of={o.qty || 1} /></td>
            <td><Mini v={o.qa || 0} of={o.qty || 1} /></td>
            <td className="num">{hm(o.due)}</td>
            <td className="num" style={{ color: o.eta && o.due != null && o.eta > o.due ? 'var(--bad)' : undefined }}>{o.shipped ? '已出貨' : hm(o.eta)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
function rank(o: Order) { return o.status === 'submitted' || o.status === 'approval' ? 0 : o.status === 'running' ? 1 : o.status === 'planned' ? 2 : o.status === 'queued' ? 3 : o.shipped ? 5 : 4; }

/* ===================== 右側：決策、智能體、動作、指標 ===================== */
const AGENTS = [
  { k: '①', n: '變更單智能體', m: (e: string) => e.includes('變更單') || e.includes('送出') },
  { k: '②', n: '試算智能體', m: (e: string) => e.includes('說明') || e.includes('試算') },
  { k: '③', n: '備料智能體', m: (e: string) => e.includes('黃燈') || e.includes('藍燈') || e.includes('備料') || e.includes('共用料') },
  { k: '④', n: '現場回饋智能體', m: (e: string) => e.includes('日報') },
  { k: '⑤', n: '週檢討智能體', m: (e: string) => e.includes('週報') || e.includes('重排') },
];
export function Side({ w, open }: { w: World; open: Open }) {
  const [tab, setTab] = useState<'dec' | 'agent' | 'log' | 'kpi'>('dec');
  const decs = w.events.filter((e) => (e.role === '生管' || e.role === '課長') && ['確認派發', '送課長核准', '核准破例', '退回破例', '定時重排', '手動重排', '退回業務'].includes(e.act));
  const al = alerts(w);
  return (
    <div className="pn">
      <div className="tabs">
        <button className={tab === 'dec' ? 'on' : ''} onClick={() => setTab('dec')}>決策紀錄</button>
        <button className={tab === 'agent' ? 'on' : ''} onClick={() => setTab('agent')}>智能體</button>
        <button className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>全部動作</button>
        <button className={tab === 'kpi' ? 'on' : ''} onClick={() => setTab('kpi')}>指標 {al.filter((a) => a.lv === 'bad').length ? <span className="pill bad">{al.filter((a) => a.lv === 'bad').length}</span> : null}</button>
      </div>
      {tab === 'dec' && <div className="feed">
        {!decs.length && <div className="empty">還沒有決策。生管確認方案後會記在這裡：選了哪個、為什麼。</div>}
        {decs.map((e) => { const o = e.order ? w.orders[e.order] : null; return (
          <div className="dec" key={e.id} onClick={() => o && open('order:' + o.id)} style={{ cursor: o ? 'pointer' : 'default' }}>
            <div className="dh"><span className="pill">{e.role}</span><b>{e.act}</b><time className="num">{hm(e.t)}</time></div>
            <div style={{ fontSize: 12, marginTop: 3 }}>{e.detail}</div>
            {o?.explain && (e.act === '確認派發' || e.act === '送課長核准') && <div className="why">理由：{o.explain}</div>}
          </div>); })}
      </div>}
      {tab === 'agent' && <div>
        {AGENTS.map((a) => { const last = w.events.find((e) => (e.role === '智能體' || e.role === '系統' || e.role === '倉庫' || e.role === '課長' || e.role === '生管' || e.role === '業務') && a.m(e.act + e.detail)); return (
          <div className="agent" key={a.k}><span className="ic">{a.k}</span><div><b>{a.n}</b><div>{last ? `${hm(last.t)}　${last.act}：${last.detail}` : '待命中'}</div></div></div>); })}
      </div>}
      {tab === 'log' && <div className="feed">
        {w.events.slice(0, 120).map((e) => (
          <div key={e.id} className={'fi' + (e.warn ? ' warn' : '')}><time className="num">{hm(e.t)}</time><div><span className="pill" style={{ marginRight: 6 }}>{e.role}</span><span className="a">{e.act}</span>　<span className="x">{e.detail}</span></div></div>
        ))}
      </div>}
      {tab === 'kpi' && <div>
        {al.length > 0 && <div style={{ marginBottom: 8 }}>{al.map((a, k) => <div key={k} className="fi warn"><span className={'pill ' + (a.lv === 'bad' ? 'bad' : 'warn')}>{a.role}</span><div className="x">{a.text}</div></div>)}</div>}
        <div className="kpis">{metrics(w).map((m) => <div key={m.label} className={'kpi ' + m.st}><div className="l">{m.label}</div><div className="v num">{m.value}</div><div className="t">目標 {m.target}</div></div>)}</div>
      </div>}
    </div>
  );
}
