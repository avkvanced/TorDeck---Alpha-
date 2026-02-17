import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Headphones, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { AudiobookGroup } from '@/types/torbox';
import { formatBytes, truncateMiddle } from '@/utils/formatters';

interface AudiobookGroupCardProps {
  group: AudiobookGroup;
}

function AudiobookGroupCardInner({ group }: AudiobookGroupCardProps) {
  const router = useRouter();

  const handlePress = useCallback(() => {
    router.push({
      pathname: '/(tabs)/download-detail' as any,
      params: {
        name: group.name,
        source: group.source,
        sourceId: String(group.sourceId),
        size: String(group.totalSize),
        filesCount: String(group.fileCount),
        downloadFinished: String(group.isComplete),
        createdAt: group.createdAt,
        downloadState: group.isComplete ? 'completed' : 'downloading',
      },
    });
  }, [router, group]);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
      testID={`audiobook-group-${group.id}`}
    >
      <View style={styles.artBox}>
        <Headphones size={28} color={Colors.categoryAudiobook} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {truncateMiddle(group.name, 60)}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{group.fileCount} {group.fileCount === 1 ? 'file' : 'files'}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.metaText}>{formatBytes(group.totalSize)}</Text>
        </View>
        {group.isComplete && (
          <View style={styles.completeBadge}>
            <Text style={styles.completeBadgeText}>Complete</Text>
          </View>
        )}
      </View>
      <ChevronRight size={20} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

export default React.memo(AudiobookGroupCardInner);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  artBox: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.categoryAudiobook + '14',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  info: {
    flex: 1,
  },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
    lineHeight: 20,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  dot: {
    color: Colors.textTertiary,
    fontSize: 12,
  },
  completeBadge: {
    backgroundColor: Colors.statusComplete + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  completeBadgeText: {
    color: Colors.statusComplete,
    fontSize: 10,
    fontWeight: '700' as const,
  },
});
