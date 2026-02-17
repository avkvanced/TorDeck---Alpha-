import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';

interface StatCardProps {
  label: string;
  value: string;
  color?: string;
  icon?: React.ReactNode;
}

function StatCardInner({ label, value, color = Colors.primary, icon }: StatCardProps) {
  return (
    <View style={styles.container}>
      {icon && <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>{icon}</View>}
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export default React.memo(StatCardInner);

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '48%' as any,
    marginBottom: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  value: {
    fontSize: 22,
    fontWeight: '800' as const,
    marginBottom: 2,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500' as const,
  },
});
