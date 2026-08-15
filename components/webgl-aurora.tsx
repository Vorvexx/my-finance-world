"use client";

import { useEffect, useRef } from "react";

const VERTEX_SHADER = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform float time;
out vec4 color;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1,0)), f.x), mix(hash21(i + vec2(0,1)), hash21(i + vec2(1)), f.x), f.y);
}

float fbm(vec2 p) {
  float value = 0.0, amplitude = 0.52;
  mat2 turn = mat2(0.82, -0.57, 0.57, 0.82);
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = turn * p * 2.03 + 9.7;
    amplitude *= 0.49;
  }
  return value;
}

float cloud(vec2 uv, vec2 centre, float scale, float phase) {
  vec2 p = (uv - centre) * scale;
  float drift = time * 0.0045;
  vec2 warp = vec2(fbm(p * 1.05 + vec2(phase, drift)), fbm(p * 1.08 + vec2(-drift, phase + 4.0))) - 0.5;
  p += warp * 2.15;
  float body = fbm(p * 1.28 + phase + drift);
  float curl = fbm(p * 2.55 - warp * 1.7 - drift);
  float envelope = 1.0 - smoothstep(0.12, 1.32, length(p * vec2(0.74, 1.18)));
  return smoothstep(0.48, 0.82, body * 0.72 + curl * 0.42) * envelope;
}

void main() {
  vec2 frag = gl_FragCoord.xy / resolution;
  vec2 uv = (frag - 0.5) * vec2(resolution.x / resolution.y, 1.0);
  vec3 cyan = vec3(0.03, 0.52, 1.0), mint = vec3(0.08, 0.95, 0.63);
  vec3 violet = vec3(0.46, 0.19, 1.0), pink = vec3(1.0, 0.16, 0.61), amber = vec3(1.0, 0.48, 0.09);

  float c1 = cloud(uv, vec2(-0.44, 0.12), 1.35, 2.1);
  float c2 = cloud(uv, vec2(-0.04, 0.29), 1.42, 7.4);
  float c3 = cloud(uv, vec2(0.39, 0.19), 1.34, 13.7);
  float c4 = cloud(uv, vec2(0.48, -0.20), 1.38, 19.3);
  float c5 = cloud(uv, vec2(-0.16, -0.32), 1.31, 25.8);
  float density = max(max(c1, c2), max(max(c3, c4), c5));

  vec3 aurora = cyan*c1 + mint*c2 + violet*c3 + pink*c4 + amber*c5;
  float inner = smoothstep(0.12, 0.72, density);
  float core = pow(inner, 2.4);
  float edge = smoothstep(0.025, 0.32, density) - smoothstep(0.38, 0.8, density);
  aurora *= 0.20 + core * 0.48 + edge * 0.18;

  float stars = step(0.9965, hash21(floor(frag * resolution * 0.34)));
  float twinkle = 0.42 + 0.58 * sin(time * 0.12 + hash21(frag * 900.0) * 6.2831);
  vec3 starColor = vec3(stars * twinkle * (1.0 - smoothstep(0.0, 0.22, density)));
  float vignette = smoothstep(0.92, 0.18, length(uv * vec2(0.72, 1.0)));
  vec3 background = vec3(0.002, 0.006, 0.018) + vec3(0.008, 0.014, 0.035) * vignette;
  color = vec4(background + aurora * 0.46 + starColor * 0.38, 1.0);
}
`;

const compile = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
  return shader;
};

export default function WebglAurora() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, powerPreference: "high-performance" });
    if (!gl) { canvas.dataset.fallback = "true"; return; }
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER), fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertex || !fragment) { canvas.dataset.fallback = "true"; return; }
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { canvas.dataset.fallback = "true"; return; }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const resolution = gl.getUniformLocation(program, "resolution"), clock = gl.getUniformLocation(program, "time");
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, lastFrame = 0, interval = 1000 / 60, sampleStart = performance.now(), sampleFrames = 0;
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 1.25), scale = .58;
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr * scale)), height = Math.max(1, Math.round(canvas.clientHeight * dpr * scale));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; gl.viewport(0, 0, width, height); }
    };
    const draw = (now: number) => {
      frame = 0;
      if (document.hidden) return;
      if (now - lastFrame < interval) { frame = requestAnimationFrame(draw); return; }
      lastFrame = now; resize(); gl.useProgram(program);
      gl.uniform2f(resolution, canvas.width, canvas.height); gl.uniform1f(clock, reducedMotion.matches ? 0 : now / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3); sampleFrames++;
      if (now - sampleStart > 2400) {
        const fps = sampleFrames * 1000 / (now - sampleStart);
        interval = fps < 48 ? 1000 / 30 : 1000 / 60; sampleStart = now; sampleFrames = 0;
      }
      if (!reducedMotion.matches) frame = requestAnimationFrame(draw);
    };
    const restart = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); };
    const observer = new ResizeObserver(restart);
    observer.observe(canvas); document.addEventListener("visibilitychange", restart); reducedMotion.addEventListener("change", restart); restart();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener("visibilitychange", restart); reducedMotion.removeEventListener("change", restart);
      gl.deleteBuffer(buffer); gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment);
    };
  }, []);
  return <canvas ref={canvasRef} className="webgl-aurora" aria-hidden="true" />;
}
