import type {
  ScriptMsg,
  Cust, Draft, Ev, Evaluation, Line, Order, Part, PlanOption, PlantState, ProjItem, World,
} from './types';

/* ---------- 常數（出自個案文件與九月紀錄） ---------- */
export const RATE = 2.5;        // SMT 每分鐘 2.5 片（24 秒／片）
export const CO = 50;           // 換線目標 50 分
export const KIT = 70;          // 一般備料 70 分
export const RUSHKIT = 90;      // 插單備料＋推料 90 分
export const FETCH = 15;        // 從倉庫推到線邊 15 分
export const YEL = 200;         // 剩 200 片亮黃燈
export const BLU = 50;          // 剩 50 片亮藍燈
export const START = 860;       // 示範從 14:20 開始
export const END = 1200;        // 20:00 收工
export const PRICE = 1200;      // 每片單價（示意）
export const ASM_RATE = 3;      // 每條線的人工站每分鐘可做 3 片（插件、測試、組裝、包裝）
export const QA_RATE = 3;       // 品保每條線每分鐘可檢 3 片
export const RETEST = 0.07;     // 九月重測比率 7%
export const RESCHED_AT = [720, 1020]; // 一天兩次重排：12:00、17:00
export const PILOT_WAIT = 30;    // 示範代按：放超過 30 分沒人處理，系統代業務、生管、課長按
/** 今天下午會陸續傳進來的客戶訊息（測試資料） */
export const SCRIPT: ScriptMsg[] = [
  { at: 872, from: '甲', ch: 'LINE', text: '甲王經理：A1 再加 300 片，今天 19:30 前要' },
  { at: 905, from: '乙', ch: 'Email', text: '乙 正式追加單：B2 200 片，交期今天 19:00' },
  { at: 940, from: '丙', ch: '電話', text: '丙：C2 的電容 C14 改新料號，從下一批開始換' },
  { at: 975, from: '老闆', ch: '口頭', text: '老闆交代：甲的 A2 先做 200 片，明天早上 10 點要' },
  { at: 1010, from: '甲', ch: '電話', text: '甲採購來電：A1 再追加 150 片，晚上 8 點要' },
  { at: 1050, from: '乙', ch: 'LINE', text: '乙：B1 加 120 片，明天下午 3 點交' },
  { at: 1100, from: '丙', ch: 'LINE', text: '丙：C1 追加 100 片，明天 12:00 要' },
];
/** 測試情境：不同的訂單組合，從輕到重 */
export const SCENARIOS: { id: string; name: string; desc: string; msgs: ScriptMsg[] }[] = [
  { id: 'normal', name: '平常日', desc: '下午 7 則追加和換料，交期大多寬鬆', msgs: SCRIPT },
  { id: 'jia', name: '甲連續追加', desc: '甲在兩個半小時內追加 5 張，全部今天要', msgs: [
    { at: 870, from: '甲', ch: 'LINE', text: '甲王經理：A1 追加 300 片，今天 18:00 要' },
    { at: 900, from: '甲', ch: '電話', text: '甲採購：A2 追加 200 片，今天 19:00 要' },
    { at: 940, from: '甲', ch: 'LINE', text: '甲王經理：A1 再加 250 片，今天 19:30 要' },
    { at: 990, from: '甲', ch: 'Email', text: '甲採購：A2 追加 150 片，今天 20:00 要' },
    { at: 1020, from: '老闆', ch: '口頭', text: '老闆交代：甲的 A1 先做 200 片，今天 20:00 要' },
  ] },
  { id: 'ecn', name: '換料＋共用料吃緊', desc: '丙連續換料兩次，同時甲乙追加都用到 0402 電容', msgs: [
    { at: 880, from: '丙', ch: '電話', text: '丙：C2 的電容 C14 改新料號，從下一批開始換' },
    { at: 900, from: '甲', ch: 'LINE', text: '甲王經理：A2 追加 400 片，今天 19:30 要' },
    { at: 920, from: '乙', ch: 'Email', text: '乙 正式追加單：B2 300 片，交期今天 19:00' },
    { at: 950, from: '丙', ch: 'LINE', text: '丙：C1 的電阻 R7 改新料號，從下一批開始換' },
    { at: 980, from: '甲', ch: '電話', text: '甲採購：A1 追加 300 片，明天 10:00 要' },
    { at: 1030, from: '乙', ch: 'LINE', text: '乙：B2 加 200 片，明天 12:00 交' },
  ] },
  { id: 'tight', name: '交期很緊', desc: '6 張追加，交期都在 2–3 小時內', msgs: [
    { at: 870, from: '乙', ch: 'Email', text: '乙 正式追加單：B1 200 片，交期今天 17:00' },
    { at: 890, from: '丙', ch: 'LINE', text: '丙：C2 追加 150 片，今天 17:30 要' },
    { at: 910, from: '甲', ch: 'LINE', text: '甲王經理：A1 追加 200 片，今天 17:30 要' },
    { at: 940, from: '乙', ch: '電話', text: '乙：B2 追加 250 片，今天 18:30 要' },
    { at: 980, from: '丙', ch: 'LINE', text: '丙：C1 追加 200 片，今天 19:00 要' },
    { at: 1020, from: '甲', ch: '電話', text: '甲採購：A2 追加 200 片，今天 19:30 要' },
  ] },
  { id: 'peak', name: '尖峰：全部一起來', desc: '12 則訊息：甲連續追加、交期很緊、換料、老闆插隊同時發生', msgs: [
    { at: 865, from: '甲', ch: 'LINE', text: '甲王經理：A1 追加 300 片，今天 18:00 要' },
    { at: 875, from: '乙', ch: 'Email', text: '乙 正式追加單：B1 200 片，交期今天 17:00' },
    { at: 885, from: '丙', ch: '電話', text: '丙：C2 的電容 C14 改新料號，從下一批開始換' },
    { at: 900, from: '丙', ch: 'LINE', text: '丙：C2 追加 150 片，今天 17:30 要' },
    { at: 915, from: '甲', ch: '電話', text: '甲採購：A2 追加 200 片，今天 19:00 要' },
    { at: 935, from: '乙', ch: '電話', text: '乙：B2 追加 250 片，今天 18:30 要' },
    { at: 950, from: '老闆', ch: '口頭', text: '老闆交代：甲的 A1 先做 200 片，今天 19:30 要' },
    { at: 970, from: '丙', ch: 'LINE', text: '丙：C1 追加 200 片，今天 19:00 要' },
    { at: 990, from: '甲', ch: 'LINE', text: '甲王經理：A1 再加 250 片，今天 20:00 要' },
    { at: 1010, from: '乙', ch: 'LINE', text: '乙：B1 加 120 片，明天下午 3 點交' },
    { at: 1040, from: '甲', ch: 'Email', text: '甲採購：A2 追加 150 片，明天 10:00 要' },
    { at: 1080, from: '丙', ch: 'LINE', text: '丙：C1 追加 100 片，明天 12:00 要' },
  ] },
];
export const OLD_CO = 77;        // 舊做法：換線時才找飛達、夾具，九月實際平均 1.28 小時
export const LANES: Record<string, number>[] = [
  { 甲: 1 }, { 甲: 1, 乙: 2 }, { 乙: 1 }, { 丙: 1, 乙: 2 },
];
export const LANE_NAME = ['甲', '甲 → 乙', '乙', '丙 → 乙'];
export const CUST_OF: Record<string, Cust> = { A: '甲', B: '乙', C: '丙' };
export const MODELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/* ---------- 小工具 ---------- */
export function hm(m: number | null | undefined): string {
  if (m == null || isNaN(m)) return '—';
  const d = m >= 1440 ? '明 ' : '';
  const x = Math.round(m) % 1440;
  return d + Math.floor(x / 60) + ':' + String(x % 60).padStart(2, '0');
}
export function clone<T>(o: T): T { return JSON.parse(JSON.stringify(o)); }
export function uid(p: string): string {
  return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
export function parseDue(s: string): number | null {
  s = (s || '').trim();
  if (!s) return null;
  const tm = /明天|明早|明/.test(s) ? 1440 : 0;
  const m = s.match(/(\d{1,2})\s*[:：點]\s*(\d{2})?/) || s.match(/^(\d{1,2})$/);
  if (!m) return null;
  let h = +m[1];
  if (/下午|晚上/.test(s) && h < 12) h += 12;
  return tm + h * 60 + +(m[2] || 0);
}

/* ---------- 事件紀錄 ---------- */
export function log(w: World, role: string, stage: string, act: string, detail: string, extra: Partial<Ev> = {}) {
  w.events.unshift({ id: uid('e'), t: w.state.clock, real: Date.now(), role, stage, act, detail, ...extra });
  if (w.events.length > 400) w.events.length = 400;
}

/* ---------- 示範資料：14:20，四條線都在生產 ---------- */
export function seed(scn = 'normal'): World {
  const O: Record<string, Order> = {};
  const o = (id: string, cust: Cust, model: string, qty: number, due: number, status: Order['status'], line: number, done = 0, extra: Partial<Order> = {}) => {
    O[id] = {
      id, cust, model, qty, done, due, tmr: due >= 1440, type: 'base', status, line,
      kit: { status: status === 'queued' ? 'todo' : 'atline' }, ...extra,
    };
  };
  o('甲-01', '甲', 'A1', 600, 780, 'done', 0, 600, { startAt: 530, doneAt: 770 });
  o('甲-02', '甲', 'A2', 600, 900, 'done', 1, 600, { startAt: 530, doneAt: 770 });
  o('乙-01', '乙', 'B1', 600, 840, 'done', 2, 600, { startAt: 530, doneAt: 770 });
  o('丙-01', '丙', 'C1', 450, 900, 'done', 3, 450, { startAt: 530, doneAt: 710 });
  o('丙-03', '丙', 'C1', 300, 1200, 'done', 3, 300, { startAt: 710, doneAt: 830 });
  o('乙-04', '乙', 'B2', 600, 2640, 'running', 0, 100, { startAt: 820, note: '明天的單，1 線填空檔' });
  o('乙-02', '乙', 'B2', 600, 1080, 'running', 1, 100, { startAt: 820 });
  o('乙-03', '乙', 'B1', 300, 1200, 'running', 2, 225, { startAt: 770 });
  o('丙-02', '丙', 'C2', 300, 1080, 'running', 3, 0, { startAt: 830 });
  o('丙-04', '丙', 'C1', 450, 2640, 'queued', 0);
  o('甲-05', '甲', 'A1', 900, 2640, 'queued', 1);
  o('乙-05', '乙', 'B1', 600, 2640, 'queued', 2, 0, { kit: { status: 'atline' } });
  o('乙-06', '乙', 'B2', 300, 2640, 'queued', 2);
  o('乙-07', '乙', 'B1', 300, 2640, 'queued', 2);
  o('丙-05', '丙', 'C2', 300, 2640, 'queued', 3, 0, { kit: { status: 'atline' } });
  o('丙-06', '丙', 'C1', 300, 2640, 'queued', 3);
  o('丙-07', '丙', 'C2', 200, 2640, 'queued', 3);
  o('甲-06', '甲', 'A2', 300, 2640, 'queued', 0);
  o('乙-08', '乙', 'B2', 300, 2640, 'queued', 1);
  o('乙-追1', '乙', 'B1', 150, 780, 'done', 2, 150, { type: 'rush', startAt: 715, doneAt: 750, raw: '乙（Email）：B1 追加 150 片，今天 13:00 要', submittedT: 590, plannedT: 598, eta: 750,
    optLabel: '方案 A：3 線同機種接著做', explain: '建議 A：3 線正在做 B1，同機種接著做不用換線，預計 12:30 完成，趕得上 13:00；其他今天的單不受影響。',
    reply: '您好，B1 150 片已排入生產，預計 12:30 完成，可於 13:00 前出貨。', replied: true });
  // 下游進度：已完成的單都已出貨；生產中的單人工站、品保落後一點
  Object.values(O).forEach((x) => {
    if (x.status === 'done') { x.asm = x.qty || 0; x.qa = x.qty || 0; x.shipped = true; x.shipAt = x.doneAt; }
    else { x.asm = Math.max(0, x.done - 40); x.qa = Math.max(0, x.done - 80); }
  });
  const mk = (i: number, cur: string, mode: Line['mode'], coLeft: number, queue: string[]): Line =>
    ({ i, cur, mode, coLeft, queue, lampY: false, lampB: false, preempt: null });
  const state: PlantState = {
    clock: START,
    lines: [mk(0, '乙-04', 'run', 0, ['丙-04', '甲-06']), mk(1, '乙-02', 'run', 0, ['甲-05', '乙-08']), mk(2, '乙-03', 'run', 0, ['乙-05', '乙-06', '乙-07']), mk(3, '丙-02', 'co', 20, ['丙-05', '丙-06', '丙-07'])],
    metrics: { co: 3, coMin: 130, waitMin: 0, idleMin: 0, out: 0, coSaved: 0 },
    ecn: {},
    seq: 2,
    forecast: {},
    parts: [
      { name: '0402 電容', stock: 2400, use: { A1: 2, A2: 2, B2: 1 } },
      { name: '主控 IC-77', stock: 1500, use: { B1: 1, C1: 1 } },
      { name: '連接器 J5', stock: 900, use: { A2: 1, C2: 1 } },
    ],
    reserved: {},
    resched: [720],
    shippedToday: Object.values(O).filter((x) => x.shipped).reduce((a, x) => a + (x.qty || 0), 0),
  };
  const w: World = { version: 1, state, orders: O, events: [], reports: [], weekly: [], inbox: [], play: { on: false, speed: 1, auto: true, by: '', beat: 0 } };
  // 早上已經發生的事（測試資料），讓紀錄、決策、出貨不是空的
  const H: [number, string, string, string, string, Partial<Ev>?][] = [
    [480, '系統', '回報', '開工', '1 線甲-01、2 線甲-02、3 線乙-01、4 線丙-01'],
    [582, '客戶', '接單', '新訊息', '乙（Email）：B1 追加 150 片，今天 13:00 要'],
    [590, '業務', '接單', '送出變更單', '乙-追1｜乙 B1 150 片｜交期 13:00', { order: '乙-追1' }],
    [598, '生管', '試算', '確認派發', '乙-追1｜方案 A：3 線同機種接著做｜預計 12:30 完成', { order: '乙-追1' }],
    [605, '業務', '派發', '已回覆客戶', '乙-追1｜您好，B1 150 片已排入生產…', { order: '乙-追1' }],
    [630, '系統', '備料', '黃燈', '4 線剩 200 片，備 丙-03 的料', { line: 3 }],
    [640, '倉庫', '備料', '開始備料', '丙-03 的料'],
    [705, '產線', '備料', '料到線邊，亮綠牌', '丙-03 → 4 線', { line: 3 }],
    [710, '產線', '生產', '完成', '丙-01 450 片', { line: 3 }],
    [720, '生管', '試算', '定時重排', '同機種排在一起，換線少 1 次（鎖住的下一張不動）'],
    [750, '產線', '生產', '完成', '乙-追1 150 片（試算 12:30，差 0 分）', { order: '乙-追1', line: 2 }],
    [770, '產線', '生產', '完成', '甲-01、甲-02、乙-01 都做完'],
    [790, '出貨', '出貨', '出貨', '乙-追1 150 片出貨（準時）', { order: '乙-追1' }],
    [830, '產線', '生產', '完成', '丙-03 300 片', { line: 3 }],
    [840, '產線', '換線', '綠牌亮，開始換線', '4 線 → 丙-02', { line: 3 }],
  ];
  H.forEach(([t, role, st, act, det, ex]) => { state.clock = t; log(w, role, st, act, det, ex || {}); });
  state.clock = START;
  const sc = SCENARIOS.find((x) => x.id === scn) || SCENARIOS[0];
  state.scenario = sc.id; state.script = sc.msgs;
  w.inbox.push({ id: 'm0', t: 582, from: '乙', ch: 'Email', text: '乙（Email）：B1 追加 150 片，今天 13:00 要', status: 'done', orderId: '乙-追1' });
  log(w, '系統', '回報', '開始示範', `14:20，四條線正在生產；情境「${sc.name}」：${sc.desc}`);
  return w;
}

/* ---------- 排程投影 ---------- */
export function kitEta(o: Order, S: PlantState): number {
  const k = o.kit || { status: 'todo' };
  const t = S.clock;
  if (k.status === 'atline') return t;
  if (k.status === 'fetching') return Math.max(t, k.fetchDone || t);
  if (k.status === 'ready') return t + FETCH;
  if (k.status === 'picking') return Math.max(t, (k.startAt || t) + (k.need || KIT)) + FETCH;
  if (k.status === 'newpart') return t + 180;
  return 0;
}

export function homeLineFor(o: Order, S: PlantState, O: Record<string, Order>, exclude: number): number | null {
  let best: number | null = null, score = 1e9;
  S.lines.forEach((L, i) => {
    if (i === exclude) return;
    const r = LANES[i][o.cust];
    if (!r) return;
    const cur = L.cur ? O[L.cur] : null;
    const sc = r * 10 + (cur && cur.model === o.model ? -15 : 0);
    if (sc < score) { score = sc; best = i; }
  });
  return best;
}

export function project(S: PlantState, O: Record<string, Order>): ProjItem[][] {
  const res: ProjItem[][] = S.lines.map(() => []);
  const moved: Record<number, { id: string; rem: number }> = {};
  const order = [0, 1, 2, 3].sort((a, b) => (S.lines[b].preempt ? 1 : 0) - (S.lines[a].preempt ? 1 : 0));
  order.forEach((i) => {
    const L = S.lines[i];
    let t = S.clock;
    let prev: string | null = null;
    const items = res[i];
    const seq: { id: string; cur?: boolean; rem?: number }[] = [];
    if (L.cur && O[L.cur]) seq.push({ id: L.cur, cur: true });
    if (moved[i]) seq.push({ id: moved[i].id, rem: moved[i].rem });
    L.queue.forEach((id) => { if (!moved[i] || moved[i].id !== id) seq.push({ id }); });
    const pre = L.preempt;
    let split = false;
    seq.forEach((it) => {
      const o = O[it.id];
      if (!o || o.status === 'done') return;
      const rem = it.rem != null ? it.rem : (o.qty || 0) - o.done;
      let st = t, coE: number | null = null, co = 0;
      if (it.cur) {
        if (L.mode === 'co') { coE = t + L.coLeft; t = coE; }
        else if (L.mode === 'wait') { t = Math.max(t, kitEta(o, S)); if (L.preCo) { coE = t + CO; t = coE; co = 1; } }
      } else if (o.model !== prev) {
        st = Math.max(t, kitEta(o, S)); coE = st + CO; t = coE; co = 1;
      }
      const end = t + rem / RATE;
      if (pre && !split && pre.at < end) {
        split = true;
        const stop = Math.max(S.clock, pre.at);
        const made = Math.max(0, Math.min(rem, (stop - t) * RATE));
        if (stop > st) items.push({ id: o.id, start: st, coEnd: coE && coE <= stop ? coE : null, end: Math.max(stop, t), part: true, co });
        const mv = homeLineFor(o, S, O, i);
        if (mv != null) moved[mv] = { id: o.id, rem: rem - made };
        const ro = O[pre.orderId];
        const rce = stop + CO, rrun = Math.max(rce, kitEta(ro, S));
        items.push({ id: ro.id, start: stop, coEnd: rce, wait: rrun - rce, end: rrun + ((ro.qty || 0) - ro.done) / RATE, co: 1 });
        t = items[items.length - 1].end; prev = ro.model;
        return;
      }
      items.push({ id: o.id, start: st, coEnd: coE, end, co });
      t = end; prev = o.model;
    });
    if (pre && !split) {
      const ro = O[pre.orderId];
      const s2 = Math.max(t, pre.at), ce2 = s2 + CO, r2 = Math.max(ce2, kitEta(ro, S));
      items.push({ id: ro.id, start: s2, coEnd: ce2, wait: r2 - ce2, end: r2 + ((ro.qty || 0) - ro.done) / RATE, co: 1 });
    }
  });
  return res;
}
export function endsOf(P: ProjItem[][]): Record<string, number> {
  const m: Record<string, number> = {};
  P.forEach((it) => it.forEach((x) => { if (!x.part) m[x.id] = x.end; }));
  return m;
}
const coCount = (P: ProjItem[][]) => P.reduce((n, it) => n + it.filter((x) => x.co).length, 0);

/* ---------- 試算 ---------- */
export function applyOpt(S: PlantState, O: Record<string, Order>, orderId: string, opt: PlanOption) {
  const o = O[orderId];
  o.status = 'planned';
  o.line = opt.line;
  if (opt.line == null) return;
  if (opt.kind === 'same') {
    S.lines[opt.line].queue.splice(0, 0, o.id);
    o.kit = { status: 'ready', startAt: S.clock, need: 20 };
  } else if (opt.kind === 'after') {
    const LL = S.lines[opt.line], q = LL.queue;
    let prev = LL.cur && O[LL.cur] ? O[LL.cur].model : null, pos = q.length;
    for (let qi = 0; qi < q.length; qi++) {
      const qo = O[q[qi]];
      if (qo && qo.model !== prev) { pos = qi + 1; break; }
      prev = qo ? qo.model : prev;
    }
    q.splice(pos, 0, o.id);
    o.kit = { status: 'todo' };
  } else if (opt.kind === 'preempt' || opt.kind === 'now') {
    const pre = (S.forecast[o.model] || 0) > 0;
    o.prestaged = pre;
    o.kit = pre ? { status: 'picking', startAt: S.clock, need: 5 } : { status: 'picking', startAt: S.clock, need: RUSHKIT - FETCH };
    S.lines[opt.line].preempt = { at: opt.stopAt ?? S.clock, orderId: o.id };
  }
}

function evaluate(S: PlantState, O: Record<string, Order>, o: Order, opt: PlanOption, base: { E: Record<string, number>; co: number }): Evaluation {
  const s = clone(S), oo = clone(O);
  applyOpt(s, oo, o.id, opt);
  const P = project(s, oo), E = endsOf(P);
  const end = E[o.id] ?? null;
  const delays: [string, number][] = [];
  let pen = 0;
  const vio: string[] = [];
  const newLate: string[] = [];
  Object.keys(E).forEach((id) => {
    const x = oo[id];
    if (!x || x.tmr || x.status === 'done' || id === o.id) return;
    const was = base.E[id];
    if (x.due != null && E[id] > x.due && !(was > x.due)) {
      newLate.push(id);
      pen += (x.qty || 0) * PRICE * (x.cust === '乙' ? 0.02 : x.cust === '丙' ? 0.01 : 0);
    }
    if (was != null && E[id] - was > 5) delays.push([id, Math.round(E[id] - was)]);
  });
  if (o.cust === '甲' && end != null && o.due != null && end > o.due) vio.push('甲的追加不能拒絕，今天卻交不出');
  let wait = 0;
  if (opt.line != null) P[opt.line].forEach((x) => { if (x.id === o.id && x.wait) wait = x.wait; });
  return {
    end, late: end != null && o.due != null && end > o.due, newLate, delays,
    pen: Math.round(pen / 1000) / 10, vio, coAdd: coCount(P) - base.co, wait: Math.round(wait),
  };
}

const blankEv: Evaluation = { end: null, late: false, newLate: [], delays: [], pen: 0, vio: [], coAdd: 0, wait: 0 };

export function makeOptions(w: World, orderId: string): PlanOption[] {
  const S = w.state, O = w.orders, o = O[orderId];
  const P0 = project(S, O);
  const base = { E: endsOf(P0), co: coCount(P0) };
  const opts: PlanOption[] = [];
  if (o.type === 'ecn') {
    const run = S.lines.filter((L) => L.cur && O[L.cur] && O[L.cur].model === o.model);
    const doneN = run.reduce((a, L) => a + Math.floor(O[L.cur!].done), 0);
    opts.push({ id: '', kind: 'nextlot', line: null, label: '下一批換新料', ev: { ...blankEv }, score: 0,
      note: '這批照舊做完，新料從下一張 ' + o.model + ' 開始，不用拆掉重做。' });
    opts.push({ id: '', kind: 'ecnnow', line: run.length ? run[0].i : null, label: '這批立刻換', ev: { ...blankEv, coAdd: run.length }, score: 10 + doneN / 10,
      note: run.length ? '做 ' + o.model + ' 的線要停下來等新料；已做的 ' + doneN + ' 片可能要拆掉重做。' : '目前沒有線在做 ' + o.model + '。' });
    return mark(opts);
  }
  const lanes = [0, 1, 2, 3].filter((i) => LANES[i][o.cust]).sort((a, b) => LANES[a][o.cust] - LANES[b][o.cust]);
  lanes.forEach((i) => {
    const c = S.lines[i].cur ? O[S.lines[i].cur!] : null;
    if (c && c.model === o.model) {
      const op: PlanOption = { id: '', kind: 'same', line: i, label: `${i + 1} 線同機種接著做`, ev: blankEv, score: 0 };
      op.ev = evaluate(S, O, o, op, base); opts.push(op);
    }
  });
  let bestAfter: PlanOption | null = null;
  lanes.forEach((i) => {
    const op: PlanOption = { id: '', kind: 'after', line: i, label: `排進 ${i + 1} 線下一個換線點`, ev: blankEv, score: 0 };
    op.ev = evaluate(S, O, o, op, base);
    if (!bestAfter || (op.ev.end ?? 1e9) < (bestAfter.ev.end ?? 1e9)) bestAfter = op;
  });
  if (bestAfter) opts.push(bestAfter);
  const pre = (S.forecast[o.model] || 0) > 0;
  const rk = pre ? FETCH + 5 : o.type === 'rush' ? RUSHKIT : KIT;
  lanes.filter((i) => LANES[i][o.cust] === 1).forEach((i) => {
    const L = S.lines[i];
    const c0 = L.cur ? O[L.cur] : null;
    if (!c0 || c0.model === o.model) return;
    const at = S.clock + rk - CO;
    const onAt = P0[i].find((x) => x.start <= at && at < x.end);
    const who = onAt ? O[onAt.id] : c0;
    if (who && who.model === o.model) return;
    const locked = (x: Order | null | undefined) => !!x && x.type === 'rush' && x.cust === '甲' && !x.tmr;   // 不能停掉另一張甲今天要的追加
    const approval = o.cust !== '甲';
    if (locked(who)) return;
    const op: PlanOption = { id: '', kind: 'preempt', line: i, stopAt: Math.max(S.clock, at), approval, stops: who.id, ev: blankEv, score: 0,
      label: pre ? `${i + 1} 線換做（料已依週預估備好，${hm(Math.max(S.clock, at))} 停 ${who.id}）` : `${i + 1} 線料到前才停（${hm(at)} 停 ${who.id}）` };
    op.ev = evaluate(S, O, o, op, base); opts.push(op);
    if (locked(c0)) return;
    const op2: PlanOption = { id: '', kind: 'now', line: i, stopAt: S.clock, approval, stops: c0.id, ev: blankEv, score: 0,
      label: `${i + 1} 線立刻停 ${c0.id}` };
    op2.ev = evaluate(S, O, o, op2, base); opts.push(op2);
  });
  // 甲爆量：1、2 線怎麼排都趕不上時，才提出「借別條線」的破例，要課長核准
  if (o.cust === '甲' && opts.length && opts.every((x) => x.ev.vio.length)) {
    [0, 1, 2, 3].filter((i) => !LANES[i][o.cust]).forEach((i) => {
      const L = S.lines[i];
      const c0 = L.cur ? O[L.cur] : null;
      if (!c0 || c0.model === o.model || (c0.type === 'rush' && c0.cust === '甲')) return;
      const at = Math.max(S.clock, S.clock + rk - CO);
      const op: PlanOption = { id: '', kind: 'preempt', line: i, stopAt: at, approval: true, stops: c0.id, ev: blankEv, score: 0,
        label: `破例：借 ${i + 1} 線（${hm(at)} 停 ${c0.id}）`, note: '1、2 線都趕不上交期，借用其他客戶的線，要課長核准。' };
      op.ev = evaluate(S, O, o, op, base); opts.push(op);
    });
  }
  opts.forEach((op) => {
    const e = op.ev;
    op.end = e.end;
    // 趕得上交期就不必搶最早完成：優先少延誤、少換線、少停別人的線；趕不上才比誰最早做完
    const lateBy = e.late && e.end != null && o.due != null ? e.end - o.due : 0;
    op.score = (e.vio.length ? 1e5 : 0) + e.newLate.length * 500 + (e.late ? 300 + lateBy : 0) + e.coAdd * 40 + (op.approval ? 40 : 0)
      + e.wait * 3 + (op.kind === 'preempt' || op.kind === 'now' ? 30 : 0) + (e.end || 0) * 0.1;
  });
  return mark(opts);
}
function mark(opts: PlanOption[]): PlanOption[] {
  opts.sort((a, b) => a.score - b.score);
  opts.forEach((op, i) => { op.id = String.fromCharCode(65 + i); op.rec = i === 0; });
  return opts;
}

/* ---------- 動作 ---------- */
export function submitOrder(w: World, f: { cust: Cust; model: string; qty: number | null; due: number | null; type: 'rush' | 'ecn' | 'other' }, raw: string, ai: boolean): string {
  const n = w.state.seq || 1;
  w.state.seq = n + 1;
  const id = `${f.cust}-${f.type === 'ecn' ? '換' : '追'}${n}`;
  w.orders[id] = {
    id, cust: f.cust, model: f.model, qty: f.qty, done: 0, due: f.due, tmr: f.due != null && f.due >= 1440,
    type: f.type, status: 'submitted', line: null, raw, ai, createdAt: Date.now(),
    msgT: w.state.clock, submittedT: w.state.clock, kit: { status: 'todo' },
  };
  log(w, '業務', '接單', '送出變更單', `${id}｜${f.cust} ${f.model}${f.qty ? ' ' + f.qty + ' 片' : ''}｜交期 ${hm(f.due)}`, { order: id });
  return id;
}

export function dispatch(w: World, orderId: string, p: PlanOption, explain: { text: string; reply: string; ai: boolean } | null) {
  const S = w.state, O = w.orders, x = O[orderId];
  x.eta = p.end ?? null;
  x.optLabel = `方案 ${p.id}：${p.label}`;
  x.opt = { ...p, ev: { ...blankEv } };
  x.explain = explain?.text || '';
  x.reply = explain?.reply || '';
  x.replyAi = !!explain?.ai;
  x.stops = p.stops || '';
  if (x.type === 'ecn') {
    x.status = 'decided';
    x.plannedT = S.clock;
    S.ecn[x.model] = p.kind;
    if (p.kind === 'ecnnow') S.lines.forEach((L) => {
      const c = L.cur ? O[L.cur] : null;
      if (c && c.model === x.model) { L.mode = 'wait'; L.preCo = false; c.kit = { status: 'newpart' }; }
    });
    log(w, '生管', '試算', '確認派發', `${orderId}｜${x.optLabel}`, { order: orderId });
    fanout(w, x, p);
    return;
  }
  if (p.approval) {
    x.status = 'approval';
    log(w, '生管', '試算', '送課長核准', `${orderId}｜${x.optLabel}｜會打斷 ${p.stops}`, { order: orderId, warn: 1 });
    return;
  }
  applyOpt(S, O, orderId, p);
  x.plannedT = S.clock;
  log(w, '生管', '試算', '確認派發', `${orderId}｜${x.optLabel}｜預計 ${hm(p.end)} 完成`, { order: orderId });
  fanout(w, x, p);
}

export function approve(w: World, orderId: string, yes: boolean) {
  const x = w.orders[orderId];
  if (!x || x.status !== 'approval' || !x.opt) return;
  if (yes) {
    applyOpt(w.state, w.orders, orderId, x.opt);
    x.plannedT = w.state.clock;
    log(w, '課長', '試算', '核准破例', `${orderId}｜${x.optLabel}`, { order: orderId });
    fanout(w, x, x.opt);
  } else {
    x.status = 'submitted';
    x.submittedT = w.state.clock;
    log(w, '課長', '試算', '退回破例', `${orderId}｜請生管改方案`, { order: orderId, warn: 1 });
  }
}

function fanout(w: World, x: Order, p: PlanOption) {
  log(w, '業務', '派發', '收到回覆草稿', `${x.id}｜${(x.reply || '').slice(0, 30)}…`, { order: x.id });
  if (x.type !== 'ecn') log(w, '倉庫', '派發', '收到料單', `${x.id}｜${x.model} × ${x.qty} → ${(p.line ?? 0) + 1} 線`, { order: x.id });
  else log(w, '倉庫', '派發', '收到換料通知', `${x.model}｜${p.kind === 'nextlot' ? '下一批換新料' : '這批立刻換'}`, { order: x.id });
  log(w, '課長', '派發', '收到排程變動', x.optLabel || '', { order: x.id });
  if (p.line != null) log(w, '產線', '派發', '看板更新', `${p.line + 1} 線｜${p.kind === 'preempt' || p.kind === 'now' ? hm(p.stopAt) + ' 停 ' + p.stops + '，換 ' + x.id : '下一張變動'}`, { order: x.id, line: p.line });
}

export function markReplied(w: World, orderId: string) {
  const x = w.orders[orderId];
  if (!x) return;
  x.replied = true;
  log(w, '業務', '派發', '已回覆客戶', `${orderId}｜${(x.reply || '').slice(0, 30)}…`, { order: orderId });
}

export function kitAction(w: World, orderId: string, a: 'start' | 'ready' | 'atline') {
  const o = w.orders[orderId], S = w.state;
  if (!o) return;
  if (a === 'start') { o.kit = { status: 'picking', startAt: S.clock, need: o.type === 'rush' ? RUSHKIT - FETCH : KIT }; reserveParts(w, o); log(w, '倉庫', '備料', '開始備料', `${orderId}｜${o.model}`, { order: orderId }); }
  if (a === 'ready') { o.kit.status = 'ready'; o.kit.readyAt = S.clock; log(w, '倉庫', '備料', '備妥', orderId, { order: orderId }); }
  if (a === 'atline') { o.kit.status = 'atline'; o.kit.atlineAt = S.clock; log(w, '倉庫', '備料', '送達線邊', `${orderId} → ${(o.line ?? 0) + 1} 線，亮綠牌`, { order: orderId }); }
}

/* ---------- 時間推進：每分鐘照規則跑 ---------- */
export function advance(w: World, mins: number | 'end' | 'next', auto: boolean, pilot = false): number {
  const S = w.state, O = w.orders;
  const OLD = S.policy === 'old';
  const COT = OLD ? OLD_CO : CO;
  const target = mins === 'end' ? END : mins === 'next' ? Math.min(END, S.clock + 90) : Math.min(END, S.clock + mins);
  let n = 0;
  const E = (role: string, stage: string, act: string, detail: string, ex: Partial<Ev> = {}) => { log(w, role, stage, act, detail, ex); n++; };
  const startNext = (L: Line, i: number, prevModel: string | null) => {
    const id = L.queue.shift();
    if (!id) { L.mode = 'idle'; L.cur = null; return; }
    const o = O[id];
    L.cur = id; o.status = 'running'; o.line = i; if (!o.startAt) o.startAt = S.clock;
    L.lampY = L.lampB = false;
    if (prevModel && o.model === prevModel) { o.kit = { status: 'atline', atlineAt: S.clock }; L.mode = 'run'; E('產線', '生產', '同機種接著做', `${i + 1} 線接 ${id}，免換線`, { order: id, line: i }); return; }
    if (OLD && !(o.kit && o.kit.status === 'atline')) {
      // 舊做法：先拆線換線，同時才叫倉庫備料
      if (!o.kit || o.kit.status === 'todo') o.kit = { status: 'picking', startAt: S.clock, need: KIT };
      L.mode = 'co'; L.coLeft = COT; S.metrics.co++; E('產線', '換線', '拆線換線，才通知倉庫備料', `${i + 1} 線 → ${id}`, { order: id, line: i, warn: 1 }); return;
    }
    if (o.kit && o.kit.status === 'atline') { L.mode = 'co'; L.coLeft = COT; S.metrics.co++; E('產線', '換線', '綠牌亮，開始換線', `${i + 1} 線 → ${id}`, { order: id, line: i }); }
    else { L.mode = 'wait'; L.preCo = true; E('產線', '換線', '料未到，先不拆線', `${i + 1} 線等 ${id} 的料`, { order: id, line: i, warn: 1 }); }
  };
  while (S.clock < target) {
    const t = S.clock;
    if (mins === 'next' && n > 0) break;
    if (!OLD && RESCHED_AT.includes(t) && !S.resched.includes(t)) { S.resched.push(t); reschedule(w, 'auto'); n++; }
    (S.script || SCRIPT).forEach((m) => { if (m.at === t) { pushMsg(w, m.from, m.ch, m.text); n++; } });
    if (pilot) n += autopilot(w);
    // 下游：人工站 → 品保 → 出貨
    S.lines.forEach((_, i) => {
      let cap = ASM_RATE, qcap = QA_RATE;
      Object.values(O).forEach((o) => {
        if (o.line !== i || o.shipped) return;
        const a0 = o.asm || 0, q0 = o.qa || 0;
        const da = Math.min(cap, o.done - a0); if (da > 0) { o.asm = a0 + da; cap -= da; }
        const dq = Math.min(qcap, (o.asm || 0) - q0); if (dq > 0) { o.qa = q0 + dq * (1 - RETEST); o.retest = (o.retest || 0) + dq * RETEST; qcap -= dq; }
        if (o.status === 'done' && (o.qa || 0) + (o.retest || 0) >= (o.qty || 0) - 0.5) {
          o.qa = o.qty || 0; o.shipped = true; o.shipAt = t; S.shippedToday += o.qty || 0;
          E('出貨', '出貨', '出貨', `${o.id} ${o.qty} 片出貨${o.due != null && !o.tmr ? (t <= o.due ? '（準時）' : '（晚 ' + (t - o.due) + ' 分）') : ''}`, { order: o.id });
        }
      });
    });
    Object.keys(O).forEach((id) => {
      const o = O[id], k = o.kit;
      if (!k || o.status === 'done') return;
      if (k.status === 'picking' && t >= (k.startAt || t) + (k.need || KIT)) { k.status = 'ready'; k.readyAt = t; E('倉庫', '備料', '備妥', `${id} 等人推到線邊`, { order: id }); }
      if (k.status === 'ready' && auto && S.lines.some((L) => L.cur === id && (L.mode === 'co' || L.mode === 'wait'))) { k.status = 'fetching'; k.fetchDone = t + FETCH; E('產線', '備料', '前段去推料', id, { order: id }); }
      if (k.status === 'fetching' && t >= (k.fetchDone || t)) { k.status = 'atline'; k.atlineAt = t; E('產線', '備料', '料到線邊，亮綠牌', `${id} → ${(o.line ?? 0) + 1} 線`, { order: id, line: o.line ?? undefined }); }
    });
    S.lines.forEach((L, i) => {
      let cur = L.cur ? O[L.cur] : null;
      if (L.preempt && t >= L.preempt.at) {
        const p = L.preempt, ro = O[p.orderId];
        if (cur) {
          const mv = homeLineFor(cur, S, O, i);
          const made = Math.floor(cur.done);
          cur.status = 'paused'; cur.split = (cur.split || 0) + 1;
          if (mv != null) { cur.line = mv; S.lines[mv].queue.unshift(cur.id); cur.kit = { status: 'ready', startAt: t, need: 0 }; }
          E('生管', '換線', '停線拆批', `${cur.id} 做到 ${made} 片先停，剩 ${(cur.qty || 0) - made} 片回 ${mv != null ? mv + 1 + ' 線' : '待排'}`, { order: cur.id, line: i });
          E('品保', '品保', '記子批號', `${cur.id} 拆成兩段，子批 -1：${made} 片`, { order: cur.id });
        }
        L.cur = ro.id; ro.status = 'running'; ro.startAt = t; ro.line = i;
        L.mode = 'co'; L.coLeft = COT; L.preempt = null; L.lampY = L.lampB = false; S.metrics.co++;
        E('產線', '換線', '開始換線', `${i + 1} 線 → ${ro.id}（${ro.model}）`, { order: ro.id, line: i });
        cur = ro;
      }
      if (!cur) L.mode = 'idle';
      if (L.mode === 'idle' && L.queue.length) { startNext(L, i, null); cur = L.cur ? O[L.cur] : null; }
      if (L.mode === 'idle' || !cur) { S.metrics.idleMin++; return; }
      if (L.mode === 'co') {
        L.coLeft--; S.metrics.coMin++;
        if (L.coLeft <= 0) {
          if (cur.kit && cur.kit.status !== 'atline') { L.mode = 'wait'; L.preCo = false; E('產線', '換線', '換好線，料還沒到', `${i + 1} 線等 ${cur.id}`, { order: cur.id, line: i, warn: 1 }); }
          else { L.mode = 'run'; E('產線', '生產', '開始生產', `${i + 1} 線做 ${cur.id}`, { order: cur.id, line: i }); }
        }
        return;
      }
      if (L.mode === 'wait') {
        S.metrics.waitMin++;
        if (cur.kit && cur.kit.status === 'atline') {
          if (L.preCo) { L.mode = 'co'; L.coLeft = COT; L.preCo = false; S.metrics.co++; E('產線', '換線', '綠牌亮，開始換線', `${i + 1} 線 → ${cur.id}`, { order: cur.id, line: i }); }
          else { L.mode = 'run'; E('產線', '生產', '料到，開始生產', `${i + 1} 線做 ${cur.id}`, { order: cur.id, line: i }); }
        } else if (auto && cur.kit && cur.kit.status === 'todo') { cur.kit = { status: 'picking', startAt: t, need: KIT }; E('倉庫', '備料', '開始備料', cur.id, { order: cur.id }); }
        else if (auto && cur.kit && cur.kit.status === 'ready') { cur.kit.status = 'fetching'; cur.kit.fetchDone = t + FETCH; E('產線', '備料', '前段去推料', cur.id, { order: cur.id }); }
        return;
      }
      // run
      cur.done = Math.min(cur.qty || 0, cur.done + RATE);
      S.metrics.out += RATE;
      const rem = (cur.qty || 0) - cur.done;
      const nx = L.queue[0] ? O[L.queue[0]] : null;
      if (nx && nx.model !== cur.model) {
        if (!OLD && rem <= YEL && !L.lampY) { L.lampY = true; E('系統', '備料', '黃燈', `${i + 1} 線剩 ${Math.ceil(rem)} 片，備 ${nx.id} 的料`, { order: nx.id, line: i }); }
        if (L.lampY && auto && nx.kit && nx.kit.status === 'todo') { nx.kit = { status: 'picking', startAt: t, need: KIT }; reserveParts(w, nx); E('倉庫', '備料', '開始備料', `${nx.id} 的料`, { order: nx.id }); }
        if (!OLD && rem <= BLU && !L.lampB) { L.lampB = true; E('系統', '備料', '藍燈', `${i + 1} 線剩 ${Math.ceil(rem)} 片，前段去帶 ${nx.id} 的料`, { order: nx.id, line: i }); }
        if (L.lampB && auto && nx.kit && nx.kit.status === 'ready') { nx.kit.status = 'fetching'; nx.kit.fetchDone = t + FETCH; E('產線', '備料', '前段去推料', nx.id, { order: nx.id }); }
      }
      if (rem <= 0) {
        cur.status = 'done'; cur.doneAt = t + 1;
        const lateMin = cur.tmr || cur.due == null ? 0 : t + 1 - cur.due;
        E('產線', '生產', '完成', `${cur.id} ${cur.qty} 片${lateMin > 0 ? '，晚 ' + lateMin + ' 分' : ''}${cur.eta ? '（試算 ' + hm(cur.eta) + '，差 ' + Math.abs(Math.round(t + 1 - cur.eta)) + ' 分）' : ''}`, { order: cur.id, line: i, warn: lateMin > 0 ? 1 : 0 });
        if (cur.type !== 'base') E('出貨', '出貨', '可出貨', `${cur.id} 已完成`, { order: cur.id });
        L.cur = null; L.mode = 'idle'; L.lampY = L.lampB = false;
        startNext(L, i, cur.model);
      }
    });
    S.clock++;
  }
  return n;
}

/* ---------- 甲週預估 ---------- */
export function setForecast(w: World, model: string, qty: number) {
  if (qty > 0) w.state.forecast[model] = qty; else delete w.state.forecast[model];
  log(w, '業務', '接單', '更新甲週預估', qty > 0 ? `${model} 本週預估追加 ${qty} 片 → 1 線旁先備 ${model} 的料` : `${model} 取消預估`);
}

/* ---------- 共用料 ---------- */
function partNeed(p: Part, o: Order) { return (p.use[o.model] || 0) * Math.max(0, (o.qty || 0) - o.done); }
export function reserveParts(w: World, o: Order) {
  const r: Record<string, number> = {};
  w.state.parts.forEach((p) => { const n = partNeed(p, o); if (n > 0) { r[p.name] = n; } });
  w.state.reserved[o.id] = r;
}
export interface Conflict { part: string; stock: number; need: number; orders: string[] }
export function conflicts(w: World): Conflict[] {
  const S = w.state, O = w.orders, out: Conflict[] = [];
  // 會用到料的單：正在做、各線下一張、已排程的插單
  const ids = new Set<string>();
  S.lines.forEach((L) => { if (L.cur) ids.add(L.cur); if (L.queue[0]) ids.add(L.queue[0]); });
  Object.values(O).forEach((o) => { if (o.status === 'planned') ids.add(o.id); });
  S.parts.forEach((p) => {
    let need = 0; const who: string[] = [];
    ids.forEach((id) => { const o = O[id]; if (!o || o.status === 'done') return; const n = partNeed(p, o); if (n > 0) { need += n; who.push(id); } });
    if (need > p.stock && who.length > 1) out.push({ part: p.name, stock: p.stock, need, orders: who });
  });
  return out;
}

/* ---------- 一天兩次重排：只動沒鎖住的單，同機種排在一起 ---------- */
export function reschedule(w: World, by: string): number {
  const S = w.state, O = w.orders;
  const before = project(S, O).reduce((n, it) => n + it.filter((x) => x.co).length, 0);
  S.lines.forEach((L) => {
    if (L.queue.length <= 2) return;
    const locked = L.queue[0];
    const rest = L.queue.slice(1);
    const order: string[] = [];
    let prev = O[locked]?.model;
    while (rest.length) {
      let k = rest.findIndex((id) => O[id]?.model === prev);
      if (k < 0) k = 0;
      const id = rest.splice(k, 1)[0];
      order.push(id); prev = O[id]?.model;
    }
    L.queue = [locked, ...order];
  });
  const after = project(S, O).reduce((n, it) => n + it.filter((x) => x.co).length, 0);
  const saved = Math.max(0, before - after);
  S.metrics.coSaved += saved;
  log(w, '生管', '試算', by === 'auto' ? '定時重排' : '手動重排', saved ? `同機種排在一起，換線少 ${saved} 次（鎖住的下一張不動）` : '目前排法已是最少換線，不用動');
  return saved;
}

/* ---------- 週檢討用的統計 ---------- */
export function weekStats(w: World) {
  const m = w.state.metrics;
  const avgCo = m.co ? Math.round(m.coMin / m.co) : 0;
  const est = Object.values(w.orders).filter((o) => o.status === 'done' && o.eta);
  const err = est.length ? Math.round(est.reduce((a, o) => a + Math.abs((o.doneAt || 0) - (o.eta || 0)), 0) / est.length) : null;
  const exc = w.events.filter((e) => e.act === '核准破例').length;
  const done = Object.values(w.orders).filter((o) => o.status === 'done' && !o.tmr && o.due != null);
  const ontime = done.length ? Math.round(done.filter((o) => (o.doneAt || 0) <= o.due!).length / done.length * 100) : null;
  const text = `換線 ${m.co} 次、平均每次 ${avgCo} 分（試算參數 ${CO} 分）；等料 ${m.waitMin} 分；重排省下換線 ${m.coSaved} 次；` +
    `準時率 ${ontime ?? '—'}%；試算平均誤差 ${err ?? '—'} 分；破例 ${exc} 次；變更單 ${Object.values(w.orders).filter((o) => o.type !== 'base').length} 張`;
  const suggest: string[] = [];
  if (avgCo > CO + 5) suggest.push(`實際換線平均 ${avgCo} 分，比試算用的 ${CO} 分多，建議把參數調成 ${avgCo} 分`);
  if (m.waitMin > 30) suggest.push(`等料 ${m.waitMin} 分，建議黃燈門檻從 ${YEL} 片提早到 ${YEL + 50} 片`);
  if (exc > 1) suggest.push(`破例 ${exc} 次，週會檢討是否有人繞過規則`);
  if (!suggest.length) suggest.push('參數維持不變');
  return { text, suggest, avgCo };
}

/* ---------- 指標與異常 ---------- */
export interface Alert { lv: 'bad' | 'warn'; role: string; text: string }
export function alerts(w: World): Alert[] {
  const S = w.state, O = w.orders, a: Alert[] = [];
  Object.values(O).forEach((o) => {
    if (o.status === 'submitted' && S.clock - (o.submittedT ?? S.clock) > 30) a.push({ lv: 'bad', role: '生管', text: `${o.id} 送出 ${S.clock - (o.submittedT ?? S.clock)} 分未確認` });
    if (o.status === 'approval') a.push({ lv: 'warn', role: '課長', text: `${o.id} 等候核准` });
    if (o.status === 'planned' && !o.replied && o.type !== 'base') a.push({ lv: 'warn', role: '業務', text: `${o.id} 尚未回覆客戶` });
    if (o.status !== 'done' && !o.tmr && o.due != null && o.eta && o.eta > o.due) a.push({ lv: 'bad', role: '生管', text: `${o.id} 預計 ${hm(o.eta)} 完成，超過交期` });
    if (o.status === 'done' && o.eta && o.doneAt && Math.abs(o.doneAt - o.eta) > 60) a.push({ lv: 'warn', role: '工程', text: `${o.id} 實際與試算差 ${Math.abs(Math.round(o.doneAt - o.eta))} 分` });
  });
  conflicts(w).forEach((c) => a.push({ lv: 'warn', role: '倉庫', text: `共用料不足：${c.part} 需要 ${c.need.toLocaleString()}、庫存 ${c.stock.toLocaleString()}（${c.orders.join('、')}）` }));
  S.lines.forEach((L, i) => {
    const c = L.cur ? O[L.cur] : null;
    if (L.mode === 'wait') a.push({ lv: 'bad', role: '倉庫', text: `${i + 1} 線等料${c ? '（' + c.id + '）' : ''}` });
    const nx = L.queue[0] ? O[L.queue[0]] : null;
    if (L.lampB && nx && nx.kit && nx.kit.status === 'todo') a.push({ lv: 'bad', role: '倉庫', text: `${i + 1} 線已藍燈，${nx.id} 還沒備料` });
    if (L.mode === 'idle' && S.clock < END) a.push({ lv: 'warn', role: '生管', text: `${i + 1} 線空著` });
  });
  return a;
}

export interface Metric { label: string; value: string; target: string; st: '' | 'ok' | 'warn' | 'bad' }
export function metrics(w: World): Metric[] {
  const S = w.state, O = w.orders, m = S.metrics;
  const ch = Object.values(O).filter((o) => o.type !== 'base' && o.plannedT != null && o.msgT != null);
  const lag = ch.length ? Math.round(ch.reduce((a, o) => a + (o.plannedT! - o.msgT!), 0) / ch.length) : null;
  const done = Object.values(O).filter((o) => o.status === 'done' && !o.tmr && o.due != null);
  const ontime = done.length ? Math.round(done.filter((o) => (o.doneAt || 0) <= o.due!).length / done.length * 100) : null;
  const est = Object.values(O).filter((o) => o.status === 'done' && o.eta);
  const acc = est.length ? Math.round(est.filter((o) => Math.abs((o.doneAt || 0) - o.eta!) <= 60).length / est.length * 100) : null;
  const exc = w.events.filter((e) => e.act === '核准破例').length;
  return [
    { label: '準時率', value: ontime == null ? '—' : ontime + '%', target: '≥ 90%', st: ontime == null ? '' : ontime >= 90 ? 'ok' : 'bad' },
    { label: '換線', value: m.co + ' 次', target: '每天 ≤ 4 次', st: m.co <= 4 ? 'ok' : m.co <= 6 ? 'warn' : 'bad' },
    { label: '等料', value: m.waitMin + ' 分', target: '每天 ≤ 90 分', st: m.waitMin <= 90 ? 'ok' : 'bad' },
    { label: '變更到派發', value: lag == null ? '—' : lag + ' 分', target: '≤ 30 分', st: lag == null ? '' : lag <= 30 ? 'ok' : 'bad' },
    { label: '試算準確', value: acc == null ? '—' : acc + '%', target: '誤差 ≤ 1 小時 ≥ 80%', st: acc == null ? '' : acc >= 80 ? 'ok' : 'warn' },
    { label: '破例', value: exc + ' 次', target: '每週 ≤ 1 次', st: exc <= 1 ? 'ok' : 'warn' },
    { label: '產出', value: Math.round(m.out).toLocaleString() + ' 片', target: '14:20 起累計', st: '' },
    { label: '換線時間', value: m.coMin + ' 分', target: '每次 ≤ 50 分', st: m.co ? (m.coMin / m.co <= 50 ? 'ok' : 'warn') : '' },
  ];
}

/* ---------- AI 失敗時的規則版 ---------- */
export function ruleExtract(text: string): Draft {
  const r: Draft = { cust: null, model: null, qty: null, due: null, type: 'rush', missing: [], ask: '' };
  let m = text.match(/[甲乙丙]/);
  if (m) r.cust = m[0] as Cust;
  m = text.match(/([ABC])\s*([12])/i);
  if (m) { r.model = (m[1] + m[2]).toUpperCase(); if (!r.cust) r.cust = CUST_OF[r.model[0]]; }
  const nums = (text.match(/\d+/g) || []).map(Number).filter((n) => n >= 50 && n <= 5000);
  if (nums.length) r.qty = nums[0];
  if (/換|料號|改用|設計變更|新料/.test(text)) r.type = 'ecn';
  const t = text.match(/(\d{1,2})\s*[:：點]\s*(\d{2})?/);
  const tomorrow = /明天|明早/.test(text);
  if (t) { let h = +t[1]; if (/下午|晚上/.test(text) && h < 12) h += 12; r.due = (tomorrow ? 1440 : 0) + h * 60 + +(t[2] || 0); }
  if (r.type === 'ecn') { r.qty = null; r.due = null; }
  if (!r.cust) r.missing.push('cust');
  if (!r.model) r.missing.push('model');
  if (r.type !== 'ecn') { if (!r.qty) r.missing.push('qty'); if (r.due == null) r.missing.push('due'); }
  const nm: Record<string, string> = { cust: '客戶', model: '機種', qty: '數量', due: '交期' };
  r.ask = r.missing.length ? '請補：' + r.missing.map((k) => nm[k]).join('、') : '';
  return r;
}

export function ruleExplain(o: Order, opts: PlanOption[], p: PlanOption): { text: string; reply: string } {
  const e = p.ev;
  let text = `建議 ${p.id}：${p.label}。`;
  if (p.end) text += `預計 ${hm(p.end)} 完成${o.due != null ? (p.end <= o.due ? '，趕得上交期。' : '，會超過交期。') : '。'}`;
  text += e.newLate.length ? `會讓 ${e.newLate.join('、')} 延誤。` : '其他今天的單不受影響。';
  if (e.wait) text += `換好線要等料 ${e.wait} 分。`;
  const bad = opts.filter((x) => x.ev.vio.length);
  if (bad.length) text += `方案 ${bad.map((x) => x.id).join('、')} 違反規則。`;
  const reply = o.type === 'ecn'
    ? `您好，${o.model} 換料通知已收到，我們會${p.kind === 'nextlot' ? '從下一批開始使用新料' : '這批立即換新料'}，有變動再與您確認。`
    : `您好，${o.model} ${o.qty} 片已排入生產，預計 ${hm(p.end)} 完成，${p.end != null && o.due != null && p.end <= o.due ? '可於 ' + hm(o.due) + ' 前出貨' : '會比需求時間稍晚，再與您討論'}。`;
  return { text, reply };
}

export function optBrief(opts: PlanOption[]): string {
  return opts.map((p) => `${p.id}：${p.label}；完成 ${hm(p.end)}；新增延誤 ${p.ev.newLate.join('、') || '無'}；增加換線 ${p.ev.coAdd}；違規 ${p.ev.vio.join('、') || '無'}${p.approval ? '；需課長核准' : ''}${p.ev.wait ? '；換好線等料 ' + p.ev.wait + ' 分' : ''}${p.note ? '；' + p.note : ''}`).join('\n');
}

/* ---------- 客戶訊息（收件匣） ---------- */
export function pushMsg(w: World, from: string, ch: string, text: string, test = false) {
  if (!w.inbox) w.inbox = [];
  w.inbox.unshift({ id: uid('m'), t: w.state.clock, from, ch, text, status: 'new', test });
  log(w, '客戶', '接單', '新訊息', `${from}（${ch}）：${text}`);
}
export function msgToOrder(w: World, msgId: string, orderId: string) {
  const m = w.inbox.find((x) => x.id === msgId);
  if (m) { m.status = 'done'; m.orderId = orderId; const o = w.orders[orderId]; if (o) o.msgT = m.t; }
}
export function skipMsg(w: World, msgId: string) {
  const m = w.inbox.find((x) => x.id === msgId);
  if (m) { m.status = 'skip'; log(w, '業務', '接單', '不用處理', `${m.from}：${m.text.slice(0, 24)}`); }
}

/** 隨機丟一則測試訂單訊息 */
export function testMessage(w: World) {
  const S = w.state;
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
  const who = pick(['甲', '甲', '乙', '乙', '丙', '老闆'] as const);
  const real: Cust = who === '老闆' ? pick(['甲', '乙'] as const) : who;
  const model = pick(MODELS.filter((m) => CUST_OF[m[0]] === real));
  const qty = pick([100, 150, 200, 250, 300, 400]);
  const ecn = real === '丙' && Math.random() < 0.35;
  const cand = Math.ceil((S.clock + 150 + Math.floor(Math.random() * 4) * 30) / 30) * 30;
  const due = cand <= 1200 && Math.random() < 0.6 ? cand : 1440 + pick([600, 720, 900]);
  const tt = `${Math.floor((due % 1440) / 60)}:${String(due % 60).padStart(2, '0')}`;
  const when = due >= 1440 ? `明天 ${tt}` : `今天 ${tt}`;
  const ch = pick(['LINE', '電話', 'Email']);
  const text = ecn ? `丙：${model} 的電阻 R${pick([7, 12, 21])} 改新料號，從下一批開始換`
    : who === '老闆' ? `老闆交代：${real}的 ${model} 先做 ${qty} 片，${when} 要`
      : `${real}${pick(['採購', '王經理', '窗口'])}：${model} 追加 ${qty} 片，${when} 要`;
  pushMsg(w, who, ch, text, true);
}

/** 示範代按：放太久沒人處理，系統照規則代按（業務送單、生管選建議方案、課長核准、業務回覆） */
function autopilot(w: World): number {
  const S = w.state, t = S.clock;
  let n = 0;
  const note = (who: string, what: string, id?: string) => { log(w, '系統', '派發', '示範代按', `${who}放了 ${PILOT_WAIT} 分沒人處理，系統代按：${what}`, id ? { order: id } : {}); n++; };
  (w.inbox || []).forEach((m) => {
    if (m.status !== 'new' || t - m.t < PILOT_WAIT) return;
    const d = ruleExtract(m.text);
    if (d.missing.length || !d.cust || !d.model) { m.status = 'skip'; note('業務', `${m.from} 的訊息缺${d.ask.replace('請補：', '')}，先標成要人工確認`); return; }
    const id = submitOrder(w, { cust: d.cust, model: d.model, qty: d.qty, due: d.due, type: d.type }, m.text, false);
    msgToOrder(w, m.id, id);
    note('業務', `把 ${m.from} 的訊息整理成 ${id} 送給生管`, id);
  });
  Object.values(w.orders).forEach((o) => {
    if (o.status === 'submitted' && t - (o.submittedT ?? t) >= PILOT_WAIT) {
      const opts = makeOptions(w, o.id);
      const p = opts.find((x) => !x.ev.vio.length) || opts[0];
      const ex = ruleExplain(o, opts, p);
      dispatch(w, o.id, p, { text: ex.text, reply: ex.reply, ai: false });
      note('生管', `${o.id} 選建議的方案 ${p.id}`, o.id);
    } else if (o.status === 'approval' && t - (o.submittedT ?? t) >= PILOT_WAIT * 2) {
      approve(w, o.id, true);
      note('課長', `核准 ${o.id} 的破例`, o.id);
    } else if (o.type !== 'base' && o.reply && !o.replied && o.plannedT != null && t - o.plannedT >= PILOT_WAIT) {
      markReplied(w, o.id);
      note('業務', `回覆客戶 ${o.id}`, o.id);
    }
  });
  return n;
}
