import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

interface TartanBackgroundProps {
  children: ReactNode;
}

/**
 * Root-level layout wrapper for the web layout and Storybook. The tartan
 * backdrop it used to render was retired in favor of the flat theme
 * background; this remains the mount point for any future backdrop layer.
 */
export function TartanBackground({ children }: Readonly<TartanBackgroundProps>) {
  return <View style={styles.root}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
