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

// ── Diagram geometry (viewBox 1200 × 640, axis at y = 360) ──────────────────
const AXIS = 360;
const START = 420; // where the transformation begins — every ring passes through this point
const SEGS: [number, number][] = [[420, 610], [610, 800], [800, 990], [990, 1168]];
const NODES = [20, 198, 420, 610, 800, 990];

// The reference's circle logic: each stage's circle is TANGENT to the shared
// start point, its diameter spanning from START to that stage's end node — the
// rings read as the expanding reach of the pipeline, one ring per stage.
const RINGS = SEGS.map(([, end], i) => ({
  cx: (START + end) / 2,
  r: (end - START) / 2,
  cls: ['text-foreground/30', 'text-foreground/25', 'text-foreground/20', 'text-foreground/15'][i],
}));

// Each stage's keywords live inside ITS ring band (between its circle and the
// previous one), in the upper half — hand-placed like the reference drawing.
const KW_POS: ((i: number) => { x: number; y: number; anchor: 'start' | 'middle' | 'end' })[] = [
  (i) => ({ x: 515, y: 285 + i * 26, anchor: 'middle' }),        // stage 01 — inside the smallest ring
  (i) => ({ x: 585 + i * 24, y: 190 + i * 34, anchor: 'start' }), // stage 02 — diagonal cascade in band 2
  (i) => ({ x: 880, y: 180 + i * 28, anchor: 'middle' }),         // stage 03 — cluster in band 3 (2 merged lines)
  () => ({ x: 1040, y: 130, anchor: 'middle' }),                  // stage 04 — edge label in the outer band
];

/** Stage keywords → the terse lines drawn for that stage (03 merges pairs, 04 joins all). */
function kwLines(stage: Stage | undefined, idx: number): string[] {
  const kw = stage?.keywords ?? [];
  if (idx === 2) {
    const half = Math.ceil(kw.length / 2);
    return [kw.slice(0, half).join(' · '), kw.slice(half).join(' · ')].filter(Boolean);
  }
  if (idx === 3) return kw.length ? [kw.join(' · ')] : [];
  return kw;
}

