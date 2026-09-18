export type SampleFn = (x: number, t: number) => number;

export interface CompileResult {
  ok: true;
  fn: SampleFn;
  expression: string;
}

export interface CompileError {
  ok: false;
  error: string;
  expression: string;
}

export type CompileOutcome = CompileResult | CompileError;

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'id'; value: string }
  | { kind: 'op'; value: string }
  | { kind: 'lparen' }
  | { kind: 'rparen' }
  | { kind: 'comma' };

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  abs: Math.abs,
  sqrt: Math.sqrt,
  exp: Math.exp,
  log: Math.log,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  tanh: Math.tanh,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  pow: Math.pow,
  min: Math.min,
  max: Math.max,
  sign: Math.sign,
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  tau: Math.PI * 2,
  e: Math.E,
};

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i + 1;
      while (j < input.length && /[0-9.]/.test(input[j])) j += 1;
      const raw = input.slice(i, j);
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new Error(`Invalid number "${raw}"`);
      tokens.push({ kind: 'num', value });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i + 1;
      while (j < input.length && /[a-zA-Z0-9_]/.test(input[j])) j += 1;
      tokens.push({ kind: 'id', value: input.slice(i, j).toLowerCase() });
      i = j;
      continue;
    }
    if ('+-*/^'.includes(c)) {
      tokens.push({ kind: 'op', value: c });
      i += 1;
      continue;
    }
    if (c === '(') {
      tokens.push({ kind: 'lparen' });
      i += 1;
      continue;
    }
    if (c === ')') {
      tokens.push({ kind: 'rparen' });
      i += 1;
      continue;
    }
    if (c === ',') {
      tokens.push({ kind: 'comma' });
      i += 1;
      continue;
    }
    throw new Error(`Unexpected character "${c}"`);
  }
  return tokens;
}

type AstNode =
  | { type: 'num'; value: number }
  | { type: 'var'; name: 'x' | 't' }
  | { type: 'const'; name: string }
  | { type: 'unary'; op: '-'; arg: AstNode }
  | { type: 'binary'; op: string; left: AstNode; right: AstNode }
  | { type: 'call'; name: string; args: AstNode[] };

class Parser {
  private pos = 0;
  private tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): AstNode {
    const node = this.parseExpr();
    if (this.pos < this.tokens.length) {
      throw new Error('Unexpected trailing tokens');
    }
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    const t = this.tokens[this.pos];
    if (!t) throw new Error('Unexpected end of expression');
    this.pos += 1;
    return t;
  }

  private parseExpr(): AstNode {
    return this.parseAdd();
  }

  private parseAdd(): AstNode {
    let left = this.parseMul();
    while (true) {
      const t = this.peek();
      if (!t || t.kind !== 'op' || (t.value !== '+' && t.value !== '-')) break;
      this.consume();
      const right = this.parseMul();
      left = { type: 'binary', op: t.value, left, right };
    }
    return left;
  }

  private parseMul(): AstNode {
    let left = this.parsePow();
    while (true) {
      const t = this.peek();
      if (!t || t.kind !== 'op' || (t.value !== '*' && t.value !== '/')) break;
      this.consume();
      const right = this.parsePow();
      left = { type: 'binary', op: t.value, left, right };
    }
    return left;
  }

  private parsePow(): AstNode {
    const left = this.parseUnary();
    const t = this.peek();
    if (t && t.kind === 'op' && t.value === '^') {
      this.consume();
      const right = this.parsePow();
      return { type: 'binary', op: '^', left, right };
    }
    return left;
  }

  private parseUnary(): AstNode {
    const t = this.peek();
    if (t && t.kind === 'op' && t.value === '-') {
      this.consume();
      return { type: 'unary', op: '-', arg: this.parseUnary() };
    }
    if (t && t.kind === 'op' && t.value === '+') {
      this.consume();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): AstNode {
    const t = this.consume();
    if (t.kind === 'num') return { type: 'num', value: t.value };
    if (t.kind === 'id') {
      if (t.value === 'x' || t.value === 't') {
        return { type: 'var', name: t.value };
      }
      if (t.value in CONSTANTS) {
        return { type: 'const', name: t.value };
      }
      if (t.value in FUNCTIONS) {
        const next = this.peek();
        if (!next || next.kind !== 'lparen') {
          throw new Error(`Expected "(" after function ${t.value}`);
        }
        this.consume();
        const args: AstNode[] = [];
        if (this.peek()?.kind !== 'rparen') {
          args.push(this.parseExpr());
          while (this.peek()?.kind === 'comma') {
            this.consume();
            args.push(this.parseExpr());
          }
        }
        const close = this.consume();
        if (close.kind !== 'rparen') throw new Error('Expected ")"');
        return { type: 'call', name: t.value, args };
      }
      throw new Error(`Unknown identifier "${t.value}"`);
    }
    if (t.kind === 'lparen') {
      const inner = this.parseExpr();
      const close = this.consume();
      if (close.kind !== 'rparen') throw new Error('Expected ")"');
      return inner;
    }
    throw new Error('Expected number, variable, or "("');
  }
}

