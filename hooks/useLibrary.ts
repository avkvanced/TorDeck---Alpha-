import { useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { torboxApi } from '@/services/torbox-api';
import { classifyFile, getFileExtension } from '@/utils/classification';
import {
  TorBoxItem,
  TorBoxUsenetItem,
  TorBoxWebItem,
  LibraryItem,
  MediaCategory,
  AppStats,
  DownloadSource,
  ActiveDownload,
  AudiobookGroup,
} from '@/types/torbox';
import { useAuth } from '@/hooks/useAuth';
import { useCategoryOverrides } from '@/hooks/useCategoryOverrides';
import { ALL_CATEGORIES } from '@/constants/categories';
import { appendAppNotification } from '@/hooks/useAppNotifications';

function buildLibraryItems(
  torrents: TorBoxItem[],
  usenet: TorBoxUsenetItem[],
  webDl: TorBoxWebItem[]
): LibraryItem[] {
  const items: LibraryItem[] = [];

  const getFileId = (file: { id?: number; file_id?: number }): number | null => {
    const candidate = file.id ?? file.file_id;
    return Number.isFinite(candidate) ? Number(candidate) : null;
  };

  const getWebDownloadId = (item: TorBoxWebItem): number => {
    return item.webdownload_id ?? item.web_id ?? item.id;
  };

  for (const t of torrents) {
    if (!t.files) continue;
    for (const f of t.files) {
      const fileId = getFileId(f);
      if (fileId === null) continue;

      items.push({
        id: `torrent-${t.id}-${fileId}`,
        sourceId: t.id,
        fileId,
        source: 'torrent',
        parentName: t.name,
        fileName: f.short_name || f.name,
        fileSize: f.size,
        category: classifyFile(f, t.files, undefined, t.name),
        extension: getFileExtension(f.name),
        mimetype: f.mimetype,
        md5: f.md5,
        s3Path: f.s3_path,
        createdAt: t.created_at,
        isComplete: t.download_finished,
      });
    }
  }

  for (const u of usenet) {
    if (!u.files) continue;
    for (const f of u.files) {
      const fileId = getFileId(f);
      if (fileId === null) continue;

      items.push({
        id: `usenet-${u.id}-${fileId}`,
        sourceId: u.id,
        fileId,
        source: 'usenet',
        parentName: u.name,
        fileName: f.short_name || f.name,
        fileSize: f.size,
        category: classifyFile(f, u.files, undefined, u.name),
        extension: getFileExtension(f.name),
        mimetype: f.mimetype,
        md5: f.md5,
        s3Path: f.s3_path,
        createdAt: u.created_at,
        isComplete: u.download_finished,
      });
    }
  }

  for (const w of webDl) {
    const webId = getWebDownloadId(w);
    if (!w.files) continue;
    for (const f of w.files) {
      const fileId = getFileId(f);
      if (fileId === null) continue;

      items.push({
        id: `web-${webId}-${fileId}`,
        sourceId: webId,
        fileId,
        source: 'web',
        parentName: w.name,
        fileName: f.short_name || f.name,
        fileSize: f.size,
        category: classifyFile(f, w.files, undefined, w.name),
        extension: getFileExtension(f.name),
        mimetype: f.mimetype,
        md5: f.md5,
        s3Path: f.s3_path,
        createdAt: w.created_at,
        isComplete: w.download_finished,
      });
    }
  }

  return items;
}

function shouldShowInDownloads(downloadState: string, downloadFinished: boolean): boolean {
  const state = downloadState.toLowerCase();
  if (!downloadFinished) return true;
  if (state === 'error' || state === 'failed' || state === 'stalled') return true;
  return false;
}

function buildActiveDownloads(
  torrents: TorBoxItem[],
  usenet: TorBoxUsenetItem[],
  webDl: TorBoxWebItem[]
): ActiveDownload[] {
  const items: ActiveDownload[] = [];

  for (const t of torrents) {
    if (shouldShowInDownloads(t.download_state, t.download_finished)) {
      items.push({
        id: t.id,
        name: t.name,
        size: t.size,
        progress: t.progress,
        downloadSpeed: t.download_speed,
        uploadSpeed: t.upload_speed,
        eta: t.eta,
        downloadFinished: t.download_finished,
        downloadState: t.download_state,
        createdAt: t.created_at,
        source: 'torrent',
        filesCount: t.files?.length ?? 0,
        seeds: t.seeds,
        peers: t.peers,
      });
    }
  }

  for (const u of usenet) {
    if (shouldShowInDownloads(u.download_state, u.download_finished)) {
      items.push({
        id: u.id,
        name: u.name,
        size: u.size,
        progress: u.progress,
        downloadSpeed: u.download_speed,
        uploadSpeed: 0,
        eta: u.eta,
        downloadFinished: u.download_finished,
        downloadState: u.download_state,
        createdAt: u.created_at,
        source: 'usenet',
        filesCount: u.files?.length ?? 0,
      });
    }
  }

  for (const w of webDl) {
    const webId = w.webdownload_id ?? w.web_id ?? w.id;
    if (shouldShowInDownloads(w.download_state, w.download_finished)) {
      items.push({
        id: webId,
        name: w.name,
        size: w.size,
        progress: w.progress,
        downloadSpeed: w.download_speed,
        uploadSpeed: 0,
        eta: w.eta,
        downloadFinished: w.download_finished,
        downloadState: w.download_state,
        createdAt: w.created_at,
        source: 'web',
        filesCount: w.files?.length ?? 0,
      });
    }
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items;
}

export const [LibraryProvider, useLibrary] = createContextHook(() => {
  const { isConnected } = useAuth();
  const { getEffectiveCategory } = useCategoryOverrides();
  const queryClient = useQueryClient();

  const torrentsQuery = useQuery({
    queryKey: ['torrents'],
    queryFn: () => torboxApi.getTorrents(),
    enabled: isConnected,
    refetchInterval: 120000,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const usenetQuery = useQuery({
    queryKey: ['usenet'],
    queryFn: () => torboxApi.getUsenet(),
    enabled: isConnected,
    refetchInterval: 120000,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const webQuery = useQuery({
    queryKey: ['webdl'],
    queryFn: () => torboxApi.getWebDownloads(),
    enabled: isConnected,
    refetchInterval: 120000,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const torrents = useMemo(() => torrentsQuery.data ?? [], [torrentsQuery.data]);
  const usenet = useMemo(() => usenetQuery.data ?? [], [usenetQuery.data]);
  const webDl = useMemo(() => webQuery.data ?? [], [webQuery.data]);

  const rawLibraryItems = useMemo(
    () => buildLibraryItems(torrents, usenet, webDl),
    [torrents, usenet, webDl]
  );

  const libraryItems = useMemo(
    () => rawLibraryItems.map(item => ({
      ...item,
      category: getEffectiveCategory(item.id, item.category),
    })),
    [rawLibraryItems, getEffectiveCategory]
  );

  const activeDownloads = useMemo(
    () => buildActiveDownloads(torrents, usenet, webDl),
    [torrents, usenet, webDl]
  );
  const previousCompletionMapRef = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    const currentMap = new Map<string, boolean>();
    const completedNow: string[] = [];

    for (const item of [...torrents, ...usenet, ...webDl]) {
      const source = 'webdownload_id' in item || 'web_id' in item ? 'web' : ('peers' in item ? 'torrent' : 'usenet');
      const sourceId = source === 'web' ? (item.webdownload_id ?? item.web_id ?? item.id) : item.id;
      const key = `${source}-${sourceId}`;
      currentMap.set(key, item.download_finished);

      const previous = previousCompletionMapRef.current.get(key);
      if (previous === false && item.download_finished) {
        completedNow.push(item.name);
      }
    }

    if (completedNow.length > 0) {
      for (const name of completedNow.slice(0, 5)) {
        void appendAppNotification({
          title: 'Download finished',
          message: `${name} is now complete.`,
        });
      }
    }

    previousCompletionMapRef.current = currentMap;
  }, [torrents, usenet, webDl]);

  const isLoading = torrentsQuery.isLoading || usenetQuery.isLoading || webQuery.isLoading;
  const isFetching = torrentsQuery.isFetching || usenetQuery.isFetching || webQuery.isFetching;

  const { refetch: refetchTorrents } = torrentsQuery;
  const { refetch: refetchUsenet } = usenetQuery;
  const { refetch: refetchWeb } = webQuery;

  const refetchAll = useCallback(async () => {
    await Promise.all([
      refetchTorrents(),
      refetchUsenet(),
      refetchWeb(),
    ]);
  }, [refetchTorrents, refetchUsenet, refetchWeb]);

  const deleteMutation = useMutation({
    mutationFn: async ({ source, sourceId }: { source: string; sourceId: number }) => {
      await torboxApi.deleteItem(source, sourceId);
    },
    onSuccess: () => {
      console.log('[Library] Item deleted, refetching...');
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
      queryClient.invalidateQueries({ queryKey: ['usenet'] });
      queryClient.invalidateQueries({ queryKey: ['webdl'] });
    },
  });

  const addMagnetMutation = useMutation({
    mutationFn: async (magnet: string) => {
      await torboxApi.addTorrentMagnet(magnet);
    },
    onSuccess: () => {
      console.log('[Library] Magnet added, refetching...');
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
    },
  });

  const addHashMutation = useMutation({
    mutationFn: async (hash: string) => {
      await torboxApi.addTorrentHash(hash);
    },
    onSuccess: () => {
      console.log('[Library] Hash added, refetching...');
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
    },
  });

  const addWebMutation = useMutation({
    mutationFn: async (url: string) => {
      await torboxApi.addWebDownload(url);
    },
    onSuccess: () => {
      console.log('[Library] Web download added, refetching...');
      queryClient.invalidateQueries({ queryKey: ['webdl'] });
    },
  });

  const addNzbMutation = useMutation({
    mutationFn: async (nzbUrl: string) => {
      await torboxApi.addUsenetNzb(nzbUrl);
    },
    onSuccess: () => {
      console.log('[Library] NZB added, refetching...');
      queryClient.invalidateQueries({ queryKey: ['usenet'] });
    },
  });

  const audiobookGroups = useMemo((): AudiobookGroup[] => {
    const audiobooks = libraryItems.filter(item => item.category === 'audiobook');
    const groupMap = new Map<string, LibraryItem[]>();

    for (const item of audiobooks) {
      const key = `${item.source}-${item.sourceId}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(item);
    }

    const groups: AudiobookGroup[] = [];
    for (const [key, tracks] of groupMap.entries()) {
      const first = tracks[0];
      const sortedTracks = [...tracks].sort((a, b) => a.fileName.localeCompare(b.fileName));
      groups.push({
        id: key,
        name: first.parentName,
        source: first.source,
        sourceId: first.sourceId,
        totalSize: tracks.reduce((sum, t) => sum + t.fileSize, 0),
        fileCount: tracks.length,
        tracks: sortedTracks,
        createdAt: first.createdAt,
        isComplete: first.isComplete,
      });
    }

    groups.sort((a, b) => a.name.localeCompare(b.name));
    return groups;
  }, [libraryItems]);

  const stats = useMemo((): AppStats => {
    const countsByCategory = {} as Record<MediaCategory, number>;
    const downloadsByCategory = {} as Record<MediaCategory, number>;
    const bytesByCategory = {} as Record<MediaCategory, number>;
    const categories: MediaCategory[] = ALL_CATEGORIES;

    const seenDownloadsByCategory = new Map<MediaCategory, Set<string>>();

    for (const c of categories) {
      countsByCategory[c] = 0;
      downloadsByCategory[c] = 0;
      bytesByCategory[c] = 0;
      seenDownloadsByCategory.set(c, new Set());
    }

    let totalBytes = 0;

    for (const item of libraryItems) {
      countsByCategory[item.category]++;
      bytesByCategory[item.category] += item.fileSize;

      const downloadKey = `${item.source}-${item.sourceId}`;
      const seenInCategory = seenDownloadsByCategory.get(item.category);
      if (seenInCategory && !seenInCategory.has(downloadKey)) {
        seenInCategory.add(downloadKey);
        downloadsByCategory[item.category]++;
      }

      totalBytes += item.fileSize;
    }

    const completedCount = torrents.filter(t => t.download_finished).length
      + usenet.filter(u => u.download_finished).length
      + webDl.filter(w => w.download_finished).length;

    const activeCount = torrents.filter(t => !t.download_finished && t.active).length
      + usenet.filter(u => !u.download_finished && u.active).length
      + webDl.filter(w => !w.download_finished && w.active).length;

    const errorCount = torrents.filter(t => t.download_state === 'error').length
      + usenet.filter(u => u.download_state === 'error').length
      + webDl.filter(w => w.download_state === 'error').length;

    const recentItems = [...libraryItems]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    return {
      totalItems: torrents.length + usenet.length + webDl.length,
      totalFiles: libraryItems.length,
      totalBytes,
      countsByCategory,
      downloadsByCategory,
      bytesByCategory,
      completedCount,
      activeCount,
      errorCount,
      itemsBySource: {
        torrent: torrents.length,
        usenet: usenet.length,
        web: webDl.length,
      },
      recentItems,
    };
  }, [libraryItems, torrents, usenet, webDl]);

  return {
    libraryItems,
    audiobookGroups,
    torrents,
    usenet,
    webDl,
    activeDownloads,
    isLoading,
    isFetching,
    refetchAll,
    stats,
    deleteItem: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    addMagnet: addMagnetMutation.mutateAsync,
    isAddingMagnet: addMagnetMutation.isPending,
    addHash: addHashMutation.mutateAsync,
    isAddingHash: addHashMutation.isPending,
    addWeb: addWebMutation.mutateAsync,
    isAddingWeb: addWebMutation.isPending,
    addNzb: addNzbMutation.mutateAsync,
    isAddingNzb: addNzbMutation.isPending,
  };
});

export function useFilteredLibrary(search: string, category?: MediaCategory) {
  const { libraryItems } = useLibrary();
  return useMemo(() => {
    let filtered = libraryItems;
    if (category) {
      filtered = filtered.filter(item => item.category === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(
        item =>
          item.fileName.toLowerCase().includes(q) ||
          item.parentName.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [libraryItems, search, category]);
}
