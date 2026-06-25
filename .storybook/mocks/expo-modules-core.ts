import { Platform as ReactNativePlatform } from 'react-native';

export const Platform = ReactNativePlatform;

export class CodedError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

export class UnavailabilityError extends Error {
  constructor(moduleName: string, propertyName: string) {
    super(`${moduleName}.${propertyName} is unavailable in Storybook.`);
  }
}

export class EventEmitter {
  addListener() {
    return { remove() {} };
  }

  removeListener() {}

  removeAllListeners() {}

  emit() {}

  listenerCount() {
    return 0;
  }
}

export class NativeModule {}

export class SharedObject {}

export class SharedRef {}

export function requireNativeModule() {
  return {};
}

export function requireOptionalNativeModule() {
  return null;
}

export function requireNativeViewManager() {
  return {};
}

export function registerWebModule(module: unknown) {
  return module;
}

export function createSnapshotFriendlyRef(ref: unknown) {
  return ref;
}

export function uuid() {
  return Math.random().toString(36).slice(2);
}

export async function reloadAppAsync() {}

export function installOnUIRuntime() {}

export const PermissionStatus = {
  UNDETERMINED: 'undetermined',
  DENIED: 'denied',
  GRANTED: 'granted',
} as const;

export function createPermissionHook() {
  return () => [null, async () => null, async () => null] as const;
}

export default {
  Platform,
  CodedError,
  UnavailabilityError,
  EventEmitter,
  NativeModule,
  SharedObject,
  SharedRef,
  requireNativeModule,
  requireOptionalNativeModule,
  requireNativeViewManager,
  registerWebModule,
  createSnapshotFriendlyRef,
  uuid,
  reloadAppAsync,
  installOnUIRuntime,
  PermissionStatus,
  createPermissionHook,
};