function compileAst(node: AstNode): SampleFn {
  switch (node.type) {
    case 'num':
      return () => node.value;
    case 'var':
      return node.name === 'x' ? (x) => x : (_x, t) => t;
    case 'const':
      return () => CONSTANTS[node.name];
    case 'unary': {
      const arg = compileAst(node.arg);
      return (x, t) => -arg(x, t);
    }
    case 'binary': {
      const left = compileAst(node.left);
      const right = compileAst(node.right);
      switch (node.op) {
        case '+':
          return (x, t) => left(x, t) + right(x, t);
        case '-':
          return (x, t) => left(x, t) - right(x, t);
        case '*':
          return (x, t) => left(x, t) * right(x, t);
        case '/':
          return (x, t) => left(x, t) / right(x, t);
        case '^':
          return (x, t) => Math.pow(left(x, t), right(x, t));
        default:
          throw new Error(`Unknown operator ${node.op}`);
      }
    }
    case 'call': {
      const fn = FUNCTIONS[node.name];
      const args = node.args.map(compileAst);
      return (x, t) => fn(...args.map((a) => a(x, t)));
    }
  }
}

export function compileFormula(expression: string): CompileOutcome {
  const trimmed = expression.trim();
  if (!trimmed) {
    return { ok: false, error: 'Empty expression', expression };
  }
  try {
    const tokens = tokenize(trimmed);
    const ast = new Parser(tokens).parse();
    const fn = compileAst(ast);
    // Smoke-test a few points
    for (const x of [0, Math.PI, Math.PI * 2]) {
      const y = fn(x, 0);
      if (!Number.isFinite(y)) {
        return { ok: false, error: 'Expression produced non-finite values', expression };
      }
    }
    return { ok: true, fn, expression: trimmed };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Parse error',
      expression,
    };
  }
}

export const TABLE_SIZE = 2048;

export function bakeWavetable(
  fn: SampleFn,
  t: number,
  size = TABLE_SIZE,
): Float32Array {
  const table = new Float32Array(size);
  let peak = 0;
  for (let i = 0; i < size; i += 1) {
    const x = (i / size) * Math.PI * 2;
    const y = fn(x, t);
    table[i] = y;
    const a = Math.abs(y);
    if (a > peak) peak = a;
  }
  if (peak > 1e-8) {
    const inv = 0.95 / peak;
    for (let i = 0; i < size; i += 1) table[i] *= inv;
  }
  return table;
}

export interface FormulaPreset {
  id: string;
  name: string;
  expression: string;
  /** Pedagogical tier shown in the preset list */
  tier: 'static' | 'simple-lfo' | 'multi-lfo' | 'sub-lfo' | 'complex';
}

