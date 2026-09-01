import { StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/AppText';

export default function HomeScreen() {
    return (
        <View style={styles.container}>
            <AppText style={styles.title}>Splitwise</AppText>

            <AppText style={styles.subtitle}>
                Split expenses without doing the math.
            </AppText>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
    },
    subtitle: {
        marginTop: 8,
        color: '#6B7280',
    },
});