import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../src/features/auth/AuthContext';
import { formatMinorUnits } from '../../src/features/expenses/money';
import { getGroupExpenseSummaries } from '../../src/features/expenses/queries';
import { getGroups } from '../../src/features/groups/queries';
import { supabase } from '../../src/lib/supabase';
import { colors } from '../../src/theme/colors';

export default function HomeScreen() {
  const { data: groups = [], isLoading, isError } = useQuery({
    queryKey: ['groups'],
    queryFn: getGroups,
  });
  const { data: expenseSummaries, isError: expenseSummariesError } = useQuery({
    queryKey: ['groups', 'expense-summaries'],
    queryFn: getGroupExpenseSummaries,
  });
  const { session } = useAuth();
  const queryClient = useQueryClient();

  function handleDeleteGroup(groupId: string) {
    Alert.alert('Delete group?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('groups').delete().eq('id', groupId);
          if (error) {
            Alert.alert('Unable to delete group', error.message);
            return;
          }
          await queryClient.invalidateQueries({ queryKey: ['groups'] });
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Text style={styles.wordmark}>SHARED DAYS</Text>
        <Pressable
          onPress={() => router.push('/profile')}
          style={styles.profileButton}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          <Text style={styles.profileButtonText}>Profile</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.sun} />
          <View style={styles.horizon} />
          <Text style={styles.heroEyebrow}>GOOD DAYS, SHARED FAIRLY</Text>
          <Text style={styles.heroTitle}>Make room for the moment.</Text>
          <Text style={styles.heroText}>Keep the memories. We’ll keep the numbers clear.</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your groups</Text>
          <Text style={styles.sectionCount}>{isLoading ? '…' : groups.length} total</Text>
        </View>

        {isLoading ? (
          <Text style={styles.placeholder}>Loading your groups...</Text>
        ) : isError ? (
          <Text style={styles.placeholder}>Unable to load groups.</Text>
        ) : groups.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Your next gathering starts here</Text>
            <Text style={styles.emptyText}>Create a group for a dinner, a trip, or your shared home.</Text>
          </View>
        ) : groups.map((group) => {
          const summary = expenseSummaries?.get(group.id);
          const total = formatMinorUnits(summary?.totalMinor ?? 0n);
          return (
            <View key={group.id} style={styles.groupCard}>
              <Pressable
                onPress={() => router.push({
                  pathname: '/groups/[groupId]',
                  params: { groupId: group.id },
                })}
                style={({ pressed }) => [styles.groupOpen, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`${group.name}, ${expenseSummariesError ? 'expense total unavailable' : expenseSummaries ? `${summary?.count ?? 0} expenses, ${total} ${group.currency} spent` : 'expense total loading'}. Open group`}
              >
                <Text style={styles.groupEyebrow}>SHARED GROUP · {group.currency}</Text>
                <Text style={styles.groupName}>{group.name}</Text>
                <View style={styles.cardBottom}>
                  <View style={styles.amountBlock}>
                    <Text style={styles.amountLabel}>TOTAL SPENT</Text>
                    <Text style={styles.amount}>
                      {expenseSummariesError ? 'Unavailable' : expenseSummaries ? total : '…'}
                      {!expenseSummariesError && expenseSummaries && <Text style={styles.currency}> {group.currency}</Text>}
                    </Text>
                  </View>
                  <Text style={styles.cardArrow}>↗</Text>
                </View>
                <Text style={styles.expenseCount}>
                  {expenseSummariesError ? 'Expense totals unavailable' : expenseSummaries
                    ? `${summary?.count ?? 0} ${summary?.count === 1 ? 'expense' : 'expenses'}`
                    : 'Loading expenses...'}
                </Text>
              </Pressable>
              {session?.user.id === group.created_by && (
                <Pressable
                  onPress={() => handleDeleteGroup(group.id)}
                  style={styles.deleteButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${group.name}`}
                >
                  <Text style={styles.deleteText}>Delete group</Text>
                </Pressable>
              )}
            </View>
          );
        })}

        <Pressable onPress={() => supabase.auth.signOut()} style={styles.signOut} accessibilityRole="button">
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => router.push('/groups/create')}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>＋ Create group</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sand },
  topBar: { minHeight: 60, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { color: colors.sea, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  profileButton: { minHeight: 44, minWidth: 70, alignItems: 'flex-end', justifyContent: 'center' },
  profileButtonText: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  content: { paddingHorizontal: 24, paddingBottom: 28 },
  hero: { overflow: 'hidden', backgroundColor: colors.sea, borderRadius: 28, minHeight: 230, padding: 26, justifyContent: 'flex-end' },
  sun: { position: 'absolute', width: 148, height: 148, borderRadius: 74, backgroundColor: '#E8BA87', right: -18, top: -26, opacity: 0.95 },
  horizon: { position: 'absolute', height: 2, backgroundColor: '#A6C6C5', right: 0, left: 0, top: 76, opacity: 0.55 },
  heroEyebrow: { color: '#DBECE7', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  heroTitle: { color: colors.white, fontSize: 30, lineHeight: 35, fontWeight: '700', maxWidth: 245, marginTop: 12 },
  heroText: { color: '#E3F0EC', fontSize: 15, lineHeight: 21, maxWidth: 255, marginTop: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 30, marginBottom: 14 },
  sectionTitle: { color: colors.ink, fontSize: 24, fontWeight: '700' },
  sectionCount: { color: colors.muted, fontSize: 14 },
  placeholder: { color: colors.muted, fontSize: 16, lineHeight: 23, marginVertical: 20 },
  emptyCard: { backgroundColor: colors.paper, borderRadius: 22, padding: 24, borderWidth: 1, borderColor: colors.line },
  emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8 },
  groupCard: { backgroundColor: colors.paper, borderRadius: 22, marginBottom: 14, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  groupOpen: { padding: 20 },
  groupEyebrow: { color: colors.clay, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  groupName: { color: colors.ink, fontSize: 22, fontWeight: '700', marginTop: 7 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 24 },
  amountBlock: { flex: 1 },
  amountLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  amount: { color: colors.ink, fontSize: 29, fontWeight: '700', marginTop: 3 },
  currency: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  cardArrow: { color: colors.clay, fontSize: 27, fontWeight: '500' },
  expenseCount: { color: colors.muted, fontSize: 14, marginTop: 4 },
  deleteButton: { minHeight: 44, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 20, alignItems: 'flex-start', justifyContent: 'center' },
  deleteText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  signOut: { minHeight: 48, alignSelf: 'center', justifyContent: 'center', marginTop: 4 },
  signOutText: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  footer: { backgroundColor: colors.sand, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 8 },
  primaryButton: { minHeight: 56, borderRadius: 18, backgroundColor: colors.clay, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: colors.white, fontSize: 17, fontWeight: '700' },
  pressed: { opacity: 0.75 },
});
