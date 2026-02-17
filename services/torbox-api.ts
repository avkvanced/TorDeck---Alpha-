import { Platform } from 'react-native';
import {
  TorBoxApiResponse,
  TorBoxItem,
  TorBoxUsenetItem,
  TorBoxWebItem,
  TorBoxUser,
  TorBoxNotification,
} from '@/types/torbox';

const DIRECT_BASE_URL = 'https://api.torbox.app/v1/api';
const PROXY_BASE_URL = '/api/torbox';
const BASE_URL = Platform.OS === 'web' ? PROXY_BASE_URL : DIRECT_BASE_URL;
const LINK_CACHE_TTL_MS = 3 * 60 * 60 * 1000;

interface CachedLink {
  url: string;
  cachedAt: number;
}


interface DownloadLinkOptions {
  zipLink?: boolean;
  torrentFile?: boolean;
}


interface RawTorBoxNotification extends Record<string, unknown> {
  id?: string | number;
  title?: string;
  message?: string;
  body?: string;
  detail?: string;
  created_at?: string;
  date?: string;
  timestamp?: string;
  read?: boolean;
}

class TorBoxAPI {
  private token: string = '';
  private linkCache = new Map<string, CachedLink>();
  private backoffMs: number = 0;
  private lastErrorTime: number = 0;

  setToken(token: string) {
    this.token = token;
    console.log('[TorBoxAPI] Token set');
  }

  getToken(): string {
    return this.token;
  }

  private applyJitter(ms: number): number {
    const jitter = ms * 0.2 * (Math.random() * 2 - 1);
    return Math.max(0, ms + jitter);
  }

  private async maybeWaitBackoff(): Promise<void> {
    if (this.backoffMs > 0) {
      const wait = this.applyJitter(this.backoffMs);
      console.log(`[TorBoxAPI] Backoff: waiting ${Math.round(wait)}ms`);
      await new Promise(r => setTimeout(r, wait));
    }
  }

  private handleRateOrServerError(status: number): void {
    if (status === 429 || status >= 500) {
      this.backoffMs = this.backoffMs === 0 ? 2000 : Math.min(this.backoffMs * 2, 60000);
      this.lastErrorTime = Date.now();
      console.warn(`[TorBoxAPI] Rate/server error ${status}, backoff now ${this.backoffMs}ms`);
    } else {
      if (Date.now() - this.lastErrorTime > 30000) {
        this.backoffMs = 0;
      }
    }
  }

  private getNumberFromUnknown(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  private pickNumericField(source: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
      const value = this.getNumberFromUnknown(source[key]);
      if (value !== null) return value;
    }
    return null;
  }

