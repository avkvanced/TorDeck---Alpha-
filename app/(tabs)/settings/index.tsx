import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from 'react-native';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  LogOut,
  User,
  Shield,
  Info,
  Crown,
  Library,
  Download,
  BarChart3,
  Settings,
  Check,
  Zap,
  ExternalLink,
  Heart,
  Mail,
  Calendar,
  HardDrive,
  Gift,
  RefreshCw,
} from 'lucide-react-native';
import * as Linking from 'expo-linking';
import Colors from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { DEFAULT_CLASSIFICATION_CONFIG } from '@/constants/categories';
import { DefaultTab } from '@/types/torbox';
import { formatBytes } from '@/utils/formatters';

const TAB_OPTIONS: { value: DefaultTab; label: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { value: '(library)', label: 'Library', icon: Library },
  { value: 'automations', label: 'Automations', icon: Zap },
  { value: 'downloads', label: 'Downloads', icon: Download },
  { value: 'stats', label: 'Stats', icon: BarChart3 },
  { value: 'settings', label: 'Settings', icon: Settings },
];

const REFERRAL_URL = 'https://torbox.app/subscription?referral=25f7a56b-f344-4771-babc-f9b790c66483';

function getPlanName(plan: number): string {
  switch (plan) {
    case 0: return 'Free';
    case 1: return 'Essential';
    case 2: return 'Pro';
    case 3: return 'Standard';
    default: return `Plan ${plan}`;
  }
}

