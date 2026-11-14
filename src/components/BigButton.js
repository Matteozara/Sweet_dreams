import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

export default function BigButton({ title, onPress, color = colors.primary, outline = false, disabled = false, style }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        outline ? { borderColor: color, borderWidth: 2, backgroundColor: 'transparent' } : { backgroundColor: color },
        pressed && { opacity: 0.8 },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <Text style={[styles.text, outline && { color }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    marginVertical: 8,
  },
  text: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
