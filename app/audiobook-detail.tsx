import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  Headphones,
  Trash2,
  Link2,
  ExternalLink,
  Share2,
  Copy,
} from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { LibraryItem } from '@/types/torbox';
import { formatBytes, truncateMiddle } from '@/utils/formatters';
import { torboxApi } from '@/services/torbox-api';
import { useLibrary } from '@/hooks/useLibrary';
import { AUDIO_EXTENSIONS } from '@/constants/categories';

export default function AudiobookDetailScreen() {
  const params = useLocalSearchParams<{
    groupId: string;
    name: string;
    source: string;
    sourceId: string;
  }>();
  const router = useRouter();
  const { libraryItems, deleteItem, isDeleting } = useLibrary();
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const tracks = useMemo(() => {
    return libraryItems
      .filter(
        item =>
          item.source === params.source &&
          item.sourceId === Number(params.sourceId) &&
          item.category === 'audiobook' &&
          AUDIO_EXTENSIONS.includes(item.extension)
      )
      .sort((a, b) => a.fileName.localeCompare(b.fileName));
  }, [libraryItems, params.source, params.sourceId]);

  const totalSize = useMemo(() => tracks.reduce((sum, t) => sum + t.fileSize, 0), [tracks]);

  const primaryTrack = useMemo(() => tracks[0] ?? null, [tracks]);

  const handleOpenTrack = useCallback((track: LibraryItem) => {
    router.push({
      pathname: '/item/[id]' as any,
      params: {
        id: track.id,
        sourceId: String(track.sourceId),
        fileId: String(track.fileId),
        source: track.source,
        fileName: track.fileName,
        parentName: track.parentName,
        fileSize: String(track.fileSize),
        category: track.category,
        extension: track.extension,
      },
    });
  }, [router]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Audiobook',
      `Delete "${params.name}"? This will remove the entire download and all its files from TorBox.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteItem({
                source: params.source ?? 'torrent',
                sourceId: Number(params.sourceId),
              });
              router.back();
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Delete failed';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  }, [params, deleteItem, router]);

  const generateLinkMutation = useMutation({
    mutationFn: async (track: LibraryItem) => {
      return torboxApi.getDownloadArchiveLink(track.source, track.sourceId, track.fileId);
    },
    onSuccess: (url) => {
      setGeneratedLink(url);
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to generate link');
    },
  });

  const handleGenerateMainLink = useCallback(() => {
    if (!primaryTrack) {
      Alert.alert('No files', 'No audiobook files are available for this item yet.');
      return;
    }

    generateLinkMutation.mutate(primaryTrack);
  }, [primaryTrack, generateLinkMutation]);

  const handleShareLink = useCallback(async () => {
    if (!primaryTrack) {
      Alert.alert('No files', 'No audiobook files are available for this item yet.');
      return;
    }

    try {
      const url = generatedLink || await torboxApi.getDownloadArchiveLink(primaryTrack.source, primaryTrack.sourceId, primaryTrack.fileId);
      if (Platform.OS === 'web') {
        try {
          await navigator.clipboard.writeText(url);
          Alert.alert('Copied', 'Link copied to clipboard');
        } catch {
          Alert.alert('Link', url);
        }
      } else {
        await Share.share({ message: url, title: `Download: ${primaryTrack.fileName}` });
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to share');
    }
  }, [generatedLink, primaryTrack]);

  const handleCopyLink = useCallback(async () => {
    if (!generatedLink) return;

    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(generatedLink);
        Alert.alert('Copied', 'Link copied to clipboard');
      } catch {
        Alert.alert('Link', generatedLink);
      }
      return;
    }

    await Share.share({ message: generatedLink, title: `Download: ${params.name}` });
  }, [generatedLink, params.name]);

  const renderTrack = useCallback(({ item, index }: { item: LibraryItem; index: number }) => (
    <TouchableOpacity
      style={styles.trackRow}
      onPress={() => handleOpenTrack(item)}
      activeOpacity={0.7}
    >
      <View style={styles.trackNum}>
        <Text style={styles.trackNumText}>{index + 1}</Text>
      </View>
      <View style={styles.trackInfo}>
        <Text style={styles.trackName} numberOfLines={1}>
          {item.fileName}
        </Text>
        <View style={styles.trackMeta}>
          <Text style={styles.trackSize}>{formatBytes(item.fileSize)}</Text>
          <Text style={styles.trackExt}>.{item.extension.toUpperCase()}</Text>
        </View>
      </View>
      <ExternalLink size={16} color={Colors.categoryAudiobook} />
    </TouchableOpacity>
  ), [handleOpenTrack]);

  const keyExtractor = useCallback((item: LibraryItem) => item.id, []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: truncateMiddle(params.name ?? '', 24) }} />
      <FlatList
        data={tracks}
        renderItem={renderTrack}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.heroCard}>
              <View style={styles.heroIconWrap}>
                <Headphones size={40} color={Colors.categoryAudiobook} />
              </View>
              <Text style={styles.heroTitle} numberOfLines={3}>
                {params.name}
              </Text>
              <View style={styles.heroMeta}>
                <Text style={styles.heroMetaText}>{tracks.length} chapters</Text>
                <Text style={styles.heroDot}>·</Text>
                <Text style={styles.heroMetaText}>{formatBytes(totalSize)}</Text>
                <Text style={styles.heroDot}>·</Text>
                <Text style={styles.heroMetaText}>{params.source}</Text>
              </View>
            </View>
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={handleGenerateMainLink}
                disabled={generateLinkMutation.isPending || !primaryTrack}
                testID="audiobook-primary-download-btn"
              >
                {generateLinkMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Link2 size={18} color={Colors.primary} />
                )}
                <Text style={styles.quickActionText}>
                  {generatedLink ? 'Regenerate Link' : 'Generate Link'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={handleShareLink}
                disabled={!primaryTrack}
              >
                <Share2 size={18} color={Colors.secondary} />
                <Text style={[styles.quickActionText, { color: Colors.secondary }]}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickActionBtn, styles.quickActionDanger]}
                onPress={handleDelete}
                disabled={isDeleting}
                testID="delete-audiobook-btn"
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={Colors.danger} />
                ) : (
                  <Trash2 size={18} color={Colors.danger} />
                )}
                <Text style={[styles.quickActionText, { color: Colors.danger }]}>Delete</Text>
              </TouchableOpacity>
            </View>

            {generatedLink && (
              <TouchableOpacity style={styles.linkPreview} onPress={handleCopyLink}>
                <Copy size={14} color={Colors.textTertiary} />
                <Text style={styles.linkPreviewText} numberOfLines={1}>{generatedLink}</Text>
                <Text style={styles.linkCopyHint}>Copy</Text>
              </TouchableOpacity>
            )}

            <View style={styles.trackListHeader}>
              <Text style={styles.trackListTitle}>Chapters ({tracks.length})</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No audio files found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    marginTop: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  heroIconWrap: {
    width: 78,
    height: 78,
    borderRadius: 16,
    backgroundColor: Colors.categoryAudiobook + '18',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.categoryAudiobook + '30',
  },
  heroTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800' as const,
    textAlign: 'center' as const,
    lineHeight: 26,
    marginBottom: 8,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroMetaText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  heroDot: {
    color: Colors.textTertiary,
    fontSize: 13,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickActionDanger: {
    borderColor: Colors.danger + '25',
    backgroundColor: Colors.danger + '08',
  },
  quickActionText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  linkPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  linkPreviewText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 11,
  },
  linkCopyHint: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  trackListHeader: {
    marginBottom: 12,
  },
  trackListTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700' as const,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 10,
    marginBottom: 2,
    gap: 12,
  },
  trackNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackNumText: {
    color: Colors.textTertiary,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  trackMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  trackSize: {
    color: Colors.textTertiary,
    fontSize: 11,
  },
  trackExt: {
    color: Colors.textTertiary,
    fontSize: 11,
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: 14,
  },
});
