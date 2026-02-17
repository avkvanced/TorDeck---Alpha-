import type { ComponentType } from 'react';
import { AlertCircle, AlertTriangle, ArrowUp, CheckCircle, Clock, Download, Pause } from 'lucide-react-native';
import Colors from '@/constants/colors';

export type NormalizedDownloadStatus = 'downloading' | 'completed' | 'stalled' | 'paused' | 'failed' | 'queued';

export function normalizeDownloadStatus(state: string): NormalizedDownloadStatus {
  const s = state.toLowerCase();

  if (s === 'completed' || s === 'cached' || s === 'uploading' || s === 'seeding' || s === 'stalledup') {
    return 'completed';
  }
  if (s === 'stalled' || s === 'stalleddl' || s.includes('stall')) {
    return 'stalled';
  }
  if (s === 'paused' || s === 'pauseddl' || s === 'pausedup') {
    return 'paused';
  }
  if (s === 'error' || s === 'failed' || s.includes('fail') || s.includes('error')) {
    return 'failed';
  }
  if (s === 'queued' || s.includes('queue')) {
    return 'queued';
  }
  return 'downloading';
}

export function getDownloadStatusInfo(downloadState: string, downloadFinished: boolean): {
  label: string;
  color: string;
  icon: ComponentType<{ size: number; color: string }>;
} {
  if (downloadFinished) {
    return { label: 'Completed', color: Colors.statusComplete, icon: CheckCircle };
  }

  const s = downloadState.toLowerCase();

  if (s === 'error' || s === 'failed') {
    return { label: 'Failed', color: Colors.danger, icon: AlertCircle };
  }
  if (s === 'stalled' || s === 'stalleddl' || s.includes('stall')) {
    return { label: 'Stalled', color: Colors.secondary, icon: AlertTriangle };
  }
  if (s === 'paused' || s === 'pauseddl' || s === 'pausedup') {
    return { label: 'Paused', color: Colors.textTertiary, icon: Pause };
  }
  if (s === 'uploading' || s === 'stalledup' || s === 'seeding') {
    return { label: 'Seeding', color: '#8B5CF6', icon: ArrowUp };
  }
  if (s === 'metadl' || s === 'metadata' || s.includes('meta')) {
    return { label: 'Fetching Metadata', color: Colors.accent, icon: Clock };
  }
  if (s === 'checkingresumedata' || s.includes('check')) {
    return { label: 'Checking', color: Colors.accent, icon: Clock };
  }
  if (s === 'queued' || s.includes('queue')) {
    return { label: 'Queued', color: Colors.textSecondary, icon: Clock };
  }

  return { label: 'Downloading', color: Colors.primary, icon: Download };
}
