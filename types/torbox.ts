export type MediaCategory =
  | 'audiobook'
  | 'music'
  | 'video'
  | 'ebook'
  | 'games'
  | 'other';

export type DownloadSource = 'torrent' | 'usenet' | 'web';

export type DownloadStatus =
  | 'downloading'
  | 'uploading'
  | 'stalled'
  | 'paused'
  | 'completed'
  | 'cached'
  | 'metaDL'
  | 'checkingResumeData'
  | 'error';

export interface TorBoxFile {
  id: number;
  file_id?: number;
  md5: string;
  s3_path: string;
  name: string;
  size: number;
  mimetype: string | null;
  short_name: string;
}

export interface TorBoxItem {
  id: number;
  hash: string;
  name: string;
  size: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  download_state: string;
  seeds: number;
  peers: number;
  ratio: number;
  progress: number;
  download_speed: number;
  upload_speed: number;
  eta: number;
  files: TorBoxFile[];
  download_path: string | null;
  availability: number;
  download_finished: boolean;
  tracker: string | null;
  total_uploaded: number;
  total_downloaded: number;
  cached: boolean;
  owner: string;
  seed_torrent: boolean;
  allow_zipped: boolean;
  long_term_seeding: boolean;
  tracker_message: string | null;
  inactive_check: number;
  download_present: boolean;
  server: number;
  torrent_file: boolean;
  expires_at: string | null;
}

export interface TorBoxUsenetItem {
  id: number;
  hash: string;
  name: string;
  size: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  download_state: string;
  progress: number;
  download_speed: number;
  eta: number;
  files: TorBoxFile[];
  download_path: string | null;
  download_finished: boolean;
  cached: boolean;
  owner: string;
  download_present: boolean;
  server: number;
  expires_at: string | null;
  auth_id: string;
}

export interface TorBoxWebItem {
  id: number;
  webdownload_id?: number;
  web_id?: number;
  hash: string;
  name: string;
  size: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  download_state: string;
  progress: number;
  download_speed: number;
  eta: number;
  files: TorBoxFile[];
  download_path: string | null;
  download_finished: boolean;
  cached: boolean;
  owner: string;
  download_present: boolean;
  server: number;
  expires_at: string | null;
}

export interface LibraryItem {
  id: string;
  sourceId: number;
  fileId: number;
  source: DownloadSource;
  parentName: string;
  fileName: string;
  fileSize: number;
  category: MediaCategory;
  extension: string;
  mimetype: string | null;
  md5: string;
  s3Path: string;
  createdAt: string;
  isComplete: boolean;
}

export interface ActiveDownload {
  id: number;
  name: string;
  size: number;
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  eta: number;
  downloadFinished: boolean;
  downloadState: string;
  createdAt: string;
  source: DownloadSource;
  filesCount: number;
  seeds?: number;
  peers?: number;
}

export interface PlaybackProgress {
  fileId: string;
  positionMillis: number;
  durationMillis: number;
  isComplete: boolean;
  lastUpdated: string;
  trackIndex?: number;
}

export interface TorBoxUser {
  id: number;
  email: string;
  plan: number;
  total_downloaded: number;
  total_downloaded_bytes?: number;
  monthly_downloaded_bytes?: number;
  monthly_data_cap_bytes?: number;
  download_limit_bytes?: number;
  customer: string;
  server: number;
  is_subscribed: boolean;
  premium_expires_at: string;
  cooldown_until: string;
  auth_id: string;
  user_referral: string;
  base_email: string;
}

export interface TorBoxApiResponse<T> {
  success: boolean;
  detail: string;
  data: T;
  error?: string;
}

export interface TorBoxNotification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read?: boolean;
}

export interface DownloadLinkResponse {
  data: string;
}

export interface ClassificationConfig {
  audiobookMinFileSizeMB: number;
  audiobookMinDurationMinutes: number;
  audiobookMultiTrackMinSizeMB: number;
  audiobookKeywords: string[];
}

export interface AppStats {
  totalItems: number;
  totalFiles: number;
  totalBytes: number;
  countsByCategory: Record<MediaCategory, number>;
  downloadsByCategory: Record<MediaCategory, number>;
  bytesByCategory: Record<MediaCategory, number>;
  completedCount: number;
  activeCount: number;
  errorCount: number;
  itemsBySource: Record<DownloadSource, number>;
  recentItems: LibraryItem[];
}

