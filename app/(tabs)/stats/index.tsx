import React, { useMemo, useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useScrollToTop } from '@react-navigation/native';
import {
  Database,
  HardDrive,
  CheckCircle,
  Zap,
  AlertTriangle,
  Download,
  Globe,
  Newspaper,
  ChevronRight,
  ChevronDown,
  Layers,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { CATEGORY_META } from '@/constants/categories';
import { useLibrary } from '@/hooks/useLibrary';
import { MediaCategory, DownloadSource } from '@/types/torbox';
import { formatBytes, formatTimeAgo } from '@/utils/formatters';

const CATEGORIES: MediaCategory[] = ['audiobook', 'music', 'video', 'ebook', 'games', 'other'];
const INITIAL_RECENT_ITEMS = 5;
const RECENT_ITEMS_PAGE_SIZE = 25;

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { stats, isFetching, refetchAll, isLoading, activeDownloads, libraryItems } = useLibrary();
  const [visibleRecentCount, setVisibleRecentCount] = useState<number>(INITIAL_RECENT_ITEMS);
  const statsScrollRef = useRef<ScrollView>(null);

  useScrollToTop(statsScrollRef);

  const categoryStats = useMemo(() => {
    return CATEGORIES
      .filter(c => (stats.downloadsByCategory[c] ?? 0) > 0)
      .map(c => ({
        category: c,
        count: stats.downloadsByCategory[c] ?? 0,
        bytes: stats.bytesByCategory[c] ?? 0,
        meta: CATEGORY_META[c],
      }));
  }, [stats]);

  const handleCategoryPress = useCallback((category: MediaCategory) => {
    router.push({
      pathname: '/(tabs)/(library)/[category]' as any,
      params: { category },
    });
  }, [router]);

  const handleSourcePress = useCallback((source: DownloadSource) => {
    router.push({
      pathname: '/(tabs)/downloads' as any,
      params: { initialSource: source },
    });
  }, [router]);

  const handleActivePress = useCallback(() => {
    router.push('/(tabs)/downloads' as any);
  }, [router]);

  const recentItems = useMemo(() => {
    return [...libraryItems]
      .sort((a, b) => {
        const bTime = Date.parse(b.createdAt) || 0;
        const aTime = Date.parse(a.createdAt) || 0;
        return bTime - aTime;
      })
      .map(item => ({
        ...item,
        createdAtMs: Date.parse(item.createdAt) || 0,
      }));
  }, [libraryItems]);

  const displayedRecent = useMemo(() => {
    return recentItems.slice(0, visibleRecentCount);
  }, [recentItems, visibleRecentCount]);

  const hasMoreRecent = visibleRecentCount < recentItems.length;
  const nextRecentCount = Math.min(visibleRecentCount + RECENT_ITEMS_PAGE_SIZE, recentItems.length);
  const remainingRecentCount = Math.max(recentItems.length - visibleRecentCount, 0);

  const handleRecentPress = useCallback((item: typeof recentItems[number]) => {
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
        returnCategory: item.category,
      },
    });
  }, [router]);

  return (
    <ScrollView
      ref={statsScrollRef}
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      refreshControl={
        <RefreshControl
          refreshing={isFetching && !isLoading}
          onRefresh={refetchAll}
          tintColor={Colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Stats</Text>
        <Text style={styles.subtitle}>Overview of your TorBox content</Text>
      </View>

      <View style={styles.grid}>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => router.push('/(tabs)/(library)' as any)}
          activeOpacity={0.7}
        >
          <View style={[styles.statIcon, { backgroundColor: Colors.primary + '20' }]}>
            <Database size={18} color={Colors.primary} />
          </View>
          <Text style={[styles.statValue, { color: Colors.primary }]}>{stats.totalItems}</Text>
          <Text style={styles.statLabel}>Total Items</Text>
          <ChevronRight size={14} color={Colors.textTertiary} style={styles.chevron} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statCard}
          onPress={() => router.push('/(tabs)/(library)' as any)}
          activeOpacity={0.7}
        >
          <View style={[styles.statIcon, { backgroundColor: Colors.accent + '20' }]}>
            <HardDrive size={18} color={Colors.accent} />
          </View>
          <Text style={[styles.statValue, { color: Colors.accent }]}>{formatBytes(stats.totalBytes)}</Text>
          <Text style={styles.statLabel}>Total Size</Text>
          <ChevronRight size={14} color={Colors.textTertiary} style={styles.chevron} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statCard}
          onPress={() => router.push('/(tabs)/downloads' as any)}
          activeOpacity={0.7}
        >
          <View style={[styles.statIcon, { backgroundColor: Colors.statusComplete + '20' }]}>
            <CheckCircle size={18} color={Colors.statusComplete} />
          </View>
          <Text style={[styles.statValue, { color: Colors.statusComplete }]}>{stats.completedCount}</Text>
          <Text style={styles.statLabel}>Completed</Text>
          <ChevronRight size={14} color={Colors.textTertiary} style={styles.chevron} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statCard}
          onPress={handleActivePress}
          activeOpacity={0.7}
        >
          <View style={[styles.statIcon, { backgroundColor: Colors.statusActive + '20' }]}>
            <Zap size={18} color={Colors.statusActive} />
          </View>
          <Text style={[styles.statValue, { color: Colors.statusActive }]}>{activeDownloads.length}</Text>
          <Text style={styles.statLabel}>Active</Text>
          <ChevronRight size={14} color={Colors.textTertiary} style={styles.chevron} />
        </TouchableOpacity>

        {stats.errorCount > 0 && (
          <TouchableOpacity
            style={styles.statCard}
            onPress={handleActivePress}
            activeOpacity={0.7}
          >
            <View style={[styles.statIcon, { backgroundColor: Colors.danger + '20' }]}>
              <AlertTriangle size={18} color={Colors.danger} />
            </View>
            <Text style={[styles.statValue, { color: Colors.danger }]}>{stats.errorCount}</Text>
            <Text style={styles.statLabel}>Errors</Text>
            <ChevronRight size={14} color={Colors.textTertiary} style={styles.chevron} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sectionTitle}>By Source</Text>
      <View style={styles.sourceRow}>
        <TouchableOpacity
          style={styles.sourceCard}
          onPress={() => handleSourcePress('torrent')}
          activeOpacity={0.7}
        >
          <Download size={18} color={Colors.primary} />
          <Text style={styles.sourceValue}>{stats.itemsBySource.torrent ?? 0}</Text>
          <Text style={styles.sourceLabel}>Torrents</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sourceCard}
          onPress={() => handleSourcePress('usenet')}
          activeOpacity={0.7}
        >
          <Newspaper size={18} color={Colors.secondary} />
          <Text style={styles.sourceValue}>{stats.itemsBySource.usenet ?? 0}</Text>
          <Text style={styles.sourceLabel}>Usenet</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sourceCard}
          onPress={() => handleSourcePress('web')}
          activeOpacity={0.7}
        >
          <Globe size={18} color={Colors.accent} />
          <Text style={styles.sourceValue}>{stats.itemsBySource.web ?? 0}</Text>
          <Text style={styles.sourceLabel}>Web</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>By Category</Text>
      {categoryStats.map(cs => (
        <TouchableOpacity
          key={cs.category}
          style={styles.categoryRow}
          onPress={() => handleCategoryPress(cs.category)}
          activeOpacity={0.7}
        >
          <View style={[styles.categoryDot, { backgroundColor: cs.meta.color }]} />
          <Text style={styles.categoryLabel}>{cs.meta.label}</Text>
          <View style={styles.categoryBar}>
            <View
              style={[
                styles.categoryBarFill,
                {
                  backgroundColor: cs.meta.color,
                  width: `${stats.totalItems > 0 ? (cs.count / stats.totalItems) * 100 : 0}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.categoryCount}>{cs.count}</Text>
          <Text style={styles.categorySize}>{formatBytes(cs.bytes)}</Text>
          <ChevronRight size={14} color={Colors.textTertiary} />
        </TouchableOpacity>
      ))}

      {recentItems.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {displayedRecent.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.recentItem}
              onPress={() => handleRecentPress(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.recentDot, { backgroundColor: CATEGORY_META[item.category].color }]} />
              <View style={styles.recentInfo}>
                <Text style={styles.recentName} numberOfLines={1}>{item.fileName}</Text>
                <View style={styles.recentMetaRow}>
                  <Text style={styles.recentMeta}>
                    {CATEGORY_META[item.category].label} · {formatBytes(item.fileSize)}
                  </Text>
                  <View style={styles.fileCountBadge}>
                    <Layers size={10} color={Colors.textTertiary} />
                    <Text style={styles.fileCountText}>
                      {item.createdAtMs > 0 ? formatTimeAgo(item.createdAt) : 'Unknown date'}
                    </Text>
                  </View>
                </View>
              </View>
              <ChevronRight size={14} color={Colors.textTertiary} />
            </TouchableOpacity>
          ))}
          {recentItems.length > INITIAL_RECENT_ITEMS && (
            <>
              {hasMoreRecent && (
                <TouchableOpacity
                  style={styles.seeMoreBtn}
                  onPress={() => setVisibleRecentCount(nextRecentCount)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.seeMoreText}>
                    Show {Math.min(RECENT_ITEMS_PAGE_SIZE, remainingRecentCount)} More ({remainingRecentCount} remaining)
                  </Text>
                  <ChevronDown size={14} color={Colors.primary} />
                </TouchableOpacity>
              )}
              {visibleRecentCount > INITIAL_RECENT_ITEMS && (
                <TouchableOpacity
                  style={styles.seeMoreBtn}
                  onPress={() => setVisibleRecentCount(INITIAL_RECENT_ITEMS)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.seeMoreText}>Show Less</Text>
                  <ChevronDown
                    size={14}
                    color={Colors.primary}
                    style={{ transform: [{ rotate: '180deg' }] }}
                  />
                </TouchableOpacity>
              )}
            </>
          )}
        </>
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
  header: {
    paddingTop: 12,
    paddingBottom: 18,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '48%' as any,
    marginBottom: 12,
    position: 'relative' as const,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    marginBottom: 2,
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  chevron: {
    position: 'absolute' as const,
    top: 16,
    right: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.3,
    marginTop: 24,
    marginBottom: 14,
  },
  sourceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sourceCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sourceValue: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  sourceLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500' as const,
    width: 90,
  },
  categoryBar: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.surface,
    borderRadius: 4,
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: 8,
    borderRadius: 4,
    minWidth: 4,
  },
  categoryCount: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600' as const,
    width: 32,
    textAlign: 'right' as const,
  },
  categorySize: {
    color: Colors.textTertiary,
    fontSize: 11,
    width: 54,
    textAlign: 'right' as const,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  recentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recentInfo: {
    flex: 1,
  },
  recentName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  recentMeta: {
    color: Colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
  },
  recentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  fileCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fileCountText: {
    color: Colors.textTertiary,
    fontSize: 10,
    fontWeight: '600' as const,
  },
  seeMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginTop: 4,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  seeMoreText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
});
