import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Share,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useScrollToTop } from '@react-navigation/native';
import {
  Plus,
  Trash2,
  CheckSquare,
  X,
  Link,
  ExternalLink,
  Share2,
  Copy,
  ChevronRight,
  FileText,
  Filter,
  Link2,
} from 'lucide-react-native';
import * as Linking from 'expo-linking';
import Colors from '@/constants/colors';
import { useLibrary } from '@/hooks/useLibrary';
import SwipeableDownloadCard from '@/components/SwipeableDownloadCard';
import { DownloadSource, LibraryItem, MediaCategory } from '@/types/torbox';
import { torboxApi } from '@/services/torbox-api';
import { formatBytes } from '@/utils/formatters';
import { normalizeDownloadStatus } from '@/utils/downloadStatus';
import { selectPrimaryDownloadFile } from '@/utils/downloadSelection';

type SourceTab = 'all' | DownloadSource;
type StatusFilter = 'all' | 'downloading' | 'completed' | 'stalled' | 'paused' | 'failed' | 'queued';
type MediaFilter = 'all' | MediaCategory;
type FileTypeFilter = 'all' | 'video' | 'audio' | 'books' | 'archives' | 'images' | 'other';
type SizeFilter = 'all' | 'small' | 'medium' | 'large';
type AgeFilter = 'all' | '24h' | '7d' | '30d' | 'older';
type FileCountFilter = 'all' | 'single' | 'multi' | 'bulk';
type DateSort = 'newest' | 'oldest';

interface DownloadItem {
  id: number;
  name: string;
  size: number;
  progress: number;
  downloadSpeed: number;
  eta: number;
  downloadFinished: boolean;
  downloadState: string;
  createdAt: string;
  source: DownloadSource;
  filesCount: number;
  mediaCategory: MediaCategory;
  fileType: Exclude<FileTypeFilter, 'all'>;
}