export interface AudiobookGroup {
  id: string;
  name: string;
  source: DownloadSource;
  sourceId: number;
  totalSize: number;
  fileCount: number;
  tracks: LibraryItem[];
  createdAt: string;
  isComplete: boolean;
}

export interface RecentlyPlayed {
  item: LibraryItem;
  playedAt: string;
  positionMillis: number;
  durationMillis: number;
}

export type DefaultTab = '(library)' | 'downloads' | 'stats' | 'settings' | 'automations';

export type AddContentType = 'magnet' | 'hash' | 'web' | 'nzb';

export interface PlayerSession {
  itemId: string;
  fileName: string;
  parentName: string;
  category: MediaCategory;
  startedAt: string;
  endedAt: string;
  durationListenedMs: number;
  startPositionMs: number;
  endPositionMs: number;
  fileDurationMs: number;
}

export interface PlayerStats {
  totalListeningTimeMs: number;
  totalSessions: number;
  uniqueTracksPlayed: number;
  uniqueAudiobooksPlayed: number;
  sessionsHistory: PlayerSession[];
  longestSessionMs: number;
  averageSessionMs: number;
  lastUpdated: string;
}

export interface MediaMetadata {
  title: string;
  artist: string;
  album: string;
  artworkUri: string | null;
  durationMs: number | null;
  genre: string | null;
  trackNumber: number | null;
  totalTracks: number | null;
}

export interface TranscodeRequest {
  source: DownloadSource;
  sourceId: number;
  fileId: number;
  fileName: string;
  targetCodec: 'aac';
  targetContainer: 'm4a';
  targetBitrate: number;
  targetSampleRate: number;
}

export interface TranscodeResult {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transcodedUrl: string | null;
  error: string | null;
}

export interface CategoryOverride {
  itemId: string;
  originalCategory: MediaCategory;
  overrideCategory: MediaCategory;
  updatedAt: string;
}

export type TorBoxRuleConditionField =
  | 'progress'
  | 'eta'
  | 'current_download_speed'
  | 'average_download_speed'
  | 'download_stalled_time'
  | 'upload_stalled_time'
  | 'seeding_ratio'
  | 'peers'
  | 'age'
  | 'tracker'
  | 'availability'
  | 'status'
  | 'download_type'
  | 'name_contains'
  | 'size';

export type TorBoxRuleOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'contains';

export type TorBoxRuleAction =
  | 'delete_download'
  | 'pause_download'
  | 'resume_download'
  | 'reannounce_torrent'
  | 'request_download_link'
  | 'create_stream'
  | 'notify_user';

export interface TorBoxRuleCondition {
  field: TorBoxRuleConditionField;
  operator: TorBoxRuleOperator;
  value: string;
}

export type TorBoxRuleScope = 'all' | 'torrent' | 'usenet' | 'web';

export interface TorBoxRule {
  id: string;
  name: string;
  enabled: boolean;
  checkIntervalMinutes: number;
  conditions: TorBoxRuleCondition[];
  action: TorBoxRuleAction;
  actionValue?: string;
  scope?: TorBoxRuleScope;
  isDangerous?: boolean;
  isCustom?: boolean;
  lastRunAt: string | null;
  lastResult: string | null;
  runCount: number;
  createdAt: string;
}

export type TorBoxRulePresetId =
  | 'pause_stalled_downloads'
  | 'resume_when_progress_seen'
  | 'reannounce_stalled_torrents'
  | 'completed_notify'
  | 'completed_get_link'
  | 'stream_ready_media'
  | 'delete_very_old_completed'
  | 'auto_delete_old_failed'
  | 'notify_errors'
  | 'pause_high_eta_downloads'
  | 'resume_stalled_items'
  | 'notify_slow_downloads'
  | 'generate_links_for_cached'
  | 'stream_ready_cached'
  | 'notify_torrent_tracker_issues';

export interface TorBoxRulePreset {
  id: TorBoxRulePresetId;
  name: string;
  description: string;
  checkIntervalMinutes: number;
  conditions: TorBoxRuleCondition[];
  action: TorBoxRuleAction;
  actionValue?: string;
  scope?: TorBoxRuleScope;
  isDangerous?: boolean;
  category: 'transfer' | 'completion' | 'playback' | 'maintenance';
}
