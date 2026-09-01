import { useGroups } from '@/src/features/groups/GroupsContext';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
export default function HomeScreen() {
    const { groups } = useGroups();
    return (
        <View style={styles.container}>
            <View>
                <Text style={styles.title}>Your groups</Text>

                <Text style={styles.subtitle}>
                    Trips, dinners and everything you split with friends.
                </Text>
            </View>

            <View style={styles.content}>
                {groups.length === 0 ? (
                    <>
                        <Text style={styles.emptyTitle}>No groups yet</Text>

                        <Text style={styles.emptyDescription}>
                            Create your first group and start splitting expenses.
                        </Text>
                    </>
                ) : (
                    groups.map((group) => (
                        <View key={group.id} style={styles.groupCard}>
                            <Text style={styles.groupName}>{group.name}</Text>

                            <Text style={styles.groupMeta}>No expenses yet</Text>
                        </View>
                    ))
                )}
            </View>

            <Pressable
                style={styles.button}
                onPress={() => router.push('/groups/create')}
            >
                <Text style={styles.buttonText}>+ Create group</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 72,
        paddingBottom: 32,
    },

    title: {
        fontSize: 32,
        fontWeight: '700',
    },

    subtitle: {
        marginTop: 8,
        fontSize: 16,
        lineHeight: 22,
        color: '#6B7280',
    },

    content: {
        flex: 1,
        justifyContent: 'center',
    },

    groupCard: {
        padding: 18,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 16,
    },

    groupName: {
        fontSize: 18,
        fontWeight: '600',
    },

    groupMeta: {
        marginTop: 4,
        color: '#6B7280',
    },

    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
    },

    emptyDescription: {
        marginTop: 8,
        textAlign: 'center',
        fontSize: 15,
        lineHeight: 21,
        color: '#6B7280',
    },

    button: {
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        backgroundColor: '#111827',
    },

    buttonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '600',
    },
});