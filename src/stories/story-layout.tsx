import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

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
  return (
    <ScrollView contentContainerStyle={[styles.content, centered && styles.centered]}>
      <View style={[styles.inner, { maxWidth }]}>{children}</View>
    </ScrollView>
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
