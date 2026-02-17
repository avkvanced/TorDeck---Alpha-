import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Download,
  ArrowUp,
  Zap,
  AlertCircle,
  Pause,
  Clock,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { ActiveDownload } from '@/types/torbox';
import { formatBytes, formatSpeed, formatEta, formatProgress } from '@/utils/formatters';

interface ActiveDownloadCardProps {
  item: ActiveDownload;
}

function getDownloadStatusInfo(state: string): { label: string; color: string; icon: React.ComponentType<{ size: number; color: string }> } {
  const s = state.toLowerCase();
  if (s === 'error' || s === 'failed') {
    return { label: 'Failed', color: Colors.danger, icon: AlertCircle };
  }
  if (s === 'stalled' || s.includes('stall')) {
    return { label: 'Stalled', color: Colors.secondary, icon: AlertTriangle };
  }
  if (s === 'paused' || s.includes('pause')) {
    return { label: 'Paused', color: Colors.textTertiary, icon: Pause };
  }
  if (s === 'uploading' || s === 'seeding') {
    return { label: 'Seeding', color: '#8B5CF6', icon: ArrowUp };
  }
  if (s.includes('meta') || s.includes('check')) {
    return { label: 'Preparing', color: Colors.accent, icon: Clock };
  }
  if (s === 'cached' || s === 'completed') {
    return { label: 'Completed', color: Colors.statusComplete, icon: CheckCircle };
  }
  if (s === 'downloading' || s === 'queued') {
    return { label: 'Downloading', color: Colors.primary, icon: Download };
  }
  return { label: state || 'Unknown', color: Colors.textTertiary, icon: Clock };
}

function ActiveDownloadCardInner({ item }: ActiveDownloadCardProps) {
  const statusInfo = getDownloadStatusInfo(item.downloadState);
  const progressPercent = Math.min(item.progress * 100, 100);
  const StatusIcon = statusInfo.icon;

  return (
    <View style={[styles.container, { borderLeftColor: statusInfo.color }]}>
      <View style={styles.header}>
        <View style={[styles.sourceBadge, { backgroundColor: getSourceColor(item.source) + '20' }]}>
          <Text style={[styles.sourceText, { color: getSourceColor(item.source) }]}>
            {item.source.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '18' }]}>
          <StatusIcon size={10} color={statusInfo.color} />
          <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </View>
        {item.downloadState && item.downloadState !== statusInfo.label.toLowerCase() && (
          <Text style={styles.rawState}>{item.downloadState}</Text>
        )}
      </View>

      <View style={styles.progressRow}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${progressPercent}%`, backgroundColor: statusInfo.color },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: statusInfo.color }]}>
          {formatProgress(item.progress)}
        </Text>
      </View>

      <View style={styles.statsRow}>
        {statusInfo.label === 'Failed' ? (
          <View style={styles.statItem}>
            <AlertCircle size={12} color={Colors.danger} />
            <Text style={[styles.statText, { color: Colors.danger }]}>Download Failed</Text>
          </View>
        ) : (
          <>
            {item.downloadSpeed > 0 && (
              <View style={styles.statItem}>
                <Download size={12} color={Colors.primary} />
                <Text style={styles.statText}>{formatSpeed(item.downloadSpeed)}</Text>
              </View>
            )}
            {item.uploadSpeed > 0 && (
              <View style={styles.statItem}>
                <ArrowUp size={12} color={Colors.secondary} />
                <Text style={styles.statText}>{formatSpeed(item.uploadSpeed)}</Text>
              </View>
            )}
            {item.seeds !== undefined && item.seeds > 0 && (
              <View style={styles.statItem}>
                <Zap size={12} color={Colors.accent} />
                <Text style={styles.statText}>{item.seeds}s / {item.peers ?? 0}p</Text>
              </View>
            )}
            {item.eta > 0 && (
              <Text style={styles.etaText}>ETA: {formatEta(item.eta)}</Text>
            )}
          </>
        )}
        <Text style={styles.sizeText}>{formatBytes(item.size)}</Text>
      </View>
    </View>
  );
}

function getSourceColor(source: string): string {
  switch (source) {
    case 'torrent': return Colors.primary;
    case 'usenet': return Colors.secondary;
    case 'web': return Colors.accent;
    default: return Colors.textTertiary;
  }
}

export default React.memo(ActiveDownloadCardInner);

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sourceText: {
    fontSize: 9,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  name: {
    flex: 1,
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
  },
  rawState: {
    fontSize: 10,
    color: Colors.textTertiary,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700' as const,
    width: 34,
    textAlign: 'right' as const,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  etaText: {
    color: Colors.textTertiary,
    fontSize: 11,
  },
  sizeText: {
    color: Colors.textTertiary,
    fontSize: 11,
    marginLeft: 'auto',
  },
});
