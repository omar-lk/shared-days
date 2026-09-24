import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../../../../../src/features/auth/AuthContext';
import { buildExpenseDraft, type EditableExpenseItem } from '../../../../../src/features/expenses/draft';
import { formatMinorUnits, parseMinorUnits } from '../../../../../src/features/expenses/money';
import { createItemizedExpense, updateItemizedExpense } from '../../../../../src/features/expenses/queries';
import { editableItemsFromReceipt, type ReceiptScan } from '../../../../../src/features/expenses/receiptImport';
import { scanReceipt } from '../../../../../src/features/expenses/scanReceipt';
import { getGroup, getGroupMembers, type Group, type GroupMember } from '../../../../../src/features/groups/queries';
import { colors } from '../../../../../src/theme/colors';

function blankItem(id: string): EditableExpenseItem {
  return {
    id,
    description: '',
    priceText: '',
    participantMemberIds: [],
    splitKind: 'equal',
    customShares: {},
  };
}

export default function CreateExpenseScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
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

  if (groupLoading || membersLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }
  if (groupError || membersError || !group) {
    return <View style={styles.center}><Text>Unable to load expense details.</Text></View>;
  }

  return <ExpenseEditor group={group} members={members} />;
}

export function ExpenseEditor({
  group,
  members,
  expenseId,
  initialPayerMemberId,
  initialItems,
}: {
  group: Group;
  members: GroupMember[];
  expenseId?: string;
  initialPayerMemberId?: string;
  initialItems?: EditableExpenseItem[];
}) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const nextItemNumber = useRef((initialItems?.length ?? 1) + 1);
  const [selectedPayerMemberId, setSelectedPayerMemberId] = useState(initialPayerMemberId ?? '');
  const [items, setItems] = useState<EditableExpenseItem[]>(initialItems ?? [blankItem('draft-1')]);
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [receiptTotalMinor, setReceiptTotalMinor] = useState<number | null>(null);
  const [receiptImageUri, setReceiptImageUri] = useState<string | null>(null);
  const groupId = group.id;

  const payerMemberId = members.some((member) => member.id === selectedPayerMemberId)
    ? selectedPayerMemberId
    : (members.find((member) => member.user_id === session?.user.id)?.id ?? members[0]?.id ?? '');

  function updateItem(id: string, update: Partial<EditableExpenseItem>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...update } : item));
  }

  function toggleParticipant(itemId: string, memberId: string) {
    setItems((current) => current.map((item) => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        participantMemberIds: item.participantMemberIds.includes(memberId)
          ? item.participantMemberIds.filter((id) => id !== memberId)
          : [...item.participantMemberIds, memberId],
      };
    }));
  }

  function setCustomShare(itemId: string, memberId: string, amount: string) {
    setItems((current) => current.map((item) => item.id === itemId
      ? { ...item, customShares: { ...item.customShares, [memberId]: amount } }
      : item
    ));
  }

  let draft: ReturnType<typeof buildExpenseDraft> | null = null;
  let draftError: string | null = null;
  try {
    draft = buildExpenseDraft({
      payerMemberId,
      memberIds: members.map((member) => member.id),
      items,
    });
  } catch (error) {
    draftError = error instanceof Error ? error.message : 'Check the expense details';
  }

  const saveMutation = useMutation({
    mutationFn: (input: { groupId: string; payerMemberId: string; items: ReturnType<typeof buildExpenseDraft>['rpcItems'] }) =>
      expenseId
        ? updateItemizedExpense({ expenseId, payerMemberId: input.payerMemberId, items: input.items })
        : createItemizedExpense(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['groups', groupId, 'expenses'],
        exact: true,
      });
      await queryClient.invalidateQueries({
        queryKey: ['groups', 'expense-summaries'],
        exact: true,
      });
      if (expenseId) {
        await queryClient.invalidateQueries({
          queryKey: ['groups', groupId, 'expenses', expenseId],
          exact: true,
        });
      }
      router.back();
    },
    onError: (error) => Alert.alert('Unable to save expense', error.message),
  });

  const scanMutation = useMutation({
    mutationFn: ({ imageBase64 }: { imageBase64: string; imageUri: string }) => scanReceipt(groupId, imageBase64),
    onSuccess: (scan: ReceiptScan, variables) => {
      setItems(editableItemsFromReceipt(scan, `receipt-${Date.now()}`));
      setReceiptTotalMinor(scan.totalMinor);
      setReceiptImageUri(variables.imageUri);
      setAttemptedSave(false);
    },
    onError: (error) => Alert.alert('Unable to scan bill', error.message),
  });

  async function pickReceipt(source: 'camera' | 'gallery') {
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Camera access needed', 'Allow camera access to photograph a bill. You can also choose a photo from your gallery.');
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        base64: true,
        quality: 0.8,
      };
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const image = result.assets[0];
      if (!image?.base64) throw new Error('This image could not be read. Try another photo.');
      if (image.base64.length > 7_000_000) {
        throw new Error('This photo is too large to scan. Choose a smaller image or enter the items manually.');
      }
      scanMutation.mutate({ imageBase64: image.base64, imageUri: image.uri });
    } catch (error) {
      Alert.alert('Unable to open bill photo', error instanceof Error ? error.message : 'Try another photo.');
    }
  }

  function confirmReceiptImport(source: 'camera' | 'gallery') {
    if (scanMutation.isPending) return;
    if (items.some((item) => item.description.trim() || item.priceText.trim())) {
      Alert.alert('Replace current items?', 'Scanning a new bill will replace the items you have entered. The expense has not been saved.', [
        { text: 'Keep items', style: 'cancel' },
        { text: 'Replace items', onPress: () => void pickReceipt(source) },
      ]);
      return;
    }
    void pickReceipt(source);
  }

  let itemTotalMinor: number | null = 0;
  for (const item of items) {
    const price = parseMinorUnits(item.priceText);
    if (price === null || itemTotalMinor === null || !Number.isSafeInteger(itemTotalMinor + price)) {
      itemTotalMinor = null;
      break;
    }
    itemTotalMinor += price;
  }
  const receiptTotalMismatch = receiptTotalMinor !== null && itemTotalMinor !== null &&
    receiptTotalMinor !== itemTotalMinor;

  function handleSave() {
    setAttemptedSave(true);
    if (!draft || !groupId || saveMutation.isPending) return;
    const input = { groupId, payerMemberId, items: draft.rpcItems };
    if (receiptTotalMismatch && receiptTotalMinor !== null && itemTotalMinor !== null) {
      Alert.alert(
        'Bill total does not match',
        `The photo shows ${formatMinorUnits(receiptTotalMinor)} ${group.currency}, but the items add up to ${formatMinorUnits(itemTotalMinor)} ${group.currency}. Review missing charges, discounts, or misread prices before saving.`,
        [
          { text: 'Review items', style: 'cancel' },
          { text: 'Save item total', onPress: () => saveMutation.mutate(input) },
        ],
      );
      return;
    }
    saveMutation.mutate(input);
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: expenseId ? 'Edit expense' : 'Add expense', headerStyle: { backgroundColor: colors.sand }, headerTintColor: colors.ink }} />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>{group.name.toUpperCase()} · {group.currency}</Text>
          <Text style={styles.title}>{expenseId ? 'Edit the bill' : 'Add a shared bill'}</Text>
          <Text style={styles.subtitle}>Add each item, then choose who shared it.</Text>

          <Text style={styles.sectionTitle}>1 · Who paid?</Text>
          <Text style={styles.sectionHint}>One person covered this bill in full.</Text>
          <View style={styles.choices}>
            {members.map((member) => (
              <Pressable
                key={member.id}
                onPress={() => setSelectedPayerMemberId(member.id)}
                style={[styles.choice, payerMemberId === member.id && styles.choiceSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected: payerMemberId === member.id }}
              >
                <Text style={[styles.choiceText, payerMemberId === member.id && styles.choiceTextSelected]}>
                  {member.display_name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionTitle}>2 · What was shared?</Text>
          <Text style={styles.sectionHint}>A dish can belong to one person or many.</Text>
          {!expenseId && (
            <View style={styles.scanCard}>
              <Text style={styles.scanTitle}>Import a bill photo</Text>
              <Text style={styles.scanHint}>We’ll fill in article names and prices. You’ll review them and choose who shared each one. The photo is sent for scanning and is not saved with the expense.</Text>
              <View style={styles.scanActions}>
                <Pressable
                  onPress={() => confirmReceiptImport('camera')}
                  disabled={scanMutation.isPending}
                  style={[styles.scanButton, scanMutation.isPending && styles.scanDisabled]}
                  accessibilityRole="button"
                >
                  <Text style={styles.scanButtonText}>Take photo</Text>
                </Pressable>
                <Pressable
                  onPress={() => confirmReceiptImport('gallery')}
                  disabled={scanMutation.isPending}
                  style={[styles.scanButton, scanMutation.isPending && styles.scanDisabled]}
                  accessibilityRole="button"
                >
                  <Text style={styles.scanButtonText}>Choose photo</Text>
                </Pressable>
              </View>
              {scanMutation.isPending && <View style={styles.scanningRow}><ActivityIndicator color={colors.sea} /><Text style={styles.scanHint}>Reading bill items...</Text></View>}
              {receiptImageUri && <Image source={{ uri: receiptImageUri }} style={styles.receiptImage} resizeMode="contain" accessibilityLabel="Imported bill photo" />}
              {receiptImageUri && <Text style={styles.scanHint}>Check every price and assign at least one person to each item.</Text>}
            </View>
          )}
          {items.map((item, index) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>ITEM {String(index + 1).padStart(2, '0')}</Text>
                {items.length > 1 && (
                  <Pressable
                    onPress={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
                    style={styles.removeButton}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove item ${index + 1}`}
                  >
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                )}
              </View>

              <Text style={styles.label}>Name</Text>
              <TextInput
                value={item.description}
                onChangeText={(description) => updateItem(item.id, { description })}
                placeholder="Pizza, salad, wine..."
                placeholderTextColor={colors.muted}
                style={styles.input}
                accessibilityLabel={`Item ${index + 1} name`}
              />

              <Text style={styles.label}>Price ({group.currency})</Text>
              <TextInput
                value={item.priceText}
                onChangeText={(priceText) => updateItem(item.id, { priceText })}
                placeholder="0.00"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                style={styles.input}
                accessibilityLabel={`Item ${index + 1} price`}
              />

              <Text style={styles.label}>Who shared it?</Text>
              <View style={styles.choices}>
                {members.map((member) => {
                  const selected = item.participantMemberIds.includes(member.id);
                  return (
                    <Pressable
                      key={member.id}
                      onPress={() => toggleParticipant(item.id, member.id)}
                      style={[styles.choice, selected && styles.choiceSelected]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                    >
                      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                        {member.display_name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Split</Text>
              <View style={styles.choices}>
                {(['equal', 'custom'] as const).map((kind) => (
                  <Pressable
                    key={kind}
                    onPress={() => updateItem(item.id, { splitKind: kind })}
                    style={[styles.choice, item.splitKind === kind && styles.choiceSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: item.splitKind === kind }}
                  >
                    <Text style={[styles.choiceText, item.splitKind === kind && styles.choiceTextSelected]}>
                      {kind === 'equal' ? 'Equal' : 'Custom amounts'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {item.splitKind === 'custom' && item.participantMemberIds.map((memberId) => {
                const member = members.find((entry) => entry.id === memberId);
                return (
                  <View key={memberId} style={styles.customRow}>
                    <Text style={styles.customName}>{member?.display_name ?? 'Member'}</Text>
                    <TextInput
                      value={item.customShares[memberId] ?? ''}
                      onChangeText={(amount) => setCustomShare(item.id, memberId, amount)}
                      placeholder="0.00"
                      placeholderTextColor={colors.muted}
                      keyboardType="decimal-pad"
                      style={[styles.input, styles.customInput]}
                      accessibilityLabel={`${member?.display_name ?? 'Member'} custom share`}
                    />
                  </View>
                );
              })}
            </View>
          ))}

          <Pressable
            onPress={() => {
              const id = `draft-${nextItemNumber.current++}`;
              setItems((current) => [...current, blankItem(id)]);
            }}
            style={styles.addItemButton}
            accessibilityRole="button"
          >
            <Text style={styles.addItemText}>+ Add another item</Text>
          </Pressable>

          <Text style={styles.sectionTitle}>3 · Review the split</Text>
          {receiptTotalMinor !== null && (
            <View style={styles.receiptTotalNotice}>
              <Text style={styles.receiptTotalText}>Photo total: {formatMinorUnits(receiptTotalMinor)} {group.currency}</Text>
              <Text style={[styles.receiptTotalCaption, receiptTotalMismatch && styles.receiptTotalWarning]}>
                {receiptTotalMismatch ? 'Item prices differ from the photo total. Review before saving.' : 'Compare this with the item prices below.'}
              </Text>
            </View>
          )}
          <View style={styles.summary}>
            {draft ? (
              <>
                <Text style={styles.summaryLabel}>BILL TOTAL</Text>
                <Text style={styles.total}>{formatMinorUnits(draft.calculation.totalMinor)} <Text style={styles.totalCurrency}>{group.currency}</Text></Text>
                {draft.calculation.shares.filter((share) => share.amountMinor > 0).map((share) => {
                  const member = members.find((entry) => entry.id === share.memberId);
                  return (
                    <View key={share.memberId} style={styles.summaryRow}>
                      <View style={styles.summaryPerson}>
                        <Text style={styles.summaryName}>{member?.display_name ?? 'Member'}</Text>
                        <Text style={styles.summaryCaption}>{share.memberId === payerMemberId ? 'Payer’s own share' : 'Owes the payer'}</Text>
                      </View>
                      <Text style={styles.summaryAmount}>{formatMinorUnits(share.amountMinor)} {group.currency}</Text>
                    </View>
                  );
                })}
              </>
            ) : (
              <Text style={styles.summaryPlaceholder}>Complete the items above to preview everyone’s share.</Text>
            )}
          </View>

          {attemptedSave && draftError && <Text style={styles.error}>{draftError}</Text>}
          {members.length === 0 && <Text style={styles.error}>Add a group member before recording an expense.</Text>}

          <Pressable
            onPress={handleSave}
            disabled={saveMutation.isPending || members.length === 0}
            style={[styles.saveButton, (saveMutation.isPending || members.length === 0) && styles.saveButtonDisabled]}
            accessibilityRole="button"
          >
            <Text style={styles.saveText}>
              {saveMutation.isPending ? 'Saving...' : expenseId ? 'Save changes' : 'Save expense'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sand },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sand },
  container: { backgroundColor: colors.sand, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 48 },
  eyebrow: { color: colors.clay, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '700', marginTop: 7 },
  subtitle: { marginTop: 6, color: colors.muted, fontSize: 15, lineHeight: 22 },
  sectionTitle: { color: colors.ink, fontSize: 21, fontWeight: '700', marginTop: 30, marginBottom: 5 },
  sectionHint: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 44, paddingHorizontal: 15, justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  choiceSelected: { borderColor: colors.sea, backgroundColor: colors.sea },
  choiceText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  choiceTextSelected: { color: colors.white },
  itemCard: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, borderRadius: 20, padding: 18, marginBottom: 14 },
  scanCard: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, borderRadius: 20, padding: 18, marginBottom: 20 },
  scanTitle: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  scanHint: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 8 },
  scanActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  scanButton: { flex: 1, minHeight: 48, borderRadius: 13, backgroundColor: colors.sea, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  scanButtonText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  scanDisabled: { opacity: 0.5 },
  scanningRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  receiptImage: { width: '100%', height: 170, marginTop: 16, borderRadius: 12, backgroundColor: colors.sand },
  receiptTotalNotice: { backgroundColor: colors.paper, borderRadius: 15, padding: 15, marginTop: 12, marginBottom: 4 },
  receiptTotalText: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  receiptTotalCaption: { color: colors.muted, fontSize: 13, marginTop: 4 },
  receiptTotalWarning: { color: colors.danger },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { color: colors.clay, fontSize: 12, fontWeight: '800', letterSpacing: 1.3 },
  removeButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  removeText: { color: colors.danger, fontWeight: '700' },
  label: { color: colors.ink, fontSize: 15, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, color: colors.ink, borderRadius: 13, paddingHorizontal: 13, fontSize: 16 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  customName: { flex: 1, color: colors.ink, fontSize: 15 },
  customInput: { width: 120 },
  addItemButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: colors.sea },
  addItemText: { color: colors.sea, fontWeight: '700', fontSize: 16 },
  summary: { backgroundColor: colors.seaLight, borderRadius: 20, padding: 20, marginTop: 10 },
  summaryLabel: { color: colors.sea, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  total: { color: colors.ink, fontSize: 30, fontWeight: '700', marginTop: 4, marginBottom: 12 },
  totalCurrency: { fontSize: 16, color: colors.muted },
  summaryRow: { borderTopWidth: 1, borderTopColor: '#C8DADC', paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryPerson: { flex: 1 },
  summaryName: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  summaryCaption: { color: colors.muted, fontSize: 13, marginTop: 2 },
  summaryAmount: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  summaryPlaceholder: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  error: { color: colors.danger, marginTop: 16, fontSize: 14 },
  saveButton: { minHeight: 56, marginTop: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.clay },
  saveButtonDisabled: { opacity: 0.45 },
  saveText: { color: colors.white, fontSize: 17, fontWeight: '700' },
});
