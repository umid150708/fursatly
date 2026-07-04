/**
 * Fixed, site-wide atmospheric backdrop: topographic contour texture + soft
 * accent glows + vertical grid lines + film grain. Sits behind all content
 * (stays fixed while the page scrolls, for depth). Subtle in light mode,
 * dramatic in dark. Pure CSS — see `.site-atmos` / `.grid-lines` / `.site-grain`.
 */
export function SiteBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="site-atmos absolute inset-0" />
      <div className="grid-lines absolute inset-0 opacity-30 dark:opacity-50" />
      <div className="site-grain absolute inset-0" />
    </div>
  );
}
