import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { supabase } from '../../../src/lib/supabase';
export default function CreateGroupScreen() {
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    const canSubmit = name.trim().length > 0;
    const [isSubmitting, setIsSubmitting] = useState(false);
    async function handleCreateGroup() {
        if (!canSubmit || isSubmitting) {
            return;
        }

        try {
            setIsSubmitting(true);

            const { error } = await supabase.rpc('create_group', {
                group_name: name.trim(),
                group_currency: 'EUR',
            });

            if (error) {
                console.error('Create group failed:', error);
                return;
            }

            await queryClient.invalidateQueries({
                queryKey: ['groups'],
            });

            router.back();
        } finally {
            setIsSubmitting(false);
        }
    }
    return (
        <KeyboardAvoidingView
            style={styles.screen}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
                <View style={styles.container}>
                    <View>
                        <Pressable
                            onPress={() => router.back()}
                            hitSlop={12}
                            accessibilityRole="button"
                            accessibilityLabel="Back"
                            style={styles.backButton}
                        >
                            <Text style={styles.backIcon}>‹</Text>
                            <Text style={styles.backText}>Back</Text>
                        </Pressable>

                        <Text style={styles.title}>Create a group</Text>
                        <Text style={styles.subtitle}>
                            Give your group a name to start splitting expenses together.
                        </Text>

                        <View style={styles.form}>
                            <Text style={styles.label}>Group name</Text>

                            <TextInput
                                value={name}
                                onChangeText={setName}
                                placeholder="Barcelona Weekend"
                                returnKeyType="done"
                                onSubmitEditing={handleCreateGroup}
                                style={styles.input}
                                accessibilityLabel="Group name"
                            />
                        </View>
                    </View>

                    <Pressable
                        disabled={!canSubmit || isSubmitting}
                        onPress={handleCreateGroup}
                        style={({ pressed }) => [
                            styles.button,
                            (!canSubmit || isSubmitting) && styles.buttonDisabled,
                            pressed && canSubmit && !isSubmitting && styles.buttonPressed,
                        ]}
                    >
                        <Text style={styles.buttonText}>
                            {isSubmitting ? 'Creating...' : 'Create group'}
                        </Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },

    safeArea: {
        flex: 1,
    },

    container: {
        flex: 1,
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 20,
    },

    backButton: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 32,
    },

    backIcon: {
        fontSize: 32,
        lineHeight: 32,
        color: '#111827',
        marginRight: 4,
    },

    backText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },

    title: {
        fontSize: 32,
        fontWeight: '700',
        color: '#111827',
    },

    subtitle: {
        marginTop: 8,
        fontSize: 16,
        lineHeight: 23,
        color: '#6B7280',
    },

    form: {
        marginTop: 36,
    },

    label: {
        marginBottom: 8,
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },

    input: {
        height: 56,
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

    buttonDisabled: {
        opacity: 0.35,
    },

    buttonPressed: {
        opacity: 0.8,
    },

    buttonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '600',
    },
});
