import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import createContextHook from '@nkzw/create-context-hook';
import {
  TorBoxRule,
  TorBoxRulePreset,
  TorBoxRulePresetId,
  TorBoxRuleCondition,
  TorBoxRuleAction,
  TorBoxRuleConditionField,
  TorBoxRuleOperator,
  TorBoxRuleScope,
} from '@/types/torbox';
import { torboxApi } from '@/services/torbox-api';
import { appendAppNotification } from '@/hooks/useAppNotifications';

const RULES_STORAGE_KEY = 'torbox_automation_rules';

type AutomationSource = 'torrent' | 'usenet' | 'web';
interface AutomationTarget {
  source: AutomationSource;
  sourceId: number;
  name: string;
  progress: number;
  eta: number;
  downloadSpeed: number;
  downloadState: string;
  peers: number;
  ratio: number;
  availability: number;
  createdAt: string;
  tracker: string | null;
  stalledMinutes: number;
  fileIds: number[];
  size: number;
}

export const TORBOX_RULE_PRESETS: TorBoxRulePreset[] = [
  { id: 'pause_stalled_downloads', name: 'Pause stalled downloads', description: 'Pauses active items stalled for more than 20 minutes.', checkIntervalMinutes: 10, conditions: [{ field: 'download_stalled_time', operator: 'greater_than', value: '20' }], action: 'pause_download', category: 'transfer' },
  { id: 'resume_when_progress_seen', name: 'Resume paused downloads', description: 'Resumes paused downloads automatically.', checkIntervalMinutes: 10, conditions: [{ field: 'status', operator: 'equals', value: 'paused' }], action: 'resume_download', category: 'transfer' },
  { id: 'reannounce_stalled_torrents', name: 'Reannounce stalled torrents', description: 'Reannounces stalled torrents to refresh trackers.', checkIntervalMinutes: 15, conditions: [{ field: 'download_stalled_time', operator: 'greater_than', value: '15' }], action: 'reannounce_torrent', scope: 'torrent', category: 'maintenance' },
  { id: 'completed_notify', name: 'Notify on completion', description: 'Creates a local notification when an item reaches 100%.', checkIntervalMinutes: 5, conditions: [{ field: 'progress', operator: 'equals', value: '100' }], action: 'notify_user', category: 'completion' },
  { id: 'notify_errors', name: 'Notify on failed downloads', description: 'Creates a local notification when a download enters error state.', checkIntervalMinutes: 5, conditions: [{ field: 'status', operator: 'equals', value: 'error' }], action: 'notify_user', category: 'transfer' },
  { id: 'completed_get_link', name: 'Auto-generate download link', description: 'Requests a download link when item completes.', checkIntervalMinutes: 10, conditions: [{ field: 'progress', operator: 'equals', value: '100' }], action: 'request_download_link', category: 'completion' },
  { id: 'stream_ready_media', name: 'Create stream links for completed media', description: 'Requests stream links for completed items.', checkIntervalMinutes: 15, conditions: [{ field: 'progress', operator: 'equals', value: '100' }], action: 'create_stream', category: 'playback' },
  { id: 'delete_very_old_completed', name: 'Delete very old completed', description: 'Deletes completed downloads older than 60 days. DANGEROUS.', checkIntervalMinutes: 1440, conditions: [{ field: 'age', operator: 'greater_than', value: '60' }, { field: 'progress', operator: 'equals', value: '100' }], action: 'delete_download', isDangerous: true, category: 'completion' },
  { id: 'auto_delete_old_failed', name: 'Auto-delete old failed downloads', description: 'Deletes failed downloads older than 7 days. DANGEROUS.', checkIntervalMinutes: 1440, conditions: [{ field: 'status', operator: 'equals', value: 'error' }, { field: 'age', operator: 'greater_than', value: '7' }], action: 'delete_download', isDangerous: true, category: 'completion' },
  { id: 'pause_high_eta_downloads', name: 'Pause very long ETA downloads', description: 'Pauses items with ETA above 2 days (172800s).', checkIntervalMinutes: 20, conditions: [{ field: 'eta', operator: 'greater_than', value: '172800' }], action: 'pause_download', category: 'transfer' },
  { id: 'resume_stalled_items', name: 'Resume stalled transfers', description: 'Resumes stalled transfers to kick progress.', checkIntervalMinutes: 15, conditions: [{ field: 'status', operator: 'contains', value: 'stalled' }], action: 'resume_download', category: 'transfer' },
  { id: 'notify_slow_downloads', name: 'Notify on slow downloads', description: 'Sends notification when download speed drops below 10KB/s.', checkIntervalMinutes: 10, conditions: [{ field: 'current_download_speed', operator: 'less_than', value: '10240' }, { field: 'status', operator: 'contains', value: 'download' }], action: 'notify_user', category: 'transfer' },
  { id: 'generate_links_for_cached', name: 'Generate links for cached items', description: 'Requests download links for cached/completed items.', checkIntervalMinutes: 30, conditions: [{ field: 'status', operator: 'contains', value: 'cached' }], action: 'request_download_link', category: 'completion' },
  { id: 'stream_ready_cached', name: 'Create stream links for cached items', description: 'Builds stream links for cached/completed files.', checkIntervalMinutes: 30, conditions: [{ field: 'status', operator: 'contains', value: 'cached' }], action: 'create_stream', category: 'playback' },
  { id: 'notify_torrent_tracker_issues', name: 'Notify tracker-related stalls', description: 'Notifies when torrent tracker field contains warning text.', checkIntervalMinutes: 15, conditions: [{ field: 'tracker', operator: 'contains', value: 'error' }], action: 'notify_user', scope: 'torrent', category: 'maintenance' },
];

