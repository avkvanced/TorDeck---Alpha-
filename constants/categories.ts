import { MediaCategory, ClassificationConfig } from '@/types/torbox';
import Colors from '@/constants/colors';

export const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'm4b', 'aac', 'flac', 'ogg', 'wma', 'wav', 'opus'];
export const ALWAYS_AUDIOBOOK_EXTENSIONS = ['m4b'];
export const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv', 'flv', 'ts', 'm4v'];
export const EBOOK_EXTENSIONS = ['epub', 'mobi', 'azw', 'azw3', 'djvu', 'cbr', 'cbz'];
export const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'ppt', 'pptx', 'csv'];
export const ARCHIVE_EXTENSIONS = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso'];
export const GAMES_MIN_SIZE_GB = 10;

export const DEFAULT_CLASSIFICATION_CONFIG: ClassificationConfig = {
  audiobookMinFileSizeMB: 150,
  audiobookMinDurationMinutes: 60,
  audiobookMultiTrackMinSizeMB: 250,
  audiobookKeywords: ['audiobook', 'audible', 'chapter', 'book', 'narrated', 'narrator', 'unabridged', 'abridged'],
};

export const CATEGORY_META: Record<MediaCategory, { label: string; icon: string; color: string }> = {
  audiobook: { label: 'Audiobooks', icon: 'Headphones', color: Colors.categoryAudiobook },
  music: { label: 'Music', icon: 'Music', color: Colors.categoryMusic },
  video: { label: 'Video', icon: 'Film', color: Colors.categoryVideo },
  ebook: { label: 'eBooks', icon: 'BookOpen', color: Colors.categoryEbook },
  games: { label: 'Games', icon: 'Gamepad2', color: Colors.categoryGames },
  other: { label: 'Other', icon: 'File', color: Colors.categoryOther },
};

export const ALL_CATEGORIES: MediaCategory[] = ['audiobook', 'music', 'video', 'ebook', 'games', 'other'];

export const DISPLAY_CATEGORIES: MediaCategory[] = ['audiobook', 'music', 'video', 'ebook', 'games'];

export const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5];