export const FORMULA_PRESETS: FormulaPreset[] = [
  // —— Static (no time / LFO in the formula) ——
  { id: 'sine', name: 'Sine', tier: 'static', expression: 'sin(x)' },
  {
    id: 'warm',
    name: 'Warm',
    tier: 'static',
    expression: 'sin(x) + 0.35*sin(2*x) + 0.12*sin(3*x)',
  },
  {
    id: 'odd',
    name: 'Odd Harmonics',
    tier: 'static',
    expression: 'sin(x) + 0.4*sin(3*x) + 0.2*sin(5*x)',
  },
  {
    id: 'sawish',
    name: 'Saw-ish',
    tier: 'static',
    expression: 'sin(x) + 0.5*sin(2*x) + 0.33*sin(3*x) + 0.25*sin(4*x) + 0.2*sin(5*x)',
  },
  {
    id: 'squareish',
    name: 'Square-ish',
    tier: 'static',
    expression: 'sin(x) + 0.33*sin(3*x) + 0.2*sin(5*x) + 0.14*sin(7*x)',
  },
  { id: 'fold', name: 'Fold', tier: 'static', expression: 'sin(x + 0.8*sin(2*x))' },
  {
    id: 'deepfold',
    name: 'Deep Fold',
    tier: 'static',
    expression: 'sin(x + sin(x + 0.6*sin(3*x)))',
  },
  { id: 'abs', name: 'Full Wave', tier: 'static', expression: 'abs(sin(x)) * 2 - 1' },
  { id: 'half', name: 'Half Wave', tier: 'static', expression: 'max(sin(x), 0) * 2 - 0.5' },
  { id: 'pulse', name: 'Soft Pulse', tier: 'static', expression: 'tanh(3*sin(x))' },
  { id: 'hard', name: 'Hard Clip', tier: 'static', expression: 'tanh(8*sin(x))' },
  {
    id: 'triangle',
    name: 'Triangle-ish',
    tier: 'static',
    expression: 'asin(sin(x)) * 2 / pi',
  },
  {
    id: 'hollow',
    name: 'Hollow',
    tier: 'static',
    expression: 'sin(x) - 0.7*sin(2*x) + 0.3*sin(4*x)',
  },
  {
    id: 'glass',
    name: 'Glass',
    tier: 'static',
    expression: 'sin(x) + 0.2*sin(7*x) + 0.1*sin(11*x)',
  },
  {
    id: 'buzz',
    name: 'Buzz',
    tier: 'static',
    expression: 'sin(x) * cos(3*x) + 0.3*sin(5*x)',
  },
  {
    id: 'metallic',
    name: 'Metallic',
    tier: 'static',
    expression: 'sin(x) + 0.45*sin(pi*x) + 0.2*sin(7*x)',
  },

  // —— Simple single-LFO feel via t ——
  {
    id: 'breath',
    name: 'Breath',
    tier: 'simple-lfo',
    expression: 'sin(x) * (0.6 + 0.4*sin(t*0.25)) + 0.25*sin(2*x)',
  },
  {
    id: 'tide',
    name: 'Tide',
    tier: 'simple-lfo',
    expression: 'sin(x + 0.5*sin(t*0.15)) + 0.3*sin(2*x)',
  },
  {
    id: 'under',
    name: 'Undertone',
    tier: 'simple-lfo',
    expression: 'sin(x) + 0.5*sin(x/2 + t*0.05) + 0.2*sin(3*x)',
  },

  // —— Multiple LFOs in the formula ——
  {
    id: 'shimmer',
    name: 'Shimmer',
    tier: 'multi-lfo',
    expression: 'sin(x) + 0.25*sin(5*x + t*0.6) + 0.12*sin(9*x - t*0.4)',
  },
  {
    id: 'orbit',
    name: 'Orbit',
    tier: 'multi-lfo',
    expression: 'sin(x) * cos(x*0.5 + t*0.2) + 0.35*sin(3*x + sin(t*0.35))',
  },
  {
    id: 'mutate',
    name: 'Time Drift',
    tier: 'multi-lfo',
    expression: 'sin(x) + 0.4*sin(3*x + 0.7*sin(t*0.4)) + 0.15*sin(5*x - t*0.2)',
  },

  // —— Nested / sub-LFO style (LFO modulating LFO inside formula) ——
  {
    id: 'pulsewalk',
    name: 'Pulse Walk',
    tier: 'sub-lfo',
    expression: 'tanh((2.5 + sin(t*0.3))*sin(x + 0.4*sin(t*0.11))) + 0.15*sin(3*x)',
  },
  {
    id: 'nested',
    name: 'Nested Drift',
    tier: 'sub-lfo',
    expression: 'sin(x + 0.6*sin(t*0.2 + 0.5*sin(t*0.07))) + 0.25*sin(2*x)',
  },

  // —— Multiple carriers with multiple nested modulators ——
  {
    id: 'fracture',
    name: 'Fracture',
    tier: 'complex',
    expression:
      'sin(x + 1.2*sin(2*x + 0.5*sin(t*0.5 + 0.4*sin(t*0.12)))) * (0.7 + 0.3*cos(t*0.18 + 0.3*sin(t*0.05)))',
  },
  {
    id: 'cascade',
    name: 'Cascade',
    tier: 'complex',
    expression:
      'sin(x + sin(t*0.15 + 0.6*sin(t*0.04))) + 0.35*sin(3*x + 0.8*sin(t*0.22 + 0.5*sin(t*0.06))) + 0.15*sin(5*x - t*0.1)',
  },
];

export const PRESET_TIER_LABELS: Record<FormulaPreset['tier'], string> = {
  static: 'Static',
  'simple-lfo': 'Simple LFO',
  'multi-lfo': 'Multi LFO',
  'sub-lfo': 'Sub-LFO',
  complex: 'Complex',
};