export const PRESET_CATEGORIES = [
  { key: 'transfer', label: 'Downloads & Transfers' },
  { key: 'completion', label: 'Completion & Cleanup' },
  { key: 'maintenance', label: 'Torrent Maintenance' },
  { key: 'playback', label: 'Playback' },
];

export const CONDITION_FIELD_LABELS: Record<string, string> = {
  progress: 'Progress (%)', eta: 'ETA (seconds)', current_download_speed: 'Current Download Speed (bytes/s)', average_download_speed: 'Average Download Speed (bytes/s)',
  download_stalled_time: 'Download Stalled Time (minutes)', upload_stalled_time: 'Upload Stalled Time (minutes)', seeding_ratio: 'Seeding Ratio', peers: 'Peers', age: 'Age (days)', tracker: 'Tracker', availability: 'Availability', status: 'Download Status', download_type: 'Download Type', name_contains: 'Name Contains', size: 'Size (bytes)',
};

export const CONDITION_FIELDS: TorBoxRuleConditionField[] = ['progress', 'eta', 'current_download_speed', 'average_download_speed', 'download_stalled_time', 'upload_stalled_time', 'seeding_ratio', 'peers', 'age', 'tracker', 'availability', 'status', 'download_type', 'name_contains', 'size'];

export const OPERATOR_LABELS: Record<string, string> = {
  equals: '=', not_equals: '!=', greater_than: '>', less_than: '<', greater_than_or_equal: '>=', less_than_or_equal: '<=', contains: 'contains',
};
export const OPERATORS: TorBoxRuleOperator[] = ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal', 'contains'];

export const ACTION_LABELS: Record<string, string> = {
  delete_download: 'Delete Download', pause_download: 'Pause Download', resume_download: 'Resume Download', reannounce_torrent: 'Reannounce Torrent', request_download_link: 'Request Download Link', create_stream: 'Create Stream Link', notify_user: 'Notify (Local)',
};
export const ALL_ACTIONS: TorBoxRuleAction[] = ['delete_download', 'pause_download', 'resume_download', 'reannounce_torrent', 'request_download_link', 'create_stream', 'notify_user'];
const SUPPORTED_ACTION_SET = new Set<TorBoxRuleAction>(ALL_ACTIONS);

export const SCOPE_LABELS: Record<TorBoxRuleScope, string> = { all: 'All Downloads', torrent: 'Torrents Only', usenet: 'Usenet Only', web: 'Web Downloads Only' };

const isActionSupportedForScope = (action: TorBoxRuleAction, scope: TorBoxRuleScope) => !(action === 'reannounce_torrent' && scope !== 'torrent');

function createRuleFromPreset(preset: TorBoxRulePreset): TorBoxRule {
  return { id: `rule_${preset.id}_${Date.now()}`, name: preset.name, enabled: false, checkIntervalMinutes: preset.checkIntervalMinutes, conditions: preset.conditions.map(c => ({ ...c })), action: preset.action, actionValue: preset.actionValue, scope: preset.scope ?? 'all', isDangerous: preset.isDangerous, isCustom: false, lastRunAt: null, lastResult: null, runCount: 0, createdAt: new Date().toISOString() };
}

