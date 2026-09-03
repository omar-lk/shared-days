import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  AuthProvider,
  useAuth,
} from '../src/features/auth/AuthContext';
import { GroupsProvider } from '../src/features/groups/GroupsContext';

function RootNavigator() {
  const { session, isLoading } = useAuth();

  console.log('AUTH STATE:', {
    session: !!session,
    isLoading,
  });

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <GroupsProvider>
        <RootNavigator />
      </GroupsProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});