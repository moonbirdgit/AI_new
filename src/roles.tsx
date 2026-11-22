import { useState } from 'react';
import {
  skipMsg, alerts, applyOpt, clone, conflicts, END, endsOf, hm, KIT, kitAction, LANE_NAME, metrics, project, RATE, reschedule, RESCHED_AT, YEL, BLU,
} from './engine/engine';
import type { Order, PlanOption, ProjItem, World } from './engine/types';
import type { Open, Role } from './panels';
import { store } from './store';
import { Cust, custCol, KIT_TXT, KitPill, lineState, toast } from './ui';

export type RoleSel = Role | '全部';

/* ===================== 角色選擇 ===================== */
const IC: Record<string, string> = {
  業務: 'M4 5h16v11H10l-5 4v-4H4z',
  生管: 'M4 6h8M8 12h10M6 18h7M4 3v18',
  倉庫: 'M3 8l9-5 9 5v9l-9 5-9-5zM3 8l9 5 9-5M12 13v9',
  產線: 'M3 21V11l6 4v-4l6 4V7h6v14zM7 18h2M12 18h2M17 18h2',
  課長: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5',
  老闆: 'M4 20h16M7 16l4-5 3 3 5-7',
  全部: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
};
export const ROLE_META: { r: RoleSel; d: string }[] = [
  { r: '業務', d: '接客戶追加、回覆交期' },
  { r: '生管', d: '模擬排程、決定插單' },
  { r: '倉庫', d: '看接下來的單，提前備料' },
  { r: '產線', d: '看自己這條線、何時換線' },
  { r: '課長', d: '核准破例、看異常、寫日報' },
  { r: '老闆', d: '看成果和延誤風險' },
  { r: '全部', d: '所有角色的事一次看' },
];
export function RoleIcon({ r, size = 16 }: { r: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={IC[r]} /></svg>;
}
export function RoleBar({ role, setRole, children }: { role: RoleSel | null; setRole: (r: RoleSel) => void; children?: React.ReactNode }) {
  const cur = ROLE_META.find((x) => x.r === role);
  return (
    <div className="rolebar"><div className="rbin">
      <span className="rlab">我是</span>
      <div className={'rtabs' + (role ? '' : ' pulse')}>{ROLE_META.map((x, i) => (
        <button key={x.r} className={role === x.r ? 'on' : ''} style={{ animationDelay: `${i * 0.22}s` }} onClick={() => setRole(x.r)} title={x.d}><RoleIcon r={x.r} /><span>{x.r === '全部' ? '看全部' : x.r}</span></button>
      ))}</div>
      <span className={'rdesc' + (role ? '' : ' hintc')}>{cur ? cur.d : '← 先選你的角色'}</span>
      <div className="spacer" />
      {children}
    </div></div>
  );
}
export function RolePicker({ setRole }: { setRole: (r: RoleSel) => void }) {
  return (
    <div className="pn picker">
      <div className="pk-h"><b>你是誰？</b><span>選好角色，主畫面會先顯示你要做的事；每個環節的進度大家都看得到。之後可以在上方隨時切換。</span></div>
      <div className="pk-g">{ROLE_META.map((x, i) => (
        <button key={x.r} style={{ animationDelay: `${i * 0.22}s` }} onClick={() => setRole(x.r)}><span className="pk-ic"><RoleIcon r={x.r} size={22} /></span><b>{x.r === '全部' ? '看全部' : x.r}</b><small>{x.d}</small></button>
      ))}</div>
    </div>
  );
}

/* ===================== 排程時間軸（模擬排程） ===================== */
export function simulate(w: World, orderId: string, opt: PlanOption): ProjItem[][] {
  const S = clone(w.state), O = clone(w.orders);
  applyOpt(S, O, orderId, opt);
  return project(S, O);
}
export function Gantt({ w, P, hl, compact }: { w: World; P: ProjItem[][]; hl?: string; compact?: boolean }) {
  const now = w.state.clock;
  const last = Math.max(now + 120, ...P.flat().map((x) => x.end));
  const t0 = now - 10, t1 = Math.min(Math.max(END + 10, last + 10), now + 600);
  const pc = (t: number) => Math.max(0, Math.min(100, ((t - t0) / (t1 - t0)) * 100));
  const ticks: number[] = [];
  for (let h = Math.ceil(t0 / 60) * 60; h <= t1; h += 60) ticks.push(h);
  const seg = (a: number, b: number, cls: string, txt: string, bg?: string, key?: string, title?: string, mark?: boolean) => {
    if (b <= t0 || a >= t1 || b - a < 0.5) return null;
    return <div key={key} className={'gs ' + cls + (mark ? ' hl' : '')} title={title} style={{ left: pc(a) + '%', width: Math.max(0.4, pc(b) - pc(a)) + '%', background: bg }}><span>{txt}</span></div>;
  };
  return (
    <div className={'gantt' + (compact ? ' compact' : '')}>
      <div className="gaxis"><div className="gl" /><div className="gt">{ticks.map((h) => <span key={h} style={{ left: pc(h) + '%' }}>{hm(h)}</span>)}</div></div>
      {P.map((items, i) => (
        <div className="grow" key={i}>
          <div className="gl"><b>{i + 1} 線</b>{!compact && <small>{LANE_NAME[i]}</small>}</div>
          <div className="gt">
            {ticks.map((h) => <i key={h} className="gtick" style={{ left: pc(h) + '%' }} />)}
            <i className="gend" style={{ left: pc(END) + '%' }} />
            {items.map((x, k) => {
              const o = w.orders[x.id];
              const out = [];
              if (x.coEnd != null) out.push(seg(x.start, x.coEnd, 'co', '換線', undefined, k + 'c', `${hm(x.start)}–${hm(x.coEnd)} 換線`));
              let ps = x.coEnd ?? x.start;
              if (x.wait && x.wait > 0.5) { out.push(seg(ps, ps + x.wait, 'wait', '等料', undefined, k + 'w', `等料 ${Math.round(x.wait)} 分`)); ps += x.wait; }
              out.push(seg(ps, x.end, 'run', x.id, o ? custCol(o.cust) : undefined, k + 'r', `${x.id} ${o?.model || ''} ${hm(ps)}–${hm(x.end)}`, x.id === hl));
              return out;
            })}
            <i className="gnow" style={{ left: pc(now) + '%' }} />
          </div>
        </div>
      ))}
      <div className="glegend"><span><i className="lg run" />生產（顏色＝客戶）</span><span><i className="lg co" />換線</span><span><i className="lg wait" />等料</span><span><i className="lg now" />現在</span><span><i className="lg end" />20:00 收工</span></div>
    </div>
  );
}

/* ===================== 生管：模擬排程與確認 ===================== */
export function PlannerView({ w, open }: { w: World; open: Open }) {
  const S = w.state, O = w.orders;
  const P = project(S, O);
  const E = endsOf(P);
  const coN = P.flat().filter((x) => x.co).length;
  const late = Object.entries(E).filter(([id, e]) => { const o = O[id]; return o && !o.tmr && o.due != null && e > o.due; }).map(([id]) => id);
  const pend = Object.values(O).filter((o) => o.status === 'submitted' || o.status === 'approval');
  const sim = clone(w);
  const save = reschedule(sim, 'preview');
  const nextRe = RESCHED_AT.find((t) => t > S.clock);
  return (
    <div className="pn">
      <div className="ph"><h2>模擬排程</h2><div className="r">接下來換線 <b style={{ color: 'var(--ink)' }}>{coN}</b> 次・可能延誤 <b style={{ color: late.length ? 'var(--bad)' : 'var(--ok)' }}>{late.length}</b> 張</div></div>
      {pend.length > 0 ? (
        <div className="pend">{pend.map((o) => (
          <div key={o.id} className="pd"><Cust c={o.cust} /><b>{o.id}</b><span className="mut">{o.model}{o.qty ? ` × ${o.qty}` : ''}・交期 {hm(o.due)}</span>
            {o.status === 'approval' ? <span className="pill warn" style={{ marginLeft: 'auto' }}>等課長核准</span>
              : <button className="btn sm pri" style={{ marginLeft: 'auto' }} onClick={() => open('plan:' + o.id)}>試算方案，看插進來後的排程</button>}</div>
        ))}</div>
      ) : <div className="hint" style={{ marginBottom: 8 }}>目前沒有待決定的變更單。業務送出後會出現在這裡，按「試算」就能比較插單前後的排程。</div>}
      <Gantt w={w} P={P} />
      <div className="row" style={{ marginTop: 10, gap: 10 }}>
        <button className="btn sm" disabled={!save} onClick={() => store.act((x) => reschedule(x, 'manual')).then(() => toast('已重排'))}>{save ? `現在重排（同機種排一起，少換線 ${save} 次）` : '目前排法換線已最少'}</button>
        <span className="hint">{nextRe ? `下一次自動重排：${hm(nextRe)}` : '今天的自動重排已完成'}；鎖住的下一張不會動</span>
        {late.length > 0 && <span className="pill bad">可能延誤：{late.join('、')}</span>}
      </div>
    </div>
  );
}

/* ===================== 倉庫：接下來要備料的單 ===================== */
interface KitRow { i: number; o: Order; need: number; startBy: number; same: boolean; cur: boolean }
export function WarehouseView({ w }: { w: World }) {
  const S = w.state, O = w.orders, now = S.clock;
  const P = project(S, O);
  const rows: KitRow[] = [];
  P.forEach((items, i) => items.forEach((x) => {
    const o = O[x.id];
    if (!o || x.part) return;
    const isCur = S.lines[i].cur === x.id;
    if (isCur && S.lines[i].mode === 'run') return;
    rows.push({ i, o, need: x.start, startBy: x.start - (KIT + 10), same: x.coEnd == null && !isCur, cur: isCur });
  }));
  rows.sort((a, b) => a.need - b.need);
  const show = rows.filter((r) => r.need <= now + 360).slice(0, 10);
  const cf = conflicts(w);
  return (
    <div className="pn">
      <div className="ph"><h2>接下來要備料的單</h2><div className="r">依「幾點要送到線邊」排序・備料約 {KIT} 分，提前 {KIT + 10} 分開始</div></div>
      <table className="wtab">
        <thead><tr><th>線</th><th>單號</th><th>機種・數量</th><th>幾點要開始備</th><th>幾點要到線邊</th><th>狀態</th><th /></tr></thead>
        <tbody>{show.map((r) => {
          const k = r.o.kit?.status || 'todo';
          const overdue = !r.same && k === 'todo' && r.startBy <= now;
          const left = Math.round(r.need - now);
          return (
            <tr key={r.o.id} className={overdue ? 'due' : r.same ? 'dim' : ''}>
              <td><b>{r.i + 1} 線</b></td>
              <td><span className="row"><Cust c={r.o.cust} /><b>{r.o.id}</b>{r.o.type === 'rush' && <span className="pill acc">插單</span>}</span></td>
              <td className="mut">{r.o.model} × {r.o.qty}</td>
              <td className="num">{r.same ? '—' : k !== 'todo' ? <span className="mut">{r.o.kit?.startAt != null ? `${hm(r.o.kit.startAt)} 已開始` : '已開始'}</span> : overdue ? <b style={{ color: 'var(--bad)' }}>現在就要備</b> : hm(r.startBy)}</td>
              <td className="num">{r.cur ? <b style={{ color: 'var(--bad)' }}>線在等</b> : <>{hm(r.need)}<span className="mut">　{left <= 0 ? '' : `還有 ${left} 分`}</span></>}</td>
              <td>{r.same ? <span className="pill">同機種，料沿用</span> : <KitPill k={r.o.kit} />}</td>
              <td style={{ textAlign: 'right' }}>{!r.same && <KitBtn id={r.o.id} k={k} />}</td>
            </tr>);
        })}</tbody>
      </table>
      {!show.length && <div className="empty">接下來 6 小時沒有要換線的單。</div>}
      <div className="parts">{S.parts.map((p) => {
        const c = cf.find((x) => x.part === p.name);
        return <div key={p.name} className={'part' + (c ? ' bad' : '')}><b>{p.name}</b><span className="num">庫存 {p.stock.toLocaleString()}</span>{c ? <em>不夠：需要 {c.need.toLocaleString()}（{c.orders.join('、')}）</em> : <em>夠用（{Object.keys(p.use).join('、')} 共用）</em>}</div>;
      })}</div>
    </div>
  );
}
function KitBtn({ id, k }: { id: string; k: string }) {
  const a = k === 'todo' || k === 'newpart' ? ['start', '開始備料'] : k === 'picking' ? ['ready', '備妥'] : k === 'ready' || k === 'fetching' ? ['atline', '送達線邊'] : null;
  if (!a) return null;
  return <button className={'btn sm' + (k === 'todo' ? ' pri' : '')} onClick={() => store.act((x) => kitAction(x, id, a[0] as 'start' | 'ready' | 'atline'))}>{a[1]}</button>;
}

/* ===================== 業務：我的變更單 ===================== */
const STEP = ['接單', '決定', '備料', 'SMT', '人工站', '品保', '出貨'];
export function stepIdx(o: Order) {
  return o.shipped ? 7 : (o.qa || 0) > 0 ? 5 : (o.asm || 0) > 0 ? 4 : o.done > 0 || o.status === 'running' ? 3 : o.kit.status !== 'todo' && o.status !== 'submitted' ? 2 : ['planned', 'queued', 'approval', 'decided'].includes(o.status) ? 1 : 0;
}
export function StepDots({ o }: { o: Order }) {
  const k = stepIdx(o);
  return <span className="dots" title={k >= 7 ? '已出貨' : '目前在：' + STEP[k]}>{STEP.map((s, i) => <i key={s} className={i < k ? 'd' : i === k ? 'c' : ''} />)}<em>{k >= 7 ? '已出貨' : STEP[k]}</em></span>;
}
export function SalesView({ w, open }: { w: World; open: Open }) {
  const O = w.orders;
  const E = endsOf(project(w.state, O));
  const my = Object.values(O).filter((o) => o.type !== 'base').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return (
    <div className="pn">
      <div className="ph"><h2>客戶訊息</h2><div className="r">LINE、電話、Email、老闆交代都收在這裡</div></div>
      <Inbox w={w} open={open} />
      <div className="ph" style={{ marginTop: 14 }}><h2>我的變更單</h2><div className="r"><button className="btn sm" onClick={() => open('forecast')}>甲的週預估</button><button className="btn sm pri" onClick={() => open('intake')}>＋ 新增變更單</button></div></div>
      {!my.length ? <div className="empty">還沒有變更單。客戶用 LINE、電話追加時，按「新增變更單」把訊息貼進來，AI 會整理成單。</div> : (
        <table>
          <thead><tr><th>單號</th><th>機種・數量</th><th>目前在哪</th><th>交期</th><th>預計完成</th><th>趕得上嗎</th><th>回覆客戶</th></tr></thead>
          <tbody>{my.map((o) => {
            const eta = o.shipped ? o.shipAt : E[o.id] ?? o.eta;
            const risk = o.due == null || eta == null ? '' : eta > o.due ? 'bad' : eta > o.due - 30 ? 'warn' : 'ok';
            return (
              <tr key={o.id} className="click" onClick={() => open('order:' + o.id)}>
                <td><span className="row"><Cust c={o.cust} /><b>{o.id}</b></span></td>
                <td className="mut">{o.model}{o.qty ? ` × ${o.qty}` : ''}</td>
                <td><StepDots o={o} /></td>
                <td className="num">{hm(o.due)}</td>
                <td className="num">{o.status === 'submitted' ? <span className="mut">等生管試算</span> : hm(eta)}</td>
                <td>{risk === 'bad' ? <span className="pill bad">可能延誤</span> : risk === 'warn' ? <span className="pill warn">很趕</span> : risk === 'ok' ? <span className="pill ok">趕得上</span> : <span className="mut">—</span>}</td>
                <td>{o.replied ? <span className="pill ok">已回覆</span> : o.reply ? <button className="btn sm pri" onClick={(e) => { e.stopPropagation(); open('order:' + o.id); }}>看草稿</button> : <span className="mut">等決定</span>}</td>
              </tr>);
          })}</tbody>
        </table>)}
    </div>
  );
}

function Inbox({ w, open }: { w: World; open: Open }) {
  const nw = (w.inbox || []).filter((m) => m.status === 'new');
  const old = (w.inbox || []).filter((m) => m.status !== 'new').slice(0, 3);
  return (
    <div className="inbox">
      {!nw.length && <div className="empty">目前沒有新的客戶訊息。按右上「＋ 測試訂單」可以丟一則進來，或等客戶傳訊（下午會陸續進來）。</div>}
      {nw.map((m) => (
        <div key={m.id} className="msg new">
          <span className="mt num">{hm(m.t)}</span><span className={'mf ' + (m.from === '老闆' ? 'boss' : '')}>{m.from}</span><span className="mc">{m.ch}</span>
          <span className="mx">{m.text}</span>
          <button className="btn sm pri" onClick={() => open('intake:' + m.id)}>整理成變更單</button>
          <button className="btn sm ghost" onClick={() => store.act((x) => skipMsg(x, m.id))}>不用處理</button>
        </div>
      ))}
      {old.map((m) => (
        <div key={m.id} className="msg">
          <span className="mt num">{hm(m.t)}</span><span className="mf">{m.from}</span><span className="mc">{m.ch}</span>
          <span className="mx mut">{m.text}</span>
          {m.orderId ? <button className="btn sm ghost" onClick={() => open('order:' + m.orderId)}>→ {m.orderId}</button> : <span className="pill">不用處理</span>}
        </div>
      ))}
    </div>
  );
}

/* ===================== 產線：我這條線 ===================== */
function loadLine() { try { const v = +(localStorage.getItem('sl-line') || 0); return v >= 0 && v < 4 ? v : 0; } catch { return 0; } }
export function LineDesk({ w }: { w: World }) {
  const [i, setI] = useState<number>(loadLine);
  const pick = (k: number) => { setI(k); try { localStorage.setItem('sl-line', String(k)); } catch { /* 忽略 */ } };
  const S = w.state, O = w.orders, L = S.lines[i];
  const P = project(S, O)[i];
  const c = L.cur ? O[L.cur] : null;
  const ci = P.find((x) => x.id === L.cur);
  const nxi = P.find((x) => x.id !== L.cur && !x.part);
  const nx = nxi ? O[nxi.id] : null;
  const st = lineState(L);
  const rem = c ? Math.ceil((c.qty || 0) - c.done) : 0;
  const same = !!(nx && c && nx.model === c.model);
  const kit = nx?.kit?.status || 'todo';
  const green = same || kit === 'atline';
  return (
    <div className="pn">
      <div className="ph"><h2>我這條線</h2><div className="r"><div className="seg">{[0, 1, 2, 3].map((k) => <button key={k} className={k === i ? 'on' : ''} onClick={() => pick(k)}>{k + 1} 線</button>)}</div></div></div>
      <div className="desk">
        <div className="dk">
          <div className="dkh"><span>現在</span><b style={{ color: st.c }}>{st.t}</b></div>
          {c ? <>
            <div className="row" style={{ fontSize: 15 }}><Cust c={c.cust} /><b>{c.id}</b><span className="mut">{c.model}</span></div>
            <div className="dkbig num">{rem}<small> 片要做</small></div>
            <div className="prog"><i style={{ width: Math.round((c.done / (c.qty || 1)) * 100) + '%', background: custCol(c.cust) }} /></div>
            <div className="mut" style={{ marginTop: 6 }}>{Math.floor(c.done)} / {c.qty} 片・{ci?.part ? <>預計 <b style={{ color: 'var(--warn)' }}>{hm(ci.end)}</b> 先停下，讓插單上線（剩下的排到其他線）</> : <>預計 <b style={{ color: 'var(--ink)' }}>{hm(ci?.end)}</b> 做完</>}</div>
          </> : <div className="empty">沒有單</div>}
          <div className="biglamps">
            <div className={'bl y' + (L.lampY ? ' on' : '')}><i />黃燈<small>剩 {YEL} 片</small></div>
            <div className={'bl b' + (L.lampB ? ' on' : '')}><i />藍燈<small>剩 {BLU} 片</small></div>
            <div className={'bl g' + (green ? ' on' : '')}><i />綠牌<small>料到線邊</small></div>
          </div>
        </div>
        <div className="dk">
          <div className="dkh"><span>下一張</span>{nx && <b>{same ? '同機種，不用換線' : `${hm(nxi?.start)} 開始換線`}</b>}</div>
          {nx ? <>
            <div className="row" style={{ fontSize: 15 }}><Cust c={nx.cust} /><b>{nx.id}</b><span className="mut">{nx.model} × {nx.qty}</span></div>
            <ul className="check">
              <li className={same || ['picking', 'ready', 'fetching', 'atline'].includes(kit) ? 'ok' : ''}>倉庫已開始備料 {!same && <KitPill k={nx.kit} />}</li>
              <li className={same || ['ready', 'fetching', 'atline'].includes(kit) ? 'ok' : ''}>料和工具（飛達、鋼板）已備好</li>
              <li className={green ? 'ok' : ''}>送到線邊，掛上綠牌</li>
            </ul>
            <div className={'verdict ' + (green ? 'ok' : '')}>{green ? '綠牌已掛：做完這張就可以拆線換線' : '還沒有綠牌：繼續做目前這張，先不要拆線'}</div>
            {!same && (kit === 'ready' || kit === 'fetching') && <button className="btn sm pri" style={{ marginTop: 8 }} onClick={() => store.act((x) => kitAction(x, nx.id, 'atline'))}>料已送到線邊</button>}
          </> : <div className="empty">後面沒有排單。</div>}
          <div className="dkh" style={{ marginTop: 12 }}><span>之後的排程</span></div>
          {P.filter((x) => x.id !== L.cur && x.id !== nx?.id).slice(0, 4).map((x) => { const o = O[x.id]; return o ? <div key={x.id} className="row qrow"><Cust c={o.cust} />{o.id}<span className="mut">{o.model} × {o.qty}</span><span className="num mut" style={{ marginLeft: 'auto' }}>{hm(x.start)}–{hm(x.end)}</span></div> : null; })}
          {P.filter((x) => x.id !== L.cur && x.id !== nx?.id).length === 0 && <div className="mut" style={{ fontSize: 12 }}>—</div>}
        </div>
      </div>
      <div className="hint" style={{ marginTop: 8 }}>速度：每分鐘 {RATE} 片（24 秒／片）。作業員不用輸入，只看燈號和綠牌。</div>
    </div>
  );
}

/* ===================== 課長：核准、異常 ===================== */
export function ChiefView({ w, open }: { w: World; open: Open }) {
  const ap = Object.values(w.orders).filter((o) => o.status === 'approval');
  const al = alerts(w);
  const exc = w.events.filter((e) => e.act === '核准破例').length;
  return (
    <div className="pn">
      <div className="ph"><h2>要你決定的事</h2><div className="r">今天破例 {exc} 次（目標每週 ≤1 次）<button className="btn sm" onClick={() => open('report')}>寫日報</button></div></div>
      {ap.length ? ap.map((o) => (
        <div key={o.id} className="pd"><Cust c={o.cust} /><b>{o.id}</b><span className="mut">要打斷 {o.stops}：{o.optLabel}</span><button className="btn sm pri" style={{ marginLeft: 'auto' }} onClick={() => open('approve:' + o.id)}>看理由並核准</button></div>
      )) : <div className="empty">沒有要核准的破例。生管選的方案如果要打斷鎖住的單，會送到這裡。</div>}
      <div className="dkh" style={{ marginTop: 12 }}><span>今天的異常</span></div>
      {al.length ? al.map((a, k) => <div key={k} className="fi warn"><span className={'pill ' + (a.lv === 'bad' ? 'bad' : 'warn')}>{a.role}</span><div className="x">{a.text}</div></div>) : <div className="empty">目前沒有異常：沒有線在等料，換線都在時間內。</div>}
    </div>
  );
}

/* ===================== 老闆：成果與風險 ===================== */
export function BossView({ w, open }: { w: World; open: Open }) {
  const O = w.orders;
  const E = endsOf(project(w.state, O));
  const risk = Object.values(O).filter((o) => !o.shipped && !o.tmr && o.due != null && (E[o.id] ?? o.eta ?? 0) > o.due);
  const wk = w.weekly[0];
  return (
    <div className="pn">
      <div className="ph"><h2>今天的成果</h2><div className="r"><button className="btn sm" onClick={() => open('weekly')}>週報</button></div></div>
      <div className="kpis big">
        <div className="kpi ok"><div className="l">今天出貨</div><div className="v num">{w.state.shippedToday.toLocaleString()}<small> 片</small></div><div className="t">每月目標 125,400 片</div></div>
        {metrics(w).slice(0, 5).map((m) => <div key={m.label} className={'kpi ' + m.st}><div className="l">{m.label}</div><div className="v num">{m.value}</div><div className="t">目標 {m.target}</div></div>)}
      </div>
      <div className="dkh" style={{ marginTop: 12 }}><span>可能延誤的單</span></div>
      {risk.length ? risk.map((o) => <div key={o.id} className="pd click" onClick={() => open('order:' + o.id)}><Cust c={o.cust} /><b>{o.id}</b><span className="mut">交期 {hm(o.due)}，預計 {hm(E[o.id] ?? o.eta)}</span><span className="pill bad" style={{ marginLeft: 'auto' }}>晚 {Math.round((E[o.id] ?? o.eta ?? 0) - (o.due || 0))} 分</span></div>)
        : <div className="empty">目前今天的單都趕得上交期。</div>}
      {wk && <div className="note" style={{ marginTop: 10 }}><div className="lab">最新週報</div>{wk.summary}</div>}
    </div>
  );
}

export { KIT_TXT };
