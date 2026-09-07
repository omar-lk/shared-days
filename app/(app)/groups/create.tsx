import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
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
            <View style={styles.container}>
                <View>
                    <Text style={styles.label}>Group name</Text>

                    <TextInput
                        value={name}
                        onChangeText={setName}
                        placeholder="Barcelona Weekend"
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={handleCreateGroup}
                        style={styles.input}
                    />
                </View>

                <Pressable
                    disabled={!canSubmit || isSubmitting}
                    onPress={handleCreateGroup}
                    style={({ pressed }) => [
                        styles.button,
                        !canSubmit && styles.buttonDisabled,
                        pressed && canSubmit && styles.buttonPressed,
                    ]}
                >
                    <Text style={styles.buttonText}>
                        {isSubmitting ? 'Creating...' : 'Create group'}
                    </Text>
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
        padding: 24,
        paddingBottom: 32,
    },

    label: {
        marginBottom: 8,
        fontSize: 15,
        fontWeight: '600',
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