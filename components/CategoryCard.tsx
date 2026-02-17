import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  Headphones,
  Music,
  Film,
  BookOpen,
  Gamepad2,
  File,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { MediaCategory } from '@/types/torbox';
import { CATEGORY_META } from '@/constants/categories';
import { formatBytes } from '@/utils/formatters';

const ICONS: Record<MediaCategory, React.ComponentType<{ size: number; color: string }>> = {
  audiobook: Headphones,
  music: Music,
  video: Film,
  ebook: BookOpen,
  games: Gamepad2,
  other: File,
};

interface CategoryCardProps {
  category: MediaCategory;
  count: number;
  totalBytes: number;
  onPress: (category: MediaCategory) => void;
}

function CategoryCardInner({ category, count, totalBytes, onPress }: CategoryCardProps) {
  const meta = CATEGORY_META[category];
  const Icon = ICONS[category];

  const handlePress = useCallback(() => {
    onPress(category);
  }, [category, onPress]);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
      testID={`category-${category}`}
    >
      <View style={[styles.iconCircle, { backgroundColor: meta.color + '20' }]}>
        <Icon size={24} color={meta.color} />
      </View>
      <Text style={styles.label}>{meta.label}</Text>
      <Text style={styles.count}>{count} download{count === 1 ? '' : 's'}</Text>
      <Text style={styles.size}>{formatBytes(totalBytes)}</Text>
    </TouchableOpacity>
  );
}

export default React.memo(CategoryCardInner);

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '48%' as any,
    marginBottom: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  label: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  count: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500' as const,
  },
  size: {
    color: Colors.textTertiary,
    fontSize: 11,
    marginTop: 3,
    fontWeight: '500' as const,
  },
});