const compareValues = (left: number | string, rightRaw: string, operator: TorBoxRuleOperator): boolean => {
  const rightNum = Number(rightRaw);
  const leftNum = typeof left === 'number' ? left : Number(left);
  const right = Number.isFinite(rightNum) ? rightNum : rightRaw.toLowerCase();
  const l = Number.isFinite(leftNum) && typeof right === 'number' ? leftNum : String(left).toLowerCase();
  switch (operator) {
    case 'equals': return l === right;
    case 'not_equals': return l !== right;
    case 'greater_than': return Number(l) > Number(right);
    case 'less_than': return Number(l) < Number(right);
    case 'greater_than_or_equal': return Number(l) >= Number(right);
    case 'less_than_or_equal': return Number(l) <= Number(right);
    case 'contains': return String(l).includes(String(right));
    default: return false;
  }
};

const toTargets = async (): Promise<AutomationTarget[]> => {
  const [torrents, usenet, web] = await Promise.all([torboxApi.getTorrents(), torboxApi.getUsenet(), torboxApi.getWebDownloads()]);
  const now = Date.now();
  return [
    ...torrents.map(t => ({ source: 'torrent' as const, sourceId: t.id, name: t.name, progress: t.progress, eta: t.eta, downloadSpeed: t.download_speed, downloadState: t.download_state, peers: t.peers ?? 0, ratio: t.ratio ?? 0, availability: t.availability ?? 0, createdAt: t.created_at, tracker: t.tracker, stalledMinutes: Math.max(0, Math.floor((now - new Date(t.updated_at).getTime()) / 60000)), fileIds: (t.files ?? []).map(f => f.id), size: t.size })),
    ...usenet.map(u => ({ source: 'usenet' as const, sourceId: u.id, name: u.name, progress: u.progress, eta: u.eta, downloadSpeed: u.download_speed, downloadState: u.download_state, peers: 0, ratio: 0, availability: 0, createdAt: u.created_at, tracker: null, stalledMinutes: Math.max(0, Math.floor((now - new Date(u.updated_at).getTime()) / 60000)), fileIds: (u.files ?? []).map(f => f.id), size: u.size })),
    ...web.map(w => ({ source: 'web' as const, sourceId: w.webdownload_id ?? w.web_id ?? w.id, name: w.name, progress: w.progress, eta: w.eta, downloadSpeed: w.download_speed, downloadState: w.download_state, peers: 0, ratio: 0, availability: 0, createdAt: w.created_at, tracker: null, stalledMinutes: Math.max(0, Math.floor((now - new Date(w.updated_at).getTime()) / 60000)), fileIds: (w.files ?? []).map(f => f.id), size: w.size })),
  ];
};

const matchesRule = (rule: TorBoxRule, target: AutomationTarget): boolean => {
  if (rule.scope && rule.scope !== 'all' && target.source !== rule.scope) return false;
  return rule.conditions.every((cond) => {
    if (!cond.value?.trim()) return true;
    const ageDays = Math.floor((Date.now() - new Date(target.createdAt).getTime()) / 86400000);
    const fieldMap: Record<TorBoxRuleConditionField, number | string> = {
      progress: target.progress, eta: target.eta, current_download_speed: target.downloadSpeed, average_download_speed: target.downloadSpeed, download_stalled_time: target.stalledMinutes, upload_stalled_time: target.stalledMinutes,
      seeding_ratio: target.ratio, peers: target.peers, age: ageDays, tracker: target.tracker ?? '', availability: target.availability, status: target.downloadState, download_type: target.source, name_contains: target.name, size: target.size,
    };
    return compareValues(fieldMap[cond.field], cond.value, cond.operator);
  });
};

