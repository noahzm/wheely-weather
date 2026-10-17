import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useResolvedTempUnit } from '@/hooks/settings-context';
import type { ForecastSnapshot } from '@/services/forecastSnapshot';
import { publishWidgetSnapshot } from '@/services/widgetStorage';
import { buildWidgetSnapshot } from '@/services/widgetSnapshot';

/**
 * Keeps the home screen widget on the forecast the app is showing. Unlike the
 * forecast cache, watching state is safe here: the payload comes only from the
 * snapshot (its weather and its own location label), never paired with
 * `savedLocation`, so a mid-switch render can't mislabel it. Mock previews are
 * dropped by `buildWidgetSnapshot`. Re-runs on unit changes so the widget
 * follows the setting. iOS only: no other platform has a widget, and the
 * payload re-rates the forecast for each hour ahead.
 */
export function useWidgetSync(snapshot: ForecastSnapshot | null): void {
  const tempUnit = useResolvedTempUnit();
  useEffect(() => {
    if (Platform.OS !== 'ios' || !snapshot) return;
    const widget = buildWidgetSnapshot(snapshot, tempUnit);
    if (widget) publishWidgetSnapshot(widget);
  }, [snapshot, tempUnit]);
}
