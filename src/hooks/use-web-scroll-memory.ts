import { useEffect, useLayoutEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { usePathname } from 'expo-router';

// About half a second at 60 fps.
const RESTORE_FRAMES = 30;

/**
 * Web: gives each page its own scroll position, as native tabs do. The
 * document is the scroller and survives navigation, so without this a tab
 * opens wherever the last one was scrolled to.
 */
export function useWebScrollMemory() {
  const pathname = usePathname();
  const positions = useRef(new Map<string, number>());
  const current = useRef(pathname);

  // Recorded as the page scrolls: by the time the path changes, the new page
  // has rendered and a shorter document may already have clamped scrollY.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // The app restores positions itself; the browser's guess fights it on back/forward.
    globalThis.history.scrollRestoration = 'manual';
    const record = () => {
      positions.current.set(current.current, globalThis.scrollY);
    };
    globalThis.addEventListener('scroll', record, { passive: true });
    return () => {
      globalThis.removeEventListener('scroll', record);
    };
  }, []);

  // Layout effect: switches the recorded path before the browser can fire a
  // scroll event for the new page, which would otherwise land on the old one.
  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || current.current === pathname) return;
    current.current = pathname;
    const target = positions.current.get(pathname) ?? 0;
    // The page can still be growing for a few frames (sections mount after
    // the shell), and scrollTo clamps to the current height, so retry until
    // the position lands or the page stops getting taller.
    let frame = 0;
    let attempts = 0;
    const restore = () => {
      globalThis.scrollTo(0, target);
      attempts += 1;
      if (Math.abs(globalThis.scrollY - target) > 1 && attempts < RESTORE_FRAMES) {
        frame = requestAnimationFrame(restore);
      }
    };
    frame = requestAnimationFrame(restore);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [pathname]);
}
