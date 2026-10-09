import { Slot } from 'expo-router';

// Web renders one tab screen at a time with no navigator chrome: a stack would
// wrap each screen in a window-height card, and the page must grow with its
// content so the document scrolls (see renderRootChrome in app/_layout.tsx).
export default function TabsLayout() {
  return <Slot />;
}
