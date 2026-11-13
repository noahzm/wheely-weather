import { CONDITION_DISPLAY, getRideVerdict } from '@/domain';
import { useForecast } from '@/hooks/forecast-context';
import { useResolvedTempUnit } from '@/hooks/settings-context';
import { previewRideLength } from '@/services/rideLengthPreview';
import type { RideDuration } from '@/types/settings';
import { formatHourSpan } from '@/utils/timeFormat';

export interface RideLengthPreviewInfo {
  timing: string | null;
  conditionText: string;
  fallbackText: string;
}

/** Computes the ride window timing and condition summary for a draft ride duration. */
export function useRideLengthPreview(draft: RideDuration): RideLengthPreviewInfo {
  const { snapshot } = useForecast();
  const unit = useResolvedTempUnit();
  const weather = snapshot ? previewRideLength(snapshot, draft) : null;
  const verdict =
    weather && snapshot ? getRideVerdict(weather, snapshot.acclimatization.thresholds, unit) : null;
  const window = verdict?.window;
  const day = verdict?.when === 'tomorrow' ? 'Tomorrow' : 'Today';
  const warning = verdict?.status === 'no' ? ' · Riding not recommended' : '';
  const timing = window ? `${day} · ${formatHourSpan(window.startHour, window.endHour)}` : null;
  const conditionText = verdict
    ? `${CONDITION_DISPLAY[verdict.condition]} conditions${warning}`
    : '';
  const fallbackText = weather
    ? 'No ride window available in this forecast.'
    : 'Apply this length to refresh your ride window.';

  return { timing, conditionText, fallbackText };
}
