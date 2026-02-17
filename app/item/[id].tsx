import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  ChevronLeft,
  Headphones,
  Music,
  Film,
  BookOpen,
  Gamepad2,
  File,
  ExternalLink,
  Trash2,
  Link,
  Copy,
  Share2,
} from 'lucide-react-native';
import * as Linking from 'expo-linking';
import { useMutation } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { CATEGORY_META, AUDIO_EXTENSIONS } from '@/constants/categories';
import { MediaCategory, LibraryItem } from '@/types/torbox';
import { formatBytes, truncateMiddle } from '@/utils/formatters';
import { torboxApi } from '@/services/torbox-api';
import { useLibrary } from '@/hooks/useLibrary';
import { selectPrimaryDownloadFile } from '@/utils/downloadSelection';

const ICONS: Record<MediaCategory, React.ComponentType<{ size: number; color: string }>> = {
  audiobook: Headphones,
  music: Music,
  video: Film,
  ebook: BookOpen,
  games: Gamepad2,
  other: File,
};

export default function ItemDetailScreen() {
  const params = useLocalSearchParams<{
    id: string;
    sourceId: string;
    fileId: string;
    source: string;
    fileName: string;
    parentName: string;
    fileSize: string;
    category: string;
    extension: string;
    returnTo?: 'library' | 'downloads';
    returnCategory?: MediaCategory;
    initialSource?: string;
  }>();
  const router = useRouter();
  const { libraryItems, deleteItem, isDeleting } = useLibrary();
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [activeRelatedDownloadId, setActiveRelatedDownloadId] = useState<string | null>(null);

  const category = (params.category || 'other') as MediaCategory;
  const meta = CATEGORY_META[category];
  const Icon = ICONS[category];

  const siblingFiles = useMemo(() => {
    return libraryItems.filter(
      item => item.sourceId === Number(params.sourceId) && item.source === params.source
    );
  }, [libraryItems, params.sourceId, params.source]);

  const primaryDownloadFile = useMemo(() => {
    return selectPrimaryDownloadFile(siblingFiles, params.parentName ?? params.fileName);
  }, [siblingFiles, params.parentName, params.fileName]);

  const audiobookTracks = useMemo(() => {
    if (category !== 'audiobook' && category !== 'music') return [];
    return siblingFiles
      .filter(f => AUDIO_EXTENSIONS.includes(f.extension))
      .sort((a, b) => a.fileName.localeCompare(b.fileName));
  }, [siblingFiles, category]);

  const downloadLinkMutation = useMutation({
    mutationFn: async () => {
      if (!primaryDownloadFile) {
        throw new Error('No files available for this download.');
      }
      const url = await torboxApi.getDownloadArchiveLink(
        primaryDownloadFile.source,
        primaryDownloadFile.sourceId,
        primaryDownloadFile.fileId
      );
      return url;
    },
    onSuccess: async (url) => {
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        await Linking.openURL(url);
      }
    },
    onError: (err) => {
      Alert.alert('Download Error', err instanceof Error ? err.message : 'Failed to get download link');
    },
  });

  const generateLinkMutation = useMutation({
    mutationFn: async () => {
      if (!primaryDownloadFile) {
        throw new Error('No files available for this download.');
      }
      const url = await torboxApi.getDownloadArchiveLink(
        primaryDownloadFile.source,
        primaryDownloadFile.sourceId,
        primaryDownloadFile.fileId
      );
      return url;
    },
    onSuccess: (url) => {
      setGeneratedLink(url);
      console.log('[ItemDetail] Generated link:', url);
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to generate link');
    },
  });

  const handleCopyLink = useCallback(async () => {
    if (!generatedLink) return;
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(generatedLink);
        Alert.alert('Copied', 'Link copied to clipboard');
      } catch {
        Alert.alert('Link', generatedLink);
      }
    } else {
      await Share.share({
        message: generatedLink,
        title: `Download: ${params.fileName}`,
      });
    }
  }, [generatedLink, params.fileName]);

  const handleShareLink = useCallback(async () => {
    if (!generatedLink) {
      Alert.alert('Generate Link First', 'Please tap "Generate Link" before sharing.');
      return;
    }

    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(generatedLink);
        Alert.alert('Copied', 'Link copied to clipboard');
      } catch {
        Alert.alert('Link', generatedLink);
      }
    } else {
      await Share.share({
        message: generatedLink,
        title: `Download: ${params.fileName}`,
      });
    }
  }, [generatedLink, params.fileName]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Item',
      `Delete "${params.parentName}"? This will remove the entire download and all its files from TorBox.`,
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

  const handleBackPress = useCallback(() => {
    if (params.returnTo === 'downloads') {
      router.replace({
        pathname: '/(tabs)/downloads' as any,
        params: params.initialSource ? { initialSource: params.initialSource } : undefined,
      });
      return;
    }

    if (params.returnTo === 'library') {
      if (params.returnCategory) {
        router.replace({
          pathname: '/(tabs)/(library)/[category]' as any,
          params: { category: params.returnCategory },
        });
      } else {
        router.replace('/(tabs)/(library)' as any);
      }
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/(library)' as any);
  }, [router, params.returnTo, params.returnCategory, params.initialSource]);

  const handleOpenItem = useCallback((item: LibraryItem) => {
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
        returnTo: params.returnTo,
        returnCategory: params.returnCategory,
        initialSource: params.initialSource,
      },
    });
  }, [router, params.returnTo, params.returnCategory, params.initialSource]);

  const handleDownloadItem = useCallback(async (item: LibraryItem) => {
    try {
      setActiveRelatedDownloadId(item.id);
      const url = await torboxApi.getDownloadLink(item.source, item.sourceId, item.fileId);
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        await Linking.openURL(url);
      }
    } catch (err) {
      Alert.alert('Download Error', err instanceof Error ? err.message : 'Failed to get download link');
    } finally {
      setActiveRelatedDownloadId(null);
    }
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: truncateMiddle(params.fileName ?? '', 24) }} />

      <TouchableOpacity style={styles.backButton} onPress={handleBackPress} testID="item-back-button">
        <ChevronLeft size={18} color={Colors.textSecondary} />
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

      <View style={styles.heroSection}>
        <View style={[styles.iconBox, { backgroundColor: meta.color + '20' }]}>
          <Icon size={48} color={meta.color} />
        </View>
        <View style={[styles.categoryBadge, { backgroundColor: meta.color + '25' }]}>
          <Text style={[styles.categoryText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      <Text style={styles.fileName}>{params.fileName}</Text>
      <Text style={styles.parentName}>{params.parentName}</Text>
      {primaryDownloadFile && primaryDownloadFile.fileId !== Number(params.fileId) && (
        <Text style={styles.mainDownloadHint}>Main download targets: {primaryDownloadFile.fileName}</Text>
      )}

      <View style={styles.metaGrid}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Size</Text>
          <Text style={styles.metaValue}>{formatBytes(Number(params.fileSize ?? 0))}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Type</Text>
          <Text style={styles.metaValue}>.{params.extension?.toUpperCase()}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Source</Text>
          <Text style={styles.metaValue}>{params.source}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Files</Text>
          <Text style={styles.metaValue}>{siblingFiles.length}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.downloadButton}
          onPress={() => downloadLinkMutation.mutate()}
          disabled={downloadLinkMutation.isPending}
          testID="download-button"
        >
          {downloadLinkMutation.isPending ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <ExternalLink size={20} color={Colors.accent} />
          )}
          <Text style={styles.downloadButtonText}>Open Main Download</Text>
        </TouchableOpacity>

        <View style={styles.linkActions}>
          <TouchableOpacity
            style={styles.generateLinkBtn}
            onPress={() => generateLinkMutation.mutate()}
            disabled={generateLinkMutation.isPending}
            testID="generate-link-button"
          >
            {generateLinkMutation.isPending ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Link size={18} color={Colors.primary} />
            )}
            <Text style={styles.generateLinkText}>
              {generatedLink ? 'Regenerate Link' : 'Generate Link'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shareLinkBtn}
            onPress={handleShareLink}
            testID="share-link-button"
          >
            <Share2 size={18} color={Colors.secondary} />
            <Text style={styles.shareLinkText}>Share</Text>
          </TouchableOpacity>
        </View>

        {generatedLink && (
          <TouchableOpacity style={styles.linkPreview} onPress={handleCopyLink}>
            <Copy size={14} color={Colors.textTertiary} />
            <Text style={styles.linkPreviewText} numberOfLines={1}>
              {generatedLink}
            </Text>
            <Text style={styles.linkCopyHint}>Tap to copy</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          disabled={isDeleting}
          testID="delete-item-button"
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={Colors.danger} />
          ) : (
            <Trash2 size={20} color={Colors.danger} />
          )}
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {audiobookTracks.length > 1 && (
        <View style={styles.tracksSection}>
          <Text style={styles.sectionTitle}>
            {category === 'audiobook' ? 'Chapters' : 'Tracks'} ({audiobookTracks.length})
          </Text>
          {audiobookTracks.map((track, idx) => (
            <TouchableOpacity
              key={track.id}
              style={[
                styles.trackItem,
                track.id === params.id && styles.trackItemActive,
              ]}
              onPress={() => {
                handleOpenItem(track);
              }}
            >
              <Text style={styles.trackIdx}>{idx + 1}</Text>
              <View style={styles.trackInfo}>
                <Text
                  style={[
                    styles.trackName,
                    track.id === params.id && styles.trackNameActive,
                  ]}
                  numberOfLines={1}
                >
                  {track.fileName}
                </Text>
                <Text style={styles.trackSize}>{formatBytes(track.fileSize)}</Text>
              </View>
              <ExternalLink size={16} color={track.id === params.id ? Colors.primary : Colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {siblingFiles.length > 1 && category !== 'audiobook' && category !== 'music' && (
        <View style={styles.tracksSection}>
          <Text style={styles.sectionTitle}>
            Related Files ({siblingFiles.length})
          </Text>
          {siblingFiles.slice(0, 20).map(file => (
            <TouchableOpacity key={file.id} style={styles.relatedFile} onPress={() => handleOpenItem(file)}>
              <View style={[styles.relatedDot, { backgroundColor: CATEGORY_META[file.category].color }]} />
              <Text style={styles.relatedName} numberOfLines={1}>{file.fileName}</Text>
              <Text style={styles.relatedSize}>{formatBytes(file.fileSize)}</Text>
              <TouchableOpacity
                style={styles.relatedDownloadBtn}
                onPress={(event) => {
                  event.stopPropagation();
                  handleDownloadItem(file);
                }}
                disabled={activeRelatedDownloadId === file.id}
                testID={`related-download-${file.id}`}
              >
                {activeRelatedDownloadId === file.id ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <ExternalLink size={15} color={Colors.accent} />
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  backButton: {
    marginTop: 12,
    marginBottom: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
  },
  backButtonText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
  },
  iconBox: {
    width: 96,
    height: 96,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  fileName: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    lineHeight: 26,
    marginBottom: 4,
  },
  parentName: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center' as const,
    marginBottom: 6,
  },
  mainDownloadHint: {
    color: Colors.textTertiary,
    fontSize: 11,
    textAlign: 'center' as const,
    marginBottom: 14,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  metaItem: {
    width: '50%',
    padding: 14,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.border,
  },
  metaLabel: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    marginBottom: 2,
  },
  metaValue: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  actions: {
    marginTop: 20,
    gap: 10,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent + '15',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.accent + '30',
  },
  downloadButtonText: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  linkActions: {
    flexDirection: 'row',
    gap: 10,
  },
  generateLinkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '12',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '25',
  },
  generateLinkText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  shareLinkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.secondary + '12',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.secondary + '25',
  },
  shareLinkText: {
    color: Colors.secondary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  linkPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 10,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  linkPreviewText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 12,
  },
  linkCopyHint: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.danger + '12',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.danger + '25',
  },
  deleteButtonText: {
    color: Colors.danger,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  tracksSection: {
    marginTop: 24,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 12,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
    gap: 12,
  },
  trackItemActive: {
    backgroundColor: Colors.primary + '15',
  },
  trackIdx: {
    color: Colors.textTertiary,
    fontSize: 13,
    fontWeight: '600' as const,
    width: 24,
    textAlign: 'center' as const,
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    color: Colors.text,
    fontSize: 14,
  },
  trackNameActive: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  trackSize: {
    color: Colors.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  relatedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  relatedDownloadBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  relatedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  relatedName: {
    color: Colors.text,
    fontSize: 13,
    flex: 1,
  },
  relatedSize: {
    color: Colors.textTertiary,
    fontSize: 12,
  },
});
