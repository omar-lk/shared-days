import { StyleSheet, Text, type TextProps } from 'react-native';

export function AppText({ style, ...props }: TextProps) {
    return <Text {...props} style={[styles.text, style]} />;
}

const styles = StyleSheet.create({
    text: {
        color: '#111827',
        fontSize: 16,
    },
});