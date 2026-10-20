import { type PropsWithChildren, useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  type EdgeInsets,
} from 'react-native-safe-area-context';

import { measureSafeAreaEnvInsets, sameInsets } from './safe-area-env-insets';

// Expo Router (SDK 58) hard-codes zero safe-area insets on web (see its
// build/SafeAreaProvider.js: measuring at hydration can discard streamed
// content), so with `viewport-fit=cover` in src/app/+html.tsx the notch and
// home-indicator insets stopped reaching the safe-area hooks. This reads the
// CSS `env(safe-area-inset-*)` values instead and provides them for the app's
// web tree. Inset state starts at zero to match the server-rendered output,
// then updates in an effect so hydration never mismatches.
//
// Not react-native-safe-area-context's own `SafeAreaProvider`: on web it
// clamps the insets to its element's bounding rect, and here the document
// scrolls, so a page taller than the viewport would report a bottom inset as
// tall as the overflow. These insets are measured against the window.

const ZERO_INSETS: EdgeInsets = { top: 0, bottom: 0, left: 0, right: 0 };

/** Web-only: provides real safe-area insets to everything inside the web chrome. */
export function WebSafeAreaProvider({ children }: Readonly<PropsWithChildren>) {
  const { width, height } = useWindowDimensions();
  const [insets, setInsets] = useState<EdgeInsets>(ZERO_INSETS);

  useEffect(() => {
    // iPhone Safari fires `resize` continuously while its toolbar collapses
    // during a scroll. Measure at most once per frame, and keep the previous
    // object when nothing changed: a fresh one re-renders every inset
    // consumer (the whole home screen) mid-scroll, which makes scrolling janky.
    let frame = 0;
    const measure = () => {
      frame = 0;
      const next = measureSafeAreaEnvInsets(globalThis.document);
      setInsets((current) => (sameInsets(current, next) ? current : next));
    };
    const scheduleMeasure = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };
    measure();
    globalThis.addEventListener('resize', scheduleMeasure);
    return () => {
      globalThis.removeEventListener('resize', scheduleMeasure);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <SafeAreaInsetsContext.Provider value={insets}>
      <SafeAreaFrameContext.Provider value={{ x: 0, y: 0, width, height }}>
        {children}
      </SafeAreaFrameContext.Provider>
    </SafeAreaInsetsContext.Provider>
  );
}
