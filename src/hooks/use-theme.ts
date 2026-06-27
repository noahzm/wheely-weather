/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { createContext, useContext } from 'react';

import { WheelyTheme, type WheelyPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type ColorSchemeName = 'light' | 'dark';

/**
 * Lets a parent (e.g. a Storybook decorator) force a color scheme instead of
 * reading the OS preference. `null` means "follow the system".
 */
export const ColorSchemeOverrideContext = createContext<ColorSchemeName | null>(null);

export function useColorSchemeName(): ColorSchemeName {
  const override = useContext(ColorSchemeOverrideContext);
  const scheme = useColorScheme();
  // `useColorScheme()` can return 'light' | 'dark' | 'unspecified' | null | undefined
  // depending on platform, so treat anything that isn't an explicit 'dark' as light.
  return override ?? (scheme === 'dark' ? 'dark' : 'light');
}

/** Resolves the neobrutalist Wheely palette for the active color scheme. */
export function useWheelyColors(): WheelyPalette {
  return WheelyTheme[useColorSchemeName()];
}
