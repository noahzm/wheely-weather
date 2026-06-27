// Thin, fire-and-forget wrappers around expo-haptics. Haptics are a polish layer:
// failures (e.g. unsupported on web) are swallowed so callers never need to await
// or guard.
import * as Haptics from 'expo-haptics';

const VERDICT_FEEDBACK = {
  yes: Haptics.NotificationFeedbackType.Success,
  maybe: Haptics.NotificationFeedbackType.Warning,
  no: Haptics.NotificationFeedbackType.Error,
} as const;

function ignore() {
  // Swallow rejections; haptics are best-effort.
}

/** Light selection tick — for buttons, rows, and segmented controls. */
export function selectionFeedback() {
  Haptics.selectionAsync().catch(ignore);
}

/** Notification haptic matched to the ride verdict's tone. */
export function verdictFeedback(status: 'yes' | 'maybe' | 'no') {
  Haptics.notificationAsync(VERDICT_FEEDBACK[status]).catch(ignore);
}
