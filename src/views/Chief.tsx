import { useEffect, useRef, useState } from 'react';
import { aiReport } from '../ai';
import { approve, hm, log, uid } from '../engine/engine';
import type { World } from '../engine/types';
import { store } from '../store';
import { Card, Cust, Head, ModePill, toast } from '../ui';

type SR = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null };

export default function Chief({ w }: { w: World }) {
  const S = w.state, O = w.orders, m = S.metrics;
  const aps = Object.values(O).filter((o) => o.status === 'approval');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState(false);
  const srRef = useRef<SR | null>(null);
  const stats = `14:20 起產出 ${Math.round(m.out)} 片，換線 ${m.co} 次共 ${m.coMin} 分，等料 ${m.waitMin} 分`;

  useEffect(() => () => { srRef.current?.stop(); }, []);

  function mic() {
    if (rec) { srRef.current?.stop(); return; }
    const C = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!C) { toast('這個瀏覽器不支援語音，請用 Chrome 或直接打字'); return; }
    const sr: SR = new C();
    sr.lang = 'zh-TW'; sr.continuous = true; sr.interimResults = false;
    sr.onresult = (e) => { let s = ''; for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) s += e.results[i][0].transcript; if (s) setText((t) => (t ? t + ' ' : '') + s); };
    sr.onend = () => setRec(false);
    sr.onerror = (e) => { setRec(false); toast(e?.error === 'not-allowed' ? '沒有麥克風權限' : '語音中斷，請再試一次'); };
    srRef.current = sr; sr.start(); setRec(true);
  }

  async function make() {
    const t = text.trim();
    if (!t) { toast('先講或打幾句'); return; }
    setBusy(true);
    const r = await aiReport(t, stats);
    setBusy(false);
    await store.act((x) => {
      x.reports.unshift({ id: uid('r'), t: x.state.clock, real: Date.now(), raw: t, ...r });
      log(x, '課長', '回報', r.ai ? '日報（AI 整理）' : '日報', r.summary);
    });
    setText('');
  }

  return (
    <>
      <Head title="課長" desc="只處理破例；下班前講一段話，AI 整理成日報。" />
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="col" style={{ gap: 14 }}>
          <Card title="待核准" sub={aps.length ? `${aps.length} 件` : ''}>
            {!aps.length && <div className="empty">沒有。照規則走時，課長不用介入。</div>}
            {aps.map((o) => (
              <div className="item" key={o.id} style={{ borderLeftColor: 'var(--warn)' }}>
                <div className="t"><Cust c={o.cust} /><b>{o.id}</b><span className="muted">{o.model} × {o.qty}</span></div>
                <div className="d">{o.optLabel}</div>
                <div className="d">會打斷 {o.stops}。{o.explain}</div>
                <div className="row mt">
                  <button className="btn sm pri" onClick={() => store.act((x) => approve(x, o.id, true))}>核准</button>
                  <button className="btn sm" onClick={() => store.act((x) => approve(x, o.id, false))}>退回生管</button>
                </div>
              </div>
            ))}
          </Card>
          <Card title="四條線">
            {S.lines.map((L, i) => { const c = L.cur ? O[L.cur] : null; return (
              <div key={i} className="row" style={{ padding: '5px 0', borderBottom: i < 3 ? '1px solid var(--line)' : 0 }}>
                <b style={{ width: 40 }}>{i + 1} 線</b>{c ? <><Cust c={c.cust} />{c.id}</> : <span className="muted">空著</span>}<span style={{ marginLeft: 'auto' }}><ModePill L={L} /></span>
              </div>); })}
          </Card>
        </div>
        <Card title="日報" sub="講兩分鐘就好">
          <div className="muted" style={{ marginBottom: 6 }}>系統已知：{stats}</div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="例：1 線下午插了甲的追加，換線順利沒等料；4 線換 C2 少一個飛達，晚了 10 分鐘。" />
          <div className="row mt">
            <button className="btn" onClick={mic}>{rec ? '■ 停止' : '● 錄音'}</button>
            <button className="btn pri" onClick={make} disabled={busy}>{busy ? '整理中…' : 'AI 整理成日報'}</button>
          </div>
          <div className="col mt">
            {w.reports.slice(0, 5).map((r) => (
              <div className="note" key={r.id}>
                <div className="lab">{hm(r.t)} 日報 <span className={'pill ' + (r.ai ? 'dark' : '')}>{r.ai ? 'AI' : '原文'}</span></div>
                <div>{r.summary}</div>
                {r.issues.length > 0 && <ul style={{ margin: '4px 0', paddingLeft: 18 }}>{r.issues.map((x, k) => <li key={k}>{x}</li>)}</ul>}
                {r.tomorrow && <div className="muted">明天：{r.tomorrow}</div>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
