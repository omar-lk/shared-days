import { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { signInWithOAuthProvider, type OAuthProvider } from './oauth';
import { colors } from '../../theme/colors';

type Props = {
  disabled?: boolean;
  onError: (message: string) => void;
};

export function SocialSignInButtons({ disabled = false, onError }: Props) {
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider | null>(null);
  const { width } = useWindowDimensions();
  const buttonWidth = Math.min(320, width - 48);
  const buttonHeight = buttonWidth * 52 / 320;

  async function handleSignIn(provider: OAuthProvider) {
    if (disabled || pendingProvider) return;
    onError('');
    try {
      setPendingProvider(provider);
      await signInWithOAuthProvider(provider);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unable to sign in. Please try again.');
    } finally {
      setPendingProvider(null);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.separator}>or continue with</Text>
      {(Platform.OS === 'ios' || Platform.OS === 'web') && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
          disabled={disabled || pendingProvider !== null}
          onPress={() => handleSignIn('apple')}
          style={({ pressed }) => [
            { width: buttonWidth, height: buttonHeight },
            (pressed || disabled || pendingProvider !== null) && styles.disabled,
          ]}
        >
          <Image
            source={require('../../../assets/images/apple-continue-320.png')}
            style={{ width: buttonWidth, height: buttonHeight }}
            resizeMode="contain"
          />
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={disabled || pendingProvider !== null}
        onPress={() => handleSignIn('google')}
        style={({ pressed }) => [
          styles.button,
          { width: buttonWidth, height: buttonHeight },
          (pressed || disabled || pendingProvider !== null) && styles.disabled,
        ]}
      >
        <Text style={styles.buttonText}>
          {pendingProvider === 'google' ? 'Connecting to Google...' : 'Continue with Google'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 20, marginBottom: 24, alignItems: 'center' },
  separator: { textAlign: 'center', color: colors.muted, marginBottom: 8 },
  button: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
  disabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '700', color: colors.ink },
});
