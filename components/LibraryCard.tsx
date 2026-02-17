import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Headphones,
  Music,
  Film,
  BookOpen,
  Gamepad2,
  File,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { CATEGORY_META } from '@/constants/categories';
import { LibraryItem, MediaCategory } from '@/types/torbox';
import { formatBytes, truncateMiddle } from '@/utils/formatters';

const ICONS: Record<MediaCategory, React.ComponentType<{ size: number; color: string }>> = {
  audiobook: Headphones,
  music: Music,
  video: Film,
  ebook: BookOpen,
  games: Gamepad2,
  other: File,
};

interface LibraryCardProps {
  item: LibraryItem;
  returnCategory?: MediaCategory;
}

function LibraryCardInner({ item, returnCategory }: LibraryCardProps) {
  const router = useRouter();
  const meta = CATEGORY_META[item.category];
  const Icon = ICONS[item.category];

  const handlePress = useCallback(() => {
    router.push({
      pathname: '/item/[id]' as any,
      params: {
        id: item.id,
        sourceId: String(item.sourceId),
        fileId: String(item.fileId),
        source: item.source,
        fileName: item.fileName,
        parentName: item.parentName,
        fileSize: String(item.fileSize),
        category: item.category,
        extension: item.extension,
        returnTo: 'library',
        returnCategory,
      },
    });
  }, [router, item, returnCategory]);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
      testID={`library-card-${item.id}`}
    >
      <View style={[styles.iconBox, { backgroundColor: meta.color + '20' }]}>
        <Icon size={22} color={meta.color} />
      </View>
      <View style={styles.info}>
        <Text style={styles.fileName} numberOfLines={1}>
          {truncateMiddle(item.fileName, 40)}
        </Text>
        <Text style={styles.parentName} numberOfLines={1}>
          {truncateMiddle(item.parentName, 36)}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.badge, { backgroundColor: meta.color + '25' }]}>
            <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <Text style={styles.size}>{formatBytes(item.fileSize)}</Text>
          <Text style={styles.ext}>.{item.extension}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default React.memo(LibraryCardInner);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  fileName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
    letterSpacing: -0.1,
    marginBottom: 3,
  },
  parentName: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginBottom: 7,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
  },
  size: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  ext: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: '500' as const,
    textTransform: 'uppercase' as const,
  },
});
