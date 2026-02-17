import { useState, useEffect, useRef, useCallback } from 'react';
import { Audio, AVPlaybackStatus, AVPlaybackStatusSuccess } from 'expo-av';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { torboxApi } from '@/services/torbox-api';
import { LibraryItem, PlaybackProgress, RecentlyPlayed, PlayerSession, PlayerStats, MediaMetadata } from '@/types/torbox';
import {
  getAudioMimeType,
  isM4bOrM4a,
  isAudioExtension,
  requestTranscode,
  getCachedTranscodeUrl,
  isDecodeError,
  isIosAvFoundationDecodeError,
  TRANSCODE_ENABLED,
} from '@/services/mediaTranscode';

const PROGRESS_KEY_PREFIX = 'playback_progress_';
const RECENTLY_PLAYED_KEY = 'recently_played_items';
const PLAYER_STATS_KEY = 'player_stats';
const METADATA_CACHE_PREFIX = 'media_metadata_';
const MAX_RECENT = 30;

async function loadProgress(fileId: string): Promise<PlaybackProgress | null> {
  try {
    const stored = await AsyncStorage.getItem(PROGRESS_KEY_PREFIX + fileId);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

async function saveProgress(progress: PlaybackProgress): Promise<void> {
  try {
    await AsyncStorage.setItem(
      PROGRESS_KEY_PREFIX + progress.fileId,
      JSON.stringify(progress)
    );
  } catch (err) {
    console.error('[Player] Failed to save progress:', err);
  }
}

async function loadRecentlyPlayed(): Promise<RecentlyPlayed[]> {
  try {
    const stored = await AsyncStorage.getItem(RECENTLY_PLAYED_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

async function addToRecentlyPlayed(item: LibraryItem, posMillis: number, durMillis: number): Promise<void> {
  try {
    const recent = await loadRecentlyPlayed();
    const filtered = recent.filter(r => r.item.id !== item.id);
    filtered.unshift({
      item,
      playedAt: new Date().toISOString(),
      positionMillis: posMillis,
      durationMillis: durMillis,
    });
    const trimmed = filtered.slice(0, MAX_RECENT);
    await AsyncStorage.setItem(RECENTLY_PLAYED_KEY, JSON.stringify(trimmed));
    console.log('[Player] Added to recently played:', item.fileName);
  } catch (err) {
    console.error('[Player] Failed to save recently played:', err);
  }
}

function getDefaultStats(): PlayerStats {
  return {
    totalListeningTimeMs: 0,
    totalSessions: 0,
    uniqueTracksPlayed: 0,
    uniqueAudiobooksPlayed: 0,
    sessionsHistory: [],
    longestSessionMs: 0,
    averageSessionMs: 0,
    lastUpdated: new Date().toISOString(),
  };
}

async function loadPlayerStats(): Promise<PlayerStats> {
  try {
    const stored = await AsyncStorage.getItem(PLAYER_STATS_KEY);
    return stored ? JSON.parse(stored) : getDefaultStats();
  } catch {
    return getDefaultStats();
  }
}

async function savePlayerStats(stats: PlayerStats): Promise<void> {
  try {
    await AsyncStorage.setItem(PLAYER_STATS_KEY, JSON.stringify(stats));
  } catch (err) {
    console.error('[Player] Failed to save stats:', err);
  }
}

async function loadCachedMetadata(itemId: string): Promise<MediaMetadata | null> {
  try {
    const stored = await AsyncStorage.getItem(METADATA_CACHE_PREFIX + itemId);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

async function saveCachedMetadata(itemId: string, metadata: MediaMetadata): Promise<void> {
  try {
    await AsyncStorage.setItem(METADATA_CACHE_PREFIX + itemId, JSON.stringify(metadata));
  } catch (err) {
    console.error('[Player] Failed to cache metadata:', err);
  }
}

function getExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

interface ProbeResult {
  status: number;
  contentType: string;
  acceptRanges: string;
  contentRange: string;
  contentLength: string;
  finalUrl: string;
  firstBytesHex: string;
  isBinaryMedia: boolean;
  hasFtyp: boolean;
  totalContentLength: number;
}

async function probeRemoteMedia(url: string): Promise<ProbeResult | null> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-4095' },
    });

    const status = res.status;
    const contentType = res.headers.get('content-type') || '';
    const acceptRanges = res.headers.get('accept-ranges') || '';
    const contentRange = res.headers.get('content-range') || '';
    const contentLength = res.headers.get('content-length') || '';
    const finalUrl = (res as unknown as { url?: string }).url || url;

    let totalContentLength = 0;
    const rangeMatch = contentRange.match(/bytes \d+-\d+\/(\d+)/);
    if (rangeMatch) {
      totalContentLength = parseInt(rangeMatch[1], 10);
    }

    let firstBytesHex = '';
    let firstBytes = new Uint8Array(0);
    try {
      const buf = await res.arrayBuffer();
      firstBytes = new Uint8Array(buf).slice(0, 16);
      firstBytesHex = Array.from(firstBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
    } catch {}

    const ct = contentType.toLowerCase();
    const isBinaryMedia = !ct.includes('text/html') && !ct.includes('application/json') && status < 400;

    let hasFtyp = false;
    if (firstBytes.length >= 8) {
      const ftypStr = String.fromCharCode(firstBytes[4], firstBytes[5], firstBytes[6], firstBytes[7]);
      hasFtyp = ftypStr === 'ftyp';
      if (!hasFtyp && firstBytes.length >= 12) {
        for (let i = 0; i <= Math.min(firstBytes.length - 4, 12); i++) {
          const check = String.fromCharCode(firstBytes[i], firstBytes[i + 1], firstBytes[i + 2], firstBytes[i + 3]);
          if (check === 'ftyp') {
            hasFtyp = true;
            break;
          }
        }
      }
    }

    console.log('[Player][Probe] finalUrl(120):', String(finalUrl).slice(0, 120));
    console.log('[Player][Probe] status:', status);
    console.log('[Player][Probe] content-type:', contentType);
    console.log('[Player][Probe] accept-ranges:', acceptRanges);
    console.log('[Player][Probe] content-range:', contentRange);
    console.log('[Player][Probe] content-length:', contentLength);
    console.log('[Player][Probe] total-size:', totalContentLength);
    console.log('[Player][Probe] first-bytes(16):', firstBytesHex);
    console.log('[Player][Probe] hasFtyp:', hasFtyp);
    console.log('[Player][Probe] isBinaryMedia:', isBinaryMedia);

    return { status, contentType, acceptRanges, contentRange, contentLength, finalUrl, firstBytesHex, isBinaryMedia, hasFtyp, totalContentLength };
  } catch (e) {
    console.warn('[Player][Probe] failed:', e);
    return null;
  }
}

function normalizeMediaUri(rawUrl: string): string {
  if (!rawUrl) return rawUrl;

  if (rawUrl.startsWith('/') && !rawUrl.startsWith('//')) {
    const fileUri = 'file://' + rawUrl;
    console.log('[Player] normalizeMediaUri: local path -> file://', rawUrl.substring(0, 60));
    return fileUri;
  }

  try {
    const url = new URL(rawUrl);
    const encodedPathSegments = url.pathname.split('/').map(segment => {
      const decoded = decodeURIComponent(segment);
      return encodeURIComponent(decoded).replace(/%2F/gi, '/');
    });
    url.pathname = encodedPathSegments.join('/');
    const normalized = url.toString();
    if (normalized !== rawUrl) {
      console.log('[Player] normalizeMediaUri: re-encoded URL');
      console.log('[Player]   raw (120):', rawUrl.substring(0, 120));
      console.log('[Player]   norm(120):', normalized.substring(0, 120));
    }
    return normalized;
  } catch {
    const encoded = encodeURI(rawUrl);
    if (encoded !== rawUrl) {
      console.log('[Player] normalizeMediaUri: fallback encodeURI applied');
    }
    return encoded;
  }
}

function extractMetadataFromItem(item: LibraryItem): MediaMetadata {
  const cleanName = item.fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const parentClean = item.parentName
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let artist = '';
  let album = '';
  const isAudiobook = item.category === 'audiobook';

  if (isAudiobook) {
    artist = parentClean;
    album = parentClean;
  } else {
    const dashParts = cleanName.split(' - ');
    if (dashParts.length >= 2) {
      artist = dashParts[0].trim();
      album = parentClean || dashParts[1].trim();
    } else {
      artist = parentClean;
      album = parentClean;
    }
  }

  return {
    title: cleanName,
    artist,
    album,
    artworkUri: null,
    durationMs: null,
    genre: isAudiobook ? 'Audiobook' : null,
    trackNumber: null,
    totalTracks: null,
  };
}

export const [PlayerProvider, usePlayer] = createContextHook(() => {
  const [currentItem, setCurrentItem] = useState<LibraryItem | null>(null);
  const [playlist, setPlaylist] = useState<LibraryItem[]>([]);
  const [trackIndex, setTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [positionMillis, setPositionMillis] = useState<number>(0);
  const [durationMillis, setDurationMillis] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [errorFileName, setErrorFileName] = useState<string | null>(null);
  const [recentlyPlayed, setRecentlyPlayed] = useState<RecentlyPlayed[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats>(getDefaultStats());
  const [metadata, setMetadata] = useState<MediaMetadata | null>(null);
  const [isTranscodeAvailable, setIsTranscodeAvailable] = useState<boolean>(false);
  const [needsTranscode, setNeedsTranscode] = useState<boolean>(false);
  const [streamLinkAvailable, setStreamLinkAvailable] = useState<boolean>(false);

  const soundRef = useRef<Audio.Sound | null>(null);
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const positionRef = useRef<number>(0);
  const durationRef = useRef<number>(0);
  const sessionStartRef = useRef<string | null>(null);
  const sessionStartPosRef = useRef<number>(0);
  const accumulatedListenRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  const probeResultRef = useRef<ProbeResult | null>(null);
  const playLockRef = useRef<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    loadRecentlyPlayed().then(items => {
      setRecentlyPlayed(items);
      console.log('[Player] Loaded recently played:', items.length);
    });
    loadPlayerStats().then(stats => {
      setPlayerStats(stats);
      console.log('[Player] Loaded stats, total sessions:', stats.totalSessions);
    });
  }, []);

  const refreshRecentlyPlayed = useCallback(async () => {
    const items = await loadRecentlyPlayed();
    setRecentlyPlayed(items);
  }, []);

  const refreshStats = useCallback(async () => {
    const stats = await loadPlayerStats();
    setPlayerStats(stats);
  }, []);

  const recordSession = useCallback(async (item: LibraryItem | null) => {
    if (!item || !sessionStartRef.current) return;
    const listenedMs = accumulatedListenRef.current;
    if (listenedMs < 3000) {
      sessionStartRef.current = null;
      accumulatedListenRef.current = 0;
      return;
    }

    const session: PlayerSession = {
      itemId: item.id,
      fileName: item.fileName,
      parentName: item.parentName,
      category: item.category,
      startedAt: sessionStartRef.current,
      endedAt: new Date().toISOString(),
      durationListenedMs: listenedMs,
      startPositionMs: sessionStartPosRef.current,
      endPositionMs: positionRef.current,
      fileDurationMs: durationRef.current,
    };

    console.log('[Player] Recording session:', session.durationListenedMs, 'ms for', item.fileName);

    const stats = await loadPlayerStats();
    stats.sessionsHistory.unshift(session);
    if (stats.sessionsHistory.length > 200) {
      stats.sessionsHistory = stats.sessionsHistory.slice(0, 200);
    }

    stats.totalSessions += 1;
    stats.totalListeningTimeMs += listenedMs;
    if (listenedMs > stats.longestSessionMs) {
      stats.longestSessionMs = listenedMs;
    }
    stats.averageSessionMs = stats.totalSessions > 0
      ? Math.round(stats.totalListeningTimeMs / stats.totalSessions)
      : 0;

    const uniqueTracks = new Set(stats.sessionsHistory.map(s => s.itemId));
    stats.uniqueTracksPlayed = uniqueTracks.size;

    const uniqueAudiobooks = new Set(
      stats.sessionsHistory
        .filter(s => s.category === 'audiobook')
        .map(s => s.parentName)
    );
    stats.uniqueAudiobooksPlayed = uniqueAudiobooks.size;
    stats.lastUpdated = new Date().toISOString();

    await savePlayerStats(stats);
    setPlayerStats(stats);

    sessionStartRef.current = null;
    accumulatedListenRef.current = 0;
  }, []);

  const cleanup = useCallback(async () => {
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch (e) {
        console.log('[Player] Cleanup unload error (safe to ignore):', e);
      }
      soundRef.current = null;
    }
  }, []);

  const persistProgress = useCallback(async () => {
    if (!currentItem) return;
    const pos = positionRef.current;
    const dur = durationRef.current;
    if (dur <= 0) return;
    const isComplete = pos / dur >= 0.98;
    await saveProgress({
      fileId: currentItem.id,
      positionMillis: pos,
      durationMillis: dur,
      isComplete,
      lastUpdated: new Date().toISOString(),
      trackIndex,
    });
  }, [currentItem, trackIndex]);

  const trackIndexRef = useRef<number>(0);
  const playlistRef = useRef<LibraryItem[]>([]);
  const currentItemRef = useRef<LibraryItem | null>(null);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) {
        const item = currentItemRef.current;
        const ext = item ? getExtension(item.fileName) : 'unknown';
        const errorMsg = String(status.error);
        console.error('[Player] Playback error for ext=' + ext + ', platform=' + Platform.OS + ':', errorMsg);
        setErrorFileName(item?.fileName ?? null);
        setIsLoading(false);

        if (item && isM4bOrM4a(ext) && Platform.OS === 'ios' && isIosAvFoundationDecodeError(errorMsg)) {
          console.log('[Player] iOS AVFoundation -11828 decode failure detected. Stopping retries immediately.');
          setNeedsTranscode(true);
          setStreamLinkAvailable(true);

          const probe = probeResultRef.current;
          const probeInfo = probe
            ? `\nProbe: status=${probe.status}, ftyp=${probe.hasFtyp}, content-type=${probe.contentType}`
            : '';

          setError(
            `This audiobook uses an unsupported codec on iOS.\n` +
            `File: ${item.fileName}\n` +
            `Extension: .${ext} | Platform: iOS\n` +
            `Error: AVFoundationErrorDomain -11828${probeInfo}\n\n` +
            (probe && !probe.hasFtyp
              ? 'The file does not appear to be a valid MP4 container (no ftyp box found). It may be encrypted, DRM-protected, or corrupted.\n\n'
              : '') +
            (TRANSCODE_ENABLED
              ? 'Convert to AAC-LC to play, or try a stream link.'
              : 'Transcode service not configured. Try using a stream link, or convert the file externally to AAC-LC (.m4a).')
          );
          if (TRANSCODE_ENABLED) {
            setIsTranscodeAvailable(true);
          } else {
            setIsTranscodeAvailable(false);
          }
          return;
        }

        if (item && isM4bOrM4a(ext)) {
          const msg = errorMsg.toLowerCase();
          if (isDecodeError(msg)) {
            console.log('[Player] Decode-style error detected for m4b/m4a');
            setNeedsTranscode(true);
            setStreamLinkAvailable(true);
            setError(
              `Playback failed: unsupported codec.\n` +
              `File: ${item.fileName}\n` +
              `Extension: .${ext} | Platform: ${Platform.OS}\n` +
              `Error: ${errorMsg}\n\n` +
              (TRANSCODE_ENABLED
                ? 'Convert to AAC-LC to play, or try a stream link.'
                : 'Transcode service not configured. Try a stream link or convert externally to AAC-LC (.m4a).')
            );
            if (TRANSCODE_ENABLED) {
              setIsTranscodeAvailable(true);
            } else {
              setIsTranscodeAvailable(false);
            }
          } else {
            console.log('[Player] Non-decode error for m4b/m4a; transcode may not help:', errorMsg);
            setError(`Playback error (${ext}): ${errorMsg}`);
            setIsTranscodeAvailable(false);
          }
        } else {
          setError(`Playback error (${ext}): ${errorMsg}`);
          setIsTranscodeAvailable(false);
        }
      }
      return;
    }

    const loadedStatus = status as AVPlaybackStatusSuccess;
    setIsPlaying(loadedStatus.isPlaying);
    setPositionMillis(loadedStatus.positionMillis);
    setDurationMillis(loadedStatus.durationMillis ?? 0);
    positionRef.current = loadedStatus.positionMillis;
    durationRef.current = loadedStatus.durationMillis ?? 0;

    if (loadedStatus.isPlaying) {
      const now = Date.now();
      if (lastTickRef.current > 0) {
        const delta = now - lastTickRef.current;
        if (delta > 0 && delta < 5000) {
          accumulatedListenRef.current += delta;
        }
      }
      lastTickRef.current = now;
    } else {
      lastTickRef.current = 0;
    }

    if (loadedStatus.didJustFinish) {
      console.log('[Player] Track finished');
      persistProgress();
      const item = currentItemRef.current;
      if (item) {
        recordSession(item);
      }
      const currentIdx = trackIndexRef.current;
      const currentPlaylist = playlistRef.current;
      if (currentIdx < currentPlaylist.length - 1) {
        const nextIdx = currentIdx + 1;
        setTrackIndex(nextIdx);
        trackIndexRef.current = nextIdx;
      } else {
        setIsPlaying(false);
      }
    }
  }, [persistProgress, recordSession]);

  const configureAudioMode = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
      console.log('[Player] Audio mode configured');
    } catch (err) {
      console.warn('[Player] Failed to configure audio mode:', err);
    }
  }, []);

  const loadAudioWithRetry = useCallback(async (
    rawUrl: string,
    item: LibraryItem,
    rate: number,
    statusCallback: (status: AVPlaybackStatus) => void,
  ): Promise<Audio.Sound> => {
    const ext = getExtension(item.fileName);
    const isM4BType = isM4bOrM4a(ext);
    const mimeType = getAudioMimeType(ext);
    const url = normalizeMediaUri(rawUrl);
    const isIOS = Platform.OS === 'ios';
    const isAndroid = Platform.OS === 'android';
    const isWeb = Platform.OS === 'web';

    console.log('[Player] ============ LOADING AUDIO ============');
    console.log('[Player] File:', item.fileName);
    console.log('[Player] Extension:', ext);
    console.log('[Player] MIME:', mimeType);
    console.log('[Player] Is M4B/M4A:', isM4BType);
    console.log('[Player] Platform:', Platform.OS);
    console.log('[Player] Normalized URL (120):', url.substring(0, 120));

    await configureAudioMode();

    const errors: { attempt: string; error: unknown }[] = [];

    const tryLoad = async (
      attemptName: string,
      source: Record<string, unknown>,
      statusObj: Record<string, unknown>,
    ): Promise<Audio.Sound | null> => {
      try {
        console.log('[Player]', attemptName);
        const { sound } = await Audio.Sound.createAsync(
          source as Parameters<typeof Audio.Sound.createAsync>[0],
          statusObj as Parameters<typeof Audio.Sound.createAsync>[1],
          statusCallback,
        );
        const checkStatus = await sound.getStatusAsync();
        if (checkStatus.isLoaded) {
          console.log('[Player] SUCCESS:', attemptName, 'duration:', checkStatus.durationMillis, 'ms');
          if (isWeb && rate !== 1) {
            try { await sound.setRateAsync(rate, true); } catch (e) { console.log('[Player] Web rate set skipped:', e); }
          }
          return sound;
        }
        console.warn('[Player]', attemptName, '- loaded but status.isLoaded=false, unloading');
        await sound.unloadAsync();
        return null;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn('[Player]', attemptName, 'FAILED:', errMsg);
        errors.push({ attempt: attemptName, error: err });

        if (isIOS && isM4BType && isIosAvFoundationDecodeError(errMsg)) {
          console.log('[Player] iOS -11828 detected, aborting further retries immediately');
          throw err;
        }

        return null;
      }
    };

    const baseStatus = {
      shouldPlay: false,
      rate: isWeb ? 1 : rate,
      shouldCorrectPitch: true,
      progressUpdateIntervalMillis: 500,
    };
    const minimalStatus = { shouldPlay: false, progressUpdateIntervalMillis: 500 };

    if (isIOS) {
      let sound = await tryLoad(
        'Attempt 1 (iOS minimal): bare URI, no headers',
        { uri: url },
        minimalStatus,
      );
      if (sound) return sound;

      sound = await tryLoad(
        'Attempt 2 (iOS accept header): URI + Accept',
        { uri: url, headers: { 'Accept': `${mimeType},audio/*,*/*` } },
        baseStatus,
      );
      if (sound) return sound;
    } else if (isAndroid) {
      const androidOverride = isM4BType ? { overrideFileExtensionAndroid: 'm4a' } : {};

      let sound = await tryLoad(
        'Attempt 1 (Android standard): URI + Accept + override',
        { uri: url, ...androidOverride, headers: { 'Accept': `${mimeType},audio/*,*/*` } },
        baseStatus,
      );
      if (sound) return sound;

      if (isM4BType) {
        sound = await tryLoad(
          'Attempt 2 (Android m4a forced)',
          { uri: url, overrideFileExtensionAndroid: 'm4a' },
          minimalStatus,
        );
        if (sound) return sound;
      }

      sound = await tryLoad(
        'Attempt 3 (Android minimal): bare URI',
        { uri: url },
        minimalStatus,
      );
      if (sound) return sound;
    } else {
      let sound = await tryLoad(
        'Attempt 1 (Web): bare URI',
        { uri: url },
        minimalStatus,
      );
      if (sound) return sound;

      sound = await tryLoad(
        'Attempt 2 (Web): URI + Accept header',
        { uri: url, headers: { 'Accept': `${mimeType},audio/*,*/*` } },
        baseStatus,
      );
      if (sound) return sound;

      try {
        console.log('[Player] Attempt 3 (Web): HTML5 Audio probe');
        const probeResult = await new Promise<boolean>((resolve) => {
          const audio = new window.Audio();
          audio.preload = 'metadata';
          const timeout = setTimeout(() => { resolve(false); }, 8000);
          audio.onloadedmetadata = () => { clearTimeout(timeout); audio.src = ''; resolve(true); };
          audio.onerror = () => { clearTimeout(timeout); resolve(false); };
          audio.src = url;
        });
        if (probeResult) {
          sound = await tryLoad(
            'Attempt 3b (Web): post-probe retry',
            { uri: url },
            minimalStatus,
          );
          if (sound) return sound;
        } else {
          console.warn('[Player] Web HTML5 probe failed for ext:', ext);
        }
      } catch (webErr) {
        console.warn('[Player] Web probe error:', webErr);
      }
    }

    const cachedTransUrl = await getCachedTranscodeUrl(item.fileId);
    if (cachedTransUrl) {
      const normalizedTransUrl = normalizeMediaUri(cachedTransUrl);
      const sound = await tryLoad(
        'Attempt (transcode cache): cached transcoded URL',
        { uri: normalizedTransUrl },
        minimalStatus,
      );
      if (sound) return sound;
    }

    console.error('[Player] ============ ALL ATTEMPTS FAILED ============');
    console.error('[Player] File:', item.fileName, 'Ext:', ext, 'Platform:', Platform.OS);
    for (const e of errors) {
      const msg = e.error instanceof Error ? e.error.message : String(e.error);
      console.error('[Player]  -', e.attempt, ':', msg);
    }

    const lastErr = errors.length > 0 ? errors[errors.length - 1].error : null;
    const lastNativeError = lastErr instanceof Error
      ? lastErr.message
      : lastErr != null ? String(lastErr) : 'Unknown error';

    const hasDecodeFailure = errors.some(e => {
      const msg = e.error instanceof Error ? e.error.message : String(e.error);
      return isDecodeError(msg);
    });

    const probe = probeResultRef.current;
    const probeShowsBinary = probe?.isBinaryMedia ?? true;

    if ((isM4BType || hasDecodeFailure) && probeShowsBinary) {
      setNeedsTranscode(true);
      setStreamLinkAvailable(true);
      if (TRANSCODE_ENABLED) {
        setIsTranscodeAvailable(true);
      }
    }

    const errorDetail = [
      `Playback failed for "${item.fileName}"`,
      `Extension: .${ext} | Platform: ${Platform.OS}`,
      `Native error: ${lastNativeError}`,
      probe && !probe.hasFtyp && isM4BType
        ? 'Warning: No ftyp box found in file header. File may not be a valid MP4 container, or may be encrypted/DRM.'
        : '',
      hasDecodeFailure && probeShowsBinary
        ? (TRANSCODE_ENABLED
            ? 'Codec decode failure — try requesting AAC transcode or stream link.'
            : 'Codec decode failure. Try a stream link or convert file externally to AAC-LC (.m4a).')
        : '',
      !probeShowsBinary ? 'Note: URL probe indicated non-binary response. The download link may be invalid.' : '',
    ].filter(Boolean).join('\n');

    throw new Error(errorDetail);
  }, [configureAudioMode]);

  const resolveMetadata = useCallback(async (item: LibraryItem): Promise<MediaMetadata> => {
    const cached = await loadCachedMetadata(item.id);
    if (cached) {
      console.log('[Player] Metadata cache hit for:', item.fileName);
      return cached;
    }

    const extracted = extractMetadataFromItem(item);
    console.log('[Player] Extracted metadata:', extracted.title, 'by', extracted.artist);

    await saveCachedMetadata(item.id, extracted);
    return extracted;
  }, []);

  const requestTranscodeForCurrent = useCallback(async () => {
    if (!currentItem) return;
    if (!TRANSCODE_ENABLED) {
      setError('Transcode service is not configured. Please convert the file externally to AAC-LC (.m4a).');
      setIsTranscodeAvailable(false);
      return;
    }
    console.log('[Player] User requested transcode for:', currentItem.fileName);
    setError('Requesting transcoded version...');
    setIsTranscodeAvailable(false);

    try {
      const result = await requestTranscode(
        currentItem.source,
        currentItem.sourceId,
        currentItem.fileId,
        currentItem.fileName,
      );

      if (result.status === 'completed' && result.transcodedUrl) {
        setError(null);
        console.log('[Player] Transcode completed, replaying with transcoded URL');
      } else {
        setError(result.error || 'Transcoding is not yet available. Please configure a transcode backend endpoint.');
        setIsTranscodeAvailable(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transcode request failed';
      setError(msg);
      console.error('[Player] Transcode request error:', msg);
    }
  }, [currentItem]);

  const retryWithStreamLink = useCallback(async () => {
    if (!currentItem) return;
    console.log('[Player] User requested stream link for:', currentItem.fileName);
    setError('Requesting stream link...');
    setStreamLinkAvailable(false);
    setIsLoading(true);

    try {
      const streamUrl = await torboxApi.getStreamLink(currentItem.source, currentItem.sourceId, currentItem.fileId);
      const normalizedUrl = normalizeMediaUri(streamUrl);
      console.log('[Player] Got stream URL (120):', normalizedUrl.substring(0, 120));

      await cleanup();

      const sound = await loadAudioWithRetry(streamUrl, currentItem, playbackRate, onPlaybackStatusUpdate);
      soundRef.current = sound;

      const savedProgress = await loadProgress(currentItem.id);
      if (savedProgress && savedProgress.positionMillis > 0 && !savedProgress.isComplete) {
        try {
          await sound.setPositionAsync(savedProgress.positionMillis);
        } catch (seekErr) {
          console.warn('[Player] Stream resume seek failed:', seekErr);
        }
      }

      sessionStartRef.current = new Date().toISOString();
      sessionStartPosRef.current = savedProgress?.positionMillis ?? 0;
      accumulatedListenRef.current = 0;
      lastTickRef.current = 0;

      await sound.playAsync();
      console.log('[Player] Stream playback started successfully');
      setError(null);
      setNeedsTranscode(false);
      setIsLoading(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Stream link playback failed';
      console.error('[Player] Stream link error:', msg);
      setError(`Stream link also failed:\n${msg}`);
      setStreamLinkAvailable(false);
      setIsLoading(false);
    }
  }, [currentItem, cleanup, loadAudioWithRetry, playbackRate, onPlaybackStatusUpdate]);

  const playItem = useCallback(async (
    item: LibraryItem,
    items?: LibraryItem[],
    idx?: number
  ) => {
    if (currentItemRef.current?.id === item.id && soundRef.current !== null) {
      console.log('[Player] Same item already loaded, toggling play/pause instead of reloading');
      if (!isPlayingRef.current) {
        try {
          await configureAudioMode();
          lastTickRef.current = Date.now();
          await soundRef.current.playAsync();
        } catch (err) {
          console.error('[Player] Resume error:', err);
        }
      }
      return;
    }

    if (playLockRef.current) {
      console.log('[Player] Play locked (debounce), skipping duplicate call');
      return;
    }
    playLockRef.current = true;
    setTimeout(() => { playLockRef.current = false; }, 500);

    const ext = getExtension(item.fileName);
    console.log('[Player] ====== PLAY ITEM ======');
    console.log('[Player] File:', item.fileName);
    console.log('[Player] Extension:', ext);
    console.log('[Player] Category:', item.category);
    console.log('[Player] Source:', item.source, 'SourceId:', item.sourceId, 'FileId:', item.fileId);

    setError(null);
    setErrorFileName(null);
    setIsLoading(true);
    setIsTranscodeAvailable(false);
    setNeedsTranscode(false);
    setStreamLinkAvailable(false);
    probeResultRef.current = null;

    if (currentItemRef.current) {
      await recordSession(currentItemRef.current);
    }

    await cleanup();

    setCurrentItem(item);
    currentItemRef.current = item;
    if (items) {
      setPlaylist(items);
      playlistRef.current = items;
    }
    if (idx !== undefined) {
      setTrackIndex(idx);
      trackIndexRef.current = idx;
    }

    const itemMetadata = await resolveMetadata(item);
    setMetadata(itemMetadata);

    try {
      let rawUrl: string;
      const isM4BType = isM4bOrM4a(ext);
      const useStreamFirst = Platform.OS === 'ios' && isM4BType;

      if (useStreamFirst) {
        console.log('[Player] iOS + M4B detected, trying stream link first');
        try {
          rawUrl = await torboxApi.getStreamLink(item.source, item.sourceId, item.fileId);
          console.log('[Player] Using stream link for M4B on iOS');
        } catch (streamErr) {
          console.log('[Player] Stream link failed, falling back to download link:', streamErr);
          rawUrl = await torboxApi.getDownloadLink(item.source, item.sourceId, item.fileId);
        }
      } else {
        rawUrl = await torboxApi.getDownloadLink(item.source, item.sourceId, item.fileId);
      }

      const normalizedProbeUrl = normalizeMediaUri(rawUrl);
      console.log('[Player] Got URL for', item.fileName, '- length:', rawUrl.length);
      console.log('[Player] Normalized URL (120):', normalizedProbeUrl.substring(0, 120));

      const probe = await probeRemoteMedia(normalizedProbeUrl);
      probeResultRef.current = probe;

      if (probe) {
        const ct = probe.contentType.toLowerCase();
        const looksHtml = ct.includes('text/html');
        const looksJson = ct.includes('application/json');
        const notOk = probe.status >= 400;
        if (notOk || looksHtml || looksJson) {
          console.error('[Player][Probe] Non-media response detected:', probe.status, probe.contentType);
          setIsLoading(false);
          setErrorFileName(item.fileName);
          setError(
            `Link is not returning playable audio.\n` +
            `status=${probe.status}\ncontent-type=${probe.contentType}\n` +
            `This usually means expired link, auth/redirect, or server error.`
          );
          return;
        }

        if (isM4BType && !probe.hasFtyp) {
          console.warn('[Player][Probe] M4B/M4A file missing ftyp box in first 4KB. File may be encrypted, DRM, or not a valid MP4.');
        }

        if (isM4BType && !probe.acceptRanges && probe.status !== 206) {
          console.warn('[Player][Probe] No range support detected. AVPlayer may struggle with seeking.');
        }
      }

      const sound = await loadAudioWithRetry(rawUrl, item, playbackRate, onPlaybackStatusUpdate);
      soundRef.current = sound;

      const savedProgress = await loadProgress(item.id);
      if (savedProgress && savedProgress.positionMillis > 0 && !savedProgress.isComplete) {
        console.log('[Player] Resuming from:', savedProgress.positionMillis, 'ms');
        try {
          await sound.setPositionAsync(savedProgress.positionMillis);
        } catch (seekErr) {
          console.warn('[Player] Resume seek failed, starting from beginning:', seekErr);
        }
      }

      sessionStartRef.current = new Date().toISOString();
      sessionStartPosRef.current = savedProgress?.positionMillis ?? 0;
      accumulatedListenRef.current = 0;
      lastTickRef.current = 0;

      await sound.playAsync();
      console.log('[Player] Playback started successfully');

      addToRecentlyPlayed(item, 0, 0).then(() => {
        loadRecentlyPlayed().then(recents => setRecentlyPlayed(recents));
      });

      saveIntervalRef.current = setInterval(() => {
        persistProgress();
      }, 10000);

      setIsLoading(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Playback failed';
      console.error('[Player] Play error:', message);

      if (!error) {
        setError(message);
      }
      setErrorFileName(item.fileName);
      setIsLoading(false);
    }
  }, [cleanup, playbackRate, onPlaybackStatusUpdate, persistProgress, loadAudioWithRetry, recordSession, resolveMetadata, error, configureAudioMode]);

  const togglePlayPause = useCallback(async () => {
    if (!soundRef.current) return;
    try {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
        await persistProgress();
        lastTickRef.current = 0;
      } else {
        await configureAudioMode();
        lastTickRef.current = Date.now();
        await soundRef.current.playAsync();
      }
    } catch (err) {
      console.error('[Player] Toggle error:', err);
      setError('Failed to toggle playback');
    }
  }, [isPlaying, persistProgress, configureAudioMode]);

  const seekTo = useCallback(async (millis: number) => {
    if (!soundRef.current) return;
    try {
      await soundRef.current.setPositionAsync(Math.max(0, Math.round(millis)));
      await persistProgress();
    } catch (err) {
      console.error('[Player] Seek error:', err);
    }
  }, [persistProgress]);

  const skipForward = useCallback(async () => {
    if (!soundRef.current) return;
    const newPos = Math.min(positionRef.current + 15000, durationRef.current);
    await seekTo(newPos);
  }, [seekTo]);

  const skipBackward = useCallback(async () => {
    if (!soundRef.current) return;
    const newPos = Math.max(positionRef.current - 15000, 0);
    await seekTo(newPos);
  }, [seekTo]);

  const changeRate = useCallback(async (rate: number) => {
    setPlaybackRate(rate);
    if (soundRef.current) {
      try {
        await soundRef.current.setRateAsync(rate, true);
      } catch (err) {
        console.error('[Player] Rate change error:', err);
      }
    }
  }, []);

  const stop = useCallback(async () => {
    await persistProgress();
    if (currentItemRef.current) {
      await recordSession(currentItemRef.current);
    }
    await cleanup();
    setCurrentItem(null);
    currentItemRef.current = null;
    setPlaylist([]);
    setTrackIndex(0);
    setIsPlaying(false);
    setPositionMillis(0);
    setDurationMillis(0);
    setMetadata(null);
    setError(null);
    setErrorFileName(null);
    setIsTranscodeAvailable(false);
    setNeedsTranscode(false);
    setStreamLinkAvailable(false);
    lastTickRef.current = 0;

    await refreshRecentlyPlayed();
    await refreshStats();
  }, [persistProgress, cleanup, recordSession, refreshRecentlyPlayed, refreshStats]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    currentItem,
    playlist,
    trackIndex,
    isPlaying,
    isLoading,
    positionMillis,
    durationMillis,
    playbackRate,
    error,
    errorFileName,
    metadata,
    isTranscodeAvailable,
    needsTranscode,
    streamLinkAvailable,
    recentlyPlayed,
    playerStats,
    playItem,
    togglePlayPause,
    seekTo,
    skipForward,
    skipBackward,
    changeRate,
    stop,
    loadProgress,
    refreshRecentlyPlayed,
    refreshStats,
    requestTranscodeForCurrent,
    retryWithStreamLink,
  };
});
