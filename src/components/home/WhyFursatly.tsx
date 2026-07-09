'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useMotion } from '@/components/motion/MotionConfig';
import { SectionHeader } from '@/components/home/SectionHeader';

interface Stage {
  title: string;
  keywords: string[];
}

/**
 * "Why Fursatly" — presented as a self-drawing process journey in the spirit of
 * an architectural blueprint (à la penguin-capital.co.jp): raw listings flow
 * left→right along a hairline axis through four transformation stages and arrive
 * as something "ready for you". On scroll, the axis and concentric circles stroke
 * themselves in and each stage's label reveals in sequence along the path.
 *
 * Desktop draws the horizontal axis; mobile folds it into a vertical timeline.
 * One GSAP timeline, scoped to whichever layout is visible. Motion-gated like
 * Reveal: renders fully visible with no JS on the reduced-motion tier.
 */
export function WhyFursatly({
  lead,
  index,
  title,
  start,
  end,
  stages,
}: {
  lead: string;
  index: string;
  title: string;
  start: string;
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
        const q = (sel: string) => self.selector!(sel);
        const inLayout = (name: string) => q(scope + `[data-anim="${name}"]`);

        const tl = gsap.timeline({
          defaults: { ease: 'expo.out' },
          scrollTrigger: { trigger: el, start: 'top 70%', once: true },
        });

        tl.fromTo(inLayout('origin'), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' })
          .fromTo(q('[data-anim="circle"]'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.9, stagger: 0.18, ease: 'power2.inOut' }, '<')
          .fromTo(inLayout('track-h'), { scaleX: 0 }, { scaleX: 1, duration: 1.3, ease: 'power2.inOut' }, '<')
          .fromTo(inLayout('track-v'), { scaleY: 0 }, { scaleY: 1, duration: 1.3, ease: 'power2.inOut' }, '<')
          .fromTo(inLayout('node'), { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, stagger: 0.14, ease: 'back.out(2)' }, '-=1.05')
          .fromTo(inLayout('stage'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.14 }, '-=1.0')
          .fromTo(inLayout('end'), { opacity: 0, x: -12 }, { opacity: 1, x: 0, duration: 0.7 }, '-=0.2');
      }, el);
    })();

    return () => ctx?.revert();
  }, [motion]);

  // Concentric rings act as containers for the stage keywords — the copy sits
  // inside them (à la the reference's "Creating Value" diagram), centred over
  // the right half of the journey where the transformation happens.
  const circles = (
    <svg
      className="pointer-events-none absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-[38%] -translate-y-1/2 text-foreground/[0.18]"
      viewBox="0 0 320 320"
      fill="none"
      aria-hidden
    >
      {[72, 116, 158].map((r) => (
        <circle key={r} data-anim="circle" cx="160" cy="160" r={r} pathLength={1} strokeDasharray={1} stroke="currentColor" strokeWidth={0.5} />
      ))}
    </svg>
  );

  return (
    <section ref={root} className="container relative overflow-hidden py-24 md:py-32">
      <SectionHeader label={lead} index={index} title={title} />

      {/* ── Desktop: horizontal journey ─────────────────────────────────── */}
      <div data-layout="lg" className="relative mt-24 hidden lg:block">
        {circles}

        {/* Axis line + arrowhead, vertically centred through the row */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2" aria-hidden>
          <span data-anim="track-h" className="block h-px w-full origin-left bg-foreground/25" />
          <svg data-anim="node" className="absolute -right-1 top-1/2 h-3 w-3 -translate-y-1/2 text-foreground/50" viewBox="0 0 12 12" fill="none">
            <path d="M2 2 L8 6 L2 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="relative flex items-stretch">
          {/* Origin */}
          <div data-anim="origin" className="flex w-40 shrink-0 flex-col items-center justify-center text-center">
            <span className="grid h-24 w-24 place-items-center rounded-full border border-foreground/25">
              <span data-anim="node" className="h-2.5 w-2.5 rotate-45 border border-foreground/60 bg-background" />
            </span>
            <p className="mt-4 max-w-[9rem] text-xs leading-snug text-muted-foreground">{start}</p>
          </div>

          {/* Four transformation stages */}
          {stages.map((s, i) => (
            <div key={i} className="flex min-h-[340px] flex-1 flex-col">
              <div data-anim="stage" className="flex flex-1 flex-col justify-end pb-6 text-center">
                <h3 className="font-display text-xl font-semibold leading-tight xl:text-2xl">{s.title}</h3>
              </div>
              <div className="relative flex h-0 items-center justify-center">
                <span data-anim="node" className="h-3 w-3 rotate-45 border border-foreground/60 bg-background" />
              </div>
              <div data-anim="stage" className="flex flex-1 flex-col items-center pt-6 text-center">
                <span className="text-eyebrow font-semibold text-accent">0{i + 1}</span>
                <ul className="mt-3 space-y-1.5">
                  {s.keywords.map((k) => (
                    <li key={k} className="text-sm text-muted-foreground">{k}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}

          {/* Terminus */}
          <div data-anim="end" className="flex w-48 shrink-0 flex-col items-start justify-center pl-6">
            <span className="text-eyebrow text-accent">↗</span>
            <p className="mt-2 font-display text-3xl font-semibold leading-none xl:text-4xl">{end}</p>
          </div>
        </div>
      </div>

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