async function executeAction(rule: TorBoxRule, targets: AutomationTarget[]): Promise<string> {
  if (!targets.length) return 'No matching downloads found.';
  let affected = 0;
  for (const target of targets) {
    switch (rule.action) {
      case 'pause_download':
        if (target.source === 'torrent') await torboxApi.controlTorrent(target.sourceId, 'pause');
        if (target.source === 'usenet') await torboxApi.controlUsenet(target.sourceId, 'pause');
        if (target.source === 'web') await torboxApi.controlWebDownload(target.sourceId, 'pause');
        affected++;
        break;
      case 'resume_download':
        if (target.source === 'torrent') await torboxApi.controlTorrent(target.sourceId, 'resume');
        if (target.source === 'usenet') await torboxApi.controlUsenet(target.sourceId, 'resume');
        if (target.source === 'web') await torboxApi.controlWebDownload(target.sourceId, 'resume');
        affected++;
        break;
      case 'reannounce_torrent':
        if (target.source === 'torrent') {
          await torboxApi.controlTorrent(target.sourceId, 'reannounce');
          affected++;
        }
        break;
      case 'delete_download':
        await torboxApi.deleteItem(target.source, target.sourceId);
        affected++;
        break;
      case 'request_download_link': {
        const fileId = target.fileIds[0];
        if (!fileId) break;
        await torboxApi.getDownloadLink(target.source, target.sourceId, fileId);
        affected++;
        break;
      }
      case 'create_stream': {
        const fileId = target.fileIds[0];
        if (!fileId) break;
        await torboxApi.getStreamLink(target.source, target.sourceId, fileId);
        affected++;
        break;
      }
      case 'notify_user':
        affected++;
        break;
    }
  }

  if (affected > 0) {
    await appendAppNotification({ title: 'Automation ran', message: `${rule.name} processed ${affected} item${affected === 1 ? '' : 's'}.` });
  }

  return affected > 0 ? `Processed ${affected} item${affected === 1 ? '' : 's'}.` : 'No supported items matched this action.';
}

