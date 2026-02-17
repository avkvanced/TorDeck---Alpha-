import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronDown, ChevronRight, FolderArchive, Gauge, HardDriveDownload, Timer } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { formatBytes, formatSpeed, formatEta, formatTimeAgo, formatProgress } from '@/utils/formatters';
import { getDownloadStatusInfo } from '@/utils/downloadStatus';

interface DownloadCardProps {
  id: number;
  name: string;
  size: number;
  progress: number;
  downloadSpeed: number;
  eta: number;
  downloadFinished: boolean;
  downloadState: string;
  createdAt: string;
  source: string;
  filesCount: number;
  onPress?: () => void;
  expandable?: boolean;
}

function DownloadCardInner(props: DownloadCardProps) {
  const {
    name,
    size,
    progress,
    downloadSpeed,
    eta,
    downloadFinished,
    downloadState,
    createdAt,
    filesCount,
    onPress,
    source,
    expandable = true,
  } = props;
  const [expanded, setExpanded] = useState(false);

  const statusInfo = useMemo(
    () => getDownloadStatusInfo(downloadState, downloadFinished),
    [downloadState, downloadFinished]
  );

  const isLiveTransfer = !downloadFinished;
  const StatusIcon = statusInfo.icon;

  const typeLabel = source === 'torrent'
    ? 'Torrent'
    : source === 'usenet'
      ? 'Usenet'
      : source === 'web'
        ? 'Web'
        : source;

  const downloadedAmount = Math.max(0, Math.min(size, Math.round(size * progress)));
  const progressPercent = Math.max(0, Math.min(progress * 100, 100));
  const speedText = downloadFinished
    ? 'Done'
    : downloadSpeed > 0
      ? formatSpeed(downloadSpeed)
      : '—';
  const remainingText = downloadFinished ? 'Complete' : formatEta(eta);

  const handlePress = () => {
    if (expandable) {
      setExpanded((prev) => !prev);
      return;
    }
    onPress?.();
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
      testID={`download-${props.id}`}
    >
      <View style={styles.header}>
        <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
        <Text style={styles.name} numberOfLines={expanded ? 3 : 2}>{name}</Text>
        {expandable ? (
          <ChevronDown
            size={16}
            color={Colors.textTertiary}
            style={[styles.chevron, expanded && styles.chevronExpanded]}
          />
        ) : (
          <ChevronRight
            size={16}
            color={Colors.textTertiary}
            style={styles.chevron}
          />
        )}
      </View>

      <View style={styles.metaRow}>
        <StatusIcon size={14} color={statusInfo.color} />
        <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
        <Text style={styles.sep}>·</Text>
        <Text style={styles.meta}>{formatBytes(size)}</Text>
        <Text style={styles.sep}>·</Text>
        <Text style={styles.meta}>{filesCount} files</Text>
      </View>

      {isLiveTransfer && (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: statusInfo.color }]} />
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>{formatBytes(downloadedAmount)} / {formatBytes(size)}</Text>
            <Text style={[styles.progressPct, { color: statusInfo.color }]}>{formatProgress(progress)}</Text>
          </View>
        </View>
      )}

      <View style={styles.metricRow}>
        <View style={styles.metricChip}>
          <Gauge size={12} color={Colors.primary} />
          <Text style={styles.metricText}>{speedText}</Text>
        </View>
        <View style={styles.metricChip}>
          <Timer size={12} color={Colors.textSecondary} />
          <Text style={styles.metricText}>{remainingText}</Text>
        </View>
        <View style={styles.metricChip}>
          <HardDriveDownload size={12} color={Colors.textSecondary} />
          <Text style={styles.metricText}>{filesCount} files</Text>
        </View>
        <View style={styles.metricChip}>
          <FolderArchive size={12} color={Colors.textSecondary} />
          <Text style={styles.metricText}>{typeLabel}</Text>
        </View>
      </View>

      {expandable && expanded && (
        <View style={styles.expandedBlock}>
          <Text style={styles.expandedLabel}>Raw state: <Text style={styles.expandedValue}>{downloadState || '—'}</Text></Text>
          <Text style={styles.expandedLabel}>Created: <Text style={styles.expandedValue}>{new Date(createdAt).toLocaleString()}</Text></Text>
        </View>
      )}

      <Text style={styles.date}>{formatTimeAgo(createdAt)}</Text>
    </TouchableOpacity>
  );
}

export default React.memo(DownloadCardInner);

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    marginRight: 10,
  },
  name: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  chevron: {
    marginLeft: 10,
    marginTop: 2,
  },
  chevronExpanded: {
    transform: [{ rotate: '180deg' }],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  sep: {
    color: Colors.textTertiary,
    fontSize: 12,
  },
  meta: {
    color: Colors.textTertiary,
    fontSize: 12,
  },
  progressWrap: {
    marginTop: 8,
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },
  progressLabel: {
    color: Colors.textTertiary,
    fontSize: 11,
  },
  progressPct: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metricText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  expandedBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 4,
  },
  expandedLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
  },
  expandedValue: {
    color: Colors.text,
    fontWeight: '600' as const,
  },
  date: {
    color: Colors.textTertiary,
    fontSize: 11,
    marginTop: 6,
  },
});