/**
 * "Why Fursatly" as a hand-composed process drawing, literal to the reference
 * (penguin-capital.co.jp "Creating Value") — including its circle logic: all
 * rings are tangent at the transformation-start node, one ring per stage, each
 * stage's keywords contained in its own ring band. The whole thing self-draws
 * as a left→right narrative: origin → axis → per stage (ring blooms from the
 * shared point → its keywords → its bracket) → diagonal → terminus, with a
 * subtle scroll-scrubbed parallax on the ring system.
 *
 * One SVG (viewBox 1200×640) so the composition scales as a drawing and can
 * never overflow; rings intentionally clip at the frame edges like the
 * reference. Mobile folds into the vertical timeline. Motion-gated like
 * Reveal: static with no JS on the reduced-motion tier.
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
          // Start once the diagram itself is well inside the viewport, so the
          // construction is actually WATCHED, not finished during the scroll.
          scrollTrigger: { trigger: el, start: 'top 55%', once: true },
        });

        if (desktop) {
          // The construction is led by a visible pen point — a compass tip that
          // physically travels every primary stroke while the stroke draws
          // under it. Same duration + ease as the paired dash tween keeps the
          // tip exactly on the advancing stroke end.
          const pen = q('pen');
          const EASE = 'power1.inOut';
          /** Pen sweeps a circle from angle offset (fraction of a turn). */
          const penCircle = (cx: number, cy: number, r: number, dur: number, flip: boolean) => {
            const p = { t: 0 };
            return gsap.to(p, {
              t: 1, duration: dur, ease: EASE,
              onUpdate() {
                const a = p.t * Math.PI * 2;
                // flip=false: start at 3 o'clock (plain circle); true: at 9 o'clock (rotated rings)
                const s = flip ? -1 : 1;
                gsap.set(pen, { attr: { cx: cx + s * r * Math.cos(a), cy: cy + s * r * Math.sin(a) } });
              },
            });
          };
          /** Pen runs a straight segment. */
          const penLine = (x1: number, y1: number, x2: number, y2: number, dur: number) => {
            const p = { t: 0 };
            return gsap.to(p, {
              t: 1, duration: dur, ease: EASE,
              onUpdate() {
                gsap.set(pen, { attr: { cx: x1 + (x2 - x1) * p.t, cy: y1 + (y2 - y1) * p.t } });
              },
            });
          };

          // ── Act 1: the origin circle is swept, then the axis is ruled ────
          tl.set(pen, { attr: { cx: 198, cy: AXIS }, opacity: 1 })
            .fromTo(q('oc'), draw, drawn(1.4, EASE))
            .add(penCircle(110, AXIS, 88, 1.4, false), '<')
            .fromTo(q('otext'), { opacity: 0 }, { opacity: 1, duration: 0.6 }, '-=0.5');

          const AXIS_DUR = 2.2;
          const axisAt = (x: number) => `axis+=${(AXIS_DUR * (x - 20)) / (1162 - 20)}`;
          tl.addLabel('axis')
            .fromTo(q('beam'), draw, drawn(AXIS_DUR, EASE), 'axis')
            .fromTo(q('axis'), draw, drawn(AXIS_DUR, EASE), 'axis')
            .add(penLine(20, AXIS, 1162, AXIS, AXIS_DUR), 'axis');
          // Nodes pop the moment the pen passes them; the connector label too.
          q('sq').forEach((node: Element, i: number) => {
            tl.fromTo(node, { scale: 0, opacity: 0 },
              { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2.5)' }, axisAt(NODES[i]));
          });
          tl.fromTo(q('via'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6 }, axisAt(309))
            .fromTo(q('arrow'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, axisAt(1150));

          // ── Act 2: each ring is drawn by the compass out of the shared
          // tangent point; its keywords + bracket follow before the next ring.
          for (let i = 0; i < 4; i++) {
            const { cx, r } = RINGS[i];
            tl.fromTo(q(`ring-${i}`), draw, drawn(1.35, EASE), i === 0 ? '+=0.05' : '-=0.35')
              .add(penCircle(cx, AXIS, r, 1.35, true), '<')
              .fromTo(q(`kw-${i}`), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.1 }, '-=0.45')
              .fromTo(q(`blabel-${i}`), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.45 }, '-=0.3')
              .fromTo(q(`bline-${i}`), draw, drawn(0.55, EASE), '<');
          }

          // ── Act 3: the ray out, pen lifts off, the payoff lands ──────────
          tl.fromTo(q('diag'), draw, drawn(1.2, EASE), '-=0.2')
            .add(penLine(START, AXIS, 1160, 55, 1.2), '<')
            .fromTo(q('vline'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, '<')
            .to(pen, { opacity: 0, duration: 0.35 }, '-=0.1')
            .fromTo(q('end'), { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.8 }, '-=0.6');

          // Continuous depth: the ring system drifts subtly with scroll.
          gsap.fromTo(q('para'), { y: 18 }, {
            y: -18,
            ease: 'none',
            scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
          });
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
        {/* Ring system + diagonal, on a scroll-parallax layer. Each ring is
            rotated 180° so its stroke draw starts at the shared tangent point
            and blooms outward — the pipeline's reach expanding stage by stage. */}
        <g data-anim="para">
          {RINGS.map(({ cx, r, cls }, i) => (
            <circle key={i} data-anim={`ring-${i}`} cx={cx} cy={AXIS} r={r}
              transform={`rotate(180 ${cx} ${AXIS})`} pathLength={1} strokeDasharray={1}
              className={cls} {...hair} strokeWidth={1} />
          ))}
          {/* Ray out of the tangent point, through the ring bands */}
          <line data-anim="diag" x1={START} y1={AXIS} x2="1160" y2="55" pathLength={1} strokeDasharray={1}
            className="text-foreground/15" {...hair} strokeWidth={1} />
        </g>

        {/* Axis: a soft wide beam under a crisp hairline, plus arrowhead */}
        <line data-anim="beam" x1="20" y1={AXIS} x2="1162" y2={AXIS} pathLength={1} strokeDasharray={1}
          className="text-foreground/[0.07]" stroke="currentColor" strokeWidth={7} />
        <line data-anim="axis" x1="20" y1={AXIS} x2="1162" y2={AXIS} pathLength={1} strokeDasharray={1}
          className="text-foreground/35" {...hair} strokeWidth={1.5} />
        <path data-anim="arrow" d="M1154 352 L1166 360 L1154 368" className="text-foreground/50" {...hair}
          strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />

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

        {/* Stage keywords — each cluster contained in its own ring band */}
        {stages.slice(0, 4).map((s, si) => (
          <g key={si} fill="currentColor" className="text-muted-foreground">
            {kwLines(s, si).map((line, li) => {
              const p = KW_POS[si](li);
              return (
                <text key={li} data-anim={`kw-${si}`} x={p.x} y={p.y} fontSize="16.5" textAnchor={p.anchor}>
                  {line}
                </text>
              );
            })}
          </g>
        ))}

        {/* Bracket segments under the axis, one per stage */}
        {SEGS.map(([x1, x2], i) => (
          <g key={i}>
            <line data-anim="vline" x1={x1} y1={AXIS - 14} x2={x1} y2={460} className="text-foreground/15" {...hair} strokeWidth={1} />
            <text data-anim={`blabel-${i}`} x={(x1 + x2) / 2} y="418" fontSize="21" fontWeight="600" textAnchor="middle"
              fill="currentColor" className="font-display text-foreground">
              <tspan className="text-accent" fill="currentColor">• </tspan>
              {stages[i]?.title}
            </text>
            <path data-anim={`bline-${i}`} d={`M ${x1 + 6} 444 L ${x1 + 6} 452 L ${x2 - 6} 452 L ${x2 - 6} 444`}
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

        {/* The pen — the compass tip that leads every stroke while it draws.
            Hidden until the timeline picks it up (and always, on reduced-motion). */}
        <circle data-anim="pen" cx="198" cy={AXIS} r="4" opacity="0"
          fill="hsl(var(--accent))" stroke="hsl(var(--background))" strokeWidth="1.5" />
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
