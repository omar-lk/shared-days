import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    Alert,
} from 'react-native';
import { supabase } from '../../../src/lib/supabase';
import { colors } from '../../../src/theme/colors';

const currencyOptions = [
    { code: 'MAD', name: 'Moroccan dirham' },
    { code: 'EUR', name: 'Euro' },
    { code: 'USD', name: 'US dollar' },
    { code: 'GBP', name: 'British pound' },
    { code: 'CAD', name: 'Canadian dollar' },
    { code: 'CHF', name: 'Swiss franc' },
    { code: 'AED', name: 'UAE dirham' },
    { code: 'SAR', name: 'Saudi riyal' },
    { code: 'TND', name: 'Tunisian dinar' },
    { code: 'DZD', name: 'Algerian dinar' },
    { code: 'EGP', name: 'Egyptian pound' },
    { code: 'TRY', name: 'Turkish lira' },
];

export default function CreateGroupScreen() {
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    const [currency, setCurrency] = useState('EUR');
    const [customCurrency, setCustomCurrency] = useState(false);
    const [currencyMenuOpen, setCurrencyMenuOpen] = useState(false);
    const canSubmit = name.trim().length > 0 && /^[A-Z]{3}$/.test(currency.trim());
    const [isSubmitting, setIsSubmitting] = useState(false);
    async function handleCreateGroup() {
        if (!canSubmit || isSubmitting) {
            return;
        }

        try {
            setIsSubmitting(true);

            const { error } = await supabase.rpc('create_group', {
                group_name: name.trim(),
                group_currency: currency.trim(),
            });

            if (error) {
                Alert.alert('Unable to create group', error.message);
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
                <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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

                        <Text style={styles.eyebrow}>A NEW SHARED SPACE</Text>
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
                                style={styles.input}
                                accessibilityLabel="Group name"
                            />

                            <Text style={styles.currencyLabel}>Currency</Text>
                            <Pressable
                                onPress={() => {
                                    Keyboard.dismiss();
                                    setCurrencyMenuOpen(true);
                                }}
                                style={styles.selectButton}
                                accessibilityRole="button"
                                accessibilityLabel="Choose currency"
                                accessibilityState={{ expanded: currencyMenuOpen }}
                            >
                                <Text style={styles.selectText}>
                                    {customCurrency
                                        ? currency || 'Other currency'
                                        : `${currency} · ${currencyOptions.find((option) => option.code === currency)?.name ?? ''}`}
                                </Text>
                                <Text style={styles.selectArrow}>⌄</Text>
                            </Pressable>
                            {customCurrency && (
                                <TextInput
                                    value={currency}
                                    onChangeText={(value) => setCurrency(value.toUpperCase())}
                                    placeholder="Three-letter code"
                                    autoCapitalize="characters"
                                    maxLength={3}
                                    style={[styles.input, styles.customCurrencyInput]}
                                    accessibilityLabel="Other currency code"
                                />
                            )}
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
                </ScrollView>
            </SafeAreaView>
            <Modal
                visible={currencyMenuOpen}
                transparent
                animationType="slide"
                onRequestClose={() => setCurrencyMenuOpen(false)}
            >
                <View style={styles.modalContainer}>
                    <Pressable
                        style={styles.modalBackdrop}
                        onPress={() => setCurrencyMenuOpen(false)}
                        accessibilityLabel="Close currency list"
                    />
                    <View style={styles.modalPanel}>
                        <Text style={styles.modalTitle}>Choose currency</Text>
                        <ScrollView keyboardShouldPersistTaps="handled">
                            {currencyOptions.map((option) => (
                                <Pressable
                                    key={option.code}
                                    onPress={() => {
                                        setCurrency(option.code);
                                        setCustomCurrency(false);
                                        setCurrencyMenuOpen(false);
                                    }}
                                    style={styles.currencyOption}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: !customCurrency && currency === option.code }}
                                >
                                    <Text style={styles.currencyOptionText}>
                                        {option.code} · {option.name}
                                    </Text>
                                </Pressable>
                            ))}
                            <Pressable
                                onPress={() => {
                                    setCurrency('');
                                    setCustomCurrency(true);
                                    setCurrencyMenuOpen(false);
                                }}
                                style={styles.currencyOption}
                                accessibilityRole="button"
                            >
                                <Text style={styles.currencyOptionText}>Other currency...</Text>
                            </Pressable>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.sand,
    },

    safeArea: {
        flex: 1,
        backgroundColor: colors.sand,
    },

    container: {
        flexGrow: 1,
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
        minHeight: 44,
    },

    backIcon: {
        fontSize: 32,
        lineHeight: 32,
        color: colors.ink,
        marginRight: 4,
    },

    backText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.ink,
    },

    eyebrow: { color: colors.clay, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },

    title: {
        fontSize: 32,
        fontWeight: '700',
        color: colors.ink,
    },

    subtitle: {
        marginTop: 8,
        fontSize: 16,
        lineHeight: 23,
        color: colors.muted,
    },

    form: {
        marginTop: 36,
    },

    label: {
        marginBottom: 8,
        fontSize: 15,
        fontWeight: '600',
        color: colors.ink,
    },

    currencyLabel: {
        marginTop: 20,
        marginBottom: 8,
        fontSize: 15,
        fontWeight: '600',
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

    selectButton: {
        minHeight: 56,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 16,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.paper,
    },

    selectText: { color: colors.ink, fontSize: 17 },
    selectArrow: { fontSize: 24, color: colors.muted },
    customCurrencyInput: { marginTop: 12 },
    modalContainer: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: '#00000066',
    },
    modalPanel: {
        maxHeight: '70%',
        padding: 24,
        paddingBottom: 40,
        backgroundColor: colors.paper,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    modalTitle: { color: colors.ink, fontSize: 20, fontWeight: '700', marginBottom: 12 },
    currencyOption: { minHeight: 52, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.line },
    currencyOptionText: { color: colors.ink, fontSize: 17 },

    button: {
        minHeight: 56,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        backgroundColor: colors.clay,
    },

    buttonDisabled: {
        opacity: 0.35,
    },

    buttonPressed: {
        opacity: 0.8,
    },

    buttonText: {
        color: colors.white,
        fontSize: 17,
        fontWeight: '600',
    },
});
