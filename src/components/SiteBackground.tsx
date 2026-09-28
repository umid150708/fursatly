/**
 * Fixed, site-wide paper: the newsprint colour plus a faint fibre grain, held
 * still behind the content. Pure CSS — see `.paper-grain` in globals.css.
 */
export function SiteBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-background">
      <div className="paper-grain absolute inset-0" />
    </div>
  );
}
