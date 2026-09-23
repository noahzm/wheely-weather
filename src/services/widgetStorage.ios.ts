import { ExtensionStorage } from '@bacons/apple-targets';

import type { WidgetSnapshot } from '@/utils/widgetSnapshot';

import { captureError } from './telemetry';

// Must match the App Group in app.json and WheelyWidget.swift's `appGroup`.
const APP_GROUP = 'group.app.wheelyweather';
// Read by WheelyWidget.swift's `SnapshotStore.key`.
const SNAPSHOT_KEY = 'widgetSnapshot';

const storage = new ExtensionStorage(APP_GROUP);

/**
 * Writes the verdict to the App Group the widget reads, then asks WidgetKit to
 * redraw. Stored as a JSON string so the widget can decode it with Codable.
 * Without a native rebuild the module is absent and ExtensionStorage no-ops.
 */
export function publishWidgetSnapshot(snapshot: WidgetSnapshot): void {
  try {
    storage.set(SNAPSHOT_KEY, JSON.stringify(snapshot));
    ExtensionStorage.reloadWidget();
  } catch (error) {
    captureError(error, { where: 'publishWidgetSnapshot' });
  }
}