export default function DownloadsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { torrents, usenet, webDl, libraryItems, isLoading, isFetching, refetchAll, deleteItem, isDeleting } = useLibrary();
  const searchParams = useLocalSearchParams<{ initialSource?: string }>();
  const [sourceTab, setSourceTab] = useState<SourceTab>('all');
  const lastAppliedSource = useRef<string | undefined>(undefined);

  useEffect(() => {
    const incoming = searchParams.initialSource;
    const allowedTabs: SourceTab[] = ['all', 'torrent', 'web', 'usenet'];
    if (incoming && allowedTabs.includes(incoming as SourceTab) && incoming !== lastAppliedSource.current) {
      lastAppliedSource.current = incoming;
      setSourceTab(incoming as SourceTab);
    }
  }, [searchParams.initialSource]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>('all');
  const [sizeFilter, setSizeFilter] = useState<SizeFilter>('all');
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('all');
  const [fileCountFilter, setFileCountFilter] = useState<FileCountFilter>('all');
  const [dateSort, setDateSort] = useState<DateSort>('newest');
  const [showStatusFilters, setShowStatusFilters] = useState<boolean>(false);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionItem, setActionItem] = useState<DownloadItem | null>(null);
  const [generatingLink, setGeneratingLink] = useState<boolean>(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState<boolean>(false);
  const [bulkLinks, setBulkLinks] = useState<Map<string, string>>(new Map());
  const [showBulkLinksModal, setShowBulkLinksModal] = useState<boolean>(false);
  const downloadsListRef = useRef<FlatList<DownloadItem>>(null);

  useScrollToTop(downloadsListRef);

  const categoryByDownload = useMemo(() => {
    const categoryCounts = new Map<string, Map<MediaCategory, number>>();

    for (const item of libraryItems) {
      const key = `${item.source}-${item.sourceId}`;
      const bucket = categoryCounts.get(key) ?? new Map<MediaCategory, number>();
      bucket.set(item.category, (bucket.get(item.category) ?? 0) + 1);
      categoryCounts.set(key, bucket);
    }

    const categoryMap = new Map<string, MediaCategory>();
    for (const [key, counts] of categoryCounts.entries()) {
      const dominant = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'other';
      categoryMap.set(key, dominant);
    }

    return categoryMap;
  }, [libraryItems]);


  const fileTypeByDownload = useMemo(() => {
    const fileTypeCounts = new Map<string, Map<Exclude<FileTypeFilter, 'all'>, number>>();

    for (const item of libraryItems) {
      const key = `${item.source}-${item.sourceId}`;
      const bucket = fileTypeCounts.get(key) ?? new Map<Exclude<FileTypeFilter, 'all'>, number>();
      const fileType = getFileTypeFromExtension(item.extension);
      bucket.set(fileType, (bucket.get(fileType) ?? 0) + 1);
      fileTypeCounts.set(key, bucket);
    }

    const fileTypeMap = new Map<string, Exclude<FileTypeFilter, 'all'>>();
    for (const [key, counts] of fileTypeCounts.entries()) {
      const dominant = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'other';
      fileTypeMap.set(key, dominant);
    }

    return fileTypeMap;
  }, [libraryItems]);

  const allDownloads = useMemo((): DownloadItem[] => {
    const items: DownloadItem[] = [];

    for (const t of torrents) {
      items.push({
        id: t.id,
        name: t.name,
        size: t.size,
        progress: t.progress,
        downloadSpeed: t.download_speed,
        eta: t.eta,
        downloadFinished: t.download_finished,
        downloadState: t.download_state,
        createdAt: t.created_at,
        source: 'torrent',
        filesCount: t.files?.length ?? 0,
        mediaCategory: categoryByDownload.get(`torrent-${t.id}`) ?? 'other',
        fileType: fileTypeByDownload.get(`torrent-${t.id}`) ?? 'other',
      });
    }

    for (const u of usenet) {
      items.push({
        id: u.id,
        name: u.name,
        size: u.size,
        progress: u.progress,
        downloadSpeed: u.download_speed,
        eta: u.eta,
        downloadFinished: u.download_finished,
        downloadState: u.download_state,
        createdAt: u.created_at,
        source: 'usenet',
        filesCount: u.files?.length ?? 0,
        mediaCategory: categoryByDownload.get(`usenet-${u.id}`) ?? 'other',
        fileType: fileTypeByDownload.get(`usenet-${u.id}`) ?? 'other',
      });
    }

    for (const w of webDl) {
      const webId = w.webdownload_id ?? w.web_id ?? w.id;
      items.push({
        id: webId,
        name: w.name,
        size: w.size,
        progress: w.progress,
        downloadSpeed: w.download_speed,
        eta: w.eta,
        downloadFinished: w.download_finished,
        downloadState: w.download_state,
        createdAt: w.created_at,
        source: 'web',
        filesCount: w.files?.length ?? 0,
        mediaCategory: categoryByDownload.get(`web-${webId}`) ?? 'other',
        fileType: fileTypeByDownload.get(`web-${webId}`) ?? 'other',
      });
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  }, [torrents, usenet, webDl, categoryByDownload, fileTypeByDownload]);

  const matchesSizeFilter = useCallback((size: number, filter: SizeFilter) => {
    if (filter === 'all') return true;
    if (filter === 'small') return size < 500 * 1024 * 1024;
    if (filter === 'medium') return size >= 500 * 1024 * 1024 && size < 2 * 1024 * 1024 * 1024;
    return size >= 2 * 1024 * 1024 * 1024;
  }, []);

  const matchesAgeFilter = useCallback((createdAt: string, filter: AgeFilter) => {
    if (filter === 'all') return true;

    const createdAtMs = new Date(createdAt).getTime();
    if (Number.isNaN(createdAtMs)) return false;

    const now = Date.now();
    const ageMs = now - createdAtMs;
    if (filter === '24h') return ageMs <= 24 * 60 * 60 * 1000;
    if (filter === '7d') return ageMs <= 7 * 24 * 60 * 60 * 1000;
    if (filter === '30d') return ageMs <= 30 * 24 * 60 * 60 * 1000;
    return ageMs > 30 * 24 * 60 * 60 * 1000;
  }, []);

  const matchesFileCountFilter = useCallback((filesCount: number, filter: FileCountFilter) => {
    if (filter === 'all') return true;
    if (filter === 'single') return filesCount <= 1;
    if (filter === 'multi') return filesCount >= 2 && filesCount <= 10;
    return filesCount > 10;
  }, []);

  const filteredDownloads = useMemo(() => {
    let items = allDownloads;
    if (sourceTab !== 'all') {
      items = items.filter(d => d.source === sourceTab);
    }
    if (statusFilter !== 'all') {
      items = items.filter(d => {
        if (statusFilter === 'completed') return d.downloadFinished;
        return normalizeDownloadStatus(d.downloadState) === statusFilter;
      });
    }
    if (mediaFilter !== 'all') {
      items = items.filter(d => d.mediaCategory === mediaFilter);
    }
    if (fileTypeFilter !== 'all') {
      items = items.filter(d => d.fileType === fileTypeFilter);
    }
    if (sizeFilter !== 'all') {
      items = items.filter(d => matchesSizeFilter(d.size, sizeFilter));
    }
    if (ageFilter !== 'all') {
      items = items.filter(d => matchesAgeFilter(d.createdAt, ageFilter));
    }
    if (fileCountFilter !== 'all') {
      items = items.filter(d => matchesFileCountFilter(d.filesCount, fileCountFilter));
    }
    items = [...items].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return dateSort === 'newest' ? bTime - aTime : aTime - bTime;
    });
    return items;
  }, [allDownloads, sourceTab, statusFilter, mediaFilter, fileTypeFilter, sizeFilter, ageFilter, fileCountFilter, dateSort, matchesSizeFilter, matchesAgeFilter, matchesFileCountFilter]);

  const statusCounts = useMemo(() => {
    const base = sourceTab === 'all' ? allDownloads : allDownloads.filter(d => d.source === sourceTab);
    const counts: Record<StatusFilter, number> = {
      all: base.length,
      downloading: 0,
      completed: 0,
      stalled: 0,
      paused: 0,
      failed: 0,
      queued: 0,
    };
    for (const d of base) {
      if (d.downloadFinished) {
        counts.completed++;
      } else {
        const norm = normalizeDownloadStatus(d.downloadState);
        counts[norm]++;
      }
    }
    return counts;
  }, [allDownloads, sourceTab]);

  const mediaCounts = useMemo(() => {
    const base = sourceTab === 'all' ? allDownloads : allDownloads.filter(d => d.source === sourceTab);
    const counts: Record<MediaFilter, number> = {
      all: base.length,
      audiobook: 0,
      ebook: 0,
      video: 0,
      music: 0,
      games: 0,
      other: 0,
    };
    for (const d of base) {
      counts[d.mediaCategory]++;
    }
    return counts;
  }, [allDownloads, sourceTab]);

  const sizeCounts = useMemo(() => {
    const base = sourceTab === 'all' ? allDownloads : allDownloads.filter(d => d.source === sourceTab);
    return {
      all: base.length,
      small: base.filter(item => matchesSizeFilter(item.size, 'small')).length,
      medium: base.filter(item => matchesSizeFilter(item.size, 'medium')).length,
      large: base.filter(item => matchesSizeFilter(item.size, 'large')).length,
    };
  }, [allDownloads, sourceTab, matchesSizeFilter]);


  const fileTypeCounts = useMemo(() => {
    const base = sourceTab === 'all' ? allDownloads : allDownloads.filter(d => d.source === sourceTab);
    return {
      all: base.length,
      video: base.filter(item => item.fileType === 'video').length,
      audio: base.filter(item => item.fileType === 'audio').length,
      books: base.filter(item => item.fileType === 'books').length,
      archives: base.filter(item => item.fileType === 'archives').length,
      images: base.filter(item => item.fileType === 'images').length,
      other: base.filter(item => item.fileType === 'other').length,
    };
  }, [allDownloads, sourceTab]);

  const ageCounts = useMemo(() => {
    const base = sourceTab === 'all' ? allDownloads : allDownloads.filter(d => d.source === sourceTab);
    return {
      all: base.length,
      '24h': base.filter(item => matchesAgeFilter(item.createdAt, '24h')).length,
      '7d': base.filter(item => matchesAgeFilter(item.createdAt, '7d')).length,
      '30d': base.filter(item => matchesAgeFilter(item.createdAt, '30d')).length,
      older: base.filter(item => matchesAgeFilter(item.createdAt, 'older')).length,
    };
  }, [allDownloads, sourceTab, matchesAgeFilter]);

  const fileCountCounts = useMemo(() => {
    const base = sourceTab === 'all' ? allDownloads : allDownloads.filter(d => d.source === sourceTab);
    return {
      all: base.length,
      single: base.filter(item => matchesFileCountFilter(item.filesCount, 'single')).length,
      multi: base.filter(item => matchesFileCountFilter(item.filesCount, 'multi')).length,
      bulk: base.filter(item => matchesFileCountFilter(item.filesCount, 'bulk')).length,
    };
  }, [allDownloads, sourceTab, matchesFileCountFilter]);

  const sourceCounts = useMemo(() => ({
    all: allDownloads.length,
    torrent: torrents.length,
    usenet: usenet.length,
    web: webDl.length,
  }), [allDownloads, torrents, usenet, webDl]);

  const sourceSummaries = useMemo(() => {
    const bySource: Record<SourceTab, DownloadItem[]> = {
      all: allDownloads,
      torrent: allDownloads.filter(item => item.source === 'torrent'),
      usenet: allDownloads.filter(item => item.source === 'usenet'),
      web: allDownloads.filter(item => item.source === 'web'),
    };

    const summary = {} as Record<SourceTab, { active: number; completed: number }>;
    (Object.keys(bySource) as SourceTab[]).forEach((key) => {
      const sourceItems = bySource[key];
      const completed = sourceItems.filter(item => item.downloadFinished).length;
      summary[key] = {
        completed,
        active: sourceItems.length - completed,
      };
    });

    return summary;
  }, [allDownloads]);

  const getSourceMetaLabel = useCallback((tab: SourceTab) => {
    const activeCount = sourceSummaries[tab].active;
    if (activeCount > 0) {
      return `${activeCount} active`;
    }

    const fileLabel = sourceCounts[tab] === 1 ? 'file' : 'files';
    return `${sourceCounts[tab]} ${fileLabel}`;
  }, [sourceSummaries, sourceCounts]);

  const getFilesForDownload = useCallback((item: DownloadItem): LibraryItem[] => {
    return libraryItems.filter(
      li => li.source === item.source && li.sourceId === item.id
    );
  }, [libraryItems]);

  const itemKey = useCallback((item: DownloadItem) => `${item.source}-${item.id}`, []);

  const handleDelete = useCallback((item: DownloadItem) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteItem({ source: item.source, sourceId: item.id });
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Delete failed';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  }, [deleteItem]);

  const toggleSelect = useCallback((key: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredDownloads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDownloads.map(d => itemKey(d))));
    }
  }, [selectedIds.size, filteredDownloads, itemKey]);

  const handleBulkGenerateLinks = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const items = filteredDownloads.filter(d => selectedIds.has(itemKey(d)));
    setBulkGenerating(true);
    const newLinks = new Map<string, string>();
    let successCount = 0;
    let failCount = 0;

    for (const item of items) {
      try {
        const files = getFilesForDownload(item);
        if (files.length === 0) {
          failCount++;
          continue;
        }
        const primaryFile = selectPrimaryDownloadFile(files, item.name);
        if (!primaryFile) {
          failCount++;
          continue;
        }
        const url = await torboxApi.getDownloadArchiveLink(primaryFile.source, primaryFile.sourceId, primaryFile.fileId);
        newLinks.set(itemKey(item), url);
        successCount++;
        console.log('[Downloads] Generated link for', item.name);
      } catch (err) {
        failCount++;
        console.error('[Downloads] Failed to generate link for', item.name, err);
      }
    }

    setBulkLinks(newLinks);
    setBulkGenerating(false);
    setShowBulkLinksModal(true);

    if (failCount > 0) {
      Alert.alert('Links Generated', `${successCount} succeeded, ${failCount} failed.`);
    }
  }, [selectedIds, filteredDownloads, itemKey, getFilesForDownload]);

  const handleCopyAllLinks = useCallback(async () => {
    const allLinks = Array.from(bulkLinks.values()).join('\n');
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(allLinks);
        Alert.alert('Copied', `${bulkLinks.size} links copied to clipboard`);
      } catch {
        Alert.alert('Links', allLinks);
      }
    } else {
      await Share.share({
        message: allLinks,
        title: `${bulkLinks.size} Download Links`,
      });
    }
  }, [bulkLinks]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      'Delete Selected',
      `Delete ${selectedIds.size} item${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            const items = filteredDownloads.filter(d => selectedIds.has(itemKey(d)));
            for (const item of items) {
              try {
                await deleteItem({ source: item.source, sourceId: item.id });
                console.log('[Downloads] Deleted:', item.name);
              } catch (err) {
                console.error('[Downloads] Failed to delete:', item.name, err);
              }
            }
            setSelectedIds(new Set());
            setIsSelecting(false);
          },
        },
      ]
    );
  }, [selectedIds, filteredDownloads, deleteItem, itemKey]);

  const exitSelectMode = useCallback(() => {
    setIsSelecting(false);
    setSelectedIds(new Set());
  }, []);

  const enterSelectMode = useCallback(() => {
    setIsSelecting(true);
  }, []);

  const handleItemPress = useCallback((item: DownloadItem) => {
    router.push({
      pathname: '/(tabs)/download-detail' as any,
      params: {
        source: item.source,
        sourceId: String(item.id),
        name: item.name,
        size: String(item.size),
        filesCount: String(item.filesCount),
        downloadState: item.downloadState,
        downloadFinished: String(item.downloadFinished),
        createdAt: item.createdAt,
        returnTo: 'downloads',
        initialSource: item.source,
      },
    });
  }, [router]);

  const closeActionModal = useCallback(() => {
    setActionItem(null);
    setGeneratedLink(null);
  }, []);

  const handleGenerateLink = useCallback(async () => {
    if (!actionItem) return;
    setGeneratingLink(true);
    try {
      const files = getFilesForDownload(actionItem);
      if (files.length === 0) {
        Alert.alert('No Files', 'No files found for this download.');
        setGeneratingLink(false);
        return;
      }
      const primaryFile = selectPrimaryDownloadFile(files, actionItem.name);
      if (!primaryFile) {
        Alert.alert('No Files', 'No files found for this download.');
        setGeneratingLink(false);
        return;
      }
      const url = await torboxApi.getDownloadArchiveLink(primaryFile.source, primaryFile.sourceId, primaryFile.fileId);
      setGeneratedLink(url);
      console.log('[Downloads] Generated link for', actionItem.name);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to generate link');
    } finally {
      setGeneratingLink(false);
    }
  }, [actionItem, getFilesForDownload]);

  const handleOpenLink = useCallback(async () => {
    if (!generatedLink) {
      Alert.alert('Generate Link First', 'Please tap "Generate Link" before opening.');
      return;
    }
    if (Platform.OS === 'web') {
      window.open(generatedLink, '_blank');
    } else {
      await Linking.openURL(generatedLink);
    }
  }, [generatedLink]);

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
        title: `Download: ${actionItem?.name ?? ''}`,
      });
    }
  }, [generatedLink, actionItem]);

  const handleShareLink = useCallback(async () => {
    if (!actionItem) return;
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
        title: `Download: ${actionItem.name}`,
      });
    }
  }, [actionItem, generatedLink]);

  const handleViewFiles = useCallback(() => {
    if (!actionItem) return;
    const files = getFilesForDownload(actionItem);
    if (files.length > 0) {
      const first = files[0];
      router.push({
        pathname: '/item/[id]' as any,
        params: {
          id: first.id,
          sourceId: String(first.sourceId),
          fileId: String(first.fileId),
          source: first.source,
          fileName: first.fileName,
          parentName: first.parentName,
          fileSize: String(first.fileSize),
          category: first.category,
          extension: first.extension,
          returnTo: 'downloads',
          initialSource: actionItem.source,
        },
      });
      closeActionModal();
    } else {
      Alert.alert('No Files', 'This download has no browseable files yet.');
    }
  }, [actionItem, getFilesForDownload, router, closeActionModal]);

  const renderActionModal = useCallback(() => {
    if (!actionItem) return null;
    const files = getFilesForDownload(actionItem);

    return (
      <Modal
        visible={!!actionItem}
        transparent
        animationType="slide"
        onRequestClose={closeActionModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeActionModal}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle} numberOfLines={2}>{actionItem.name}</Text>
            <View style={styles.modalMeta}>
              <View style={[styles.modalSourceBadge, { backgroundColor: getSourceColor(actionItem.source) + '20' }]}>
                <Text style={[styles.modalSourceText, { color: getSourceColor(actionItem.source) }]}>
                  {actionItem.source.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.modalMetaText}>{formatBytes(actionItem.size)}</Text>
              <Text style={styles.modalMetaText}>{actionItem.filesCount} files</Text>
            </View>

            {files.length > 0 && files.length <= 5 && (
              <View style={styles.modalFilesList}>
                {files.map(f => (
                  <TouchableOpacity
                    key={f.id}
                    style={styles.modalFileRow}
                    onPress={() => {
                      router.push({
                        pathname: '/item/[id]' as any,
                        params: {
                          id: f.id,
                          sourceId: String(f.sourceId),
                          fileId: String(f.fileId),
                          source: f.source,
                          fileName: f.fileName,
                          parentName: f.parentName,
                          fileSize: String(f.fileSize),
                          category: f.category,
                          extension: f.extension,
                          returnTo: 'downloads',
                          initialSource: actionItem.source,
                        },
                      });
                      closeActionModal();
                    }}
                  >
                    <FileText size={14} color={Colors.textSecondary} />
                    <Text style={styles.modalFileName} numberOfLines={1}>{f.fileName}</Text>
                    <Text style={styles.modalFileSize}>{formatBytes(f.fileSize)}</Text>
                    <ChevronRight size={14} color={Colors.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalActionBtn} onPress={handleViewFiles}>
                <FileText size={20} color={Colors.accent} />
                <Text style={styles.modalActionText}>View Files</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalActionBtn}
                onPress={handleGenerateLink}
                disabled={generatingLink}
              >
                {generatingLink ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Link size={20} color={Colors.primary} />
                )}
                <Text style={styles.modalActionText}>
                  {generatedLink ? 'Regenerate Link' : 'Generate Link'}
                </Text>
              </TouchableOpacity>

              {generatedLink && (
                <>
                  <TouchableOpacity style={styles.modalLinkPreview} onPress={handleCopyLink}>
                    <Copy size={14} color={Colors.textTertiary} />
                    <Text style={styles.modalLinkText} numberOfLines={1}>{generatedLink}</Text>
                    <Text style={styles.modalCopyHint}>Copy</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.modalActionBtn} onPress={handleOpenLink}>
                    <ExternalLink size={20} color={Colors.accent} />
                    <Text style={styles.modalActionText}>Open in Browser</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity style={styles.modalActionBtn} onPress={handleShareLink}>
                <Share2 size={20} color={Colors.secondary} />
                <Text style={styles.modalActionText}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalActionBtn, styles.modalDeleteBtn]}
                onPress={() => {
                  closeActionModal();
                  handleDelete(actionItem);
                }}
              >
                <Trash2 size={20} color={Colors.danger} />
                <Text style={[styles.modalActionText, { color: Colors.danger }]}>Delete</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.modalCancelBtn} onPress={closeActionModal}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  }, [actionItem, generatedLink, generatingLink, handleGenerateLink, handleOpenLink, handleCopyLink, handleShareLink, handleViewFiles, handleDelete, closeActionModal, getFilesForDownload, router]);

  const renderBulkLinksModal = useCallback(() => {
    if (!showBulkLinksModal) return null;
    const entries = Array.from(bulkLinks.entries());
    return (
      <Modal
        visible={showBulkLinksModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBulkLinksModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowBulkLinksModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{entries.length} Links Generated</Text>

            <FlatList
              data={entries}
              keyExtractor={([key]) => key}
              style={styles.bulkLinksList}
              renderItem={({ item: [key, url] }) => {
                const dl = filteredDownloads.find(d => itemKey(d) === key);
                return (
                  <View style={styles.bulkLinkItem}>
                    <Text style={styles.bulkLinkName} numberOfLines={1}>
                      {dl?.name ?? key}
                    </Text>
                    <TouchableOpacity
                      style={styles.bulkLinkCopyBtn}
                      onPress={async () => {
                        if (Platform.OS === 'web') {
                          try {
                            await navigator.clipboard.writeText(url);
                            Alert.alert('Copied', 'Link copied');
                          } catch {
                            Alert.alert('Link', url);
                          }
                        } else {
                          await Share.share({ message: url });
                        }
                      }}
                    >
                      <Copy size={14} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                );
              }}
            />

            <View style={styles.bulkLinksActions}>
              <TouchableOpacity style={styles.bulkCopyAllBtn} onPress={handleCopyAllLinks}>
                <Copy size={16} color="#fff" />
                <Text style={styles.bulkCopyAllText}>Copy All Links</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowBulkLinksModal(false)}
              >
                <Text style={styles.modalCancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  }, [showBulkLinksModal, bulkLinks, filteredDownloads, itemKey, handleCopyAllLinks]);

  const renderItem = useCallback(({ item }: { item: DownloadItem }) => {
    const key = itemKey(item);
    return (
      <SwipeableDownloadCard
        id={item.id}
        name={item.name}
        size={item.size}
        progress={item.progress}
        downloadSpeed={item.downloadSpeed}
        eta={item.eta}
        downloadFinished={item.downloadFinished}
        downloadState={item.downloadState}
        createdAt={item.createdAt}
        source={item.source}
        filesCount={item.filesCount}
        isSelected={selectedIds.has(key)}
        isSelecting={isSelecting}
        onDelete={() => handleDelete(item)}
        onToggleSelect={() => toggleSelect(key)}
        onPress={() => handleItemPress(item)}
      />
    );
  }, [handleDelete, isSelecting, selectedIds, toggleSelect, itemKey, handleItemPress]);

  const keyExtractor = useCallback((item: DownloadItem) => itemKey(item), [itemKey]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={downloadsListRef}
        data={filteredDownloads}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 12 }]}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Downloads</Text>
                <Text style={styles.subtitle}>{allDownloads.length} total</Text>
              </View>
              <View style={styles.headerActions}>
                {isSelecting ? (
                  <>
                    <TouchableOpacity
                      style={styles.selectAllBtn}
                      onPress={handleSelectAll}
                    >
                      <Text style={styles.selectAllText}>
                        {selectedIds.size === filteredDownloads.length ? 'Deselect All' : 'Select All'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelSelectBtn}
                      onPress={exitSelectMode}
                    >
                      <X size={20} color={Colors.text} />
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {allDownloads.length > 0 && (
                      <TouchableOpacity
                        style={styles.selectModeBtn}
                        onPress={enterSelectMode}
                        testID="select-mode-btn"
                      >
                        <CheckSquare size={18} color={Colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => router.push('/add-content' as any)}
                      testID="downloads-add-btn"
                    >
                      <Plus size={20} color={Colors.text} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            {isSelecting && selectedIds.size > 0 && (
              <View style={styles.bulkActionsRow}>
                <TouchableOpacity
                  style={styles.bulkLinkBar}
                  onPress={handleBulkGenerateLinks}
                  disabled={bulkGenerating}
                  testID="bulk-link-btn"
                >
                  {bulkGenerating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Link2 size={16} color="#fff" />
                  )}
                  <Text style={styles.bulkLinkText}>
                    {bulkGenerating ? 'Generating...' : `Links (${selectedIds.size})`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.bulkDeleteBar}
                  onPress={handleBulkDelete}
                  disabled={isDeleting}
                  testID="bulk-delete-btn"
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Trash2 size={16} color="#fff" />
                  )}
                  <Text style={styles.bulkDeleteText}>
                    Delete ({selectedIds.size})
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabScroll}
              contentContainerStyle={styles.tabRow}
            >
              {(['all', 'torrent', 'web', 'usenet'] as SourceTab[]).map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, sourceTab === tab && styles.tabActive]}
                  onPress={() => setSourceTab(tab)}
                >
                  <View style={styles.tabLabelWrap}>
                    <Text style={[styles.tabText, sourceTab === tab && styles.tabTextActive]}>
                      {tab === 'all' ? 'All' : tab === 'torrent' ? 'Torrents' : tab === 'web' ? 'Web Link' : 'Usenet'}
                    </Text>
                    <Text style={[styles.tabSubtext, sourceTab === tab && styles.tabSubtextActive]}>
                      {getSourceMetaLabel(tab)}
                    </Text>
                  </View>
                  <View style={[styles.tabBadge, sourceTab === tab && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, sourceTab === tab && styles.tabBadgeTextActive]}>
                      {sourceCounts[tab]}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.filterToggle}
              onPress={() => setShowStatusFilters(prev => !prev)}
              testID="filter-toggle-btn"
            >
              <Filter
                size={14}
                color={statusFilter !== 'all' || mediaFilter !== 'all' || fileTypeFilter !== 'all' || sizeFilter !== 'all' || ageFilter !== 'all' || fileCountFilter !== 'all' || dateSort !== 'newest' ? Colors.primary : Colors.textTertiary}
              />
              <Text
                style={[
                  styles.filterToggleText,
                  (statusFilter !== 'all' || mediaFilter !== 'all' || fileTypeFilter !== 'all' || sizeFilter !== 'all' || ageFilter !== 'all' || fileCountFilter !== 'all' || dateSort !== 'newest') && styles.filterToggleTextActive,
                ]}
              >
                {statusFilter === 'all' && mediaFilter === 'all' && fileTypeFilter === 'all' && sizeFilter === 'all' && ageFilter === 'all' && fileCountFilter === 'all' && dateSort === 'newest'
                  ? 'Filters'
                  : `Filters: ${statusFilter !== 'all' ? statusFilter : mediaFilter !== 'all' ? mediaFilter : fileTypeFilter !== 'all' ? fileTypeFilter : sizeFilter !== 'all' ? sizeFilter : ageFilter !== 'all' ? ageFilter : fileCountFilter !== 'all' ? fileCountFilter : dateSort}`}
              </Text>
              {(statusFilter !== 'all' || mediaFilter !== 'all' || fileTypeFilter !== 'all' || sizeFilter !== 'all' || ageFilter !== 'all' || fileCountFilter !== 'all' || dateSort !== 'newest') && (
                <TouchableOpacity
                  onPress={() => {
                    setStatusFilter('all');
                    setMediaFilter('all');
                    setFileTypeFilter('all');
                    setSizeFilter('all');
                    setAgeFilter('all');
                    setFileCountFilter('all');
                    setDateSort('newest');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={14} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {showStatusFilters && (
              <View style={styles.filterGroupWrap}>
                <Text style={styles.filterGroupLabel}>Status</Text>
                <View style={styles.statusRow}>
                  {(['all', 'downloading', 'completed', 'stalled', 'paused', 'failed', 'queued'] as StatusFilter[]).map(sf => {
                    const count = statusCounts[sf];
                    if (sf !== 'all' && count === 0) return null;
                    const colorMap: Record<StatusFilter, string> = {
                      all: Colors.textSecondary,
                      downloading: Colors.primary,
                      completed: Colors.statusComplete,
                      stalled: Colors.statusPaused,
                      paused: Colors.textTertiary,
                      failed: Colors.danger,
                      queued: Colors.accent,
                    };
                    const c = colorMap[sf];
                    return (
                      <TouchableOpacity
                        key={sf}
                        style={[styles.statusChip, statusFilter === sf && { backgroundColor: c + '20', borderColor: c }]}
                        onPress={() => setStatusFilter(sf)}
                      >
                        {sf !== 'all' && <View style={[styles.statusDot, { backgroundColor: c }]} />}
                        <Text style={[styles.statusChipText, statusFilter === sf && { color: c }]}>
                          {sf === 'all' ? 'All' : sf.charAt(0).toUpperCase() + sf.slice(1)}
                        </Text>
                        <Text style={[styles.statusChipCount, statusFilter === sf && { color: c }]}>{count}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.filterGroupLabel}>Type</Text>
                <View style={styles.statusRow}>
                  {(['all', 'audiobook', 'ebook', 'video', 'music', 'games', 'other'] as MediaFilter[]).map(mf => {
                    const count = mediaCounts[mf];
                    if (mf !== 'all' && count === 0) return null;
                    return (
                      <TouchableOpacity
                        key={mf}
                        style={[styles.statusChip, mediaFilter === mf && { backgroundColor: Colors.primary + '20', borderColor: Colors.primary }]}
                        onPress={() => setMediaFilter(mf)}
                      >
                        <Text style={[styles.statusChipText, mediaFilter === mf && { color: Colors.primary }]}>
                          {mf === 'all' ? 'All' : mf.charAt(0).toUpperCase() + mf.slice(1)}
                        </Text>
                        <Text style={[styles.statusChipCount, mediaFilter === mf && { color: Colors.primary }]}>{count}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.filterGroupLabel}>File Type</Text>
                <View style={styles.statusRow}>
                  {(['all', 'video', 'audio', 'books', 'archives', 'images', 'other'] as FileTypeFilter[]).map(fileType => {
                    const labels: Record<FileTypeFilter, string> = {
                      all: 'All',
                      video: 'Video',
                      audio: 'Audio',
                      books: 'Books',
                      archives: 'Archives',
                      images: 'Images',
                      other: 'Other',
                    };
                    const count = fileTypeCounts[fileType];
                    if (fileType !== 'all' && count === 0) return null;
                    return (
                      <TouchableOpacity
                        key={fileType}
                        style={[styles.statusChip, fileTypeFilter === fileType && { backgroundColor: Colors.primary + '20', borderColor: Colors.primary }]}
                        onPress={() => setFileTypeFilter(fileType)}
                      >
                        <Text style={[styles.statusChipText, fileTypeFilter === fileType && { color: Colors.primary }]}>{labels[fileType]}</Text>
                        <Text style={[styles.statusChipCount, fileTypeFilter === fileType && { color: Colors.primary }]}>{count}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.filterGroupLabel}>Size</Text>
                <View style={styles.statusRow}>
                  {(['all', 'small', 'medium', 'large'] as SizeFilter[]).map(sz => {
                    const labels: Record<SizeFilter, string> = {
                      all: 'All',
                      small: '< 500 MB',
                      medium: '500 MB - 2 GB',
                      large: '> 2 GB',
                    };
                    const count = sizeCounts[sz];
                    if (sz !== 'all' && count === 0) return null;
                    return (
                      <TouchableOpacity
                        key={sz}
                        style={[styles.statusChip, sizeFilter === sz && { backgroundColor: Colors.accent + '20', borderColor: Colors.accent }]}
                        onPress={() => setSizeFilter(sz)}
                      >
                        <Text style={[styles.statusChipText, sizeFilter === sz && { color: Colors.accent }]}>{labels[sz]}</Text>
                        <Text style={[styles.statusChipCount, sizeFilter === sz && { color: Colors.accent }]}>{count}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.filterGroupLabel}>Age</Text>
                <View style={styles.statusRow}>
                  {(['all', '24h', '7d', '30d', 'older'] as AgeFilter[]).map(age => {
                    const labels: Record<AgeFilter, string> = {
                      all: 'All',
                      '24h': 'Last 24h',
                      '7d': 'Last 7d',
                      '30d': 'Last 30d',
                      older: 'Older',
                    };
                    const count = ageCounts[age];
                    if (age !== 'all' && count === 0) return null;
                    return (
                      <TouchableOpacity
                        key={age}
                        style={[styles.statusChip, ageFilter === age && { backgroundColor: Colors.secondary + '20', borderColor: Colors.secondary }]}
                        onPress={() => setAgeFilter(age)}
                      >
                        <Text style={[styles.statusChipText, ageFilter === age && { color: Colors.secondary }]}>{labels[age]}</Text>
                        <Text style={[styles.statusChipCount, ageFilter === age && { color: Colors.secondary }]}>{count}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.filterGroupLabel}>Files per Download</Text>
                <View style={styles.statusRow}>
                  {(['all', 'single', 'multi', 'bulk'] as FileCountFilter[]).map(fileFilter => {
                    const labels: Record<FileCountFilter, string> = {
                      all: 'All',
                      single: 'Single File',
                      multi: '2-10 Files',
                      bulk: '11+ Files',
                    };
                    const count = fileCountCounts[fileFilter];
                    if (fileFilter !== 'all' && count === 0) return null;
                    return (
                      <TouchableOpacity
                        key={fileFilter}
                        style={[styles.statusChip, fileCountFilter === fileFilter && { backgroundColor: Colors.statusComplete + '20', borderColor: Colors.statusComplete }]}
                        onPress={() => setFileCountFilter(fileFilter)}
                      >
                        <Text style={[styles.statusChipText, fileCountFilter === fileFilter && { color: Colors.statusComplete }]}>{labels[fileFilter]}</Text>
                        <Text style={[styles.statusChipCount, fileCountFilter === fileFilter && { color: Colors.statusComplete }]}>{count}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.filterGroupLabel}>Date Added</Text>
                <View style={styles.statusRow}>
                  {(['newest', 'oldest'] as DateSort[]).map(sortOption => (
                    <TouchableOpacity
                      key={sortOption}
                      style={[styles.statusChip, dateSort === sortOption && { backgroundColor: Colors.secondary + '20', borderColor: Colors.secondary }]}
                      onPress={() => setDateSort(sortOption)}
                    >
                      <Text style={[styles.statusChipText, dateSort === sortOption && { color: Colors.secondary }]}>
                        {sortOption === 'newest' ? 'Newest First' : 'Oldest First'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {filteredDownloads.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No downloads</Text>
              </View>
            )}

            {!isSelecting && filteredDownloads.length > 0 && (
              <Text style={styles.swipeHint}>
                {Platform.OS === 'web' ? 'Tap for actions' : 'Tap for actions · Swipe left to delete'}
              </Text>
            )}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetchAll}
            tintColor={Colors.primary}
          />
        }
      />
      {renderActionModal()}
      {renderBulkLinksModal()}
    </View>
  );
}

function getFileTypeFromExtension(extension?: string | null): Exclude<FileTypeFilter, 'all'> {
  const ext = (extension ?? '').replace(/^\./, '').toLowerCase();
  if (!ext) return 'other';

  if (['mkv', 'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v'].includes(ext)) return 'video';
  if (['mp3', 'm4a', 'flac', 'wav', 'aac', 'ogg', 'opus'].includes(ext)) return 'audio';
  if (['epub', 'pdf', 'mobi', 'azw3', 'cbz', 'cbr'].includes(ext)) return 'books';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return 'archives';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return 'images';
  return 'other';
}

function getSourceColor(source: string): string {
  switch (source) {
    case 'torrent': return Colors.primary;
    case 'usenet': return Colors.secondary;
    case 'web': return Colors.accent;
    default: return Colors.textTertiary;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 3,
    fontWeight: '500' as const,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectModeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.primary + '20',
  },
  selectAllText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  cancelSelectBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bulkActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  bulkLinkBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  bulkLinkText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700' as const,
  },
  bulkDeleteBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.danger,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  bulkDeleteText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700' as const,
  },
  tabScroll: {
    marginTop: 16,
    marginBottom: 12,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 12,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  tabLabelWrap: {
    minWidth: 74,
  },
  tabActive: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  tabSubtext: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 0,
  },
  tabSubtextActive: {
    color: Colors.primary,
  },
  tabBadge: {
    backgroundColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tabBadgeActive: {
    backgroundColor: Colors.primary + '30',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
  },
  tabBadgeTextActive: {
    color: Colors.primary,
  },
  swipeHint: {
    color: Colors.textTertiary,
    fontSize: 11,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingBottom: 36,
    paddingTop: 14,
    maxHeight: '80%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderLight,
    alignSelf: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700' as const,
    lineHeight: 22,
    marginBottom: 8,
  },
  modalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  modalSourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  modalSourceText: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  modalMetaText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  modalFilesList: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  modalFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalFileName: {
    flex: 1,
    color: Colors.text,
    fontSize: 12,
  },
  modalFileSize: {
    color: Colors.textTertiary,
    fontSize: 11,
  },
  modalActions: {
    gap: 6,
  },
  modalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalActionText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  modalDeleteBtn: {
    borderColor: Colors.danger + '30',
    backgroundColor: Colors.danger + '08',
  },
  modalLinkPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalLinkText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 11,
  },
  modalCopyHint: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  modalCancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 4,
  },
  filterToggleText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
  },
  filterToggleTextActive: {
    color: Colors.primary,
  },
  filterGroupWrap: {
    marginBottom: 8,
  },
  filterGroupLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700' as const,
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  statusChipCount: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
  },
  bulkLinksList: {
    maxHeight: 300,
    marginBottom: 12,
  },
  bulkLinkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  bulkLinkName: {
    flex: 1,
    color: Colors.text,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  bulkLinkCopyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bulkLinksActions: {
    gap: 8,
  },
  bulkCopyAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  bulkCopyAllText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700' as const,
  },
});
