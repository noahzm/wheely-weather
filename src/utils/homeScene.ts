/** The compact navigation bar's height under the status bar (iOS). */
const NAV_BAR_HEIGHT = 44;

/**
 * Whether the home scene's sky is still what sits under the status bar at a
 * scroll offset. The large-title screen rests at a negative offset (its
 * content inset); once content scrolls up under the compact navigation bar,
 * the bar blurs the page instead, so the sky is gone from behind the status
 * bar. Pulling down past the rest position keeps the sky there.
 */
export function isSkyUnderStatusBar(scrollY: number, topInset: number): boolean {
  return scrollY < -(topInset + NAV_BAR_HEIGHT);
}
