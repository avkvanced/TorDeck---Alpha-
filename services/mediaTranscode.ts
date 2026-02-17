import { TranscodeRequest, TranscodeResult, DownloadSource } from '@/types/torbox';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TRANSCODE_CACHE_PREFIX = 'transcode_result_';

export const TRANSCODE_ENABLED = false;

export async function requestTranscode(
  source: DownloadSource,
  sourceId: number,
  fileId: number,
  fileName: string,
): Promise<TranscodeResult> {
  if (!TRANSCODE_ENABLED) {
    console.log('[Transcode] Transcode service not configured. Returning stub.');
    return {
      status: 'failed',
      transcodedUrl: null,
      error: 'Not included in public release: transcode backend integration is disabled.',
    };
  }

  const request: TranscodeRequest = {
    source,
    sourceId,
    fileId,
    fileName,
    targetCodec: 'aac',
    targetContainer: 'm4a',
    targetBitrate: 192,
    targetSampleRate: 44100,
  };

  console.log('[Transcode] Requesting transcode for:', fileName, request);

  // TODO: Replace with actual backend transcode endpoint
  // POST /api/transcode { source, sourceId, fileId, targetCodec, targetContainer, targetBitrate, targetSampleRate }
  // Returns { status, transcodedUrl, error }

  const result: TranscodeResult = {
    status: 'pending',
    transcodedUrl: null,
    error: 'Not included in public release: transcoding is unavailable in this build.',
  };

  console.log('[Transcode] Stub result:', result);
  return result;
}

export async function getCachedTranscodeUrl(fileId: number): Promise<string | null> {
  try {
    const cached = await AsyncStorage.getItem(TRANSCODE_CACHE_PREFIX + fileId);
    if (cached) {
      const result: TranscodeResult = JSON.parse(cached);
      if (result.status === 'completed' && result.transcodedUrl) {
        console.log('[Transcode] Cache hit for fileId:', fileId);
        return result.transcodedUrl;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function cacheTranscodeResult(fileId: number, result: TranscodeResult): Promise<void> {
  try {
    await AsyncStorage.setItem(TRANSCODE_CACHE_PREFIX + fileId, JSON.stringify(result));
  } catch (err) {
    console.error('[Transcode] Failed to cache result:', err);
  }
}

export function getAudioMimeType(extension: string): string {
  switch (extension.toLowerCase()) {
    case 'm4b': return 'audio/mp4';
    case 'm4a': return 'audio/mp4';
    case 'aac': return 'audio/aac';
    case 'mp3': return 'audio/mpeg';
    case 'flac': return 'audio/flac';
    case 'ogg': return 'audio/ogg';
    case 'opus': return 'audio/opus';
    case 'wav': return 'audio/wav';
    case 'wma': return 'audio/x-ms-wma';
    default: return 'audio/*';
  }
}

export function isAudioExtension(ext: string): boolean {
  return ['mp3', 'm4a', 'm4b', 'aac', 'flac', 'ogg', 'wma', 'wav', 'opus'].includes(ext.toLowerCase());
}

export function isM4bOrM4a(ext: string): boolean {
  return ['m4b', 'm4a'].includes(ext.toLowerCase());
}

export function isNativelySupportedAudio(ext: string): boolean {
  const supported = ['mp3', 'm4a', 'm4b', 'aac', 'wav'];
  return supported.includes(ext.toLowerCase());
}

const DECODE_ERROR_PATTERNS = [
  'decode',
  'codec',
  'unsupported',
  'format',
  'mediacodec',
  'audiodecoder',
  'kaudiodecodermimetype',
  'media_err_src_not_supported',
  'media_err_decode',
  'cannot play',
  'playback error',
  'could not open',
  'invalid data',
  '-11828',
  'avfoundationerrordomain',
  'this media format is not supported',
  'media_err',
  'not supported',
];

export function isDecodeError(errorMessage: string): boolean {
  const lower = errorMessage.toLowerCase();
  return DECODE_ERROR_PATTERNS.some(pattern => lower.includes(pattern));
}

export function isIosAvFoundationDecodeError(errorMessage: string): boolean {
  const lower = errorMessage.toLowerCase();
  return lower.includes('-11828') || lower.includes('avfoundationerrordomain') || lower.includes('this media format is not supported');
}
