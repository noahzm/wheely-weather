import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useWheelyColors } from '@/hooks/use-theme';
import { SettingsProvider } from '@/hooks/settings-context';

interface StorySurfaceProps {
  children: ReactNode;
  centered?: boolean;
  maxWidth?: number;
}

export function StorySurface({
  children,
  centered = false,
  maxWidth = 760,
}: Readonly<StorySurfaceProps>) {
  const c = useWheelyColors();
  return (
    <SettingsProvider>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          centered && styles.centered,
          { backgroundColor: c.background },
        ]}
      >
        <View style={[styles.inner, { maxWidth }]}>{children}</View>
      </ScrollView>
    </SettingsProvider>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: 24,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    width: '100%',
    gap: 20,
  },
});
