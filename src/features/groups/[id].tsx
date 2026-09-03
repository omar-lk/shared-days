import { useGroups } from '@/src/features/groups/GroupsContext';
import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function GroupDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { groups } = useGroups();

    const group = groups.find((group) => group.id === id);

    if (!group) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>Group not found</Text>
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

                <Text style={styles.subtitle}>
                    No expenses yet
                </Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Members</Text>

                    <Text style={styles.emptyText}>
                        No members added yet.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Expenses</Text>

                    <Text style={styles.emptyText}>
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

    title: {
        fontSize: 28,
        fontWeight: '700',
    },

    subtitle: {
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

    emptyText: {
        marginTop: 12,
        color: '#6B7280',
    },
});