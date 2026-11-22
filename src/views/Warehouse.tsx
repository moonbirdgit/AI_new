import { BLU, hm, KIT, kitAction, YEL } from '../engine/engine';
import type { World } from '../engine/types';
import { store } from '../store';
import { Card, Cust, Head, KitPill, LampPill } from '../ui';

export default function Warehouse({ w }: { w: World }) {
  const S = w.state, O = w.orders;
  const pend = Object.values(O).filter((o) => o.status !== 'done' && o.kit && ['picking', 'ready', 'fetching', 'todo', 'newpart'].includes(o.kit.status) && (o.status !== 'queued' || S.lines.some((L) => L.queue.includes(o.id))));
  return (
    <>
      <Head title="倉庫" desc={`剩 ${YEL} 片亮黃燈就開始備；剩 ${BLU} 片亮藍燈，前段的人來推。`} />
      <div className="grid g4">
        {S.lines.map((L, i) => {
          const cur = L.cur ? O[L.cur] : null;
          const nx = L.queue[0] ? O[L.queue[0]] : null;
          const need = cur && (L.mode === 'wait' || (L.mode === 'co' && cur.kit?.status !== 'atline')) ? cur : nx && (!cur || nx.model !== cur.model) ? nx : null;
          const k = need?.kit;
          const rem = cur ? Math.ceil((cur.qty || 0) - cur.done) : 0;
          return (
            <div key={i} className={'linecard' + (L.mode === 'wait' ? ' wait' : '')}>
              <div className="row" style={{ marginBottom: 8 }}><b>{i + 1} 線</b><LampPill L={L} /><span className="muted" style={{ marginLeft: 'auto' }}>{cur ? `剩 ${rem} 片` : '空著'}</span></div>
              <div className="kv">
                <span>正在做</span><span>{cur ? <><Cust c={cur.cust} /> {cur.id}</> : '—'}</span>
                <span>要備</span><span>{need ? <><Cust c={need.cust} /> <b>{need.id}</b> {need.model}</> : '—'}</span>
                <span>料</span><span>{need ? <KitPill k={k} /> : '—'}</span>
              </div>
              {need && k && (
                <div className="mt">
                  {(k.status === 'todo' || k.status === 'newpart') && <button className="btn sm pri" onClick={() => store.act((x) => kitAction(x, need.id, 'start'))}>開始備料</button>}
                  {k.status === 'picking' && <><button className="btn sm pri" onClick={() => store.act((x) => kitAction(x, need.id, 'ready'))}>備妥</button><span className="muted" style={{ marginLeft: 8 }}>預計 {hm((k.startAt || 0) + (k.need || KIT))}</span></>}
                  {(k.status === 'ready' || k.status === 'fetching') && <button className="btn sm pri" onClick={() => store.act((x) => kitAction(x, need.id, 'atline'))}>送達線邊</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Card title="備料清單" style={{ marginTop: 14 }}>
        {!pend.length ? <div className="empty">目前沒有要備的料。</div> : (
          <table>
            <thead><tr><th>單</th><th>線</th><th>機種</th><th>狀態</th><th>開始</th><th>到線邊</th></tr></thead>
            <tbody>{pend.map((o) => (
              <tr key={o.id}><td><span className="row"><Cust c={o.cust} />{o.id}</span></td><td>{o.line != null ? o.line + 1 + ' 線' : '—'}</td><td>{o.model}</td><td><KitPill k={o.kit} /></td><td className="num">{hm(o.kit.startAt)}</td><td className="num">{hm(o.kit.atlineAt)}</td></tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
