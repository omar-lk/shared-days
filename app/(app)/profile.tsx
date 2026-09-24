import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../../src/features/auth/AuthContext';
import {
  getProfile,
  updateDisplayName,
} from '../../src/features/profile/queries';
import { colors } from '../../src/theme/colors';

export default function ProfileScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const [editedDisplayName, setEditedDisplayName] = useState<string | null>(null);

  const {
    data: profile,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => {
      if (!userId) {
        throw new Error('Missing authenticated user');
      }

      return getProfile(userId);
    },
    enabled: !!userId,
  });

  const displayName = editedDisplayName ?? profile?.display_name ?? '';

  const updateNameMutation = useMutation({
    mutationFn: (name: string) => {
      if (!userId) {
        throw new Error('Missing authenticated user');
      }

      return updateDisplayName(userId, name);
    },
    onSuccess: async () => {
      setEditedDisplayName(null);
      await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      await queryClient.invalidateQueries({ queryKey: ['groups'] });
      Alert.alert('Saved', 'Your profile has been updated.');
    },
    onError: (error) => {
      console.error('UPDATE PROFILE ERROR:', error);
      Alert.alert('Error', 'Unable to update profile.');
    },
  });

  const canSave = !!userId && displayName.trim().length > 0 && !updateNameMutation.isPending;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Profile', headerStyle: { backgroundColor: colors.sand }, headerTintColor: colors.ink }} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : isError || !profile ? (
        <View style={styles.center}>
          <Text>Unable to load profile.</Text>
        </View>
      ) : (
        <View style={styles.container}>
          <Text style={styles.eyebrow}>YOUR PLACE AT THE TABLE</Text>
          <Text style={styles.title}>Your profile</Text>
          <Text style={styles.label}>Display name</Text>
          <TextInput
            value={displayName}
            onChangeText={setEditedDisplayName}
            placeholder="Your name"
            autoCapitalize="words"
            returnKeyType="done"
            style={styles.input}
            accessibilityLabel="Display name"
          />

          <Pressable
            disabled={!canSave}
            onPress={() => updateNameMutation.mutate(displayName)}
            style={({ pressed }) => [
              styles.button,
              !canSave && styles.buttonDisabled,
              pressed && canSave && styles.buttonPressed,
            ]}
          >
            <Text style={styles.buttonText}>
              {updateNameMutation.isPending ? 'Saving...' : 'Save'}
            </Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sand },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    backgroundColor: colors.sand,
  },
  eyebrow: { color: colors.clay, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '700', marginTop: 8, marginBottom: 28 },
  label: {
    marginBottom: 8,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 17,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
  button: {
    minHeight: 56,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.clay,
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '600',
  },
});
