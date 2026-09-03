import { supabase } from '@/src/lib/supabase';
import { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';



export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSignUp() {
        if (!email.trim() || !password) {
            Alert.alert('Missing information', 'Enter your email and password.');
            return;
        }

        try {
            setIsSubmitting(true);

            const { error } = await supabase.auth.signUp({
                email: email.trim(),
                password,
            });

            if (error) {
                Alert.alert('Unable to sign up', error.message);
                return;
            }

            Alert.alert(
                'Account created',
                'Check your email if Supabase requires email confirmation.'
            );
        } finally {
            setIsSubmitting(false);
        }
    }
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
            <View style={styles.container}>
                <View>
                    <Text style={styles.title}>Welcome back</Text>

                    <Text style={styles.subtitle}>
                        Sign in to manage your shared expenses.
                    </Text>

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
                    onPress={handleSignUp}
                    style={styles.secondaryButton}
                >
                    <Text style={styles.secondaryButtonText}>Create account</Text>
                </Pressable>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },

    container: {
        flex: 1,
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 100,
        paddingBottom: 32,
    },

    title: {
        fontSize: 32,
        fontWeight: '700',
    },

    subtitle: {
        marginTop: 8,
        marginBottom: 32,
        fontSize: 16,
        lineHeight: 22,
        color: '#6B7280',
    },

    input: {
        height: 56,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 16,
        paddingHorizontal: 16,
        fontSize: 17,
    },

    button: {
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        backgroundColor: '#111827',
    },

    buttonPressed: {
        opacity: 0.7,
    },

    buttonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '600',
    },
    secondaryButton: {
        height: 56,
        marginTop: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },

    secondaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});