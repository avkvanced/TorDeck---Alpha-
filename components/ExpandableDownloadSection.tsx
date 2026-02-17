import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import {
  ChevronDown,
  Download,
  ArrowUp,
  Zap,
  AlertCircle,
  ArrowDown,
  Trash2,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { ActiveDownload } from '@/types/torbox';
import { formatBytes, formatSpeed, formatEta, formatProgress } from '@/utils/formatters';
import { getDownloadStatusInfo } from '@/utils/downloadStatus';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ExpandableDownloadSectionProps {
  downloads: ActiveDownload[];
  onViewAll: () => void;
  onCancelDownload: (item: ActiveDownload) => void;
}

function ExpandableDownloadItem({ item, onCancelDownload }: { item: ActiveDownload; onCancelDownload: (item: ActiveDownload) => void }) {
  const [expanded, setExpanded] = useState<boolean>(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const statusInfo = getDownloadStatusInfo(item.downloadState, item.downloadFinished);
  const progressPercent = Math.min(item.progress * 100, 100);

  const toggleExpand = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(rotateAnim, {
      toValue: expanded ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setExpanded(!expanded);
  }, [expanded, rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const sourceColor = getSourceColor(item.source);
  const StatusIcon = statusInfo.icon;

  return (
    <View style={styles.dlItem}>
      <TouchableOpacity
        style={styles.dlItemHeader}
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        <View style={[styles.dlSourceDot, { backgroundColor: sourceColor }]} />
        <View style={styles.dlItemHeaderInfo}>
          <Text style={styles.dlItemName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.dlItemStatusRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '18' }]}>
              <StatusIcon size={10} color={statusInfo.color} />
              <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
          </View>
          <View style={styles.dlItemProgressRow}>
            <View style={styles.dlItemProgressBar}>
              <View
                style={[
                  styles.dlItemProgressFill,
                  { width: `${progressPercent}%`, backgroundColor: statusInfo.color },
                ]}
              />
            </View>
            <Text style={[styles.dlItemProgressText, { color: statusInfo.color }]}>
              {formatProgress(item.progress)}
            </Text>
          </View>
          {!item.downloadFinished && (
            <View style={styles.dlInlineStatsRow}>
              {item.downloadSpeed > 0 && (
                <Text style={styles.dlInlineStatText}>↓ {formatSpeed(item.downloadSpeed)}</Text>
              )}
              {item.eta > 0 && (
                <Text style={styles.dlInlineStatText}>ETA {formatEta(item.eta)}</Text>
              )}
              {(item.seeds ?? 0) > 0 && (
                <Text style={styles.dlInlineStatText}>{item.seeds}s / {item.peers ?? 0}p</Text>
              )}
            </View>
          )}
          {!item.downloadFinished && (
            <Text style={[styles.dlDataText, { color: statusInfo.color }]}>
              {formatBytes(item.size * item.progress)} / {formatBytes(item.size)}
            </Text>
          )}
        </View>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <ChevronDown size={18} color={Colors.textTertiary} />
        </Animated.View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.dlItemExpanded}>
          <View style={styles.dlExpandedRow}>
            <View style={styles.dlExpandedCol}>
              <Text style={styles.dlExpandedLabel}>Size</Text>
              <Text style={styles.dlExpandedValue}>{formatBytes(item.size)}</Text>
            </View>
            <View style={styles.dlExpandedCol}>
              <Text style={styles.dlExpandedLabel}>Source</Text>
              <View style={[styles.dlExpandedSourceBadge, { backgroundColor: sourceColor + '20' }]}>
                <Text style={[styles.dlExpandedSourceText, { color: sourceColor }]}>
                  {item.source.toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={styles.dlExpandedCol}>
              <Text style={styles.dlExpandedLabel}>Files</Text>
              <Text style={styles.dlExpandedValue}>{item.filesCount}</Text>
            </View>
          </View>

          <View style={styles.dlExpandedRow}>
            <View style={styles.dlExpandedCol}>
              <Text style={styles.dlExpandedLabel}>Status</Text>
              <View style={[styles.statusBadgeLarge, { backgroundColor: statusInfo.color + '15' }]}>
                <StatusIcon size={12} color={statusInfo.color} />
                <Text style={[styles.statusBadgeLargeText, { color: statusInfo.color }]}>
                  {statusInfo.label}
                </Text>
              </View>
            </View>
            <View style={styles.dlExpandedCol}>
              <Text style={styles.dlExpandedLabel}>State</Text>
              <Text style={styles.dlExpandedValue}>{item.downloadState || '—'}</Text>
            </View>
          </View>

          <View style={styles.dlExpandedStatsRow}>
            {statusInfo.label === 'Failed' ? (
              <View style={styles.dlExpandedStat}>
                <AlertCircle size={13} color={Colors.danger} />
                <Text style={[styles.dlExpandedStatText, { color: Colors.danger }]}>
                  Download Failed
                </Text>
              </View>
            ) : (
              <>
                {item.downloadSpeed > 0 && (
                  <View style={styles.dlExpandedStat}>
                    <Download size={13} color={Colors.primary} />
                    <Text style={styles.dlExpandedStatText}>{formatSpeed(item.downloadSpeed)}</Text>
                  </View>
                )}
                {item.uploadSpeed > 0 && (
                  <View style={styles.dlExpandedStat}>
                    <ArrowUp size={13} color={Colors.secondary} />
                    <Text style={styles.dlExpandedStatText}>{formatSpeed(item.uploadSpeed)}</Text>
                  </View>
                )}
                {item.seeds !== undefined && item.seeds > 0 && (
                  <View style={styles.dlExpandedStat}>
                    <Zap size={13} color={Colors.accent} />
                    <Text style={styles.dlExpandedStatText}>{item.seeds}s / {item.peers ?? 0}p</Text>
                  </View>
                )}
                {item.eta > 0 && (
                  <View style={styles.dlExpandedStat}>
                    <Text style={styles.dlExpandedEtaText}>ETA: {formatEta(item.eta)}</Text>
                  </View>
                )}
              </>
            )}
          </View>
          <View style={styles.dlExpandedProgressDetail}>
            <View style={styles.dlExpandedProgressBarLarge}>
              <View
                style={[
                  styles.dlExpandedProgressFillLarge,
                  { width: `${progressPercent}%`, backgroundColor: statusInfo.color },
                ]}
              />
            </View>
            <View style={styles.dlExpandedProgressLabels}>
              <Text style={styles.dlExpandedProgressLabel}>
                {formatBytes(item.size * item.progress)} / {formatBytes(item.size)}
              </Text>
              <Text style={[styles.dlExpandedProgressPct, { color: statusInfo.color }]}>
                {progressPercent.toFixed(1)}%
              </Text>
            </View>
          </View>

          {!item.downloadFinished && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => onCancelDownload(item)}
              activeOpacity={0.7}
            >
              <Trash2 size={12} color={Colors.danger} />
              <Text style={styles.cancelBtnText}>Cancel Download</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
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

function ExpandableDownloadSectionInner({ downloads, onViewAll, onCancelDownload }: ExpandableDownloadSectionProps) {
  const [sectionExpanded, setSectionExpanded] = useState<boolean>(true);
  const sectionRotate = useRef(new Animated.Value(1)).current;

  const toggleSection = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(sectionRotate, {
      toValue: sectionExpanded ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setSectionExpanded(!sectionExpanded);
  }, [sectionExpanded, sectionRotate]);

  const rotate = sectionRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  if (downloads.length === 0) return null;

  const failedCount = downloads.filter(d => {
    const s = d.downloadState.toLowerCase();
    return s === 'error' || s === 'failed';
  }).length;

  const stalledCount = downloads.filter(d => {
    const s = d.downloadState.toLowerCase();
    return s.includes('stall');
  }).length;

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={toggleSection}
        activeOpacity={0.7}
      >
        <View style={styles.sectionHeaderLeft}>
          <View style={styles.sectionIconWrap}>
            <ArrowDown size={14} color={Colors.primary} />
          </View>
          <Text style={styles.sectionTitle}>
            Downloads
          </Text>
          <View style={styles.sectionCountBadge}>
            <Text style={styles.sectionCountText}>{downloads.length}</Text>
          </View>
          {failedCount > 0 && (
            <View style={[styles.sectionCountBadge, { backgroundColor: Colors.danger + '25' }]}>
              <Text style={[styles.sectionCountText, { color: Colors.danger }]}>{failedCount} failed</Text>
            </View>
          )}
          {stalledCount > 0 && (
            <View style={[styles.sectionCountBadge, { backgroundColor: Colors.secondary + '25' }]}>
              <Text style={[styles.sectionCountText, { color: Colors.secondary }]}>{stalledCount} stalled</Text>
            </View>
          )}
        </View>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <ChevronDown size={18} color={Colors.textTertiary} />
        </Animated.View>
      </TouchableOpacity>

      {sectionExpanded && (
        <View style={styles.sectionContent}>
          {downloads.slice(0, 8).map((dl) => (
            <ExpandableDownloadItem
              key={`${dl.source}-${dl.id}`}
              item={dl}
              onCancelDownload={onCancelDownload}
            />
          ))}
          {downloads.length > 8 && (
            <TouchableOpacity style={styles.viewAllBtn} onPress={onViewAll}>
              <Text style={styles.viewAllText}>
                View all {downloads.length} downloads
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

export default React.memo(ExpandableDownloadSectionInner);

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  sectionCountBadge: {
    backgroundColor: Colors.primary + '25',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionCountText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  sectionContent: {
    gap: 0,
  },
  dlItem: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
    overflow: 'hidden',
  },
  dlItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  dlSourceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dlItemHeaderInfo: {
    flex: 1,
  },
  dlItemName: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  dlItemStatusRow: {
    flexDirection: 'row',
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
  statusBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeLargeText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  dlItemProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dlItemProgressBar: {
    flex: 1,
    height: 7,
    backgroundColor: Colors.background,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dlItemProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  dlItemProgressText: {
    fontSize: 11,
    fontWeight: '700' as const,
    width: 34,
    textAlign: 'right' as const,
  },
  dlInlineStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  dlInlineStatText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  dlDataText: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  dlItemExpanded: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  dlExpandedRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  dlExpandedCol: {
    flex: 1,
    alignItems: 'center',
  },
  dlExpandedLabel: {
    color: Colors.textTertiary,
    fontSize: 10,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    marginBottom: 3,
  },
  dlExpandedValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  dlExpandedSourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dlExpandedSourceText: {
    fontSize: 9,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  dlExpandedStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 10,
  },
  dlExpandedStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dlExpandedStatText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  dlExpandedEtaText: {
    color: Colors.textTertiary,
    fontSize: 12,
  },
  dlExpandedProgressDetail: {
    marginTop: 2,
  },
  dlExpandedProgressBarLarge: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  dlExpandedProgressFillLarge: {
    height: 6,
    borderRadius: 3,
  },
  dlExpandedProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dlExpandedProgressLabel: {
    color: Colors.textTertiary,
    fontSize: 11,
  },
  dlExpandedProgressPct: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  cancelBtn: {
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.danger + '40',
    backgroundColor: Colors.danger + '10',
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cancelBtnText: {
    color: Colors.danger,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  viewAllBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 6,
  },
  viewAllText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
});
