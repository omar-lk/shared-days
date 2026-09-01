import { GroupsProvider } from '@/src/features/groups/GroupsContext';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <GroupsProvider>
      <Stack>
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
            title: 'Home',
          }}
        />

        <Stack.Screen
          name="groups/create"
          options={{
            title: 'New group',
          }}
        />
      </Stack>
    </GroupsProvider>
  );
}