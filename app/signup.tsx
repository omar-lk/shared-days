import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '../src/lib/supabase';
import { SocialSignInButtons } from '../src/features/auth/SocialSignInButtons';
import { colors } from '../src/theme/colors';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSignUp() {
    if (isSubmitting) return;
    setErrorMessage('');
    if (!email.trim() || !password || !confirmPassword) {
      setErrorMessage('Enter your email and password in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }
      if (!data.session) setConfirmationSent(true);
      // A session signs the user in automatically through the root route guard.
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to create account.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={() => router.replace('/login')}
          style={styles.backButton}
          accessibilityRole="button"
        >
          <Text style={styles.backText}>‹ Sign in</Text>
        </Pressable>

        {confirmationSent ? (
          <View>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>
              If confirmation is required, open the link sent to {email.trim()}, then return to sign in.
            </Text>
            <Pressable
              onPress={() => router.replace('/login')}
              style={styles.button}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Back to sign in</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <Text style={styles.eyebrow}>JOIN THE MOMENT</Text>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Sign up to manage shared expenses with your group.</Text>
            <SocialSignInButtons disabled={isSubmitting} onError={setErrorMessage} />

            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              autoComplete="email"
              style={styles.input}
              accessibilityLabel="Email"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              style={styles.input}
              accessibilityLabel="Password"
            />

            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm password"
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              style={styles.input}
              accessibilityLabel="Confirm password"
            />

            {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

            <Pressable
              onPress={handleSignUp}
              disabled={isSubmitting}
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>{isSubmitting ? 'Creating...' : 'Create account'}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sand },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 72, paddingBottom: 32 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 28 },
  backText: { fontSize: 16, fontWeight: '600', color: colors.ink },
  eyebrow: { color: colors.clay, fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '700', color: colors.ink },
  subtitle: { marginTop: 8, marginBottom: 0, fontSize: 16, lineHeight: 22, color: colors.muted },
  label: { marginBottom: 8, fontSize: 15, fontWeight: '700', color: colors.ink },
  input: {
    minHeight: 56,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 17,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
  error: { color: colors.danger, marginTop: 2, marginBottom: 16 },
  button: {
    minHeight: 56,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.clay,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 17, fontWeight: '700' },
});
