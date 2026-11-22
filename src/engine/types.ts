export type Cust = '甲' | '乙' | '丙';
export type KitStatus = 'todo' | 'picking' | 'ready' | 'fetching' | 'atline' | 'newpart';
export type OrderStatus =
  | 'draft' | 'submitted' | 'approval' | 'planned' | 'queued'
  | 'running' | 'paused' | 'done' | 'decided';
export type OrderType = 'base' | 'rush' | 'ecn' | 'other';
export type LineMode = 'run' | 'co' | 'wait' | 'idle';
export type OptKind = 'same' | 'after' | 'preempt' | 'now' | 'nextlot' | 'ecnnow';

export interface Kit {
  status: KitStatus;
  startAt?: number;
  need?: number;
  readyAt?: number;
  fetchDone?: number;
  atlineAt?: number;
}

export interface Order {
  id: string;
  cust: Cust;
  model: string;
  qty: number | null;
  done: number;
  due: number | null;
  tmr: boolean;
  type: OrderType;
  status: OrderStatus;
  line: number | null;
  kit: Kit;
  startAt?: number;
  doneAt?: number;
  raw?: string;
  ai?: boolean;
  createdAt?: number;
  msgT?: number;
  submittedT?: number;
  plannedT?: number;
  eta?: number | null;
  optLabel?: string;
  opt?: PlanOption;
  explain?: string;
  reply?: string;
  replyAi?: boolean;
  replied?: boolean;
  stops?: string;
  split?: number;
  note?: string;
}

export interface Preempt { at: number; orderId: string }

export interface Line {
  i: number;
  cur: string | null;
  mode: LineMode;
  coLeft: number;
  queue: string[];
  lampY: boolean;
  lampB: boolean;
  preempt: Preempt | null;
  preCo?: boolean;
}

export interface Metrics { co: number; coMin: number; waitMin: number; idleMin: number; out: number }

export interface PlantState {
  clock: number;
  lines: Line[];
  metrics: Metrics;
  ecn: Record<string, string>;
  seq: number;
}

export interface Ev {
  id: string;
  t: number;
  real: number;
  role: string;
  stage: string;
  act: string;
  detail: string;
  order?: string;
  line?: number;
  warn?: number;
}

export interface Report {
  id: string;
  t: number;
  real: number;
  summary: string;
  issues: string[];
  tomorrow: string;
  ai: boolean;
  raw: string;
}

export interface World {
  version: number;
  state: PlantState;
  orders: Record<string, Order>;
  events: Ev[];
  reports: Report[];
}

export interface Evaluation {
  end: number | null;
  late: boolean;
  newLate: string[];
  delays: [string, number][];
  pen: number;
  vio: string[];
  coAdd: number;
  wait: number;
}

export interface PlanOption {
  id: string;
  kind: OptKind;
  line: number | null;
  label: string;
  stopAt?: number;
  approval?: boolean;
  stops?: string;
  note?: string;
  end?: number | null;
  ev: Evaluation;
  score: number;
  rec?: boolean;
}

export interface ProjItem {
  id: string;
  start: number;
  coEnd: number | null;
  end: number;
  co: number;
  wait?: number;
  part?: boolean;
}

export interface Draft {
  cust: Cust | null;
  model: string | null;
  qty: number | null;
  due: number | null;
  type: 'rush' | 'ecn' | 'other';
  missing: string[];
  ask: string;
}
