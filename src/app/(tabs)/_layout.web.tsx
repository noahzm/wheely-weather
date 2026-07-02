import { Stack } from 'expo-router';

export default function TabsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="(home)" />
      <Stack.Screen name="location" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