export const [AutomationsProvider, useAutomations] = createContextHook(() => {
  const [rules, setRules] = useState<TorBoxRule[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const runLockRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(RULES_STORAGE_KEY);
        const parsed: TorBoxRule[] = stored ? JSON.parse(stored) : [];
        const sanitized = parsed.filter(rule => SUPPORTED_ACTION_SET.has(rule.action));
        setRules(sanitized);
      } catch (err) {
        console.error('[Automations] Load error:', err);
        setRules([]);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const persistRules = useCallback(async (newRules: TorBoxRule[]) => {
    setRules(newRules);
    try {
      await AsyncStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(newRules));
    } catch (err) {
      console.error('[Automations] Save error:', err);
    }
  }, []);

  const runRule = useCallback(async (ruleId: string, trigger: 'manual' | 'poll', options?: { allowDisabled?: boolean }) => {
    if (runLockRef.current.has(ruleId)) return;
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;
    if (!rule.enabled && !options?.allowDisabled) return;
    if (!isActionSupportedForScope(rule.action, rule.scope ?? 'all')) {
      const next = rules.map(r => r.id === rule.id ? { ...r, lastResult: 'Unsupported scope/action combination.', enabled: false } : r);
      await persistRules(next);
      return;
    }

    runLockRef.current.add(ruleId);
    try {
      const targets = (await toTargets()).filter(item => matchesRule(rule, item));
      const result = await executeAction(rule, targets);
      const next = rules.map(r => r.id === rule.id ? { ...r, lastRunAt: new Date().toISOString(), runCount: r.runCount + 1, lastResult: `${trigger === 'manual' ? 'Manual run' : 'Scheduled run'}: ${result}` } : r);
      await persistRules(next);
      if (trigger === 'manual') {
        Alert.alert('Rule Executed', `${rule.name}: ${result}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Execution failed';
      const next = rules.map(r => r.id === rule.id ? { ...r, lastRunAt: new Date().toISOString(), runCount: r.runCount + 1, lastResult: `Failed: ${message}` } : r);
      await persistRules(next);
      if (trigger === 'manual') {
        Alert.alert('Rule Failed', message);
      }
    } finally {
      runLockRef.current.delete(ruleId);
    }
  }, [rules, persistRules]);

  useEffect(() => {
    if (!isLoaded) return;
    const timer = setInterval(() => {
      const now = Date.now();
      rules.forEach((rule) => {
        if (!rule.enabled) return;
        const intervalMs = Math.max(1, rule.checkIntervalMinutes) * 60_000;
        const last = rule.lastRunAt ? new Date(rule.lastRunAt).getTime() : 0;
        if (now - last >= intervalMs) {
          void runRule(rule.id, 'poll');
        }
      });
    }, 30_000);

    return () => clearInterval(timer);
  }, [rules, runRule, isLoaded]);

  const addRuleFromPreset = useCallback(async (presetId: TorBoxRulePresetId) => {
    const preset = TORBOX_RULE_PRESETS.find(p => p.id === presetId);
    if (!preset) return null;
    const rule = createRuleFromPreset(preset);

    if (rule.isDangerous) {
      return new Promise<TorBoxRule | null>((resolve) => Alert.alert('Dangerous Rule', `"${rule.name}" can permanently delete data. Add it as disabled draft?`, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        { text: 'Add Rule', style: 'destructive', onPress: async () => { await persistRules([...rules, rule]); resolve(rule); } },
      ]));
    }

    await persistRules([...rules, rule]);
    return rule;
  }, [rules, persistRules]);

  const createCustomRule = useCallback(async (params: { name: string; checkIntervalMinutes: number; conditions: TorBoxRuleCondition[]; action: TorBoxRuleAction; actionValue?: string; scope?: TorBoxRuleScope; }) => {
    if (!SUPPORTED_ACTION_SET.has(params.action)) throw new Error(`Unsupported automation action: ${params.action}`);
    const scope = params.scope ?? 'all';
    if (!isActionSupportedForScope(params.action, scope)) throw new Error('This action is not supported for the selected scope.');

    const rule: TorBoxRule = {
      id: `rule_custom_${Date.now()}`,
      name: params.name,
      enabled: false,
      checkIntervalMinutes: Math.max(1, params.checkIntervalMinutes),
      conditions: params.conditions,
      action: params.action,
      actionValue: params.actionValue,
      scope,
      isCustom: true,
      isDangerous: params.action === 'delete_download',
      lastRunAt: null,
      lastResult: null,
      runCount: 0,
      createdAt: new Date().toISOString(),
    };

    await persistRules([...rules, rule]);
    return rule;
  }, [rules, persistRules]);

  const toggleRule = useCallback(async (ruleId: string, enabled: boolean) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;
    if (enabled && !isActionSupportedForScope(rule.action, rule.scope ?? 'all')) {
      Alert.alert('Unsupported Rule', 'This rule uses an action/scope combination not supported by TorBox.');
      return;
    }

    if (enabled && rule.isDangerous) {
      return new Promise<void>((resolve) => Alert.alert('Enable Dangerous Rule', `"${rule.name}" can permanently delete data. Enable anyway?`, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
        { text: 'Enable', style: 'destructive', onPress: async () => { await persistRules(rules.map(r => r.id === ruleId ? { ...r, enabled } : r)); resolve(); } },
      ]));
    }

    await persistRules(rules.map(r => r.id === ruleId ? { ...r, enabled } : r));
  }, [rules, persistRules]);

  const updateRule = useCallback(async (ruleId: string, updates: Partial<Pick<TorBoxRule, 'name' | 'checkIntervalMinutes' | 'conditions' | 'action' | 'actionValue' | 'scope'>>) => {
    const existing = rules.find(r => r.id === ruleId);
    if (!existing) return;
    const nextAction = updates.action ?? existing.action;
    const nextScope = updates.scope ?? existing.scope ?? 'all';
    if (!isActionSupportedForScope(nextAction, nextScope)) {
      Alert.alert('Unsupported Rule', 'That action is not supported for the selected scope.');
      return;
    }
    await persistRules(rules.map(r => r.id === ruleId ? { ...r, ...updates } : r));
  }, [rules, persistRules]);

  const deleteRule = useCallback(async (ruleId: string) => {
    await persistRules(rules.filter(r => r.id !== ruleId));
  }, [rules, persistRules]);

  const runNow = useCallback(async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;
    if (rule.lastRunAt && (Date.now() - new Date(rule.lastRunAt).getTime() < 30_000)) {
      Alert.alert('Throttled', 'Please wait at least 30 seconds between manual runs.');
      return;
    }
    await runRule(ruleId, 'manual', { allowDisabled: true });
  }, [rules, runRule]);

  const enabledCount = useMemo(() => rules.filter(r => r.enabled).length, [rules]);
  const presetsByCategory = useMemo(() => {
    const map: Record<string, TorBoxRulePreset[]> = {};
    for (const preset of TORBOX_RULE_PRESETS) {
      if (!map[preset.category]) map[preset.category] = [];
      map[preset.category].push(preset);
    }
    return map;
  }, []);

  return { rules, isLoaded, availablePresets: TORBOX_RULE_PRESETS, presetsByCategory, addRuleFromPreset, createCustomRule, toggleRule, updateRule, deleteRule, runNow, enabledCount };
});
