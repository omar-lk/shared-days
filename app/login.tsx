import { supabase } from '@/src/lib/supabase';
import { SocialSignInButtons } from '@/src/features/auth/SocialSignInButtons';
import { colors } from '@/src/theme/colors';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';



export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSignIn() {
        if (!email.trim() || !password) {
            Alert.alert('Missing information', 'Enter your email and password.');
            return;
        }

        try {
            setIsSubmitting(true);

            const { error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            if (error) {
                Alert.alert('Unable to sign in', error.message);
            }
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <KeyboardAvoidingView
            style={styles.screen}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <View>
                    <Text style={styles.eyebrow}>GOOD TO SEE YOU</Text>
                    <Text style={styles.title}>Welcome back</Text>

                    <Text style={styles.subtitle}>
                        Sign in to manage your shared expenses.
                    </Text>

                    <SocialSignInButtons
                        disabled={isSubmitting}
                        onError={(message) => {
                            if (message) Alert.alert('Unable to sign in', message);
                        }}
                    />

                    <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Email"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        textContentType="emailAddress"
                        style={styles.input}
                    />

                    <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Password"
                        secureTextEntry
                        textContentType="password"
                        style={styles.input}
                    />
                </View>

                <View>
                    <Pressable
                        disabled={isSubmitting}
                        onPress={handleSignIn}
                        style={({ pressed }) => [
                            styles.button,
                            (pressed || isSubmitting) && styles.buttonPressed,
                        ]}
                    >
                        <Text style={styles.buttonText}>
                            {isSubmitting ? 'Signing in...' : 'Sign in'}
                        </Text>
                    </Pressable>
                    <Pressable
                        disabled={isSubmitting}
                        onPress={() => router.push('/signup')}
                        style={styles.secondaryButton}
                        accessibilityRole="button"
                    >
                        <Text style={styles.secondaryButtonText}>Create account</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.sand,
    },

    container: {
        flexGrow: 1,
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 100,
        paddingBottom: 32,
    },

    title: {
        fontSize: 32,
        fontWeight: '700',
        color: colors.ink,
    },

    eyebrow: { color: colors.clay, fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 8 },

    subtitle: {
        marginTop: 8,
        marginBottom: 0,
        fontSize: 16,
        lineHeight: 22,
        color: colors.muted,
    },

    input: {
        minHeight: 56,
        marginBottom: 12,
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
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        backgroundColor: colors.clay,
    },

    buttonPressed: {
        opacity: 0.7,
    },

    buttonText: {
        color: colors.white,
        fontSize: 17,
        fontWeight: '600',
    },
    secondaryButton: {
        minHeight: 56,
        marginTop: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },

    secondaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.sea,
    },
});
