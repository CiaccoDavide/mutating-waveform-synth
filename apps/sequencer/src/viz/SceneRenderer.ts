import { createProgram } from './gl';
import type {
  Scene,
  SceneArc,
  SceneCircle,
  SceneParticle,
  SceneSegment,
} from './types';
import { defaultFx } from './types';

const GEO_VERT = `#version 300 es
layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec4 a_col;
uniform vec2 u_res;
out vec4 v_col;
void main() {
  vec2 clip = vec2(
    (a_pos.x / u_res.x) * 2.0 - 1.0,
    1.0 - (a_pos.y / u_res.y) * 2.0
  );
  gl_Position = vec4(clip, 0.0, 1.0);
  v_col = a_col;
}`;

const GEO_FRAG = `#version 300 es
precision mediump float;
in vec4 v_col;
out vec4 outColor;
void main() {
  outColor = v_col;
}`;

const PART_VERT = `#version 300 es
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec2 a_center;
layout(location = 2) in float a_radius;
layout(location = 3) in vec4 a_col;
uniform vec2 u_res;
out vec2 v_uv;
out vec4 v_col;
void main() {
  float minDim = min(u_res.x, u_res.y);
  vec2 px = a_center * u_res + a_corner * a_radius * minDim;
  vec2 clip = vec2(
    (px.x / u_res.x) * 2.0 - 1.0,
    1.0 - (px.y / u_res.y) * 2.0
  );
  gl_Position = vec4(clip, 0.0, 1.0);
  v_uv = a_corner;
  v_col = a_col;
}`;

const PART_FRAG = `#version 300 es
precision mediump float;
in vec2 v_uv;
in vec4 v_col;
out vec4 outColor;
void main() {
  float d = length(v_uv);
  float core = 1.0 - smoothstep(0.08, 0.42, d);
  float halo = 1.0 - smoothstep(0.4, 1.0, d);
  float a = max(core, halo * 0.45) * v_col.a;
  if (a < 0.01) discard;
  outColor = vec4(v_col.rgb, a);
}`;

const FS_VERT = `#version 300 es
layout(location = 0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const TRAIL_FRAG = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_prev;
uniform sampler2D u_scene;
uniform float u_decay;
uniform vec4 u_bg;
out vec4 outColor;
void main() {
  vec4 prev = texture(u_prev, v_uv);
  vec4 sc = texture(u_scene, v_uv);
  vec4 faded = mix(u_bg, prev, u_decay);
  outColor = sc.a > 0.01 ? mix(faded, sc, clamp(sc.a, 0.0, 1.0)) : faded;
  // Prefer brighter of trail and scene for glow persistence
  outColor.rgb = max(faded.rgb * u_decay, sc.rgb);
  outColor.a = 1.0;
}`;

