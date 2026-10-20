import type { EdgeInsets } from 'react-native-safe-area-context';

// Pure DOM helper, kept free of react-native imports so it can be unit-tested
// in Node (see src/components/wheely/web-safe-area-provider.tsx for usage).

/**
 * Reads the viewport's CSS `env(safe-area-inset-*)` values through a hidden
 * fixed-position probe: the computed style resolves `env()` to pixels once the
 * element participates in layout. Unresolvable values fall back to 0.
 */
export function measureSafeAreaEnvInsets(doc: Document): EdgeInsets {
  const probe = doc.createElement('div');
  probe.style.position = 'fixed';
  probe.style.top = '0';
  probe.style.left = '0';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style.paddingTop = 'env(safe-area-inset-top)';
  probe.style.paddingBottom = 'env(safe-area-inset-bottom)';
  probe.style.paddingLeft = 'env(safe-area-inset-left)';
  probe.style.paddingRight = 'env(safe-area-inset-right)';
  doc.body.append(probe);
  const view = doc.defaultView;
  if (!view) {
    probe.remove();
    return ZERO_INSETS;
  }
  const style = view.getComputedStyle(probe);
  const insets: EdgeInsets = {
    top: readInsetPx(style.paddingTop),
    bottom: readInsetPx(style.paddingBottom),
    left: readInsetPx(style.paddingLeft),
    right: readInsetPx(style.paddingRight),
  };
  probe.remove();
  return insets;
}

const ZERO_INSETS: EdgeInsets = { top: 0, bottom: 0, left: 0, right: 0 };

/** Parses a computed CSS length as pixels, falling back to 0 when unresolvable. */
const readInsetPx = (value: string): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
