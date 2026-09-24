import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/src/features/auth/AuthContext';
import type { EditableExpenseItem } from '@/src/features/expenses/draft';
import { formatMinorUnits } from '@/src/features/expenses/money';
import { getExpenseDetail } from '@/src/features/expenses/queries';
import { getGroup, getGroupMembers } from '@/src/features/groups/queries';
import { ExpenseEditor } from '../create';

export default function EditExpenseScreen() {
  const { groupId, expenseId } = useLocalSearchParams<{ groupId: string; expenseId: string }>();
  const { session } = useAuth();
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

  if (groupLoading || membersLoading || detailLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }
  if (groupError || membersError || detailError || !group || !detail) {
    return <View style={styles.center}><Text>Unable to load expense.</Text></View>;
  }
  if (group.created_by !== session?.user.id) {
    return <View style={styles.center}><Text>Only the group creator can edit expenses.</Text></View>;
  }

  const initialItems: EditableExpenseItem[] = detail.items.map((item) => {
    const allocations = detail.allocations.filter((allocation) => allocation.item_id === item.id);
    return {
      id: item.id,
      description: item.description,
      priceText: formatMinorUnits(item.price_minor).replaceAll(',', ''),
      participantMemberIds: allocations.map((allocation) => allocation.member_id),
      splitKind: item.split_method,
      customShares: Object.fromEntries(allocations.map((allocation) => [
        allocation.member_id,
        formatMinorUnits(allocation.amount_minor).replaceAll(',', ''),
      ])),
    };
  });

  return (
    <ExpenseEditor
      group={group}
      members={members}
      expenseId={expenseId}
      initialPayerMemberId={detail.expense.payer_member_id}
      initialItems={initialItems}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
