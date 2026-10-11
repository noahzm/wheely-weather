/**
 * Only iOS refreshes in the background (register-background-refresh.ios.ts):
 * it's the only platform with a widget to keep current.
 */
export function registerBackgroundRefresh(): void {
  // Nothing to refresh on this platform.
}
