import { useState } from 'react';
import { aiExtract } from '../ai';
import { CUST_OF, hm, markReplied, MODELS, parseDue, submitOrder } from '../engine/engine';
import type { Cust as CustT, Draft, World } from '../engine/types';
import { store } from '../store';
import { Card, Cust, custCol, Head, StatusPill, toast } from '../ui';

const EXAMPLES: [string, string][] = [
  ['甲・電話追加', '甲王經理來電：A1 再加 400，今天要'],
  ['乙・正式追加', '乙 正式追加單：B2 300 片，交期今天 19:00'],
  ['丙・換零件', '丙：C2 的電容 C14 改新料號，現在這批就要換'],
  ['老闆交代', '老闆說甲的 A2 先做 200 片，明天早上 10 點要'],
];

export default function Sales({ w }: { w: World }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [d, setD] = useState<(Draft & { ai: boolean; raw: string; dueText: string }) | null>(null);
  const mine = Object.values(w.orders).filter((o) => o.type !== 'base').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  async function extract() {
    const t = msg.trim();
    if (!t) { toast('先貼上一則訊息'); return; }
    setBusy(true);
    const r = await aiExtract(t, w.state.clock);
    setBusy(false);
    setD({ ...r.d, ai: r.ai, raw: t, dueText: r.d.due != null ? hm(r.d.due) : '' });
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
    const id = await store.act((x) => submitOrder(x, { cust: d.cust as CustT, model: d.model!, qty: d.qty, due, type: d.type }, d.raw, d.ai));
    setD(null); setMsg('');
    if (id) toast(`${id} 已送生管`);
  }

  const miss = (k: string) => (d && d.missing.includes(k) ? 'miss' : '');

  return (
    <>
      <Head title="業務" desc="貼上客戶訊息，AI 整理成變更單；排好後照試算結果回覆客戶。" />
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="col" style={{ gap: 14 }}>
          <Card title="新訊息" sub="LINE、電話、老闆交代都貼這裡">
            <div className="chips" style={{ marginBottom: 8 }}>
              {EXAMPLES.map(([k, v]) => <button key={k} className="chip" onClick={() => { setMsg(v); setD(null); }}>{k}</button>)}
            </div>
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="例：甲王經理來電：A1 再加 400，今天要" />
            <div className="row mt">
              <button className="btn pri" onClick={extract} disabled={busy}>{busy ? '整理中…' : 'AI 整理'}</button>
            </div>
          </Card>
          {d && (
            <Card title={<>變更單 <span className={'pill ' + (d.ai ? 'dark' : '')}>{d.ai ? 'AI' : '規則'}</span></>}>
              <div className="fields">
                <div className={miss('cust')}><label>客戶</label>
                  <select value={d.cust || ''} onChange={(e) => setD({ ...d, cust: (e.target.value || null) as CustT | null })}>
                    <option value="">—</option>{['甲', '乙', '丙'].map((c) => <option key={c}>{c}</option>)}
                  </select></div>
                <div className={miss('model')}><label>機種</label>
                  <select value={d.model || ''} onChange={(e) => setD({ ...d, model: e.target.value || null })}>
                    <option value="">—</option>{MODELS.map((m) => <option key={m}>{m}</option>)}
                  </select></div>
                <div className={miss('qty')}><label>數量</label>
                  <input type="number" value={d.qty ?? ''} onChange={(e) => setD({ ...d, qty: e.target.value ? +e.target.value : null })} /></div>
                <div className={miss('due')}><label>交期</label>
                  <input type="text" value={d.dueText} placeholder="20:00" onChange={(e) => setD({ ...d, dueText: e.target.value })} /></div>
                <div><label>類型</label>
                  <select value={d.type} onChange={(e) => setD({ ...d, type: e.target.value as Draft['type'] })}>
                    <option value="rush">追加</option><option value="ecn">換零件</option><option value="other">其他</option>
                  </select></div>
              </div>
              {d.ask && <div className="note mt" style={{ borderColor: '#ecdab4', background: 'var(--warn-bg)', color: 'var(--warn)' }}>AI 追問：{d.ask}</div>}
              <div className="row mt">
                <button className="btn pri" onClick={submit}>送出給生管</button>
                <button className="btn ghost" onClick={() => setD(null)}>取消</button>
              </div>
            </Card>
          )}
        </div>
        <Card title="我的變更單" sub={mine.length ? `${mine.length} 張` : ''}>
          {!mine.length && <div className="empty">還沒有。從左邊貼一則訊息開始。</div>}
          {mine.map((o) => (
            <div className="item" key={o.id} style={{ borderLeftColor: custCol(o.cust) }}>
              <div className="t"><Cust c={o.cust} /><b>{o.id}</b><span className="muted">{o.model}{o.qty ? ` × ${o.qty}` : ''}</span><StatusPill o={o} /><span className="muted" style={{ marginLeft: 'auto' }}>交期 {hm(o.due)}</span></div>
              {o.eta != null && <div className="d">預計 <b style={{ color: 'var(--ink)' }}>{hm(o.eta)}</b> 完成{o.line != null ? `・${o.line + 1} 線` : ''}{o.doneAt ? `・實際 ${hm(o.doneAt)}` : ''}</div>}
              {o.reply && (
                <div className="note mt">
                  <div className="lab">回覆客戶{o.replyAi && <span className="pill dark">AI</span>}</div>
                  {o.reply}
                  <div className="row" style={{ marginTop: 8 }}>
                    <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(o.reply || '').then(() => toast('已複製'), () => toast('請手動選取複製')); }}>複製</button>
                    {o.replied ? <span className="pill ok">已回覆</span> : <button className="btn sm pri" onClick={() => store.act((x) => markReplied(x, o.id))}>標記已回覆</button>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
