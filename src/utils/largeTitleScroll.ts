import { NAV_BAR_HEIGHT } from './homeScene';

/**
 * How much taller the navigation bar is with its large title expanded (iOS).
 * Only a fallback: the measured rest offset is used whenever there is one.
 */
const LARGE_TITLE_HEIGHT = 54;

/**
 * Folds a scroll offset into the large-title screen's rest offset: where its
 * content sits at the top with the title expanded. UIKit sets that offset
 * itself when the screen first lays out, and the expanded title's inset is
 * the largest the screen gets, so the rest is the lowest offset seen before
 * anything else (a drag, pull to refresh) moves the page.
 */
export function foldRestOffset(rest: number | null, offsetY: number): number {
  return rest == null ? offsetY : Math.min(rest, offsetY);
}

/**
 * The offset to scroll to for "back to the top" with the large title open.
 * Scrolling only to the current inset's edge, as a plain scroll to top does,
 * leaves a collapsed title collapsed (and, at the scroll edge, without its
 * bar background); going past it to the expanded rest offset lets the bar
 * expand the title again. Without a measured rest offset, it's estimated
 * from the status bar inset and the standard bar heights.
 */
export function largeTitleTopOffset(rest: number | null, topInset: number): number {
  if (rest != null && rest < 0) return rest;
  return -(topInset + NAV_BAR_HEIGHT + LARGE_TITLE_HEIGHT);
}
