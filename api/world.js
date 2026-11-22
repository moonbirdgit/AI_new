// 共用資料：每個「房間」一份資料，存在 Upstash Redis（Vercel Marketplace 一鍵加入）
// 用版本號做樂觀鎖：兩個人同時按，後到的會拿到最新資料重做，不會互相蓋掉。

const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL = 60 * 60 * 24 * 7; // 房間保留 7 天

const CAS = `
local v = redis.call('GET', KEYS[2])
if v and tonumber(v) ~= tonumber(ARGV[2]) then
  return {0, redis.call('GET', KEYS[1]) or ''}
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ${TTL})
redis.call('SET', KEYS[2], ARGV[3], 'EX', ${TTL})
return {1, ''}
`;

async function redis(cmd) {
  const r = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL || !TOKEN) return res.status(503).json({ error: 'no_store' });
  const room = String((req.query && req.query.room) || (req.body && req.body.room) || '');
  if (!/^[a-z0-9]{4,16}$/.test(room)) return res.status(400).json({ error: 'bad_room' });
  const kW = `sl:world:${room}`, kV = `sl:ver:${room}`;
  try {
    if (req.method === 'GET') {
      const v = await redis(['GET', kV]);
      if (v != null && req.query.v != null && String(v) === String(req.query.v)) {
        return res.status(200).json({ same: true, version: Number(v) });
      }
      const w = await redis(['GET', kW]);
      return res.status(200).json({ world: w ? JSON.parse(w) : null });
    }
    if (req.method === 'POST') {
      const { base, world } = req.body || {};
      if (!world || typeof world.version !== 'number') return res.status(400).json({ error: 'bad_world' });
      const s = JSON.stringify(world);
      if (s.length > 900000) return res.status(413).json({ error: 'too_large' });
      const r = await redis(['EVAL', CAS, '2', kW, kV, s, String(base ?? -1), String(world.version)]);
      if (Number(r[0]) === 1) return res.status(200).json({ ok: true, version: world.version });
      return res.status(409).json({ error: 'conflict', world: r[1] ? JSON.parse(r[1]) : null });
    }
    return res.status(405).json({ error: 'method' });
  } catch (e) {
    return res.status(500).json({ error: 'store_failed', detail: String(e && e.message || e) });
  }
}
