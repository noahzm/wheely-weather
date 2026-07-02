import { useEffect } from 'react';
import { Platform } from 'react-native';

import { WheelyTheme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAppearance } from '@/hooks/settings-context';

/** Syncs `html/body/#root` background and `color-scheme` with the resolved palette on web. */
export function useWebDocumentTheme(isDark: boolean) {
  const systemScheme = useColorScheme();
  const [appearance] = useAppearance();

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const root = globalThis.document.documentElement;
    const palette = WheelyTheme[isDark ? 'dark' : 'light'];
    root.style.setProperty('--wheely-background', palette.background);
    root.style.colorScheme = isDark ? 'dark' : 'light';
    root.dataset.appearance = appearance;
    root.dataset.systemScheme = systemScheme;
  }, [appearance, isDark, systemScheme]);
}
