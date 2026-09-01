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
import { useGroups } from '../../src/features/groups/GroupsContext';
export default function CreateGroupScreen() {
    const [name, setName] = useState('');
    const { createGroup } = useGroups();
    const canSubmit = name.trim().length > 0;

    function handleCreateGroup() {
        if (!canSubmit) {
            return;
        }

        createGroup(name.trim());
        router.back();
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
                    disabled={!canSubmit}
                    onPress={handleCreateGroup}
                    style={({ pressed }) => [
                        styles.button,
                        !canSubmit && styles.buttonDisabled,
                        pressed && canSubmit && styles.buttonPressed,
                    ]}
                >
                    <Text style={styles.buttonText}>Create group</Text>
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