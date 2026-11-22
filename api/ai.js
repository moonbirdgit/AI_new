// 智能體：在伺服器呼叫 AI，金鑰只放在 Vercel 環境變數，不會送到瀏覽器。
// 設 ANTHROPIC_API_KEY（Claude）或 OPENAI_API_KEY 其中一個即可。
// 數字（完成時間、延誤、換線）一律由排程演算法算好，AI 只負責整理文字和寫說明。

const A_KEY = process.env.ANTHROPIC_API_KEY;
const A_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
const O_KEY = process.env.OPENAI_API_KEY;
const O_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// 簡單限流：有資料庫時，每個 IP 每分鐘最多 30 次，避免連結外流被濫用
const R_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const R_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
async function limited(req) {
  if (!R_URL || !R_TOKEN) return false;
  try {
    const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim();
    const key = `sl:rl:${ip}:${Math.floor(Date.now() / 60000)}`;
    const r = await fetch(R_URL + '/pipeline', {
      method: 'POST', headers: { Authorization: `Bearer ${R_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['INCR', key], ['EXPIRE', key, '70']]),
    });
    const j = await r.json();
    return Number(j[0] && j[0].result) > 30;
  } catch { return false; }
}

function provider() { return A_KEY ? 'anthropic' : O_KEY ? 'openai' : null; }

function clip(s, n) { return String(s == null ? '' : s).slice(0, n); }

function prompts(task, p) {
  if (task === 'extract') {
    return '你是電子工廠的「變更單智能體」。從業務轉貼的客戶訊息抓出欄位，只回 JSON，不要其他文字。\n' +
      '工廠：客戶甲、乙、丙；機種 A1、A2（甲）、B1、B2（乙）、C1、C2（丙）。現在工廠時間是今天 ' + clip(p.now, 10) + '。\n' +
      '欄位：cust（"甲"|"乙"|"丙"|null）、model（如 "A1" 或 null）、qty（整數或 null）、due（從今天 00:00 起算的分鐘數，明天要加 1440；沒有明確幾點就 null）、' +
      'type（"rush" 追加或改量；"ecn" 換零件或改料號；"other" 其他）、missing（缺的欄位名稱陣列，從 cust、model、qty、due 裡選；ecn 不需要 qty 和 due）、ask（要問業務的一句繁體中文，不缺就空字串）。\n' +
      '不要自己猜時間：只說「今天要」沒有幾點，due 就是 null，並在 ask 問幾點前。\n訊息：' + clip(p.text, 800);
  }
  if (task === 'explain') {
    return '你是電子工廠的「交期試算智能體」。數字已由排程演算法算好，你只負責用白話說明，不可更改或自創數字。用繁體中文，只回 JSON：' +
      '{"text":"給生管看的 2–3 句：先講建議哪個方案和理由，再講其他方案的代價","reply":"業務傳給客戶的一段回覆，客氣、具體，只承諾演算法算出的時間"}。\n' +
      '變更單：' + clip(p.order, 200) + '。現在 ' + clip(p.now, 10) + '。\n方案：\n' + clip(p.options, 1800) + '\n演算法建議：' + clip(p.pick, 4);
  }
  if (task === 'report') {
    return '你是電子工廠的「現場回饋智能體」。把課長下班前講的話整理成日報，繁體中文，只回 JSON：' +
      '{"summary":"一句話總結今天","issues":["問題1","問題2"],"tomorrow":"明天要注意的一句話"}。不要加入課長沒說、數據也沒顯示的事。\n' +
      '系統數據：' + clip(p.stats, 300) + '\n課長說：' + clip(p.text, 1200);
  }
  return null;
}

function firstJson(s) {
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('no_json');
  return JSON.parse(s.slice(a, b + 1));
}

async function callAnthropic(prompt, signal) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal,
    headers: { 'x-api-key': A_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: A_MODEL, max_tokens: 700, messages: [{ role: 'user', content: prompt }] }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error((j.error && j.error.message) || 'anthropic_' + r.status);
  return (j.content || []).map((c) => c.text || '').join('');
}

async function callOpenAI(prompt, signal) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', signal,
    headers: { Authorization: `Bearer ${O_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: O_MODEL, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error((j.error && j.error.message) || 'openai_' + r.status);
  return j.choices[0].message.content;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json({ provider: provider() });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!provider()) return res.status(503).json({ error: 'no_ai' });
  if (await limited(req)) return res.status(429).json({ error: 'rate_limited' });
  const { task, payload } = req.body || {};
  const prompt = prompts(task, payload || {});
  if (!prompt) return res.status(400).json({ error: 'bad_task' });
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const text = A_KEY ? await callAnthropic(prompt, ctl.signal) : await callOpenAI(prompt, ctl.signal);
    return res.status(200).json({ ok: true, provider: provider(), data: firstJson(text) });
  } catch (e) {
    return res.status(502).json({ error: 'ai_failed', detail: String(e && e.message || e) });
  } finally {
    clearTimeout(timer);
  }
}
