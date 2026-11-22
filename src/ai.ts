import { hm, optBrief, ruleExplain, ruleExtract } from './engine/engine';
import type { Draft, Order, PlanOption } from './engine/types';

/* 呼叫伺服器上的智能體；失敗或沒設金鑰時改用規則，畫面會標示「規則」。 */

export let aiProvider: string | null = null;
export async function checkAI() {
  try { const r = await fetch('/api/ai'); if (r.ok) aiProvider = (await r.json()).provider || null; } catch { aiProvider = null; }
  return aiProvider;
}

async function call<T>(task: string, payload: unknown): Promise<T | null> {
  if (!aiProvider) return null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 25000);
    const r = await fetch('/api/ai', { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task, payload }) });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json();
    return j.data as T;
  } catch { return null; }
}

export async function aiExtract(text: string, clock: number): Promise<{ d: Draft; ai: boolean }> {
  const fb = ruleExtract(text);
  const v = await call<Record<string, unknown>>('extract', { text, now: hm(clock) });
  if (!v) return { d: fb, ai: false };
  const cust = ['甲', '乙', '丙'].includes(v.cust as string) ? (v.cust as Draft['cust']) : null;
  const model = /^[ABC][12]$/.test(String(v.model || '')) ? String(v.model) : null;
  const qty = Number.isFinite(Number(v.qty)) && Number(v.qty) > 0 ? Math.round(Number(v.qty)) : null;
  const due = v.due != null && Number.isFinite(Number(v.due)) ? Math.round(Number(v.due)) : null;
  const type = (['rush', 'ecn', 'other'].includes(v.type as string) ? v.type : 'rush') as Draft['type'];
  const d: Draft = {
    cust: cust || (model ? ({ A: '甲', B: '乙', C: '丙' } as const)[model[0] as 'A' | 'B' | 'C'] : null),
    model, qty, due, type,
    missing: Array.isArray(v.missing) ? (v.missing as string[]) : [],
    ask: typeof v.ask === 'string' ? v.ask : '',
  };
  return { d, ai: true };
}

export async function aiExplain(o: Order, opts: PlanOption[], pick: PlanOption, clock: number) {
  const fb = ruleExplain(o, opts, pick);
  const v = await call<{ text?: string; reply?: string }>('explain', {
    order: `客戶${o.cust}，${o.model}，${o.qty ?? ''} 片，交期 ${hm(o.due)}，類型 ${o.type === 'ecn' ? '換零件' : '追加'}`,
    now: hm(clock), options: optBrief(opts), pick: pick.id,
  });
  if (!v || !v.text) return { ...fb, ai: false };
  return { text: String(v.text), reply: String(v.reply || fb.reply), ai: true };
}

export async function aiReport(text: string, stats: string) {
  const v = await call<{ summary?: string; issues?: string[]; tomorrow?: string }>('report', { text, stats });
  if (!v || !v.summary) return { summary: text.slice(0, 120), issues: [] as string[], tomorrow: '', ai: false };
  return { summary: String(v.summary), issues: Array.isArray(v.issues) ? v.issues.map(String) : [], tomorrow: String(v.tomorrow || ''), ai: true };
}
