import { BLU, LANE_NAME, YEL } from '../engine/engine';
import type { World } from '../engine/types';
import { Head } from '../ui';

const KT: Record<string, string> = { todo: '未備', picking: '倉庫備料中', ready: '備妥待運', fetching: '運送中', atline: '已到線邊', newpart: '等新料' };

export default function Board({ w }: { w: World }) {
  const S = w.state, O = w.orders;
  return (
    <>
      <Head title="產線看板" desc={`作業員只看不輸入。剩 ${YEL} 片黃燈、剩 ${BLU} 片藍燈，料到線邊綠牌。`} />
      <div className="grid g4">
        {S.lines.map((L, i) => {
          const c = L.cur ? O[L.cur] : null;
          const nx = L.queue[0] ? O[L.queue[0]] : null;
          const rem = c ? Math.ceil((c.qty || 0) - c.done) : 0;
          const green = L.mode === 'wait' ? c?.kit?.status === 'atline' : !!(nx && c && nx.model !== c.model && nx.kit?.status === 'atline');
          const st = L.mode === 'run' ? '生產中' : L.mode === 'co' ? '換線中' : L.mode === 'wait' ? '等料' : '空著';
          return (
            <div key={i} className={'lb' + (L.mode === 'wait' ? ' wait' : '')}>
              <div className="h"><b>{i + 1} 線</b><span>{LANE_NAME[i]}</span><em>{st}</em></div>
              <div className="k">正在做</div>
              <div className="v">{c ? `${c.cust} ${c.id} · ${c.model}` : '—'}</div>
              <div className="k">{L.mode === 'co' ? '換線還要' : '這張還剩'}</div>
              <div className="big num">{L.mode === 'co' ? L.coLeft : rem}<small>{L.mode === 'co' ? '分' : '片'}</small></div>
              {c && <div className="prog"><i style={{ width: Math.round((c.done / (c.qty || 1)) * 100) + '%' }} /></div>}
              {c && (L.mode === 'co' || L.mode === 'wait') && <div className="k">這張的料：<span style={{ color: '#fff' }}>{KT[c.kit?.status || ''] || '—'}</span></div>}
              <div className="k">下一張</div>
              <div style={{ fontSize: 15 }}>{nx ? `${nx.cust} ${nx.id} · ${nx.model}${c && nx.model === c.model ? '（同機種）' : ''}` : '—'}</div>
              <div className="lamps">
                <div className={'lamp y' + (L.lampY ? ' on' : '')}>黃燈<br />備料</div>
                <div className={'lamp b' + (L.lampB ? ' on' : '')}>藍燈<br />帶料</div>
                <div className={'lamp g' + (green ? ' on' : '')}>綠牌<br />料到</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
