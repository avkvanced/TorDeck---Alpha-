import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  SectionList,
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
  Music,
  Film,
  BookOpen,
  Gamepad2,
  File,
  FileText,
  ExternalLink,
  Trash2,
  Link,
  Copy,
  Share2,
  ChevronRight,
  FolderOpen,
  Link2,
  ChevronLeft,
} from 'lucide-react-native';
import * as Linking from 'expo-linking';
import { useMutation } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { CATEGORY_META } from '@/constants/categories';
import { MediaCategory, LibraryItem, DownloadSource } from '@/types/torbox';
import { formatBytes, truncateMiddle, formatTimeAgo } from '@/utils/formatters';
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

interface SectionData {
  title: string;
  color: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  count: number;
  totalSize: number;
  data: LibraryItem[];
}

export default function DownloadDetailScreen() {
  const params = useLocalSearchParams<{
    source: string;
    sourceId: string;
    name: string;
    size: string;
    filesCount: string;
    downloadState: string;
    downloadFinished: string;
    createdAt: string;
    returnTo?: 'library' | 'downloads';
    initialSource?: string;
  }>();
  const router = useRouter();
  const { libraryItems, deleteItem, isDeleting } = useLibrary();
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const source = (params.source ?? 'torrent') as DownloadSource;
  const sourceId = Number(params.sourceId ?? 0);
  const isComplete = params.downloadFinished === 'true';

  const subFiles = useMemo(() => {
    return libraryItems.filter(
      item => item.source === source && item.sourceId === sourceId
    );
  }, [libraryItems, source, sourceId]);

  const sections = useMemo((): SectionData[] => {
    const grouped = new Map<MediaCategory, LibraryItem[]>();
    for (const file of subFiles) {
      const cat = file.category;
      if (!grouped.has(cat)) {
        grouped.set(cat, []);
      }
      grouped.get(cat)!.push(file);
    }

    const result: SectionData[] = [];
    for (const [cat, files] of grouped.entries()) {
      const meta = CATEGORY_META[cat];
      const sorted = [...files].sort((a, b) => a.fileName.localeCompare(b.fileName));
      result.push({
        title: meta.label,
        color: meta.color,
        icon: ICONS[cat],
        count: files.length,
        totalSize: files.reduce((sum, f) => sum + f.fileSize, 0),
        data: sorted,
      });
    }

    result.sort((a, b) => b.count - a.count);
    return result;
  }, [subFiles]);

  const generateLinkMutation = useMutation({
    mutationFn: async (file: LibraryItem) => {
      const url = await torboxApi.getDownloadArchiveLink(file.source, file.sourceId, file.fileId);
      return url;
    },
    onSuccess: (url) => {
      setGeneratedLink(url);
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to generate link');
    },
  });

  const handleOpenFile = useCallback((file: LibraryItem) => {
    router.push({
      pathname: '/item/[id]' as any,
      params: {
        id: file.id,
        sourceId: String(file.sourceId),
        fileId: String(file.fileId),
        source: file.source,
        fileName: file.fileName,
        parentName: file.parentName,
        fileSize: String(file.fileSize),
        category: file.category,
        extension: file.extension,
        returnTo: 'downloads',
        initialSource: source,
      },
    });
  }, [router, source]);

  const handleGenerateFirstLink = useCallback(async () => {
    const primaryFile = selectPrimaryDownloadFile(subFiles, params.name);
    if (!primaryFile) {
      Alert.alert('No Files', 'No files available for this download.');
      return;
    }
    generateLinkMutation.mutate(primaryFile);
  }, [subFiles, params.name, generateLinkMutation]);

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
      await Share.share({ message: generatedLink, title: `Download: ${params.name}` });
    }
  }, [generatedLink, params.name]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Download',
      `Delete "${params.name}"? This removes the entire download and all its files from TorBox.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteItem({ source, sourceId });
              router.back();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Delete failed');
            }
          },
        },
      ]
    );
  }, [params.name, source, sourceId, deleteItem, router]);

  const handleBackPress = useCallback(() => {
    if (params.returnTo === 'downloads') {
      router.replace({
        pathname: '/(tabs)/downloads' as any,
        params: params.initialSource ? { initialSource: params.initialSource } : undefined,
      });
      return;
    }

    if (params.returnTo === 'library') {
      router.replace('/(tabs)/(library)' as any);
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/(library)' as any);
  }, [router, params.returnTo, params.initialSource]);

  const handleShareLink = useCallback(async () => {
    if (!generatedLink) {
      Alert.alert('Generate Link First', 'Tap "Get Link" before sharing.');
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
      await Share.share({ message: generatedLink, title: `Download: ${params.name}` });
    }
  }, [generatedLink, params.name]);

  function getSourceColor(s: string): string {
    switch (s) {
      case 'torrent': return Colors.primary;
      case 'usenet': return Colors.secondary;
      case 'web': return Colors.accent;
      default: return Colors.textTertiary;
    }
  }

  const renderSectionHeader = useCallback(({ section }: { section: SectionData }) => {
    const SectionIcon = section.icon;
    return (
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconBox, { backgroundColor: section.color + '18' }]}>
          <SectionIcon size={16} color={section.color} />
        </View>
        <Text style={[styles.sectionTitle, { color: section.color }]}>{section.title}</Text>
        <View style={[styles.sectionBadge, { backgroundColor: section.color + '20' }]}>
          <Text style={[styles.sectionBadgeText, { color: section.color }]}>{section.count}</Text>
        </View>
        <Text style={styles.sectionSize}>{formatBytes(section.totalSize)}</Text>
      </View>
    );
  }, []);

  const renderItem = useCallback(({ item, index, section }: { item: LibraryItem; index: number; section: SectionData }) => {
    const isLast = index === section.data.length - 1;
    return (
      <TouchableOpacity
        style={[styles.fileRow, !isLast && styles.fileRowBorder]}
        onPress={() => handleOpenFile(item)}
        activeOpacity={0.6}
      >
        <View style={styles.fileIndex}>
          <Text style={styles.fileIndexText}>{index + 1}</Text>
        </View>
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>{item.fileName}</Text>
          <View style={styles.fileMetaRow}>
            <Text style={styles.fileMeta}>.{item.extension.toUpperCase()}</Text>
            <Text style={styles.fileMetaSep}>·</Text>
            <Text style={styles.fileMeta}>{formatBytes(item.fileSize)}</Text>
          </View>
        </View>
        <ChevronRight size={16} color={Colors.textTertiary} />
      </TouchableOpacity>
    );
  }, [handleOpenFile]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: truncateMiddle(params.name ?? 'Download', 28), headerShown: false }} />

      <TouchableOpacity style={styles.backButton} onPress={handleBackPress} testID="download-back-button">
        <ChevronLeft size={18} color={Colors.textSecondary} />
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <View style={[styles.sourceTag, { backgroundColor: getSourceColor(source) + '20' }]}>
                  <Text style={[styles.sourceTagText, { color: getSourceColor(source) }]}>
                    {source.toUpperCase()}
                  </Text>
                </View>
                <View style={[styles.statusTag, { backgroundColor: isComplete ? Colors.statusComplete + '20' : Colors.statusActive + '20' }]}>
                  <View style={[styles.statusDotSmall, { backgroundColor: isComplete ? Colors.statusComplete : Colors.statusActive }]} />
                  <Text style={[styles.statusTagText, { color: isComplete ? Colors.statusComplete : Colors.statusActive }]}>
                    {isComplete ? 'Complete' : params.downloadState}
                  </Text>
                </View>
              </View>

              <Text style={styles.heroName}>{params.name}</Text>

              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{formatBytes(Number(params.size ?? 0))}</Text>
                  <Text style={styles.heroStatLabel}>Total Size</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{subFiles.length}</Text>
                  <Text style={styles.heroStatLabel}>Sub-files</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{sections.length}</Text>
                  <Text style={styles.heroStatLabel}>Categories</Text>
                </View>
              </View>

              {params.createdAt && (
                <Text style={styles.heroDate}>Added {formatTimeAgo(params.createdAt)}</Text>
              )}
            </View>

            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={handleGenerateFirstLink}
                disabled={generateLinkMutation.isPending}
              >
                {generateLinkMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Link2 size={18} color={Colors.primary} />
                )}
                <Text style={styles.quickActionText}>
                  {generatedLink ? 'Regenerate' : 'Get Link'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickActionBtn} onPress={handleShareLink}>
                <Share2 size={18} color={Colors.secondary} />
                <Text style={[styles.quickActionText, { color: Colors.secondary }]}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickActionBtn, styles.quickActionDanger]}
                onPress={handleDelete}
                disabled={isDeleting}
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

            {subFiles.length === 0 && (
              <View style={styles.emptyState}>
                <FolderOpen size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>No files found</Text>
                <Text style={styles.emptySubtext}>This download may still be processing</Text>
              </View>
            )}

            {subFiles.length > 0 && (
              <View style={styles.filesHeaderRow}>
                <FileText size={16} color={Colors.textSecondary} />
                <Text style={styles.filesHeaderText}>
                  {subFiles.length} file{subFiles.length !== 1 ? 's' : ''} in this download
                </Text>
              </View>
            )}
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: -2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backButtonText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sourceTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sourceTagText: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  statusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  heroName: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700' as const,
    lineHeight: 24,
    marginBottom: 16,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: 14,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  heroStatLabel: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
  heroDate: {
    color: Colors.textTertiary,
    fontSize: 12,
    marginTop: 12,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
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
    marginTop: 10,
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  emptySubtext: {
    color: Colors.textTertiary,
    fontSize: 13,
  },
  filesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 22,
    marginBottom: 6,
  },
  filesHeaderText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    flex: 1,
  },
  sectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  sectionSize: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  fileRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  fileIndex: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileIndexText: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '500' as const,
  },
  fileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  fileMeta: {
    color: Colors.textTertiary,
    fontSize: 11,
  },
  fileMetaSep: {
    color: Colors.textTertiary,
    fontSize: 11,
  },
});
