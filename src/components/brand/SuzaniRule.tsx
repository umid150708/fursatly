/** A whisper of Uzbek identity: a thin suzani-dashed divider with a center
 *  atlas diamond. The only motif that survives the minimal redesign. */
export function SuzaniRule({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden>
      <span className="suzani-rule flex-1" />
      <svg width="9" height="9" viewBox="0 0 10 10" className="shrink-0 text-accent">
        <path d="M5 0l5 5-5 5-5-5z" fill="currentColor" />
      </svg>
      <span className="suzani-rule flex-1" />
    </div>
  );
}
