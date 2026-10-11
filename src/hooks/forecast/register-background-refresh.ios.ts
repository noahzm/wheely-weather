// iOS: let the system wake the app now and then to refresh the home screen
// widget from a new forecast (background-refresh.ts). iOS decides when: the
// interval is only a minimum, and runs come every few hours at best, more
// often overnight.
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { getForecastErrorKind } from '@/services/forecastSnapshot';
import { captureError } from '@/services/telemetry';

import { refreshWidgetInBackground } from './background-refresh';

const TASK_NAME = 'wheely-widget-refresh';
const MINIMUM_INTERVAL_MINUTES = 60;

// Defined at module load: iOS can launch the app straight into the task.
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    await refreshWidgetInBackground();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    // A flaky connection in the background isn't a bug; anything else is.
    if (getForecastErrorKind(error) !== 'network') {
      captureError(error, { where: 'refreshWidgetInBackground' });
    }
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Schedules the background refresh; safe to call on every launch. */
export function registerBackgroundRefresh(): void {
  BackgroundTask.registerTaskAsync(TASK_NAME, {
    minimumInterval: MINIMUM_INTERVAL_MINUTES,
  }).catch((error: unknown) => {
    captureError(error, { where: 'registerBackgroundRefresh' });
  });
}
