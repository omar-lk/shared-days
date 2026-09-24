import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { completeOAuthFromUrl, isOAuthCallbackUrl } from '../../src/features/auth/oauth';

export default function AuthCallbackScreen() {
  const url = Linking.useLinkingURL();
  const [errorMessage, setErrorMessage] = useState('');
  const visibleError = errorMessage || (url && !isOAuthCallbackUrl(url)
    ? 'No sign-in response was received. Please try again.'
    : '');

  useEffect(() => {
    if (!url || !isOAuthCallbackUrl(url)) return;

    let active = true;
    completeOAuthFromUrl(url)
      .catch((error: unknown) => {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : 'Unable to finish sign-in.');
        }
      })
      .finally(() => {
        if (Platform.OS === 'web') {
          window.history.replaceState(null, '', window.location.pathname);
        }
      });
    return () => { active = false; };
  }, [url]);

  return (
    <View style={styles.container}>
      {visibleError ? (
        <>
          <Text style={styles.message}>{visibleError}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/login')}>
            <Text style={styles.link}>Back to sign in</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" />
          <Text style={styles.message}>Finishing sign-in...</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { marginTop: 16, fontSize: 16, textAlign: 'center' },
  link: { marginTop: 16, fontSize: 16, fontWeight: '600', color: '#111827' },
});
