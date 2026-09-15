import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getGroup } from '../../../src/features/groups/queries';

export default function GroupDetailsScreen() {
    const { groupId } = useLocalSearchParams<{ groupId: string }>();

    const {
        data: group,
        isLoading,
        isError,
    } = useQuery({
        queryKey: ['groups', groupId],
        queryFn: () => getGroup(groupId),
        enabled: !!groupId,
    });

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

    return (
        <>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: group.name,
                }}
            />

            <View style={styles.container}>
                <Text style={styles.title}>{group.name}</Text>

                <Text style={styles.currency}>
                    Currency: {group.currency}
                </Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Members</Text>

                    {<Text style={styles.placeholder}>
                        We will add members next.
                    </Text>}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Expenses</Text>

                    <Text style={styles.placeholder}>
                        No expenses yet.
                    </Text>
                </View>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
    },

    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },

    title: {
        fontSize: 30,
        fontWeight: '700',
    },

    currency: {
        marginTop: 6,
        fontSize: 15,
        color: '#6B7280',
    },

    section: {
        marginTop: 32,
    },

    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
    },

    placeholder: {
        marginTop: 12,
        color: '#6B7280',
    },
});