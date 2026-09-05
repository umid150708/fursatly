'use client';

import { useEffect, useRef } from 'react';

interface ShaderHeroProps {
  /** Accent colour as a 0–1 RGB triplet (the bloom colour). */
  accent: [number, number, number];
  className?: string;
}

const VERT = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }
`;

// Draws only translucent accent blooms (alpha) over a transparent canvas, so it
// composites on top of the theme-correct CSS gradient — no theme reactivity, no
// re-init, no context churn.
const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uRes;
  uniform vec3 uAccent;

  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.,0.)), c = hash(i + vec2(0.,1.)), d = hash(i + vec2(1.,1.));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
  }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.02; a *= 0.5; } return v; }

  void main(){
    vec2 p = vUv * vec2(uRes.x / uRes.y, 1.0) * 2.2;
    float t = uTime;
    float q = fbm(p + vec2(t * 0.6, -t * 0.4));
    float n = fbm(p + q + vec2(-t * 0.3, t * 0.2));
    float bloom = smoothstep(0.5, 0.98, n);
    gl_FragColor = vec4(uAccent, bloom * 0.45);
  }
`;

/** Flowing fbm-noise accent blooms in WebGL. Mounted only on the WebGL tier and
 *  dynamically imported, so OGL never ships to weak devices. Initialised once. */
export default function ShaderHero({ accent, className = '' }: ShaderHeroProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Latest accent, read by the render loop without forcing a re-init.
  const accentRef = useRef(accent);
  accentRef.current = accent;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let raf = 0;
    let onResize: (() => void) | null = null;
    let destroyed = false;
    let gl: any = null;

    (async () => {
      try {
        const { Renderer, Program, Mesh, Triangle, Vec2, Vec3 } = await import('ogl');
        if (destroyed) return;

        const renderer = new Renderer({ canvas, alpha: true, dpr: Math.min(window.devicePixelRatio || 1, 1.5) });
        gl = renderer.gl;
        gl.clearColor(0, 0, 0, 0);
        const geometry = new Triangle(gl);
        const program = new Program(gl, {
          vertex: VERT,
          fragment: FRAG,
          transparent: true,
          uniforms: {
            uTime: { value: 0 },
            uRes: { value: new Vec2(1, 1) },
            uAccent: { value: new Vec3(...accentRef.current) },
          },
        });
        const mesh = new Mesh(gl, { geometry, program });

        const resize = () => {
          const w = canvas.clientWidth || window.innerWidth;
          const h = canvas.clientHeight || window.innerHeight;
          renderer.setSize(w, h);
          program.uniforms.uRes.value.set(w, h);
        };
        onResize = resize;
        window.addEventListener('resize', resize);
        resize();

        const loop = (time: number) => {
          if (destroyed) return;
          program.uniforms.uTime.value = time * 0.00018;
          program.uniforms.uAccent.value.set(...accentRef.current);
          renderer.render({ scene: mesh });
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch {
        /* WebGL unavailable — the CSS mesh-gradient fallback stays. */
      }
    })();

    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      if (onResize) window.removeEventListener('resize', onResize);
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={ref} className={`block h-full w-full ${className}`} aria-hidden />;
}
