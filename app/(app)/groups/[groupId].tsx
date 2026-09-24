import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { useAuth } from '../../../src/features/auth/AuthContext';
import { formatMinorUnits } from '../../../src/features/expenses/money';
import { getGroupExpenses } from '../../../src/features/expenses/queries';
import {
    getGroup,
    getGroupMembers,
} from '../../../src/features/groups/queries';
import { supabase } from '../../../src/lib/supabase';
import { colors } from '../../../src/theme/colors';

export default function GroupDetailsScreen() {
    const { groupId } = useLocalSearchParams<{ groupId: string }>();
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const [memberName, setMemberName] = useState('');

    const {
        data: group,
        isLoading,
        isError,
    } = useQuery({
        queryKey: ['groups', groupId],
        queryFn: () => getGroup(groupId),
        enabled: !!groupId,
    });

    const {
        data: members = [],
        isLoading: areMembersLoading,
        isError: areMembersError,
    } = useQuery({
        queryKey: ['groups', groupId, 'members'],
        queryFn: () => getGroupMembers(groupId),
        enabled: !!groupId,
    });

    const {
        data: expenses = [],
        isLoading: areExpensesLoading,
        isError: areExpensesError,
    } = useQuery({
        queryKey: ['groups', groupId, 'expenses'],
        queryFn: () => getGroupExpenses(groupId),
        enabled: !!groupId,
    });

    const addMemberMutation = useMutation({
        mutationFn: async (name: string) => {
            const { error } = await supabase.rpc('add_group_member', {
                target_group_id: groupId,
                member_name: name,
            });

            if (error) {
                throw error;
            }
        },
        onSuccess: async () => {
            setMemberName('');
            await queryClient.invalidateQueries({
                queryKey: ['groups', groupId, 'members'],
                exact: true,
            });
        },
        onError: (error) => {
            Alert.alert('Unable to add member', error.message);
        },
    });

    const canAddMember =
        session?.user.id === group?.created_by &&
        memberName.trim().length > 0 &&
        !addMemberMutation.isPending;

    if (isLoading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (isError || !group) {
        return (
            <View style={styles.center}>
                <Text>Unable to load group.</Text>
            </View>
        );
    }

    const groupTotalMinor = expenses.reduce((total, expense) => total + BigInt(expense.total_minor), 0n);

    return (
        <>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: group.name,
                    headerStyle: { backgroundColor: colors.sand },
                    headerTintColor: colors.ink,
                }}
            />

            <ScrollView contentContainerStyle={styles.container}>
                <View style={styles.hero}>
                    <View style={styles.heroSun} />
                    <Text style={styles.heroEyebrow}>YOUR SHARED SPACE · {group.currency}</Text>
                    <Text style={styles.heroTitle}>{group.name}</Text>
                    <Text style={styles.heroLabel}>GROUP SPENDING</Text>
                    <Text style={styles.heroAmount}>
                        {areExpensesError ? 'Unavailable' : areExpensesLoading ? '…' : formatMinorUnits(groupTotalMinor)}
                        {!areExpensesError && !areExpensesLoading && <Text style={styles.heroCurrency}> {group.currency}</Text>}
                    </Text>
                    <Text style={styles.heroMeta}>
                        {areExpensesError ? 'Expense list unavailable' : areExpensesLoading ? 'Loading expenses...' : `${expenses.length} ${expenses.length === 1 ? 'expense' : 'expenses'} recorded`}
                    </Text>
                </View>

                <Pressable
                    onPress={() => router.push({
                        pathname: '/groups/[groupId]/expenses/create',
                        params: { groupId },
                    })}
                    style={({ pressed }) => [styles.expenseButton, pressed && styles.pressed]}
                    accessibilityRole="button"
                >
                    <Text style={styles.expenseButtonText}>＋ Add expense</Text>
                </Pressable>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Expenses</Text>
                    {areExpensesLoading ? (
                        <ActivityIndicator style={styles.memberLoader} />
                    ) : areExpensesError ? (
                        <Text style={styles.placeholder}>Unable to load expenses.</Text>
                    ) : expenses.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Text style={styles.emptyTitle}>Start with the first bill</Text>
                            <Text style={styles.placeholder}>Add dinner, groceries, or anything the group shared.</Text>
                        </View>
                    ) : expenses.map((expense) => {
                        const payer = members.find((member) => member.id === expense.payer_member_id);
                        return (
                            <Pressable
                                key={expense.id}
                                onPress={() => router.push({
                                    pathname: '/groups/[groupId]/expenses/[expenseId]',
                                    params: { groupId, expenseId: expense.id },
                                })}
                                style={({ pressed }) => [styles.expenseRow, pressed && styles.pressed]}
                                accessibilityRole="button"
                                accessibilityLabel={`${formatMinorUnits(expense.total_minor)} ${group.currency}, paid by ${payer?.display_name ?? 'group member'}. View expense`}
                            >
                                <View style={styles.expenseBody}>
                                    <Text style={styles.expenseDate}>
                                        {new Date(expense.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </Text>
                                    <Text style={styles.expenseAmount}>{formatMinorUnits(expense.total_minor)} {group.currency}</Text>
                                    <Text style={styles.expensePayer}>Paid by {payer?.display_name ?? 'Group member'}</Text>
                                </View>
                                <Text style={styles.expenseArrow}>›</Text>
                            </Pressable>
                        );
                    })}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>People</Text>
                    <Text style={styles.sectionHint}>Everyone can be included, even without an account.</Text>
                    {areMembersLoading ? (
                        <ActivityIndicator style={styles.memberLoader} />
                    ) : areMembersError ? (
                        <Text style={styles.placeholder}>Unable to load members.</Text>
                    ) : members.map((member) => (
                        <View key={member.id} style={styles.memberRow}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{(member.display_name[0] ?? '?').toUpperCase()}</Text>
                            </View>
                            <View style={styles.memberBody}>
                                <Text style={styles.memberName}>{member.display_name}</Text>
                                <Text style={styles.memberRole}>
                                    {member.role === 'owner' ? 'Group creator' : 'Member'} · {member.user_id ? 'Account linked' : 'No account needed'}
                                </Text>
                            </View>
                        </View>
                    ))}
                    {session?.user.id === group.created_by && (
                        <View style={styles.addMemberForm}>
                            <TextInput
                                value={memberName}
                                onChangeText={setMemberName}
                                placeholder="Add someone by name"
                                placeholderTextColor={colors.muted}
                                autoCapitalize="words"
                                returnKeyType="done"
                                style={styles.input}
                                accessibilityLabel="Member name"
                            />
                            <Pressable
                                disabled={!canAddMember}
                                onPress={() => addMemberMutation.mutate(memberName.trim())}
                                style={[styles.addButton, !canAddMember && styles.addButtonDisabled]}
                                accessibilityRole="button"
                            >
                                <Text style={styles.addButtonText}>{addMemberMutation.isPending ? 'Adding...' : 'Add'}</Text>
                            </Pressable>
                        </View>
                    )}
                </View>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, backgroundColor: colors.sand, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 48 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sand },
    hero: { overflow: 'hidden', minHeight: 220, backgroundColor: colors.sea, borderRadius: 28, padding: 24, justifyContent: 'flex-end' },
    heroSun: { position: 'absolute', width: 140, height: 140, borderRadius: 70, right: -26, top: -40, backgroundColor: '#E8BA87' },
    heroEyebrow: { color: '#DFEEE8', fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
    heroTitle: { color: colors.white, fontSize: 29, lineHeight: 35, fontWeight: '700', marginTop: 8 },
    heroLabel: { color: '#DDECE8', fontSize: 11, fontWeight: '800', letterSpacing: 1.3, marginTop: 24 },
    heroAmount: { color: colors.white, fontSize: 34, fontWeight: '700', marginTop: 2 },
    heroCurrency: { fontSize: 17, fontWeight: '600' },
    heroMeta: { color: '#E1EEE9', fontSize: 14, marginTop: 3 },
    expenseButton: { minHeight: 56, marginTop: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.clay },
    expenseButtonText: { color: colors.white, fontSize: 17, fontWeight: '700' },
    section: { marginTop: 34 },
    sectionTitle: { color: colors.ink, fontSize: 23, fontWeight: '700' },
    sectionHint: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 5 },
    placeholder: { marginTop: 8, color: colors.muted, fontSize: 15, lineHeight: 21 },
    emptyCard: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 20, marginTop: 14 },
    emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
    memberLoader: { marginTop: 16, alignSelf: 'flex-start' },
    expenseRow: { minHeight: 112, flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 18, borderWidth: 1, borderColor: colors.line, borderRadius: 20, backgroundColor: colors.paper },
    expenseBody: { flex: 1 },
    expenseDate: { color: colors.clay, fontSize: 12, fontWeight: '700' },
    expenseAmount: { color: colors.ink, fontSize: 22, fontWeight: '700', marginTop: 4 },
    expensePayer: { color: colors.muted, fontSize: 14, marginTop: 2 },
    expenseArrow: { color: colors.sea, fontSize: 32, fontWeight: '300' },
    memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 66, borderBottomWidth: 1, borderBottomColor: colors.line },
    avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.seaLight },
    avatarText: { color: colors.sea, fontSize: 18, fontWeight: '700' },
    memberBody: { flex: 1 },
    memberName: { color: colors.ink, fontSize: 16, fontWeight: '700' },
    memberRole: { marginTop: 3, color: colors.muted, fontSize: 13 },
    addMemberForm: { flexDirection: 'row', gap: 10, marginTop: 20 },
    input: { flex: 1, minHeight: 52, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 14, fontSize: 16, color: colors.ink, backgroundColor: colors.paper },
    addButton: { minHeight: 52, minWidth: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.sea },
    addButtonDisabled: { opacity: 0.45 },
    addButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
    pressed: { opacity: 0.75 },
});
