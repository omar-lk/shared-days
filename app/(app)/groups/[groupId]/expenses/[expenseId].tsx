import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../../../../src/features/auth/AuthContext';
import { formatMinorUnits } from '../../../../../src/features/expenses/money';
import { getExpenseDetail, getExpenseSettlements, setExpensePaidStatus } from '../../../../../src/features/expenses/queries';
import { formatExpenseShareMessage } from '../../../../../src/features/expenses/shareMessage';
import { getGroup, getGroupMembers } from '../../../../../src/features/groups/queries';
import { colors } from '../../../../../src/theme/colors';

export default function ExpenseDetailsScreen() {
  const { groupId, expenseId } = useLocalSearchParams<{ groupId: string; expenseId: string }>();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { data: group, isLoading: groupLoading, isError: groupError } = useQuery({
    queryKey: ['groups', groupId],
    queryFn: () => getGroup(groupId),
    enabled: !!groupId,
  });
  const { data: members = [], isLoading: membersLoading, isError: membersError } = useQuery({
    queryKey: ['groups', groupId, 'members'],
    queryFn: () => getGroupMembers(groupId),
    enabled: !!groupId,
  });
  const { data: detail, isLoading: detailLoading, isError: detailError } = useQuery({
    queryKey: ['groups', groupId, 'expenses', expenseId],
    queryFn: () => getExpenseDetail(groupId, expenseId),
    enabled: !!groupId && !!expenseId,
  });
  const {
    data: settlements,
    isLoading: settlementsLoading,
    isError: settlementsError,
  } = useQuery({
    queryKey: ['groups', groupId, 'expenses', expenseId, 'settlements'],
    queryFn: () => getExpenseSettlements(groupId, expenseId),
    enabled: !!groupId && !!expenseId,
  });
  const paidMutation = useMutation({
    mutationFn: setExpensePaidStatus,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['groups', groupId, 'expenses', expenseId, 'settlements'],
        exact: true,
      });
    },
    onError: (error) => Alert.alert('Unable to change paid status', error.message),
  });

  if (groupLoading || membersLoading || detailLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }
  if (groupError || membersError || detailError || !group || !detail) {
    return <View style={styles.center}><Text>Unable to load expense details.</Text></View>;
  }

  const memberName = (memberId: string) =>
    members.find((member) => member.id === memberId)?.display_name ?? 'Group member';
  const payerId = detail.expense.payer_member_id;
  const paidMemberIds = new Set((settlements ?? []).map((settlement) => settlement.member_id));
  const hasPaidShares = paidMemberIds.size > 0;
  const shares = new Map<string, number>();
  for (const allocation of detail.allocations) {
    shares.set(allocation.member_id, (shares.get(allocation.member_id) ?? 0) + allocation.amount_minor);
  }

  async function shareOnWhatsApp() {
    if (!group || !detail) return;
    const message = formatExpenseShareMessage({
      groupName: group.name,
      currency: group.currency,
      members,
      detail,
      paidMemberIds: settlements ? [...paidMemberIds] : undefined,
    });
    try {
      await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
    } catch {
      Alert.alert('Unable to open WhatsApp', 'Please check that WhatsApp is available on this device.');
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Shared bill', headerStyle: { backgroundColor: colors.sand }, headerTintColor: colors.ink }} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>SHARED BILL · {group.name.toUpperCase()}</Text>
          <Text style={styles.heroLabel}>TOTAL PAID</Text>
          <Text style={styles.total}>{formatMinorUnits(detail.expense.total_minor)} <Text style={styles.currency}>{group.currency}</Text></Text>
          <Text style={styles.heroPayer}>Paid in full by {memberName(payerId)}</Text>
        </View>
        <Pressable
          onPress={shareOnWhatsApp}
          style={styles.shareButton}
          accessibilityRole="button"
        >
          <Text style={styles.shareButtonText}>Share bill on WhatsApp ↗</Text>
        </Pressable>
        {session?.user.id === group.created_by && (
          <>
            <Pressable
              onPress={() => router.push({
                pathname: '/groups/[groupId]/expenses/[expenseId]/edit',
                params: { groupId, expenseId },
              })}
              disabled={hasPaidShares}
              style={[styles.editButton, hasPaidShares && styles.paidButtonDisabled]}
              accessibilityRole="button"
              accessibilityState={{ disabled: hasPaidShares }}
            >
              <Text style={styles.editButtonText}>Edit expense</Text>
            </Pressable>
            {hasPaidShares && (
              <Text style={styles.helper}>Mark all shares not paid before editing this expense.</Text>
            )}
          </>
        )}

        <Text style={styles.sectionTitle}>What was shared</Text>
        {detail.items.map((item) => {
          const allocations = detail.allocations.filter((allocation) => allocation.item_id === item.id);
          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.itemName}>{item.description}</Text>
                <Text style={styles.amount}>{formatMinorUnits(item.price_minor)} {group.currency}</Text>
              </View>
              <Text style={styles.splitLabel}>
                {item.split_method === 'equal' ? 'SPLIT EQUALLY' : 'CUSTOM SHARES'}
              </Text>
              {allocations.map((allocation) => (
                <View key={allocation.member_id} style={styles.allocationRow}>
                  <Text style={styles.muted}>{memberName(allocation.member_id)}</Text>
                  <Text style={styles.allocationAmount}>
                    {formatMinorUnits(allocation.amount_minor)} {group.currency}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>Who owes what</Text>
        <Text style={styles.sectionHint}>Each amount comes from the items above.</Text>
        {members.filter((member) => (shares.get(member.id) ?? 0) > 0).map((member) => {
          const share = shares.get(member.id) ?? 0;
          const isPayer = member.id === payerId;
          const isPaid = paidMemberIds.has(member.id);
          return (
            <View key={member.id} style={styles.shareRow}>
              <View style={styles.row}>
                <Text style={styles.itemName}>{member.display_name}</Text>
                <Text style={styles.amount}>{formatMinorUnits(share)} {group.currency}</Text>
              </View>
              <Text style={styles.shareDescription}>
                {isPayer
                  ? 'Their share of the bill'
                  : settlementsLoading
                    ? 'Loading paid status...'
                    : settlementsError
                      ? 'Paid status unavailable'
                      : isPaid
                        ? `Marked paid to ${memberName(payerId)}`
                        : `Owes ${memberName(payerId)}`}
              </Text>
              {!isPayer && !settlementsLoading && !settlementsError && (
                <View style={[styles.statusPill, isPaid ? styles.paidPill : styles.unpaidPill]}>
                  <Text style={[styles.statusText, isPaid ? styles.paidText : styles.unpaidText]}>
                    {isPaid ? 'Marked paid' : 'Not paid yet'}
                  </Text>
                </View>
              )}
              {!isPayer && session?.user.id === group.created_by
                && !settlementsLoading && !settlementsError && (
                <Pressable
                  onPress={() => paidMutation.mutate({
                    expenseId,
                    memberId: member.id,
                    paid: !paidMemberIds.has(member.id),
                  })}
                  disabled={paidMutation.isPending}
                  style={[styles.paidButton, paidMutation.isPending && styles.paidButtonDisabled]}
                  accessibilityRole="button"
                  accessibilityLabel={`${isPaid ? 'Mark not paid' : 'Mark paid'} for ${member.display_name}`}
                >
                  <Text style={styles.paidButtonText}>
                    {isPaid ? 'Mark not paid' : 'Mark paid'}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sand },
  container: { backgroundColor: colors.sand, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 48 },
  hero: { backgroundColor: colors.sea, borderRadius: 28, padding: 24, minHeight: 195, justifyContent: 'flex-end' },
  eyebrow: { color: '#D9EAE7', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  heroLabel: { color: '#D9EAE7', fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginTop: 25 },
  total: { marginTop: 4, color: colors.white, fontSize: 36, fontWeight: '700' },
  currency: { fontSize: 18, fontWeight: '600' },
  heroPayer: { color: '#E5F0ED', fontSize: 15, marginTop: 7 },
  helper: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 8 },
  muted: { color: colors.muted, fontSize: 14 },
  sectionTitle: { marginTop: 34, marginBottom: 12, color: colors.ink, fontSize: 23, fontWeight: '700' },
  sectionHint: { color: colors.muted, fontSize: 14, marginTop: -6, marginBottom: 10 },
  card: { marginTop: 12, padding: 18, borderWidth: 1, borderColor: colors.line, borderRadius: 20, backgroundColor: colors.paper },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  itemName: { flex: 1, color: colors.ink, fontSize: 17, fontWeight: '700' },
  amount: { color: colors.ink, fontSize: 17, fontWeight: '700', textAlign: 'right' },
  splitLabel: { color: colors.clay, fontSize: 11, letterSpacing: 1.2, fontWeight: '800', marginTop: 9, marginBottom: 7 },
  allocationRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, gap: 12 },
  allocationAmount: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  shareRow: { backgroundColor: colors.paper, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 18, marginTop: 12 },
  shareDescription: { color: colors.muted, fontSize: 14, marginTop: 6 },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginTop: 11 },
  paidPill: { backgroundColor: colors.oliveLight },
  unpaidPill: { backgroundColor: colors.clayLight },
  statusText: { fontSize: 12, fontWeight: '700' },
  paidText: { color: colors.olive },
  unpaidText: { color: colors.clay },
  paidButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 12, paddingHorizontal: 15, borderRadius: 12, borderWidth: 1, borderColor: colors.sea },
  paidButtonDisabled: { opacity: 0.45 },
  paidButtonText: { color: colors.sea, fontSize: 14, fontWeight: '700' },
  shareButton: { minHeight: 52, marginTop: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.clay },
  shareButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  editButton: { minHeight: 52, marginTop: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: colors.sea },
  editButtonText: { color: colors.sea, fontSize: 16, fontWeight: '700' },
});
