'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useMotion } from '@/components/motion/MotionConfig';
import { SectionHeader } from '@/components/home/SectionHeader';

interface Stage {
  title: string;
  keywords: string[];
}

/** Balanced two-line split for short display labels ("Siz uchun tayyor" → ["Siz uchun","tayyor"]). */
function split2(s: string): string[] {
  const words = s.split(' ');
  if (words.length < 2 || s.length <= 12) return [s];
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ').length;
    const b = words.slice(i).join(' ').length;
    const d = Math.abs(a - b);
    if (d < bestDiff) { bestDiff = d; best = i; }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

/**
 * "Why Fursatly" as a hand-composed process drawing, literal to the reference
 * (penguin-capital.co.jp "Creating Value"): a horizontal axis with square node
 * markers, an origin circle holding the raw-input label, concentric rings that
 * CONTAIN the stage keywords (terse words, not sentences — a diagonal cascade,
 * a two-line cluster, an edge label), bracket segments under the axis naming the
 * four stages, one long diagonal hairline, and a big display terminus.
 *
 * Desktop is a single SVG (viewBox 1200×640) so the composition scales as one
 * drawing and can never overflow; every stroke self-draws via pathLength +
 * dashoffset on one GSAP timeline. Mobile folds into the vertical timeline.
 * Motion-gated like Reveal: static with no JS on the reduced-motion tier.
 */
export function WhyFursatly({
  lead,
  index,
  title,
  start,
  via,
  end,
  stages,
}: {
  lead: string;
  index: string;
  title: string;
  start: string;
  via: string;
  end: string;
  stages: Stage[];
}) {
  const root = useRef<HTMLElement>(null);
  const { motion } = useMotion();

  useEffect(() => {
    if (!motion || !root.current) return;
    const el = root.current;
    let ctx: gsap.Context | null = null;

    (async () => {
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);
      ctx = gsap.context((self) => {
        const desktop = window.matchMedia('(min-width: 1024px)').matches;
        const scope = desktop ? '[data-layout="lg"] ' : '[data-layout="sm"] ';
        const q = (name: string) => self.selector!(scope + `[data-anim="${name}"]`);
        const draw = { strokeDashoffset: 1 };
        const drawn = (d: number, ease = 'power2.inOut') => ({ strokeDashoffset: 0, duration: d, ease });

        const tl = gsap.timeline({
          defaults: { ease: 'expo.out' },
          scrollTrigger: { trigger: el, start: 'top 70%', once: true },
        });

        if (desktop) {
          tl.fromTo(q('axis'), draw, drawn(1.1))
            .fromTo(q('oc'), draw, drawn(0.8), '<0.15')
            .fromTo(q('otext'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, '-=0.4')
            .fromTo(q('via'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5 }, '-=0.3')
            .fromTo(q('sq'), { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, stagger: 0.07, ease: 'back.out(2)' }, '-=0.6')
            .fromTo(q('ring'), draw, { ...drawn(1.6), stagger: 0.15 }, '-=0.5')
            .fromTo(q('diag'), draw, drawn(0.9), '-=1.0')
            .fromTo(q('vline'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, '-=0.8')
            .fromTo(q('bline'), draw, { ...drawn(0.6), stagger: 0.1 }, '<')
            .fromTo(q('blabel'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.1 }, '<0.1')
            .fromTo(q('kw'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.06 }, '-=0.6')
            .fromTo(q('end'), { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.7 }, '-=0.3');
        } else {
          tl.fromTo(q('origin'), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' })
            .fromTo(q('track-v'), { scaleY: 0 }, { scaleY: 1, duration: 1.3, ease: 'power2.inOut' }, '<')
            .fromTo(q('node'), { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, stagger: 0.14, ease: 'back.out(2)' }, '-=1.05')
            .fromTo(q('stage'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.14 }, '-=1.0')
            .fromTo(q('end'), { opacity: 0, x: -12 }, { opacity: 1, x: 0, duration: 0.7 }, '-=0.2');
        }
      }, el);
    })();

    return () => ctx?.revert();
  }, [motion]);

  // ── Diagram geometry (viewBox 1200 × 640, axis at y = 360) ────────────────
  const AXIS = 360;
  // Bracket segments under the axis — one per stage.
  const SEGS: [number, number][] = [[420, 610], [610, 800], [800, 990], [990, 1168]];
  const NODES = [20, 198, 420, 610, 800, 990];
  const RINGS = [70, 130, 200, 265];
  const sqStyle = { transformBox: 'fill-box', transformOrigin: 'center' } as React.CSSProperties;
  const hair = { stroke: 'currentColor', vectorEffect: 'non-scaling-stroke' as const };

  const startLines = split2(start);
  const viaLines = split2(via);
  const endLines = split2(end);

  return (
    <section ref={root} className="container relative overflow-hidden py-24 md:py-32">
      <SectionHeader label={lead} index={index} title={title} />

      {/* ── Desktop: the drawing ────────────────────────────────────────── */}
      <svg data-layout="lg" viewBox="0 0 1200 640" fill="none" className="mt-16 hidden w-full lg:block" aria-hidden>
        {/* Concentric rings — the containers the information lives in */}
        {RINGS.map((r) => (
          <circle key={r} data-anim="ring" cx="420" cy={AXIS} r={r} pathLength={1} strokeDasharray={1}
            className="text-foreground/20" {...hair} strokeWidth={1} />
        ))}

        {/* Long diagonal hairline through the rings */}
        <line data-anim="diag" x1="420" y1={AXIS} x2="1160" y2="55" pathLength={1} strokeDasharray={1}
          className="text-foreground/15" {...hair} strokeWidth={1} />

        {/* Axis + arrowhead */}
        <line data-anim="axis" x1="20" y1={AXIS} x2="1162" y2={AXIS} pathLength={1} strokeDasharray={1}
          className="text-foreground/35" {...hair} strokeWidth={1.5} />
        <path data-anim="sq" d="M1154 352 L1166 360 L1154 368" className="text-foreground/50" {...hair}
          strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={sqStyle} />

        {/* Square node markers on the axis */}
        {NODES.map((x) => (
          <rect key={x} data-anim="sq" x={x - 5} y={AXIS - 5} width="10" height="10"
            fill="hsl(var(--background))" className="text-foreground/60" {...hair} strokeWidth={1} style={sqStyle} />
        ))}

        {/* Origin circle with the raw-input label inside it */}
        <circle data-anim="oc" cx="110" cy={AXIS} r="88" pathLength={1} strokeDasharray={1}
          className="text-foreground/30" {...hair} strokeWidth={1} />
        <g data-anim="otext" fill="currentColor" className="font-display text-foreground" textAnchor="middle">
          {startLines.map((l, i) => (
            <text key={i} x="110" y={AXIS - 38 + i * 26} fontSize="19" fontWeight="600">{l}</text>
          ))}
        </g>

        {/* Connector label between origin and the rings */}
        <g data-anim="via" fill="currentColor" className="font-display text-foreground" textAnchor="middle">
          {viaLines.map((l, i) => (
            <text key={i} x="309" y={AXIS - 44 + i * 28} fontSize="23" fontWeight="600">{l}</text>
          ))}
        </g>

        {/* Stage 01 keywords — small stack inside the inner rings, above its bracket */}
        <g fill="currentColor" className="text-muted-foreground" textAnchor="middle">
          {(stages[0]?.keywords ?? []).map((k, i) => (
            <text key={k} data-anim="kw" x="515" y={284 + i * 28} fontSize="16.5">{k}</text>
          ))}
        </g>

        {/* Stage 02 keywords — the diagonal cascade inside the rings */}
        <g fill="currentColor" className="text-muted-foreground">
          {(stages[1]?.keywords ?? []).map((k, i) => (
            <text key={k} data-anim="kw" x={560 + i * 22} y={150 + i * 35} fontSize="16.5">{k}</text>
          ))}
        </g>

        {/* Stage 03 keywords — two-line cluster near the outer ring */}
        <g fill="currentColor" className="text-muted-foreground" textAnchor="middle">
          {(() => {
            const kw = stages[2]?.keywords ?? [];
            const half = Math.ceil(kw.length / 2);
            return [kw.slice(0, half), kw.slice(half)]
              .filter((l) => l.length)
              .map((l, i) => (
                <text key={i} data-anim="kw" x="860" y={200 + i * 28} fontSize="16.5">{l.join(' · ')}</text>
              ));
          })()}
        </g>

        {/* Stage 04 keywords — single edge label at the rim, by the diagonal */}
        {stages[3] && (
          <text data-anim="kw" x="1040" y="130" fontSize="16.5" textAnchor="middle"
            fill="currentColor" className="text-muted-foreground">
            {stages[3].keywords.join(' · ')}
          </text>
        )}

        {/* Bracket segments under the axis, one per stage */}
        {SEGS.map(([x1, x2], i) => (
          <g key={i}>
            <line data-anim="vline" x1={x1} y1={AXIS - 14} x2={x1} y2={460} className="text-foreground/15" {...hair} strokeWidth={1} />
            <text data-anim="blabel" x={(x1 + x2) / 2} y="418" fontSize="21" fontWeight="600" textAnchor="middle"
              fill="currentColor" className="font-display text-foreground">
              <tspan className="text-accent" fill="currentColor">• </tspan>
              {stages[i]?.title}
            </text>
            <path data-anim="bline" d={`M ${x1 + 6} 444 L ${x1 + 6} 452 L ${x2 - 6} 452 L ${x2 - 6} 444`}
              pathLength={1} strokeDasharray={1} className="text-foreground/30" {...hair} strokeWidth={1} />
          </g>
        ))}
        <line data-anim="vline" x1="1168" y1={AXIS - 14} x2="1168" y2={460} className="text-foreground/15" {...hair} strokeWidth={1} />

        {/* Terminus — big display label above the axis, reference's "Value Up" */}
        <g data-anim="end" fill="currentColor" className="font-display text-foreground" textAnchor="end">
          {endLines.map((l, i) => (
            <text key={i} x="1164" y={AXIS - 58 + i * 42} fontSize="36" fontWeight="600">{l}</text>
          ))}
        </g>
      </svg>

      {/* ── Mobile: vertical timeline ───────────────────────────────────── */}
      <div data-layout="sm" className="relative mt-14 lg:hidden">
        <ol className="relative space-y-10 pl-10">
          <span data-anim="track-v" className="absolute left-[7px] top-2 bottom-2 w-px origin-top bg-foreground/25" aria-hidden />

          <li data-anim="origin" className="relative">
            <span className="absolute -left-10 top-0 grid h-4 w-4 place-items-center rounded-full border border-foreground/40">
              <span data-anim="node" className="h-1.5 w-1.5 rounded-full bg-foreground/50" />
            </span>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{start}</p>
          </li>

          {stages.map((s, i) => (
            <li key={i} data-anim="stage" className="relative">
              <span data-anim="node" className="absolute -left-10 top-1 h-3 w-3 rotate-45 border border-foreground/60 bg-background" />
              <span className="text-eyebrow font-semibold text-accent">0{i + 1}</span>
              <h3 className="mt-2 font-display text-lg font-semibold">{s.title}</h3>
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {s.keywords.map((k) => (
                  <li key={k} className="text-sm text-muted-foreground">{k}</li>
                ))}
              </ul>
            </li>
          ))}

          <li data-anim="end" className="relative">
            <span data-anim="node" className="absolute -left-[38px] top-1.5 text-accent">↓</span>
            <p className="font-display text-2xl font-semibold">{end}</p>
          </li>
        </ol>
      </div>
    </section>
  );
}