const POST_FRAG = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_texel;
uniform float u_bloom;
uniform float u_vignette;
uniform float u_flash;
uniform float u_time;
out vec4 outColor;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
void main() {
  vec4 c = texture(u_tex, v_uv);
  vec3 bloom = vec3(0.0);
  if (u_bloom > 0.001) {
    float wsum = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 o = vec2(float(x), float(y)) * u_texel * 2.5;
        vec3 s = texture(u_tex, v_uv + o).rgb;
        float br = max(s.r, max(s.g, s.b));
        float w = br > 0.45 ? 1.0 : 0.25;
        bloom += s * w;
        wsum += w;
      }
    }
    bloom /= max(wsum, 1.0);
    c.rgb += bloom * u_bloom * 0.85;
  }
  float dist = distance(v_uv, vec2(0.5));
  float vig = 1.0 - smoothstep(0.35, 0.95, dist) * u_vignette;
  c.rgb *= vig;
  c.rgb += vec3(u_flash * 0.35, u_flash * 0.28, u_flash * 0.2);
  float grain = (hash(v_uv * 480.0 + u_time) - 0.5) * 0.028;
  c.rgb += grain;
  outColor = vec4(c.rgb, 1.0);
}`;

const CIRCLE_SEGS = 24;
const ARC_SEGS = 32;

interface Fbo {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
}

function createFbo(gl: WebGL2RenderingContext, w: number, h: number): Fbo {
  const tex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  if (!tex || !fbo) throw new Error('FBO alloc failed');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA8,
    w,
    h,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    tex,
    0,
  );
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error('Framebuffer incomplete');
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex };
}

export class SceneRenderer {
  private gl: WebGL2RenderingContext;
  private geoProg: WebGLProgram;
  private partProg: WebGLProgram;
  private trailProg: WebGLProgram;
  private postProg: WebGLProgram;
  private geoVao: WebGLVertexArrayObject;
  private geoBuf: WebGLBuffer;
  private partVao: WebGLVertexArrayObject;
  private partBuf: WebGLBuffer;
  private fsVao: WebGLVertexArrayObject;
  private uGeoRes: WebGLUniformLocation;
  private uPartRes: WebGLUniformLocation;
  private uTrailPrev: WebGLUniformLocation;
  private uTrailScene: WebGLUniformLocation;
  private uTrailDecay: WebGLUniformLocation;
  private uTrailBg: WebGLUniformLocation;
  private uPostTex: WebGLUniformLocation;
  private uPostTexel: WebGLUniformLocation;
  private uPostBloom: WebGLUniformLocation;
  private uPostVig: WebGLUniformLocation;
  private uPostFlash: WebGLUniformLocation;
  private uPostTime: WebGLUniformLocation;
  private verts = new Float32Array(65536);
  private vertCount = 0;
  private partVerts = new Float32Array(16384);
  private partVertCount = 0;
  private sceneFbo: Fbo | null = null;
  private trailA: Fbo | null = null;
  private trailB: Fbo | null = null;
  private trailFlip = false;
  private fboW = 0;
  private fboH = 0;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    this.geoProg = createProgram(gl, GEO_VERT, GEO_FRAG);
    this.partProg = createProgram(gl, PART_VERT, PART_FRAG);
    this.trailProg = createProgram(gl, FS_VERT, TRAIL_FRAG);
    this.postProg = createProgram(gl, FS_VERT, POST_FRAG);

    const geoVao = gl.createVertexArray();
    const geoBuf = gl.createBuffer();
    if (!geoVao || !geoBuf) throw new Error('GL alloc failed');
    this.geoVao = geoVao;
    this.geoBuf = geoBuf;
    gl.bindVertexArray(geoVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, geoBuf);
    const stride = 6 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 8);

    const partVao = gl.createVertexArray();
    const partBuf = gl.createBuffer();
    if (!partVao || !partBuf) throw new Error('GL alloc failed');
    this.partVao = partVao;
    this.partBuf = partBuf;
    // interleaved: corner.xy, center.xy, radius, rgba = 9 floats
    gl.bindVertexArray(partVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, partBuf);
    const ps = 9 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, ps, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, ps, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, ps, 16);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, ps, 20);

    const fsVao = gl.createVertexArray();
    const fsBuf = gl.createBuffer();
    if (!fsVao || !fsBuf) throw new Error('GL alloc failed');
    this.fsVao = fsVao;
    gl.bindVertexArray(fsVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, fsBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const uGeoRes = gl.getUniformLocation(this.geoProg, 'u_res');
    const uPartRes = gl.getUniformLocation(this.partProg, 'u_res');
    const uTrailPrev = gl.getUniformLocation(this.trailProg, 'u_prev');
    const uTrailScene = gl.getUniformLocation(this.trailProg, 'u_scene');
    const uTrailDecay = gl.getUniformLocation(this.trailProg, 'u_decay');
    const uTrailBg = gl.getUniformLocation(this.trailProg, 'u_bg');
    const uPostTex = gl.getUniformLocation(this.postProg, 'u_tex');
    const uPostTexel = gl.getUniformLocation(this.postProg, 'u_texel');
    const uPostBloom = gl.getUniformLocation(this.postProg, 'u_bloom');
    const uPostVig = gl.getUniformLocation(this.postProg, 'u_vignette');
    const uPostFlash = gl.getUniformLocation(this.postProg, 'u_flash');
    const uPostTime = gl.getUniformLocation(this.postProg, 'u_time');
    if (
      !uGeoRes ||
      !uPartRes ||
      !uTrailPrev ||
      !uTrailScene ||
      !uTrailDecay ||
      !uTrailBg ||
      !uPostTex ||
      !uPostTexel ||
      !uPostBloom ||
      !uPostVig ||
      !uPostFlash ||
      !uPostTime
    ) {
      throw new Error('Uniform missing');
    }
    this.uGeoRes = uGeoRes;
    this.uPartRes = uPartRes;
    this.uTrailPrev = uTrailPrev;
    this.uTrailScene = uTrailScene;
    this.uTrailDecay = uTrailDecay;
    this.uTrailBg = uTrailBg;
    this.uPostTex = uPostTex;
    this.uPostTexel = uPostTexel;
    this.uPostBloom = uPostBloom;
    this.uPostVig = uPostVig;
    this.uPostFlash = uPostFlash;
    this.uPostTime = uPostTime;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  private ensureFbos(w: number, h: number) {
    if (this.fboW === w && this.fboH === h && this.sceneFbo) return;
    const gl = this.gl;
    const kill = (f: Fbo | null) => {
      if (!f) return;
      gl.deleteFramebuffer(f.fbo);
      gl.deleteTexture(f.tex);
    };
    kill(this.sceneFbo);
    kill(this.trailA);
    kill(this.trailB);
    this.sceneFbo = createFbo(gl, w, h);
    this.trailA = createFbo(gl, w, h);
    this.trailB = createFbo(gl, w, h);
    this.fboW = w;
    this.fboH = h;
    // clear trails
    for (const f of [this.trailA, this.trailB]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, f.fbo);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0.039, 0.063, 0.086, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  resize(cssW: number, cssH: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = this.gl.canvas as HTMLCanvasElement;
    const w = Math.max(1, Math.floor(Math.max(cssW, 1) * dpr));
    const h = Math.max(1, Math.floor(Math.max(cssH, 1) * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    this.ensureFbos(w, h);
  }

  draw(scene: Scene) {
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    const w = canvas.width || 1;
    const h = canvas.height || 1;
    this.ensureFbos(w, h);
    const fx = { ...defaultFx(), ...scene.fx };
    const minDim = Math.min(w, h);
    this.vertCount = 0;
    this.partVertCount = 0;

    for (const c of scene.circles) this.pushCircle(c, w, h, minDim);
    for (const s of scene.segments) this.pushSegment(s, w, h, minDim);
    for (const a of scene.arcs) this.pushArc(a, w, h, minDim);
    for (const p of scene.particles ?? []) this.pushParticle(p);

    const sceneFbo = this.sceneFbo!;
    const trailRead = this.trailFlip ? this.trailB! : this.trailA!;
    const trailWrite = this.trailFlip ? this.trailA! : this.trailB!;

    // 1) Geometry → scene FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo.fbo);
    gl.viewport(0, 0, w, h);
    const [br, bg, bb, ba] = scene.bg;
    gl.clearColor(br, bg, bb, ba);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    if (this.vertCount > 0) {
      gl.useProgram(this.geoProg);
      gl.uniform2f(this.uGeoRes, w, h);
      gl.bindVertexArray(this.geoVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.geoBuf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        this.verts.subarray(0, this.vertCount * 6),
        gl.DYNAMIC_DRAW,
      );
      gl.drawArrays(gl.TRIANGLES, 0, this.vertCount);
    }

    if (this.partVertCount > 0) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.useProgram(this.partProg);
      gl.uniform2f(this.uPartRes, w, h);
      gl.bindVertexArray(this.partVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        this.partVerts.subarray(0, this.partVertCount * 9),
        gl.DYNAMIC_DRAW,
      );
      gl.drawArrays(gl.TRIANGLES, 0, this.partVertCount);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    // 2) Trail composite
    const decay = Math.max(0, Math.min(0.98, fx.trail));
    gl.bindFramebuffer(gl.FRAMEBUFFER, trailWrite.fbo);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND);
    gl.useProgram(this.trailProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, trailRead.tex);
    gl.uniform1i(this.uTrailPrev, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, sceneFbo.tex);
    gl.uniform1i(this.uTrailScene, 1);
    gl.uniform1f(this.uTrailDecay, decay);
    gl.uniform4f(this.uTrailBg, br, bg, bb, ba);
    gl.bindVertexArray(this.fsVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // 3) Post → canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.postProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, trailWrite.tex);
    gl.uniform1i(this.uPostTex, 0);
    gl.uniform2f(this.uPostTexel, 1 / w, 1 / h);
    gl.uniform1f(this.uPostBloom, Math.max(0, Math.min(1, fx.bloom)));
    gl.uniform1f(this.uPostVig, Math.max(0, Math.min(1, fx.vignette)));
    gl.uniform1f(this.uPostFlash, Math.max(0, Math.min(1, fx.flash)));
    gl.uniform1f(this.uPostTime, fx.time || performance.now() * 0.001);    gl.bindVertexArray(this.fsVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    this.trailFlip = !this.trailFlip;
    gl.enable(gl.BLEND);
  }

  private ensure(n: number) {
    if ((this.vertCount + n) * 6 > this.verts.length) {
      const next = new Float32Array(this.verts.length * 2);
      next.set(this.verts);
      this.verts = next;
    }
  }

  private ensurePart(n: number) {
    if ((this.partVertCount + n) * 9 > this.partVerts.length) {
      const next = new Float32Array(this.partVerts.length * 2);
      next.set(this.partVerts);
      this.partVerts = next;
    }
  }

  private pushVert(
    x: number,
    y: number,
    r: number,
    g: number,
    b: number,
    a: number,
  ) {
    const i = this.vertCount * 6;
    this.verts[i] = x;
    this.verts[i + 1] = y;
    this.verts[i + 2] = r;
    this.verts[i + 3] = g;
    this.verts[i + 4] = b;
    this.verts[i + 5] = a;
    this.vertCount += 1;
  }

  private pushParticle(p: SceneParticle) {
    const glow = Math.max(1, p.glow ?? 1.8);
    const r = p.r * glow;
    const [cr, cg, cb, ca] = p.color;
    const corners: [number, number][] = [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];
    this.ensurePart(6);
    for (const [cx, cy] of corners) {
      const i = this.partVertCount * 9;
      this.partVerts[i] = cx;
      this.partVerts[i + 1] = cy;
      this.partVerts[i + 2] = p.x;
      this.partVerts[i + 3] = p.y;
      this.partVerts[i + 4] = r;
      this.partVerts[i + 5] = cr;
      this.partVerts[i + 6] = cg;
      this.partVerts[i + 7] = cb;
      this.partVerts[i + 8] = ca;
      this.partVertCount += 1;
    }
  }

  private pushCircle(c: SceneCircle, w: number, h: number, minDim: number) {
    const cx = c.x * w;
    const cy = c.y * h;
    const rad = Math.max(1, c.r * minDim);
    const [cr, cg, cb, ca] = c.color;
    this.ensure(CIRCLE_SEGS * 3);
    for (let i = 0; i < CIRCLE_SEGS; i += 1) {
      const a0 = (i / CIRCLE_SEGS) * Math.PI * 2;
      const a1 = ((i + 1) / CIRCLE_SEGS) * Math.PI * 2;
      this.pushVert(cx, cy, cr, cg, cb, ca);
      this.pushVert(
        cx + Math.cos(a0) * rad,
        cy + Math.sin(a0) * rad,
        cr,
        cg,
        cb,
        ca,
      );
      this.pushVert(
        cx + Math.cos(a1) * rad,
        cy + Math.sin(a1) * rad,
        cr,
        cg,
        cb,
        ca,
      );
    }
  }

  private pushThickLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    thicknessPx: number,
    color: [number, number, number, number],
  ) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * (thicknessPx * 0.5);
    const ny = (dx / len) * (thicknessPx * 0.5);
    const [cr, cg, cb, ca] = color;
    this.ensure(6);
    this.pushVert(x0 + nx, y0 + ny, cr, cg, cb, ca);
    this.pushVert(x0 - nx, y0 - ny, cr, cg, cb, ca);
    this.pushVert(x1 + nx, y1 + ny, cr, cg, cb, ca);
    this.pushVert(x0 - nx, y0 - ny, cr, cg, cb, ca);
    this.pushVert(x1 - nx, y1 - ny, cr, cg, cb, ca);
    this.pushVert(x1 + nx, y1 + ny, cr, cg, cb, ca);
  }

  private pushSegment(s: SceneSegment, w: number, h: number, minDim: number) {
    const x0 = s.x0 * w;
    const y0 = s.y0 * h;
    const x1 = s.x1 * w;
    const y1 = s.y1 * h;
    const thick = Math.max(1, s.thickness * minDim);
    if (!s.dashed) {
      this.pushThickLine(x0, y0, x1, y1, thick, s.color);
      return;
    }
    const dx = x1 - x0;
    const dy = y1 - y0;
    const lenPx = Math.hypot(dx, dy) || 1;
    const ux = dx / lenPx;
    const uy = dy / lenPx;
    const dash = Math.max(2, (s.dashLen ?? 0.04) * minDim);
    const gap = Math.max(1, (s.gapLen ?? 0.03) * minDim);
    const period = dash + gap;
    let dist = ((s.phase ?? 0) % 1) * period;
    if (dist < 0) dist += period;
    while (dist < lenPx) {
      const start = dist;
      const end = Math.min(lenPx, dist + dash);
      if (end > start) {
        this.pushThickLine(
          x0 + ux * start,
          y0 + uy * start,
          x0 + ux * end,
          y0 + uy * end,
          thick,
          s.color,
        );
      }
      dist += period;
    }
  }

  private pushArc(a: SceneArc, w: number, h: number, minDim: number) {
    const cx = a.cx * w;
    const cy = a.cy * h;
    const r0 = a.rInner * minDim;
    const r1 = a.rOuter * minDim;
    let a0 = a.a0;
    let a1 = a.a1;
    while (a1 < a0) a1 += Math.PI * 2;
    const span = a1 - a0;
    const n = Math.max(2, Math.ceil((span / (Math.PI * 2)) * ARC_SEGS));
    const [cr, cg, cb, ca] = a.color;
    this.ensure(n * 6);
    for (let i = 0; i < n; i += 1) {
      const t0 = a0 + (span * i) / n;
      const t1 = a0 + (span * (i + 1)) / n;
      const c0 = Math.cos(t0);
      const s0 = Math.sin(t0);
      const c1 = Math.cos(t1);
      const s1 = Math.sin(t1);
      const ix0 = cx + c0 * r0;
      const iy0 = cy + s0 * r0;
      const ox0 = cx + c0 * r1;
      const oy0 = cy + s0 * r1;
      const ix1 = cx + c1 * r0;
      const iy1 = cy + s1 * r0;
      const ox1 = cx + c1 * r1;
      const oy1 = cy + s1 * r1;
      this.pushVert(ix0, iy0, cr, cg, cb, ca);
      this.pushVert(ox0, oy0, cr, cg, cb, ca);
      this.pushVert(ox1, oy1, cr, cg, cb, ca);
      this.pushVert(ix0, iy0, cr, cg, cb, ca);
      this.pushVert(ox1, oy1, cr, cg, cb, ca);
      this.pushVert(ix1, iy1, cr, cg, cb, ca);
    }
  }

  destroy() {
    const gl = this.gl;
    gl.deleteBuffer(this.geoBuf);
    gl.deleteBuffer(this.partBuf);
    gl.deleteVertexArray(this.geoVao);
    gl.deleteVertexArray(this.partVao);
    gl.deleteVertexArray(this.fsVao);
    gl.deleteProgram(this.geoProg);
    gl.deleteProgram(this.partProg);
    gl.deleteProgram(this.trailProg);
    gl.deleteProgram(this.postProg);
    const kill = (f: Fbo | null) => {
      if (!f) return;
      gl.deleteFramebuffer(f.fbo);
      gl.deleteTexture(f.tex);
    };
    kill(this.sceneFbo);
    kill(this.trailA);
    kill(this.trailB);
  }
}
