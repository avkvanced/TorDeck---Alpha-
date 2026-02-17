import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bell, Plus, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { DISPLAY_CATEGORIES } from '@/constants/categories';

import { useLibrary, useFilteredLibrary } from '@/hooks/useLibrary';
import { useNotifications } from '@/hooks/useNotifications';
import { MediaCategory, LibraryItem, ActiveDownload } from '@/types/torbox';
import SearchBar from '@/components/SearchBar';
import CategoryCard from '@/components/CategoryCard';
import LibraryCard from '@/components/LibraryCard';
import ExpandableDownloadSection from '@/components/ExpandableDownloadSection';

const QUICK_ADD_TYPES: { type: 'magnet' | 'hash' | 'web' | 'nzb'; label: string }[] = [
  { type: 'magnet', label: 'Magnet' },
  { type: 'hash', label: 'Info Hash' },
  { type: 'web', label: 'Web URL' },
  { type: 'nzb', label: 'NZB' },
];

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLoading, isFetching, refetchAll, stats, activeDownloads, deleteItem } = useLibrary();
  const {
    notifications,
    refetch: refetchNotifications,
    clearNotifications,
    dismissNotification,
  } = useNotifications();
  const [search, setSearch] = useState<string>('');
  const [viewMode, setViewMode] = useState<'categories' | 'all'>('categories');
  const [showNotifications, setShowNotifications] = useState<boolean>(false);

  const filteredItems = useFilteredLibrary(search);

  const isSearching = search.trim().length > 0;

  const handleCategoryPress = useCallback((category: MediaCategory) => {
    router.push({
      pathname: '/(tabs)/(library)/[category]' as any,
      params: { category },
    });
  }, [router]);

  const handleAddContent = useCallback(() => {
    router.push('/add-content' as any);
  }, [router]);

  const handleQuickAddContent = useCallback((type: 'magnet' | 'hash' | 'web' | 'nzb') => {
    router.push({
      pathname: '/add-content' as any,
      params: { type },
    });
  }, [router]);

  const handleViewAllDownloads = useCallback(() => {
    router.push('/(tabs)/downloads' as any);
  }, [router]);

  const handleOpenNotifications = useCallback(() => {
    if (notifications.length === 0) {
      Alert.alert('Notifications', 'No notifications yet.');
      return;
    }
    setShowNotifications(true);
  }, [notifications]);

  const handleDismissNotification = useCallback(async (id: string) => {
    try {
      await dismissNotification(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to dismiss notification';
      Alert.alert('Error', message);
    }
  }, [dismissNotification]);

  const handleClearNotifications = useCallback(async () => {
    try {
      await clearNotifications();
      setShowNotifications(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clear notifications';
      Alert.alert('Error', message);
    }
  }, [clearNotifications]);

  const handleCancelDownload = useCallback((item: ActiveDownload) => {
    Alert.alert(
      'Cancel Download',
      `Stop and remove "${item.name}" from downloads?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Download',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteItem({ source: item.source, sourceId: item.id });
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to cancel download';
              Alert.alert('Error', message);
            }
          },
        },
      ]
    );
  }, [deleteItem]);

  const activeCategories = useMemo(() => {
    return DISPLAY_CATEGORIES.filter(c => (stats.downloadsByCategory[c] ?? 0) > 0);
  }, [stats.downloadsByCategory]);

  const renderCategoryGrid = useCallback(() => {
    return (
      <View style={styles.categoryGrid}>
        {activeCategories.map(cat => (
          <CategoryCard
            key={cat}
            category={cat}
            count={stats.downloadsByCategory[cat] ?? 0}
            totalBytes={stats.bytesByCategory[cat] ?? 0}
            onPress={handleCategoryPress}
          />
        ))}
      </View>
    );
  }, [activeCategories, stats, handleCategoryPress]);

  const renderItem = useCallback(({ item }: { item: LibraryItem }) => (
    <LibraryCard item={item} />
  ), []);

  const keyExtractor = useCallback((item: LibraryItem) => item.id, []);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchAll(), refetchNotifications()]);
  }, [refetchAll, refetchNotifications]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Syncing your library...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={isSearching ? filteredItems : (viewMode === 'all' ? filteredItems : [])}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 12 }]}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Library</Text>
                <Text style={styles.subtitle}>
                  {stats.totalItems} downloads · {stats.totalFiles} files
                </Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.notificationButton}
                  onPress={handleOpenNotifications}
                  accessibilityLabel="Toggle notifications"
                >
                  <Bell size={18} color={Colors.text} />
                  {notifications.length > 0 && <View style={styles.notificationBadge} />}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleAddContent}
                  testID="add-content-btn"
                >
                  <Plus size={20} color={Colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.searchRow}>
              <SearchBar value={search} onChangeText={setSearch} />
            </View>

            {!isSearching && (
              <View style={styles.quickAddRow}>
                {QUICK_ADD_TYPES.map((quickAdd) => (
                  <TouchableOpacity
                    key={quickAdd.type}
                    style={styles.quickAddChip}
                    onPress={() => handleQuickAddContent(quickAdd.type)}
                  >
                    <Text style={styles.quickAddChipText}>{quickAdd.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {!isSearching && (
              <ExpandableDownloadSection
                downloads={activeDownloads}
                onViewAll={handleViewAllDownloads}
                onCancelDownload={handleCancelDownload}
              />
            )}

            {!isSearching && (
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, viewMode === 'categories' && styles.toggleBtnActive]}
                  onPress={() => setViewMode('categories')}
                >
                  <Text style={[styles.toggleText, viewMode === 'categories' && styles.toggleTextActive]}>
                    Categories
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, viewMode === 'all' && styles.toggleBtnActive]}
                  onPress={() => setViewMode('all')}
                >
                  <Text style={[styles.toggleText, viewMode === 'all' && styles.toggleTextActive]}>
                    All Files
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {!isSearching && viewMode === 'categories' && renderCategoryGrid()}

            {isSearching && filteredItems.length === 0 && (
              <View style={styles.emptySearch}>
                <Text style={styles.emptyText}>No results for &ldquo;{search}&rdquo;</Text>
              </View>
            )}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      />

      <Modal
        visible={showNotifications}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.notificationsOverlay}>
          <View style={styles.notificationsModal}>
            <View style={styles.notificationsHeader}>
              <Text style={styles.notificationsTitle}>Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotifications(false)}>
                <X size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.notificationsList}>
              {notifications.map((notification) => (
                <View key={notification.id} style={styles.notificationItem}>
                  <View style={styles.notificationContent}>
                    <Text style={styles.notificationItemTitle}>{notification.title}</Text>
                    <Text style={styles.notificationItemMessage}>{notification.message}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.notificationDismissButton}
                    onPress={() => handleDismissNotification(notification.id)}
                    accessibilityLabel="Dismiss notification"
                  >
                    <X size={16} color={Colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.clearNotificationsButton} onPress={handleClearNotifications}>
              <Text style={styles.clearNotificationsText}>Clear all notifications</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
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
  loadingText: {
    color: Colors.textSecondary,
    marginTop: 12,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
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
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  notificationsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  notificationsModal: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: '70%',
    padding: 16,
  },
  notificationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  notificationsTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700' as const,
  },
  notificationsList: {
    maxHeight: 360,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  notificationContent: {
    flex: 1,
    paddingRight: 12,
  },
  notificationItemTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  notificationItemMessage: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  notificationDismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clearNotificationsButton: {
    marginTop: 14,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  clearNotificationsText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  searchRow: {
    marginTop: 18,
    marginBottom: 12,
  },
  quickAddRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  quickAddChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickAddChipText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  toggleBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleBtnActive: {
    backgroundColor: Colors.primary + '18',
    borderColor: Colors.primary + '60',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  toggleTextActive: {
    color: Colors.primary,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emptySearch: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: 14,
  },

});
