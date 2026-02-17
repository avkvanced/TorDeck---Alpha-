import { Stack } from 'expo-router';
import Colors from '@/constants/colors';

export default function LibraryLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="[category]"
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
          headerBackTitle: 'Library',
        }}
      />
    </Stack>
  );
}
