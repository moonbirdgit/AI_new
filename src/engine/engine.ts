import type {
  Cust, Draft, Ev, Evaluation, Line, Order, PlanOption, PlantState, ProjItem, World,
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
export function seed(): World {
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
  o('丙-05', '丙', 'C2', 300, 2640, 'queued', 3, 0, { kit: { status: 'atline' } });
  const mk = (i: number, cur: string, mode: Line['mode'], coLeft: number, queue: string[]): Line =>
    ({ i, cur, mode, coLeft, queue, lampY: false, lampB: false, preempt: null });
  const state: PlantState = {
    clock: START,
    lines: [mk(0, '乙-04', 'run', 0, ['丙-04']), mk(1, '乙-02', 'run', 0, ['甲-05']), mk(2, '乙-03', 'run', 0, ['乙-05']), mk(3, '丙-02', 'co', 20, ['丙-05'])],
    metrics: { co: 3, coMin: 130, waitMin: 0, idleMin: 0, out: 0 },
    ecn: {},
    seq: 1,
  };
  const w: World = { version: 1, state, orders: O, events: [], reports: [] };
  log(w, '系統', '回報', '開始示範', '14:20，四條線正在生產');
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
    o.kit = { status: 'picking', startAt: S.clock, need: RUSHKIT - FETCH };
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
  const rk = o.type === 'rush' ? RUSHKIT : KIT;
  lanes.filter((i) => LANES[i][o.cust] === 1).forEach((i) => {
    const L = S.lines[i];
    const c0 = L.cur ? O[L.cur] : null;
    if (!c0 || c0.model === o.model) return;
    const at = S.clock + rk - CO;
    const onAt = P0[i].find((x) => x.start <= at && at < x.end);
    const who = onAt ? O[onAt.id] : c0;
    if (who && who.model === o.model) return;
    const approval = o.cust !== '甲';
    const op: PlanOption = { id: '', kind: 'preempt', line: i, stopAt: at, approval, stops: who.id, ev: blankEv, score: 0,
      label: `${i + 1} 線料到前才停（${hm(at)} 停 ${who.id}）` };
    op.ev = evaluate(S, O, o, op, base); opts.push(op);
    const op2: PlanOption = { id: '', kind: 'now', line: i, stopAt: S.clock, approval, stops: c0.id, ev: blankEv, score: 0,
      label: `${i + 1} 線立刻停 ${c0.id}` };
    op2.ev = evaluate(S, O, o, op2, base); opts.push(op2);
  });
  opts.forEach((op) => {
    const e = op.ev;
    op.end = e.end;
    op.score = (e.vio.length ? 1e5 : 0) + e.newLate.length * 500 + (e.late ? 300 : 0) + (e.end || 0) + e.coAdd * 20 + (op.approval ? 40 : 0) + e.wait * 3;
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
  if (a === 'start') { o.kit = { status: 'picking', startAt: S.clock, need: o.type === 'rush' ? RUSHKIT - FETCH : KIT }; log(w, '倉庫', '備料', '開始備料', `${orderId}｜${o.model}`, { order: orderId }); }
  if (a === 'ready') { o.kit.status = 'ready'; o.kit.readyAt = S.clock; log(w, '倉庫', '備料', '備妥', orderId, { order: orderId }); }
  if (a === 'atline') { o.kit.status = 'atline'; o.kit.atlineAt = S.clock; log(w, '倉庫', '備料', '送達線邊', `${orderId} → ${(o.line ?? 0) + 1} 線，亮綠牌`, { order: orderId }); }
}

/* ---------- 時間推進：每分鐘照規則跑 ---------- */
export function advance(w: World, mins: number | 'end', auto: boolean): number {
  const S = w.state, O = w.orders;
  const target = mins === 'end' ? END : Math.min(END, S.clock + mins);
  let n = 0;
  const E = (role: string, stage: string, act: string, detail: string, ex: Partial<Ev> = {}) => { log(w, role, stage, act, detail, ex); n++; };
  const startNext = (L: Line, i: number, prevModel: string | null) => {
    const id = L.queue.shift();
    if (!id) { L.mode = 'idle'; L.cur = null; return; }
    const o = O[id];
    L.cur = id; o.status = 'running'; o.line = i; if (!o.startAt) o.startAt = S.clock;
    L.lampY = L.lampB = false;
    if (prevModel && o.model === prevModel) { o.kit = { status: 'atline', atlineAt: S.clock }; L.mode = 'run'; E('產線', '生產', '同機種接著做', `${i + 1} 線接 ${id}，免換線`, { order: id, line: i }); return; }
    if (o.kit && o.kit.status === 'atline') { L.mode = 'co'; L.coLeft = CO; S.metrics.co++; E('產線', '換線', '綠牌亮，開始換線', `${i + 1} 線 → ${id}`, { order: id, line: i }); }
    else { L.mode = 'wait'; L.preCo = true; E('產線', '換線', '料未到，先不拆線', `${i + 1} 線等 ${id} 的料`, { order: id, line: i, warn: 1 }); }
  };
  while (S.clock < target) {
    const t = S.clock;
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
        L.mode = 'co'; L.coLeft = CO; L.preempt = null; L.lampY = L.lampB = false; S.metrics.co++;
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
          if (L.preCo) { L.mode = 'co'; L.coLeft = CO; L.preCo = false; S.metrics.co++; E('產線', '換線', '綠牌亮，開始換線', `${i + 1} 線 → ${cur.id}`, { order: cur.id, line: i }); }
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
        if (rem <= YEL && !L.lampY) { L.lampY = true; E('系統', '備料', '黃燈', `${i + 1} 線剩 ${Math.ceil(rem)} 片，備 ${nx.id} 的料`, { order: nx.id, line: i }); }
        if (L.lampY && auto && nx.kit && nx.kit.status === 'todo') { nx.kit = { status: 'picking', startAt: t, need: KIT }; E('倉庫', '備料', '開始備料', `${nx.id} 的料`, { order: nx.id }); }
        if (rem <= BLU && !L.lampB) { L.lampB = true; E('系統', '備料', '藍燈', `${i + 1} 線剩 ${Math.ceil(rem)} 片，前段去帶 ${nx.id} 的料`, { order: nx.id, line: i }); }
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
