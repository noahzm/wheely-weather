---
name: new-wheely-component
description: Scaffold a new presentational component in src/components/wheely/ following the project's one-per-file, theme-aware conventions, wire it into the barrel, and add Storybook coverage. Use when the user asks to create a new Wheely UI component.
disable-model-invocation: true
---

# new-wheely-component

Scaffold a new component in `src/components/wheely/` that matches the existing system. Take the component name from the user (e.g. "wind gauge"). Derive:
- **file**: kebab-case → `src/components/wheely/<kebab-name>.tsx`
- **export**: PascalCase → `WindGauge`

## 1. Create the component file

Match `ride-verdict.tsx` exactly for structure. Template:

```tsx
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, Spacing, type WheelyPalette } from '@/constants/theme';
import { brutalShadow } from './primitives';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    wrap: {
      borderWidth: 2,
      borderColor: c.ink,
      padding: Spacing.four,
      ...brutalShadow(c.ink, 9),
    },
    title: {
      color: c.ink,
      fontFamily: Fonts.monoBold,
      fontSize: 16,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
  });
}

function useStyles() {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return { c, styles };
}

export function <PascalName>({
  /* props */
}: Readonly<{
  /* prop types */
}>) {
  const { c, styles } = useStyles();
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <ThemedText style={styles.title}>...</ThemedText>
    </View>
  );
}
```

### Rules to honor (these are enforced — see the `wheely-ui-reviewer` agent)
- **No hardcoded colors** — every color comes from `c` (the `WheelyPalette`). Get it via `useWheelyColors()`; build styles in `makeStyles(c)`.
- **Props typed with `Readonly<{ ... }>`.**
- **Icons** (if any) use `lucide-react-native`, rendered as **siblings of** `<ThemedText>` in a row `View`, never nested inside it.
- **Accessibility**: add `accessibilityRole` / `accessibilityLabel` (and `accessibilityState` for interactive, `accessibilityLiveRegion` for status).
- Use `Spacing`, `Fonts`, and `brutalShadow` from the existing imports rather than raw numbers/strings where an established token exists.

## 2. Wire into the barrel

Add an export line to `src/components/wheely/index.ts`:

```ts
export { <PascalName> } from './<kebab-name>';
```

(`src/components/wheely-ui.tsx` re-exports `./wheely`, so it's covered automatically — don't edit it.)

## 3. Add Storybook coverage

Storybook is the primary UI review surface. Add a story for the new component. Either add a section to `src/stories/WheelyUi.stories.tsx` or create `src/stories/<PascalName>.stories.tsx`, following the existing pattern:
- import from `@/components/wheely`
- `import type { Meta, StoryObj } from '@storybook/react-native-web-vite'`
- wrap in `StorySurface` (from `./story-layout`) via `decorators`
- pull realistic data from `./weather-fixtures` (`rideWeather` / `maybeWeather` / `restWeather` / `alertWeather`) when the component needs forecast data.

## 4. Verify

Run `npx tsc --noEmit` and `npm run lint` on the new files (the PostToolUse hooks also run these per-edit). Confirm the component renders in `npm run storybook:web` if the user wants a visual check. Then summarize: files created, barrel updated, story added.
