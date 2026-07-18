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
    root.style.setProperty('--wheely-paper', palette.paper);
    root.style.setProperty('--wheely-ink', palette.ink);
    root.style.setProperty('--wheely-muted-ink', palette.mutedInk);
    root.style.setProperty('--wheely-border', palette.border);
    root.style.setProperty('--wheely-shadow', palette.shadow);
    root.style.setProperty('--wheely-primary', palette.primary);
    root.style.setProperty('--wheely-primary-ink', palette.primaryInk);
    root.style.setProperty('--wheely-accent', palette.accent);
    root.style.setProperty('--wheely-success', palette.success);
    root.style.setProperty('--wheely-warning', palette.warning);
    root.style.setProperty('--wheely-error', palette.error);
    root.style.colorScheme = isDark ? 'dark' : 'light';
    root.dataset.theme = isDark ? 'dark' : 'light';
    root.dataset.appearance = appearance;
    root.dataset.systemScheme = systemScheme;
  }, [appearance, isDark, systemScheme]);
}
