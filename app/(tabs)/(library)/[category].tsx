import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';

import Colors from '@/constants/colors';
import { CATEGORY_META } from '@/constants/categories';
import { useFilteredLibrary, useLibrary } from '@/hooks/useLibrary';
import { MediaCategory, LibraryItem, AudiobookGroup } from '@/types/torbox';
import SearchBar from '@/components/SearchBar';
import LibraryCard from '@/components/LibraryCard';
import AudiobookGroupCard from '@/components/AudiobookGroupCard';
import { formatBytes, truncateMiddle } from '@/utils/formatters';

type SortMode = 'name' | 'size' | 'date';

interface VideoGroup {
  id: string;
  sourceId: number;
  source: string;
  parentName: string;
  fileCount: number;
  totalSize: number;
  createdAt: string;
  representative: LibraryItem;
}

type GroupedDownload = VideoGroup;

export default function CategoryScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const { isFetching, refetchAll, audiobookGroups } = useLibrary();
  const router = useRouter();

  const [search, setSearch] = useState<string>('');
  const [sort, setSort] = useState<SortMode>('name');

  const cat = category as MediaCategory;
  const meta = CATEGORY_META[cat] ?? CATEGORY_META.other;
  const items = useFilteredLibrary(search, cat);
  const isAudiobookCategory = cat === 'audiobook';
  const isVideoCategory = cat === 'video';
  const isEbookCategory = cat === 'ebook';
  const isGroupedDownloadCategory = isVideoCategory || isEbookCategory;

  const filteredGroups = useMemo(() => {
    if (!isAudiobookCategory) return [];
    if (!search.trim()) return audiobookGroups;
    const q = search.toLowerCase().trim();
    return audiobookGroups.filter(g => g.name.toLowerCase().includes(q));
  }, [isAudiobookCategory, audiobookGroups, search]);

  const sortedGroups = useMemo(() => {
    const sorted = [...filteredGroups];
    switch (sort) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'size':
        sorted.sort((a, b) => b.totalSize - a.totalSize);
        break;
      case 'date':
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }
    return sorted;
  }, [filteredGroups, sort]);

  const sortedItems = useMemo(() => {
    if (isAudiobookCategory || isGroupedDownloadCategory) return [];
    const sorted = [...items];
    switch (sort) {
      case 'name':
        sorted.sort((a, b) => a.fileName.localeCompare(b.fileName));
        break;
      case 'size':
        sorted.sort((a, b) => b.fileSize - a.fileSize);
        break;
      case 'date':
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }
    return sorted;
  }, [items, sort, isAudiobookCategory, isGroupedDownloadCategory]);

  const groupedDownloadItems = useMemo(() => {
    if (!isGroupedDownloadCategory) return [];

    const grouped = new Map<string, GroupedDownload>();
    const query = search.trim().toLowerCase();

    for (const item of items) {
      const key = `${item.source}-${item.sourceId}`;
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          id: key,
          sourceId: item.sourceId,
          source: item.source,
          parentName: item.parentName,
          fileCount: 1,
          totalSize: item.fileSize,
          createdAt: item.createdAt,
          representative: item,
        });
        continue;
      }

      existing.fileCount += 1;
      existing.totalSize += item.fileSize;

      if (item.fileSize > existing.representative.fileSize) {
        existing.representative = item;
      }
    }

    let filtered = [...grouped.values()];
    if (query) {
      filtered = filtered.filter(group => {
        if (group.parentName.toLowerCase().includes(query)) return true;
        return items.some(
          item =>
            item.sourceId === group.sourceId
            && item.source === group.source
            && item.fileName.toLowerCase().includes(query)
        );
      });
    }

    switch (sort) {
      case 'name':
        filtered.sort((a, b) => a.parentName.localeCompare(b.parentName));
        break;
      case 'size':
        filtered.sort((a, b) => b.totalSize - a.totalSize);
        break;
      case 'date':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    return filtered;
  }, [isGroupedDownloadCategory, items, search, sort]);

  const renderGroupItem = useCallback(({ item }: { item: AudiobookGroup }) => (
    <AudiobookGroupCard group={item} />
  ), []);

  const renderItem = useCallback(({ item }: { item: LibraryItem }) => (
    <LibraryCard item={item} returnCategory={cat} />
  ), [cat]);

  const renderGroupedDownload = useCallback(({ item }: { item: GroupedDownload }) => (
    <TouchableOpacity
      style={styles.videoGroupCard}
      activeOpacity={0.7}
      onPress={() => {
        router.push({
          pathname: '/item/[id]' as any,
          params: {
            id: item.representative.id,
            sourceId: String(item.representative.sourceId),
            fileId: String(item.representative.fileId),
            source: item.representative.source,
            fileName: item.parentName,
            parentName: item.parentName,
            fileSize: String(item.totalSize),
            category: item.representative.category,
            extension: item.representative.extension,
            returnTo: 'library',
            returnCategory: cat,
          },
        });
      }}
    >
      <Text style={styles.videoGroupName} numberOfLines={1}>{truncateMiddle(item.parentName, 52)}</Text>
      <View style={styles.videoGroupMeta}>
        <Text style={styles.videoGroupMetaText}>
          {item.fileCount} {item.fileCount === 1 ? 'file' : 'files'}
        </Text>
        <Text style={styles.videoGroupMetaDot}>•</Text>
        <Text style={styles.videoGroupMetaText}>{formatBytes(item.totalSize)}</Text>
      </View>
    </TouchableOpacity>
  ), [router, cat]);

  const groupedItemCount = useMemo(() => {
    if (isAudiobookCategory) return sortedGroups.length;
    if (isGroupedDownloadCategory) return groupedDownloadItems.length;
    return new Set(items.map(item => `${item.source}-${item.sourceId}`)).size;
  }, [isAudiobookCategory, isGroupedDownloadCategory, sortedGroups.length, groupedDownloadItems.length, items]);

  const displayCount = groupedItemCount;
  const itemLabel = isAudiobookCategory
    ? (groupedItemCount === 1 ? 'audiobook' : 'audiobooks')
    : isGroupedDownloadCategory
      ? (groupedItemCount === 1 ? 'collection' : 'collections')
    : (groupedItemCount === 1 ? 'download' : 'downloads');

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: meta.label, headerBackTitle: 'Library' }} />

      {isAudiobookCategory ? (
        <FlatList
          data={sortedGroups}
          renderItem={renderGroupItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              <View style={styles.header}>
                <View>
                  <Text style={[styles.title, { color: meta.color }]}>{meta.label}</Text>
                  <Text style={styles.count}>{displayCount} {itemLabel}</Text>
                </View>
              </View>

              <SearchBar
                value={search}
                onChangeText={setSearch}
                placeholder={`Search ${meta.label.toLowerCase()}...`}
              />

              <View style={styles.sortRow}>
                {(['name', 'size', 'date'] as SortMode[]).map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.sortBtn, sort === s && styles.sortBtnActive]}
                    onPress={() => setSort(s)}
                  >
                    <Text style={[styles.sortText, sort === s && styles.sortTextActive]}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {sortedGroups.length === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>
                    {search ? `No results for "${search}"` : 'No audiobooks in your library'}
                  </Text>
                </View>
              )}
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={refetchAll}
              tintColor={Colors.primary}
            />
          }
        />
      ) : isGroupedDownloadCategory ? (
        <FlatList
          data={groupedDownloadItems}
          renderItem={renderGroupedDownload}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              <View style={styles.header}>
                <View>
                  <Text style={[styles.title, { color: meta.color }]}>{meta.label}</Text>
                  <Text style={styles.count}>{displayCount} {itemLabel}</Text>
                </View>
              </View>

              <SearchBar
                value={search}
                onChangeText={setSearch}
                placeholder={`Search ${meta.label.toLowerCase()}...`}
              />

              <View style={styles.sortRow}>
                {(['name', 'size', 'date'] as SortMode[]).map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.sortBtn, sort === s && styles.sortBtnActive]}
                    onPress={() => setSort(s)}
                  >
                    <Text style={[styles.sortText, sort === s && styles.sortTextActive]}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {groupedDownloadItems.length === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>
                    {search ? `No results for "${search}"` : `No ${isEbookCategory ? 'ebook' : 'video'} collections in your library`}
                  </Text>
                </View>
              )}
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={refetchAll}
              tintColor={Colors.primary}
            />
          }
        />
      ) : (
        <FlatList
          data={sortedItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              <View style={styles.header}>
                <View>
                  <Text style={[styles.title, { color: meta.color }]}>{meta.label}</Text>
                  <Text style={styles.count}>{displayCount} {itemLabel}</Text>
                </View>
              </View>

              <SearchBar
                value={search}
                onChangeText={setSearch}
                placeholder={`Search ${meta.label.toLowerCase()}...`}
              />

              <View style={styles.sortRow}>
                {(['name', 'size', 'date'] as SortMode[]).map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.sortBtn, sort === s && styles.sortBtnActive]}
                    onPress={() => setSort(s)}
                  >
                    <Text style={[styles.sortText, sort === s && styles.sortTextActive]}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {sortedItems.length === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>
                    {search ? `No results for "${search}"` : 'No items in this category'}
                  </Text>
                </View>
              )}
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={refetchAll}
              tintColor={Colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  count: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 16,
  },
  sortBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortBtnActive: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
  },
  sortText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  sortTextActive: {
    color: Colors.primary,
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: 14,
  },
  videoGroupCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  videoGroupName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  videoGroupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  videoGroupMetaText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  videoGroupMetaDot: {
    color: Colors.textTertiary,
    fontSize: 12,
  },
});
