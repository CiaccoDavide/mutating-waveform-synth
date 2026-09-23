/** Normalized scene graph (0–1 coords) for WebGL2 2D rendering. */

export type Rgba = [number, number, number, number];

export interface SceneCircle {
  x: number;
  y: number;
  /** Radius as fraction of min(canvasW, canvasH) */
  r: number;
  color: Rgba;
}

export interface SceneSegment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Thickness as fraction of min(canvasW, canvasH) */
  thickness: number;
  color: Rgba;
  dashed?: boolean;
  /** Dash length in normalized units along the segment */
  dashLen?: number;
  gapLen?: number;
  phase?: number;
}

export interface SceneArc {
  cx: number;
  cy: number;
  rInner: number;
  rOuter: number;
  a0: number;
  a1: number;
  color: Rgba;
}

/** Soft glow particle (shader radial falloff). */
export interface SceneParticle {
  x: number;
  y: number;
  r: number;
  color: Rgba;
  /** Extra halo scale (1 = match r, higher = softer bloom) */
  glow?: number;
}

export interface SceneFx {
  /** 0–1 trail persistence (higher = longer ghost) */
  trail: number;
  /** 0–1 bloom strength */
  bloom: number;
  /** 0–1 edge darkening */
  vignette: number;
  /** 0–1 additive screen flash (hit energy) */
  flash: number;
  /** Elapsed seconds (optional) */
  time: number;
}

export interface Scene {
  bg: Rgba;
  circles: SceneCircle[];
  segments: SceneSegment[];
  arcs: SceneArc[];
  particles: SceneParticle[];
  fx: SceneFx;
}

export function defaultFx(partial?: Partial<SceneFx>): SceneFx {
  return {
    trail: 0.7,
    bloom: 0.28,
    vignette: 0.4,
    flash: 0,
    time: 0,
    ...partial,
  };
}

export function emptyScene(bg: Rgba = [0.027, 0.039, 0.051, 1]): Scene {
  return {
    bg,
    circles: [],
    segments: [],
    arcs: [],
    particles: [],
    fx: defaultFx(),
  };
}