  private pickNumericFieldFromSources(
    sources: Array<Record<string, unknown> | null | undefined>,
    keys: string[]
  ): number | null {
    for (const source of sources) {
      if (!source) continue;
      const value = this.pickNumericField(source, keys);
      if (value !== null) return value;
    }
    return null;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    await this.maybeWaitBackoff();
    const url = `${BASE_URL}${endpoint}`;
    console.log(`[TorBoxAPI] ${options?.method || 'GET'} ${url}`);

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });
    } catch (err) {
      console.error(`[TorBoxAPI] Network error for ${url}:`, err);
      const isWeb = Platform.OS === 'web';
      throw new Error(
        isWeb
          ? 'Network request failed. The API proxy may not be configured. Ensure the app is deployed with the Netlify edge function proxy.'
          : 'Network request failed. Please check your internet connection and try again.'
      );
    }

    this.handleRateOrServerError(response.status);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[TorBoxAPI] Error ${response.status}: ${errorText}`);
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid API token. Please check your token and try again.');
      }
      throw new Error(`TorBox API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data as T;
  }

  private async requestFormData<T>(endpoint: string, formData: FormData): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`[TorBoxAPI] POST (FormData) ${url}`);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
        body: formData,
      });
    } catch (err) {
      console.error(`[TorBoxAPI] Network error for ${url}:`, err);
      const isWeb = Platform.OS === 'web';
      throw new Error(
        isWeb
          ? 'Network request failed. The API proxy may not be configured. Ensure the app is deployed with the Netlify edge function proxy.'
          : 'Network request failed. Please check your internet connection.'
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[TorBoxAPI] Error ${response.status}: ${errorText}`);
      throw new Error(`TorBox API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data as T;
  }

  async getUser(): Promise<TorBoxUser> {
    const res = await this.request<TorBoxApiResponse<TorBoxUser & Record<string, unknown>>>('/user/me');
    if (!res.success) throw new Error(res.detail || 'Failed to get user');

    const rawUser = res.data;
    const nestedStats = (rawUser.stats as Record<string, unknown> | undefined) ?? null;
    const nestedUsage = (rawUser.usage as Record<string, unknown> | undefined) ?? null;
    const nestedLimits = (rawUser.limits as Record<string, unknown> | undefined) ?? null;
    const sources = [rawUser, nestedStats, nestedUsage, nestedLimits];

    const totalDownloadedBytes = this.pickNumericFieldFromSources(sources, [
      'total_downloaded_bytes',
      'total_downloaded_lifetime_bytes',
      'lifetime_downloaded_bytes',
      'all_time_downloaded_bytes',
      'downloaded_total_bytes',
      'total_downloaded',
      'downloaded_bytes',
      'downloaded',
    ]) ?? 0;
    const monthlyDownloadedBytes = this.pickNumericFieldFromSources(sources, [
      'monthly_downloaded_bytes',
      'month_downloaded_bytes',
      'downloaded_this_month_bytes',
      'current_period_downloaded_bytes',
      'current_cycle_downloaded',
      'monthly_downloaded',
      'current_cycle_downloaded_bytes',
    ]);
    const monthlyDataCapBytes = this.pickNumericFieldFromSources(sources, [
      'monthly_data_cap_bytes',
      'monthly_cap_bytes',
      'monthly_limit_bytes',
      'current_cycle_cap_bytes',
      'bandwidth_cap_bytes',
      'data_cap_bytes',
      'download_limit_bytes',
    ]);

    return {
      ...rawUser,
      total_downloaded: totalDownloadedBytes,
      total_downloaded_bytes: totalDownloadedBytes,
      monthly_downloaded_bytes: monthlyDownloadedBytes ?? undefined,
      monthly_data_cap_bytes: monthlyDataCapBytes ?? undefined,
      download_limit_bytes: monthlyDataCapBytes ?? undefined,
    };
  }

  async getTorrents(): Promise<TorBoxItem[]> {
    const res = await this.request<TorBoxApiResponse<TorBoxItem[]>>('/torrents/mylist?bypass_cache=true');
    if (!res.success) throw new Error(res.detail || 'Failed to get torrents');
    return res.data || [];
  }

  async getUsenet(): Promise<TorBoxUsenetItem[]> {
    const res = await this.request<TorBoxApiResponse<TorBoxUsenetItem[]>>('/usenet/mylist?bypass_cache=true');
    if (!res.success) throw new Error(res.detail || 'Failed to get usenet');
    return res.data || [];
  }

  async getWebDownloads(): Promise<TorBoxWebItem[]> {
    const res = await this.request<TorBoxApiResponse<TorBoxWebItem[]>>('/webdl/mylist?bypass_cache=true');
    if (!res.success) throw new Error(res.detail || 'Failed to get web downloads');
    return res.data || [];
  }

  async requestTorrentDownloadLink(torrentId: number, fileId: number, options?: DownloadLinkOptions): Promise<string> {
    const zipLink = options?.zipLink ?? false;
    const torrentFile = options?.torrentFile ?? false;
    const res = await this.request<TorBoxApiResponse<string>>(
      `/torrents/requestdl?token=${this.token}&torrent_id=${torrentId}&file_id=${fileId}&zip_link=${String(zipLink)}&torrent_file=${String(torrentFile)}`
    );
    if (!res.success) throw new Error(res.detail || 'Failed to get download link');
    return res.data;
  }

  async requestUsenetDownloadLink(usenetId: number, fileId: number, options?: DownloadLinkOptions): Promise<string> {
    const zipLink = options?.zipLink ?? false;
    const res = await this.request<TorBoxApiResponse<string>>(
      `/usenet/requestdl?token=${this.token}&usenet_id=${usenetId}&file_id=${fileId}&zip_link=${String(zipLink)}`
    );
    if (!res.success) throw new Error(res.detail || 'Failed to get download link');
    return res.data;
  }

  async requestWebDownloadLink(webId: number, fileId: number, options?: DownloadLinkOptions): Promise<string> {
    const zipLink = options?.zipLink ?? false;
    const res = await this.request<TorBoxApiResponse<string>>(
      // TorBox expects `webdownload_id` for web download resources.
      // Keep `web_id` for backwards compatibility with older API behavior.
      `/webdl/requestdl?token=${this.token}&webdownload_id=${webId}&web_id=${webId}&file_id=${fileId}&zip_link=${String(zipLink)}`
    );
    if (!res.success) throw new Error(res.detail || 'Failed to get download link');
    return res.data;
  }

  async getDownloadLink(source: string, sourceId: number, fileId: number, options?: DownloadLinkOptions): Promise<string> {
    const zipLink = options?.zipLink ?? false;
    const torrentFile = options?.torrentFile ?? false;
    const cacheKey = `${source}-${sourceId}-${fileId}-zip:${String(zipLink)}-torrent:${String(torrentFile)}`;
    const cached = this.linkCache.get(cacheKey);
    if (cached && (Date.now() - cached.cachedAt) < LINK_CACHE_TTL_MS) {
      console.log('[TorBoxAPI] Using cached download link for', cacheKey);
      return cached.url;
    }

    let url: string;
    switch (source) {
      case 'torrent':
        url = await this.requestTorrentDownloadLink(sourceId, fileId, { zipLink, torrentFile });
        break;
      case 'usenet':
        url = await this.requestUsenetDownloadLink(sourceId, fileId, { zipLink });
        break;
      case 'web':
        url = await this.requestWebDownloadLink(sourceId, fileId, { zipLink });
        break;
      default:
        throw new Error(`Unknown source: ${source}`);
    }

    this.linkCache.set(cacheKey, { url, cachedAt: Date.now() });
    return url;
  }

  async getDownloadArchiveLink(source: string, sourceId: number, fileId: number): Promise<string> {
    return this.getDownloadLink(source, sourceId, fileId, { zipLink: true });
  }

  invalidateLinkCache(source: string, sourceId: number, fileId: number, options?: DownloadLinkOptions): void {
    const zipLink = options?.zipLink ?? false;
    const torrentFile = options?.torrentFile ?? false;
    const cacheKey = `${source}-${sourceId}-${fileId}-zip:${String(zipLink)}-torrent:${String(torrentFile)}`;
    this.linkCache.delete(cacheKey);
    console.log('[TorBoxAPI] Invalidated cached link for', cacheKey);
  }

  clearLinkCache(): void {
    this.linkCache.clear();
    console.log('[TorBoxAPI] Cleared all cached links');
  }

  async addTorrentMagnet(magnet: string): Promise<void> {
    console.log('[TorBoxAPI] Adding torrent magnet');
    const formData = new FormData();
    formData.append('magnet', magnet);
    formData.append('seed', '1');
    const res = await this.requestFormData<TorBoxApiResponse<unknown>>('/torrents/createtorrent', formData);
    if (!res.success) throw new Error(res.detail || 'Failed to add torrent');
    console.log('[TorBoxAPI] Torrent magnet added successfully');
  }

  async addTorrentHash(hash: string): Promise<void> {
    console.log('[TorBoxAPI] Adding torrent by hash');
    const magnetLink = `magnet:?xt=urn:btih:${hash}`;
    await this.addTorrentMagnet(magnetLink);
  }

  async addWebDownload(url: string): Promise<void> {
    console.log('[TorBoxAPI] Adding web download');
    const formData = new FormData();
    formData.append('link', url);
    const res = await this.requestFormData<TorBoxApiResponse<unknown>>('/webdl/createwebdownload', formData);
    if (!res.success) throw new Error(res.detail || 'Failed to add web download');
    console.log('[TorBoxAPI] Web download added successfully');
  }

  async addUsenetNzb(nzbUrl: string): Promise<void> {
    console.log('[TorBoxAPI] Adding usenet NZB by link');
    const formData = new FormData();
    formData.append('link', nzbUrl);
    const res = await this.requestFormData<TorBoxApiResponse<unknown>>('/usenet/createusenetdownload', formData);
    if (!res.success) throw new Error(res.detail || 'Failed to add usenet download');
    console.log('[TorBoxAPI] Usenet NZB added successfully');
  }

  private async controlWebDownloadRequest(webId: number, operation: 'pause' | 'resume' | 'delete'): Promise<void> {
    const res = await this.request<TorBoxApiResponse<unknown>>('/webdl/controlwebdownload', {
      method: 'POST',
      body: JSON.stringify({
        operation,
        webdl_id: webId,
      }),
    });

    if (!res.success) throw new Error(res.detail || `Failed to ${operation} web download`);
  }

  async deleteTorrent(torrentId: number): Promise<void> {
    console.log('[TorBoxAPI] Deleting torrent:', torrentId);
    const res = await this.request<TorBoxApiResponse<unknown>>(
      `/torrents/controltorrent`,
      {
        method: 'POST',
        body: JSON.stringify({
          torrent_id: torrentId,
          operation: 'delete',
        }),
      }
    );
    if (!res.success) throw new Error(res.detail || 'Failed to delete torrent');
    console.log('[TorBoxAPI] Torrent deleted');
  }

  async deleteUsenet(usenetId: number): Promise<void> {
    console.log('[TorBoxAPI] Deleting usenet:', usenetId);
    const res = await this.request<TorBoxApiResponse<unknown>>(
      `/usenet/controlusenetdownload`,
      {
        method: 'POST',
        body: JSON.stringify({
          usenet_id: usenetId,
          operation: 'delete',
        }),
      }
    );
    if (!res.success) throw new Error(res.detail || 'Failed to delete usenet item');
    console.log('[TorBoxAPI] Usenet item deleted');
  }

  async deleteWebDownload(webId: number): Promise<void> {
    console.log('[TorBoxAPI] Deleting web download:', webId);
    await this.controlWebDownloadRequest(webId, 'delete');
    console.log('[TorBoxAPI] Web download deleted');
  }

  async deleteItem(source: string, sourceId: number): Promise<void> {
    switch (source) {
      case 'torrent':
        return this.deleteTorrent(sourceId);
      case 'usenet':
        return this.deleteUsenet(sourceId);
      case 'web':
        return this.deleteWebDownload(sourceId);
      default:
        throw new Error(`Unknown source: ${source}`);
    }
  }

  async controlTorrent(torrentId: number, operation: 'pause' | 'resume' | 'delete' | 'reannounce'): Promise<void> {
    console.log(`[TorBoxAPI] Control torrent ${torrentId}: ${operation}`);
    const res = await this.request<TorBoxApiResponse<unknown>>(
      `/torrents/controltorrent`,
      {
        method: 'POST',
        body: JSON.stringify({ torrent_id: torrentId, operation }),
      }
    );
    if (!res.success) throw new Error(res.detail || `Failed to ${operation} torrent`);
    console.log(`[TorBoxAPI] Torrent ${operation} success`);
  }

  async controlUsenet(usenetId: number, operation: 'pause' | 'resume' | 'delete'): Promise<void> {
    console.log(`[TorBoxAPI] Control usenet ${usenetId}: ${operation}`);
    const res = await this.request<TorBoxApiResponse<unknown>>(
      `/usenet/controlusenetdownload`,
      {
        method: 'POST',
        body: JSON.stringify({ usenet_id: usenetId, operation }),
      }
    );
    if (!res.success) throw new Error(res.detail || `Failed to ${operation} usenet`);
    console.log(`[TorBoxAPI] Usenet ${operation} success`);
  }

  async controlWebDownload(webId: number, operation: 'pause' | 'resume' | 'delete'): Promise<void> {
    console.log(`[TorBoxAPI] Control web download ${webId}: ${operation}`);
    await this.controlWebDownloadRequest(webId, operation);
    console.log(`[TorBoxAPI] Web download ${operation} success`);
  }


  private normalizeNotification(raw: RawTorBoxNotification, index: number): TorBoxNotification {
    const id = raw.id !== undefined && raw.id !== null
      ? String(raw.id)
      : `${raw.created_at ?? raw.timestamp ?? raw.date ?? Date.now()}-${index}`;

    const title = typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim()
      : 'Notification';

    const messageCandidate = [raw.message, raw.body, raw.detail].find(
      value => typeof value === 'string' && value.trim().length > 0
    );

    const message = typeof messageCandidate === 'string' ? messageCandidate.trim() : '';
    const createdAtCandidate = [raw.created_at, raw.timestamp, raw.date].find(
      value => typeof value === 'string' && value.trim().length > 0
    );

    return {
      id,
      title,
      message: message || 'No additional details available.',
      createdAt: typeof createdAtCandidate === 'string' ? createdAtCandidate : new Date().toISOString(),
      read: raw.read === true,
    };
  }

  async getNotifications(): Promise<TorBoxNotification[]> {
    const endpointCandidates = ['/notifications/mylist', '/notifications', '/user/notifications'];

    for (const endpoint of endpointCandidates) {
      try {
        const res = await this.request<TorBoxApiResponse<RawTorBoxNotification[] | RawTorBoxNotification>>(endpoint);
        if (!res.success) continue;

        const payload = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
        return payload
          .map((item, index) => this.normalizeNotification(item, index))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('404')) continue;
        throw err;
      }
    }

    return [];
  }

  async getStreamLink(source: string, sourceId: number, fileId: number): Promise<string> {
    const cacheKey = `stream-${source}-${sourceId}-${fileId}`;
    const cached = this.linkCache.get(cacheKey);
    if (cached && (Date.now() - cached.cachedAt) < LINK_CACHE_TTL_MS) {
      console.log('[TorBoxAPI] Using cached stream link for', cacheKey);
      return cached.url;
    }

    let url: string;
    switch (source) {
      case 'torrent':
        url = await this.requestTorrentStreamLink(sourceId, fileId);
        break;
      case 'usenet':
        url = await this.requestUsenetStreamLink(sourceId, fileId);
        break;
      case 'web':
        url = await this.requestWebStreamLink(sourceId, fileId);
        break;
      default:
        throw new Error(`Unknown source for stream: ${source}`);
    }

    this.linkCache.set(cacheKey, { url, cachedAt: Date.now() });
    return url;
  }

  private async requestTorrentStreamLink(torrentId: number, fileId: number): Promise<string> {
    console.log('[TorBoxAPI] Requesting torrent stream link');
    const res = await this.request<TorBoxApiResponse<string>>(
      `/torrents/requestdl?token=${this.token}&torrent_id=${torrentId}&file_id=${fileId}&zip_link=false&torrent_file=false`
    );
    if (!res.success) throw new Error(res.detail || 'Failed to get torrent stream link');
    return res.data;
  }

  private async requestUsenetStreamLink(usenetId: number, fileId: number): Promise<string> {
    console.log('[TorBoxAPI] Requesting usenet stream link');
    const res = await this.request<TorBoxApiResponse<string>>(
      `/usenet/requestdl?token=${this.token}&usenet_id=${usenetId}&file_id=${fileId}&zip_link=false`
    );
    if (!res.success) throw new Error(res.detail || 'Failed to get usenet stream link');
    return res.data;
  }

  private async requestWebStreamLink(webId: number, fileId: number): Promise<string> {
    console.log('[TorBoxAPI] Requesting web stream link');
    const res = await this.request<TorBoxApiResponse<string>>(
      `/webdl/requestdl?token=${this.token}&webdownload_id=${webId}&web_id=${webId}&file_id=${fileId}&zip_link=false`
    );
    if (!res.success) throw new Error(res.detail || 'Failed to get web stream link');
    return res.data;
  }
}

export const torboxApi = new TorBoxAPI();
