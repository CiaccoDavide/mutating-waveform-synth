import { useEffect, useRef } from 'react';
import type { AudioEngine } from '../audio/AudioEngine';

const VERT = `#version 300 es
in vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 u_res;
uniform float u_time;
uniform float u_bass;
uniform float u_mid;
uniform float u_high;
uniform sampler2D u_spectrum;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_res.x / u_res.y;

  float t = u_time * 0.15;
  float energy = u_bass * 0.7 + u_mid * 0.4 + u_high * 0.25;

  // Soft radial field
  float r = length(p);
  float field = exp(-r * (1.4 - energy * 0.6));

  // Horizontal interference bands reacting to mid
  float bands = sin(p.y * 18.0 + t * 2.0 + u_mid * 6.0) * 0.5 + 0.5;
  bands *= smoothstep(1.2, 0.1, r);

  // Spectrum ribbon along bottom
  float specX = clamp(uv.x, 0.0, 1.0);
  float spec = texture(u_spectrum, vec2(specX, 0.5)).r;
  float ribbon = smoothstep(0.08 + spec * 0.35, 0.0, uv.y) * spec;

  // Subtle noise grain
  float grain = (hash(gl_FragCoord.xy + t) - 0.5) * 0.04;

  vec3 deep = vec3(0.027, 0.039, 0.051);
  vec3 teal = vec3(0.37, 0.92, 0.83);
  vec3 amber = vec3(0.91, 0.72, 0.43);

  vec3 col = deep;
  col += teal * field * (0.18 + energy * 0.35);
  col += teal * bands * 0.06;
  col += mix(teal, amber, u_high) * ribbon * 0.85;
  col += grain;

  // Vignette
  col *= 0.55 + 0.45 * smoothstep(1.4, 0.2, r);

  outColor = vec4(col, 1.0);
}`;

function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(info || 'Shader compile failed');
  }
  return shader;
}

interface VisualizerProps {
  engine: AudioEngine;
  active: boolean;
}

export function Visualizer({ engine, active }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      powerPreference: 'low-power',
    });
    if (!gl) return;

    const vs = createShader(gl, gl.VERTEX_SHADER, VERT);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, 'u_res');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uBass = gl.getUniformLocation(program, 'u_bass');
    const uMid = gl.getUniformLocation(program, 'u_mid');
    const uHigh = gl.getUniformLocation(program, 'u_high');
    const uSpectrum = gl.getUniformLocation(program, 'u_spectrum');

    const spectrumTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, spectrumTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(uSpectrum, 0);

    const spectrumUpload = new Uint8Array(256 * 4);
    let raf = 0;
    let running = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    const frame = (now: number) => {
      if (!running) return;
      resize();
      const snap = active ? engine.getSnapshot() : null;
      let bass = 0.05;
      let mid = 0.04;
      let high = 0.03;
      if (snap) {
        bass = snap.bass;
        mid = snap.mid;
        high = snap.high;
        const freq = snap.frequencyData;
        const bins = Math.min(256, freq.length);
        for (let i = 0; i < 256; i += 1) {
          const v = i < bins ? freq[i] : 0;
          const o = i * 4;
          spectrumUpload[o] = v;
          spectrumUpload[o + 1] = v;
          spectrumUpload[o + 2] = v;
          spectrumUpload[o + 3] = 255;
        }
      } else {
        for (let i = 0; i < 256; i += 1) {
          const o = i * 4;
          const v = Math.floor(12 + 8 * Math.sin(now * 0.001 + i * 0.08));
          spectrumUpload[o] = v;
          spectrumUpload[o + 1] = v;
          spectrumUpload[o + 2] = v;
          spectrumUpload[o + 3] = 255;
        }
      }

      gl.bindTexture(gl.TEXTURE_2D, spectrumTex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        256,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        spectrumUpload,
      );

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, now * 0.001);
      gl.uniform1f(uBass, bass);
      gl.uniform1f(uMid, mid);
      gl.uniform1f(uHigh, high);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
      gl.deleteTexture(spectrumTex);
    };
  }, [engine, active]);

  return <canvas ref={canvasRef} className="viz-canvas" aria-hidden />;
}
