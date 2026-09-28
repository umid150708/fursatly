/** The Fursatly nameplate — a heavy newspaper serif with a vermilion full stop. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display font-black tracking-[-0.045em] ${className}`}>
      Fursatly<span className="text-accent">.</span>
    </span>
  );
}
