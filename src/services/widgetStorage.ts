import type { WidgetSnapshot } from '@/utils/widgetSnapshot';

/**
 * Hands the latest verdict to the home screen widget. Only iOS has a widget
 * (widgetStorage.ios.ts); web and Android drop it.
 */
export function publishWidgetSnapshot(_snapshot: WidgetSnapshot): void {
  // No widget on this platform.
}
