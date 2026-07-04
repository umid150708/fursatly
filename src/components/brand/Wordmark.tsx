/** The Fursatly logotype — geometric display face + a teal accent stop. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display font-bold tracking-[-0.03em] ${className}`}>
      Fursatly<span className="text-accent">.</span>
    </span>
  );
}
