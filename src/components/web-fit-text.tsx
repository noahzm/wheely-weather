import { useEffect, useLayoutEffect, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, Text, useWindowDimensions, type TextProps } from 'react-native';

/** Used when a caller sets no `minimumFontScale`. */
const DEFAULT_MIN_SCALE = 0.5;
/** `scrollWidth` rounds to whole pixels, so the text is fitted a pixel inside its box. */
const FIT_SLACK_PX = 1;

/** Counts finished web font loads: a face swapping in changes every text's width. */
function useFontLoadCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const fonts = (globalThis.document as Document | undefined)?.fonts;
    if (!fonts) return;
    const bump = () => {
      setCount((n) => n + 1);
    };
    fonts.addEventListener('loadingdone', bump);
    return () => {
      fonts.removeEventListener('loadingdone', bump);
    };
  }, []);
  return count;
}

/** The scale that fits the text in its box, or `scale` when it already fits. */
function fitScale(el: HTMLElement, scale: number, minScale: number): number {
  const { scrollWidth, clientWidth } = el;
  if (clientWidth === 0 || scrollWidth <= clientWidth) return scale;
  return Math.max(minScale, (scale * (clientWidth - FIT_SLACK_PX)) / scrollWidth);
}

/**
 * Web stand-in for `adjustsFontSizeToFit` on a one-line text, which
 * react-native-web ignores (the text just ellipsizes). After layout it scales
 * the font size down until the text fits, no smaller than `minimumFontScale`,
 * and keeps the line height so nothing around it moves. Nested texts with a
 * size of their own keep it; the shrink repeats until the line fits. A change
 * of text, window width or web font starts over from full size.
 */
export function WebFitText({
  style,
  minimumFontScale,
  adjustsFontSizeToFit: _adjustsFontSizeToFit,
  children,
  ...rest
}: Readonly<TextProps>) {
  const ref = useRef<ComponentRef<typeof Text>>(null);
  const { width } = useWindowDimensions();
  const fontLoads = useFontLoadCount();
  const [fit, setFit] = useState({ scale: 1, basis: '' });
  const minScale =
    minimumFontScale != null && minimumFontScale > 0 ? minimumFontScale : DEFAULT_MIN_SCALE;
  const baseFontSize = StyleSheet.flatten(style)?.fontSize;

  // Before paint, so a long text never flashes cut off. Each pass either
  // records a fit or shrinks a step further, so it settles in a pass or two.
  useLayoutEffect(() => {
    const el = ref.current as unknown as HTMLElement | null;
    if (!el || baseFontSize == null) return;
    const basis = `${el.textContent}|${width}|${fontLoads}`;
    if (basis !== fit.basis && fit.scale !== 1) {
      setFit({ scale: 1, basis: '' });
      return;
    }
    const scale = fitScale(el, fit.scale, minScale);
    if (scale !== fit.scale || basis !== fit.basis) setFit({ scale, basis });
  }, [children, width, fontLoads, fit, minScale, baseFontSize]);

  // A sibling growing (the home title's location arrow) can squeeze the text
  // without a re-render here, so its own box changing size is checked too.
  useEffect(() => {
    const el = ref.current as unknown as HTMLElement | null;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      setFit((current) => {
        const scale = fitScale(el, current.scale, minScale);
        return scale === current.scale ? current : { ...current, scale };
      });
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [minScale]);

  return (
    <Text
      ref={ref}
      style={[
        style,
        baseFontSize != null && fit.scale !== 1 && { fontSize: baseFontSize * fit.scale },
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
