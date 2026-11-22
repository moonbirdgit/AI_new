import { useState } from 'react';
import { aiExplain } from '../ai';
import { dispatch, hm, log, makeOptions } from '../engine/engine';
import type { PlanOption, World } from '../engine/types';
import { store } from '../store';
import { ask, Card, Cust, custCol, Gantt, Head, toast } from '../ui';

const RULES = ['各線有優先客戶：1 線甲、2 線甲→乙、3 線乙、4 線丙→乙', '下一張鎖住，只准同機種插單', '1 線空檔先補甲明天的單', '甲的追加：算好料到的時間才停線', '被停的單回自己客戶的線，接在正在做的後面'];

export default function Planner({ w }: { w: World }) {
  const [sel, setSel] = useState<string | null>(null);
  const [opts, setOpts] = useState<PlanOption[] | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [exp, setExp] = useState<{ text: string; reply: string; ai: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const S = w.state;
  const inbox = Object.values(w.orders).filter((o) => o.status === 'submitted').sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const o = sel ? w.orders[sel] : null;
  const active = o && o.status === 'submitted' ? o : null;

  function choose(id: string) { setSel(id); setOpts(null); setPick(null); setExp(null); }

  async function calc() {
    if (!active) return;
    const os = makeOptions(w, active.id);
    setOpts(os); setPick(os[0].id); setExp(null); setLoading(true);
    store.act((x) => log(x, '生管', '試算', '開始試算', `${active.id}｜${os.length} 個方案，建議 ${os[0].id}`, { order: active.id }));
    const e = await aiExplain(active, os, os[0], S.clock);
    setExp(e); setLoading(false);
    store.act((x) => log(x, '智能體', '試算', e.ai ? 'AI 說明' : '規則說明', e.text.slice(0, 60), { order: active.id }));
  }

  function confirm() {
    if (!active || !opts) return;
    const p = opts.find((x) => x.id === pick)!;
    const go = async () => {
      await store.act((x) => dispatch(x, active.id, p, exp));
      toast(p.approval ? '已送課長核准' : '已派發給業務、倉庫、課長、產線');
      choose('');
    };
    if (p.ev.vio.length) ask(`方案 ${p.id} 違反規則：${p.ev.vio[0]}。仍要選？`, go);
    else if (p.ev.newLate.length) ask(`方案 ${p.id} 會讓 ${p.ev.newLate.join('、')} 延誤。確定？`, go);
    else go();
  }

  return (
    <>
      <Head title="生管" desc="確認變更單 → 看試算方案 → 選一個派發。" />
      <div className="grid side">
        <div className="col" style={{ gap: 14 }}>
          <Card title="待確認" sub={inbox.length ? `${inbox.length} 張` : ''}>
            {!inbox.length && <div className="empty">沒有待確認的單。</div>}
            {inbox.map((x) => {
              const wait = S.clock - (x.submittedT ?? S.clock);
              return (
                <div key={x.id} className={'item click' + (sel === x.id ? ' sel' : '')} style={{ borderLeftColor: wait > 30 ? 'var(--bad)' : custCol(x.cust) }} onClick={() => choose(x.id)}>
                  <div className="t"><Cust c={x.cust} /><b>{x.id}</b><span className="pill line">{x.type === 'ecn' ? '換零件' : '追加'}</span>{x.ai && <span className="pill dark">AI</span>}</div>
                  <div className="d">{x.model}{x.qty ? ` × ${x.qty}` : ''}・交期 {hm(x.due)}・等 {wait} 分</div>
                </div>
              );
            })}
          </Card>
          <Card title="排程規則" sub="試算一律照規則">
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--ink2)' }}>{RULES.map((r) => <li key={r}>{r}</li>)}</ol>
          </Card>
        </div>
        <div className="col" style={{ gap: 14 }}>
          {active ? (
            <Card title={<><Cust c={active.cust} />{active.id}</>} sub={active.raw ? `原文：${active.raw}` : ''}>
              <div className="facts">
                <div><span>客戶</span><b>{active.cust}</b></div>
                <div><span>機種</span><b>{active.model}</b></div>
                <div><span>數量</span><b>{active.qty ?? '—'}</b></div>
                <div><span>交期</span><b>{hm(active.due)}</b></div>
                <div><span>類型</span><b>{active.type === 'ecn' ? '換零件' : '追加'}</b></div>
              </div>
              {!opts && (
                <div className="row mt">
                  <button className="btn pri" onClick={calc}>試算</button>
                  <button className="btn ghost" onClick={() => store.act((x) => { x.orders[active.id].status = 'draft'; log(x, '生管', '接單', '退回業務', active.id, { order: active.id }); }).then(() => choose(''))}>退回業務</button>
                </div>
              )}
              {opts && (
                <>
                  <div className="opts mt">
                    {opts.map((p) => {
                      const e = p.ev;
                      return (
                        <button key={p.id} className={'opt' + (pick === p.id ? ' sel' : '') + (e.vio.length ? ' bad' : '')} onClick={() => setPick(p.id)}>
                          <div className="oh"><b>{p.id}</b>{p.rec && <span className="pill dark">建議</span>}{p.approval && <span className="pill warn">需核准</span>}</div>
                          <div className="ol">{p.label}</div>
                          {p.note && <div className="muted">{p.note}</div>}
                          {p.end != null && <div className="m"><span>完成</span><b style={{ color: e.late ? 'var(--bad)' : undefined }}>{hm(e.end)}{e.late ? '（晚）' : ''}</b></div>}
                          <div className="m"><span>新增延誤</span><b style={{ color: e.newLate.length ? 'var(--bad)' : undefined }}>{e.newLate.length ? e.newLate.join('、') : '無'}</b></div>
                          <div className="m"><span>增加換線</span><b>{e.coAdd} 次</b></div>
                          {e.wait > 0 && <div className="m"><span>換好線等料</span><b style={{ color: 'var(--warn)' }}>{e.wait} 分</b></div>}
                          {e.pen > 0 && <div className="m"><span>罰款風險</span><b style={{ color: 'var(--bad)' }}>約 {e.pen} 萬</b></div>}
                          {e.vio.length ? <div className="flag bad">✗ {e.vio[0]}</div> : e.newLate.length ? <div className="flag warn">影響其他單</div> : e.wait ? <div className="flag warn">換好線要空等料</div> : <div className="flag">✓ 符合規則</div>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="note mt">
                    <div className="lab">試算說明 {exp && <span className={'pill ' + (exp.ai ? 'dark' : '')}>{exp.ai ? 'AI' : '規則'}</span>}</div>
                    {loading ? '整理中…' : exp?.text}
                  </div>
                  <div className="row mt">
                    <span className="muted">檢查：今天的單有沒有被拖到？甲幾點完成？有沒有打斷鎖住的單？</span>
                    <button className="btn pri" style={{ marginLeft: 'auto' }} disabled={!pick || loading} onClick={confirm}>確認派發（方案 {pick}）</button>
                  </div>
                </>
              )}
            </Card>
          ) : (
            <Card><div className="empty">從左邊選一張待確認的單。</div></Card>
          )}
          <Card title="四條線排程" sub="虛線框＝新插入或拆批"><Gantt w={w} /></Card>
        </div>
      </div>
    </>
  );
}