function getPlanColor(plan: number): string {
  switch (plan) {
    case 0: return Colors.textTertiary;
    case 1: return Colors.accent;
    case 2: return Colors.secondary;
    case 3: return '#A78BFA';
    default: return Colors.secondary;
  }
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, disconnect, isConnected, refreshUser } = useAuth();
  const downloadUsageBytes = user?.monthly_downloaded_bytes ?? user?.total_downloaded_bytes ?? user?.total_downloaded ?? 0;
  const lifetimeDownloadedBytes = user?.total_downloaded_bytes ?? user?.total_downloaded ?? 0;
  const downloadCapBytes = user?.monthly_data_cap_bytes ?? user?.download_limit_bytes;
  const downloadUsageLabel = downloadCapBytes
    ? `${formatBytes(downloadUsageBytes)} / ${formatBytes(downloadCapBytes)}`
    : formatBytes(downloadUsageBytes);
  const usagePercent = useMemo(() => {
    if (!downloadCapBytes || downloadCapBytes <= 0) return null;
    return Math.min(100, (downloadUsageBytes / downloadCapBytes) * 100);
  }, [downloadCapBytes, downloadUsageBytes]);
  const downloadUsageSubLabel = useMemo(() => {
    if (!user || user.monthly_downloaded_bytes === undefined) return null;
    return `Lifetime: ${formatBytes(lifetimeDownloadedBytes)}`;
  }, [user, lifetimeDownloadedBytes]);
  const referralLink = useMemo(() => {
    if (!user?.user_referral) return null;
    return `https://torbox.app/subscription?referral=${user.user_referral}`;
  }, [user?.user_referral]);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const { settings, updateSettings } = useSettings();
  const [config, setConfig] = useState(DEFAULT_CLASSIFICATION_CONFIG);
  const [showReferralModal, setShowReferralModal] = useState<boolean>(false);

  const handleDisconnect = useCallback(() => {
    Alert.alert(
      'Disconnect TorBox',
      'Are you sure you want to disconnect? Your library data will be cleared.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await disconnect();
            router.replace('/connect' as any);
          },
        },
      ]
    );
  }, [disconnect, router]);

  const handleTabChange = useCallback((tab: DefaultTab) => {
    updateSettings({ defaultTab: tab });
  }, [updateSettings]);

  useEffect(() => {
    if (user && !lastSyncedAt) {
      setLastSyncedAt(new Date());
    }
  }, [user, lastSyncedAt]);

  const handleRefreshUser = useCallback(async () => {
    try {
      await refreshUser();
      setLastSyncedAt(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to refresh account details.';
      Alert.alert('Refresh Failed', message);
    }
  }, [refreshUser]);

  useFocusEffect(
    useCallback(() => {
      if (!isConnected) return;
      refreshUser().catch((err) => {
        console.warn('[Settings] Failed to refresh user stats:', err);
      });
      setLastSyncedAt(new Date());
    }, [isConnected, refreshUser])
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {user && (
        <View style={styles.userCard}>
          <View style={styles.userCardTop}>
            <View style={styles.avatarLarge}>
              <User size={28} color={Colors.primary} />
            </View>
            <View style={styles.userMainInfo}>
              <Text style={styles.userName} numberOfLines={1}>{user.email}</Text>
              <View style={styles.planBadge}>
                <Crown size={12} color={getPlanColor(user.plan)} />
                <Text style={[styles.planBadgeText, { color: getPlanColor(user.plan) }]}>
                  {getPlanName(user.plan)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.userStatsRow}>
            <View style={styles.userStatItem}>
              <View style={[styles.userStatIcon, { backgroundColor: Colors.primary + '15' }]}>
                <Shield size={14} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.userStatValue}>
                  {user.is_subscribed ? 'Active' : 'Inactive'}
                </Text>
                <Text style={styles.userStatLabel}>Subscription</Text>
              </View>
            </View>
            <View style={styles.userStatDivider} />
            <View style={styles.userStatItem}>
              <View style={[styles.userStatIcon, { backgroundColor: Colors.accent + '15' }]}>
                <HardDrive size={14} color={Colors.accent} />
              </View>
              <View>
                <Text style={styles.userStatValue}>
                  {downloadUsageLabel}
                </Text>
                <Text style={styles.userStatLabel}>Download Usage</Text>
                {downloadUsageSubLabel && (
                  <Text style={styles.userStatSubLabel}>{downloadUsageSubLabel}</Text>
                )}
              </View>
            </View>
          </View>

          <View style={styles.userDetailsCard}>
            <View style={styles.detailRow}>
              <Mail size={14} color={Colors.textSecondary} />
              <Text style={styles.detailLabel}>Base Email</Text>
              <Text style={styles.detailValue} numberOfLines={1}>{user.base_email || user.email}</Text>
            </View>

            <View style={styles.detailRow}>
              <RefreshCw size={14} color={Colors.textSecondary} />
              <Text style={styles.detailLabel}>Last Sync</Text>
              <Text style={styles.detailValue}>
                {lastSyncedAt ? lastSyncedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Not synced yet'}
              </Text>
            </View>

            {user.user_referral && (
              <TouchableOpacity
                style={styles.detailRowButton}
                onPress={() => {
                  if (!referralLink) return;
                  if (Platform.OS === 'web') {
                    window.open(referralLink, '_blank', 'noopener,noreferrer');
                  } else {
                    Linking.openURL(referralLink);
                  }
                }}
                activeOpacity={0.75}
              >
                <Gift size={14} color={Colors.accent} />
                <Text style={styles.detailLabel}>Referral</Text>
                <View style={styles.detailReferralRight}>
                  <Text style={[styles.detailValue, styles.referralCode]} numberOfLines={1}>
                    {user.user_referral}
                  </Text>
                  <ExternalLink size={13} color={Colors.accent} />
                </View>
              </TouchableOpacity>
            )}
          </View>

          {usagePercent !== null && (
            <View style={styles.usageCard}>
              <View style={styles.usageHeader}>
                <HardDrive size={14} color={Colors.primary} />
                <Text style={styles.usageTitle}>Monthly Bandwidth</Text>
                <Text style={styles.usagePercent}>{Math.round(usagePercent)}%</Text>
              </View>
              <View style={styles.usageTrack}>
                <View style={[styles.usageFill, { width: `${usagePercent}%` }]} />
              </View>
              <Text style={styles.usageText}>{downloadUsageLabel}</Text>
            </View>
          )}

          {user.premium_expires_at && (
            <View style={styles.expiresRow}>
              <Calendar size={13} color={Colors.textTertiary} />
              <Text style={styles.expiresText}>
                {user.is_subscribed ? 'Renews' : 'Expires'}: {new Date(user.premium_expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Default Home Page</Text>
        <View style={styles.card}>
          {TAB_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const isSelected = settings.defaultTab === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.tabOption, isSelected && styles.tabOptionActive]}
                onPress={() => handleTabChange(opt.value)}
                testID={`default-tab-${opt.value}`}
              >
                <Icon size={18} color={isSelected ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.tabOptionLabel, isSelected && styles.tabOptionLabelActive]}>
                  {opt.label}
                </Text>
                {isSelected && (
                  <View style={styles.checkMark}>
                    <Check size={16} color={Colors.primary} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Shield size={18} color={Colors.primary} />
            <Text style={styles.rowLabel}>Status</Text>
            <View style={[styles.statusBadge, isConnected ? styles.statusConnected : styles.statusDisconnected]}>
              <Text style={[styles.statusText, isConnected ? styles.statusTextConnected : styles.statusTextDisconnected]}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Text>
            </View>
          </View>
          <View style={styles.connectionActions}>
            <TouchableOpacity
              style={styles.connectionButton}
              onPress={handleRefreshUser}
              activeOpacity={0.75}
            >
              <RefreshCw size={14} color={Colors.primary} />
              <Text style={styles.connectionButtonText}>Refresh Account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.connectionButton}
              onPress={() => {
                if (Platform.OS === 'web') {
                  window.open('https://torbox.app/', '_blank', 'noopener,noreferrer');
                } else {
                  Linking.openURL('https://torbox.app/');
                }
              }}
              activeOpacity={0.75}
            >
              <ExternalLink size={14} color={Colors.primary} />
              <Text style={styles.connectionButtonText}>Open TorBox</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Audiobook Classification</Text>
        <View style={styles.card}>
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>Min file size (MB)</Text>
            <TextInput
              style={styles.configInput}
              value={String(config.audiobookMinFileSizeMB)}
              onChangeText={(v) => setConfig(c => ({ ...c, audiobookMinFileSizeMB: Number(v) || 0 }))}
              keyboardType="numeric"
              testID="config-min-size"
            />
          </View>
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>Min duration (min)</Text>
            <TextInput
              style={styles.configInput}
              value={String(config.audiobookMinDurationMinutes)}
              onChangeText={(v) => setConfig(c => ({ ...c, audiobookMinDurationMinutes: Number(v) || 0 }))}
              keyboardType="numeric"
              testID="config-min-duration"
            />
          </View>
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>Multi-track min (MB)</Text>
            <TextInput
              style={styles.configInput}
              value={String(config.audiobookMultiTrackMinSizeMB)}
              onChangeText={(v) => setConfig(c => ({ ...c, audiobookMultiTrackMinSizeMB: Number(v) || 0 }))}
              keyboardType="numeric"
              testID="config-multi-track-size"
            />
          </View>
          <Text style={styles.configHint}>
            Keywords: {config.audiobookKeywords.join(', ')}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support the Project</Text>
        <TouchableOpacity
          style={styles.referralCard}
          onPress={() => setShowReferralModal(true)}
          activeOpacity={0.7}
          testID="referral-link"
        >
          <View style={styles.referralLeft}>
            <View style={styles.referralIconWrap}>
              <Heart size={20} color="#F472B6" />
            </View>
            <View style={styles.referralInfo}>
              <Text style={styles.referralTitle}>My TorBox Referral Link</Text>
              <Text style={styles.referralDesc}>Using this referral link to sign up or upgrade directly supports TorDeck's development at no extra cost to you.</Text>
            </View>
          </View>
          <ExternalLink size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Info size={18} color={Colors.textSecondary} />
            <Text style={styles.rowLabel}>TorDeck</Text>
            <Text style={styles.rowValue}>v1.1.5</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.disconnectButton}
        onPress={handleDisconnect}
        activeOpacity={0.7}
        testID="disconnect-button"
      >
        <LogOut size={18} color={Colors.danger} />
        <Text style={styles.disconnectText}>Disconnect TorBox</Text>
      </TouchableOpacity>

      <Modal
        visible={showReferralModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReferralModal(false)}
      >
        <TouchableOpacity
          style={styles.referralOverlay}
          activeOpacity={1}
          onPress={() => setShowReferralModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.referralModal}>
            <View style={styles.referralModalHeader}>
              <View style={styles.referralHeartWrap}>
                <Heart size={24} color="#F472B6" />
              </View>
              <Text style={styles.referralModalTitle}>Support TorDeck</Text>
              <Text style={styles.referralModalDesc}>
                This is my personal TorBox referral link. Using it to sign up or upgrade directly supports TorDeck's development at no extra cost to you.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.referralOpenBtn}
              onPress={() => {
                if (Platform.OS === 'web') {
                  window.open(REFERRAL_URL, '_blank', 'noopener,noreferrer');
                } else {
                  Linking.openURL(REFERRAL_URL);
                }
              }}
              activeOpacity={0.8}
            >
              <ExternalLink size={16} color="#fff" />
              <Text style={styles.referralOpenBtnText}>Open TorBox Signup</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.referralCloseBtn}
              onPress={() => setShowReferralModal(false)}
            >
              <Text style={styles.referralCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 18,
  },
  title: {
    fontSize: 30,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -0.8,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  userCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  userCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary + '30',
  },
  userMainInfo: {
    flex: 1,
    gap: 6,
  },
  userName: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700' as const,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  planBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  userStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  userStatItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  userStatIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userStatValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  userStatLabel: {
    color: Colors.textTertiary,
    fontSize: 10,
    fontWeight: '500' as const,
    marginTop: 1,
  },
  userStatSubLabel: {
    color: Colors.textTertiary,
    fontSize: 9,
    marginTop: 1,
  },
  userStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
  expiresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  userDetailsCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background + '66',
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailRowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  detailLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
    width: 78,
  },
  detailValue: {
    flex: 1,
    color: Colors.text,
    fontSize: 12,
    fontWeight: '500' as const,
    textAlign: 'right' as const,
  },
  detailReferralRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  referralCode: {
    color: Colors.accent,
  },
  usageCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    backgroundColor: Colors.primary + '10',
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 8,
  },
  usageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  usageTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  usagePercent: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  usageTrack: {
    height: 8,
    backgroundColor: Colors.background,
    borderRadius: 99,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  usageFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 99,
  },
  usageText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  expiresText: {
    color: Colors.textTertiary,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  section: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowLabel: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
  },
  rowValue: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusConnected: {
    backgroundColor: Colors.primary + '20',
  },
  statusDisconnected: {
    backgroundColor: Colors.danger + '20',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  statusTextConnected: {
    color: Colors.primary,
  },
  statusTextDisconnected: {
    color: Colors.danger,
  },
  connectionHint: {
    marginTop: 10,
    color: Colors.textTertiary,
    fontSize: 12,
  },
  connectionActions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  connectionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    backgroundColor: Colors.primary + '12',
    borderRadius: 10,
    paddingVertical: 9,
  },
  connectionButtonText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  tabOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabOptionActive: {
    backgroundColor: Colors.primary + '08',
  },
  tabOptionLabel: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500' as const,
  },
  tabOptionLabelActive: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  checkMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  configLabel: {
    color: Colors.text,
    fontSize: 14,
    flex: 1,
  },
  configInput: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    color: Colors.text,
    fontSize: 14,
    width: 80,
    textAlign: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  configHint: {
    color: Colors.textTertiary,
    fontSize: 11,
    marginTop: 10,
    lineHeight: 16,
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.danger + '15',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 32,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.danger + '30',
  },
  disconnectText: {
    color: Colors.danger,
    fontSize: 16,
    fontWeight: '700' as const,
  },

  referralCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F472B6' + '25',
  },
  referralLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  referralIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F472B6' + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  referralInfo: {
    flex: 1,
  },
  referralTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  referralDesc: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  referralOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  referralModal: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  referralModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  referralHeartWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F472B6' + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  referralModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  referralModalDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  referralOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F472B6',
    borderRadius: 14,
    paddingVertical: 15,
  },
  referralOpenBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  referralCloseBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  referralCloseBtnText: {
    color: Colors.textTertiary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
});
