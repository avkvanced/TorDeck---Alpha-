import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Zap,
  Play,
  Clock,
  ChevronDown,
  ChevronRight,
  Shield,
  Trash2,
  Plus,
  AlertTriangle,
  Settings,
  X,
  Pause,
  RotateCw,
  Link,
  Radio,
  Bell,
  Wrench,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import {
  useAutomations,
  CONDITION_FIELD_LABELS,
  CONDITION_FIELDS,
  OPERATOR_LABELS,
  OPERATORS,
  ACTION_LABELS,
  ALL_ACTIONS,
  SCOPE_LABELS,
  PRESET_CATEGORIES,
} from '@/hooks/useAutomations';
import {
  TorBoxRule,
  TorBoxRulePreset,
  TorBoxRuleCondition,
  TorBoxRuleAction,
  TorBoxRuleScope,
} from '@/types/torbox';

const ACTION_ICONS: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  delete_download: Trash2,
  pause_download: Pause,
  resume_download: Play,
  reannounce_torrent: RotateCw,
  request_download_link: Link,
  create_stream: Radio,
  notify_user: Bell,
};

const SUPPORTED_AUTOMATION_ACTIONS = [
  'Pause / resume downloads',
  'Reannounce torrent trackers',
  'Delete downloads',
  'Request download links',
  'Create stream links',
  'Local notifications',
];

function getActionColor(action: string): string {
  switch (action) {
    case 'delete_download': return Colors.danger;
    case 'pause_download': return Colors.secondary;
    case 'resume_download': return Colors.primary;
    case 'reannounce_torrent': return Colors.secondary;
    case 'request_download_link': return Colors.accent;
    case 'create_stream': return '#06B6D4';
    case 'notify_user': return '#F59E0B';
    default: return Colors.textSecondary;
  }
}

interface RuleCardProps {
  rule: TorBoxRule;
  onToggle: (id: string, enabled: boolean) => void;
  onRunNow: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateInterval: (id: string, minutes: number) => void;
  onUpdateRule: (id: string, updates: Partial<Pick<TorBoxRule, 'name' | 'checkIntervalMinutes' | 'action' | 'scope'>>) => void;
}

const RuleCard = React.memo(function RuleCard({
  rule,
  onToggle,
  onRunNow,
  onDelete,
  onUpdateInterval,
  onUpdateRule,
}: RuleCardProps) {
  const [expanded, setExpanded] = useState<boolean>(false);
  const [intervalInput, setIntervalInput] = useState<string>(String(rule.checkIntervalMinutes));
  const [nameInput, setNameInput] = useState<string>(rule.name);

  React.useEffect(() => {
    setIntervalInput(String(rule.checkIntervalMinutes));
    setNameInput(rule.name);
  }, [rule.checkIntervalMinutes, rule.name]);

  const ActionIcon = ACTION_ICONS[rule.action] || Settings;
  const actionColor = getActionColor(rule.action);

  const handleToggle = useCallback((val: boolean) => {
    onToggle(rule.id, val);
  }, [rule.id, onToggle]);

  const handleRunNow = useCallback(() => {
    onRunNow(rule.id);
  }, [rule.id, onRunNow]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Rule',
      `Are you sure you want to delete "${rule.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(rule.id) },
      ]
    );
  }, [rule.id, rule.name, onDelete]);

  const handleIntervalSave = useCallback(() => {
    const parsed = parseInt(intervalInput, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      onUpdateInterval(rule.id, parsed);
    }
  }, [rule.id, intervalInput, onUpdateInterval]);

  const handleNameSave = useCallback(() => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === rule.name) return;
    onUpdateRule(rule.id, { name: trimmed });
  }, [nameInput, onUpdateRule, rule.id, rule.name]);

  const scopeOptions: TorBoxRuleScope[] = ['all', 'torrent', 'usenet', 'web'];

  const lastRunText = rule.lastRunAt
    ? new Date(rule.lastRunAt).toLocaleString()
    : 'Never';

  return (
    <View style={[styles.ruleCard, rule.isDangerous && styles.ruleCardDangerous]}>
      <TouchableOpacity
        style={styles.ruleHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.ruleHeaderLeft}>
          {expanded ? (
            <ChevronDown size={16} color={Colors.textSecondary} />
          ) : (
            <ChevronRight size={16} color={Colors.textSecondary} />
          )}
          <View style={[styles.actionIconCircle, { backgroundColor: actionColor + '18' }]}>
            <ActionIcon size={14} color={actionColor} />
          </View>
          <View style={styles.ruleHeaderText}>
            <Text style={styles.ruleName} numberOfLines={1}>{rule.name}</Text>
            <View style={styles.ruleBadges}>
              <View style={[styles.actionBadge, { backgroundColor: actionColor + '15' }]}>
                <Text style={[styles.actionBadgeText, { color: actionColor }]}>
                  {ACTION_LABELS[rule.action] || rule.action}
                </Text>
              </View>
              {rule.isCustom && (
                <View style={styles.customBadge}>
                  <Wrench size={8} color={Colors.accent} />
                  <Text style={styles.customBadgeText}>Custom</Text>
                </View>
              )}
              {rule.isDangerous && (
                <View style={styles.dangerBadge}>
                  <AlertTriangle size={10} color={Colors.danger} />
                  <Text style={styles.dangerBadgeText}>Dangerous</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <Switch
          value={rule.enabled}
          onValueChange={handleToggle}
          trackColor={{ false: Colors.border, true: (rule.isDangerous ? Colors.danger : Colors.primary) + '60' }}
          thumbColor={rule.enabled ? (rule.isDangerous ? Colors.danger : Colors.primary) : Colors.textTertiary}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.ruleBody}>
          {rule.conditions.length > 0 && (
            <View style={styles.conditionsSection}>
              <Text style={styles.sectionLabel}>CONDITIONS</Text>
              {rule.conditions.map((cond, idx) => (
                <View key={idx} style={styles.conditionRow}>
                  <Text style={styles.conditionField}>
                    {CONDITION_FIELD_LABELS[cond.field] || cond.field}
                  </Text>
                  <Text style={styles.conditionOperator}>
                    {OPERATOR_LABELS[cond.operator] || cond.operator}
                  </Text>
                  <Text style={styles.conditionValue}>{cond.value}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.nameSection}>
            <Text style={styles.sectionLabel}>RULE NAME</Text>
            <TextInput
              style={styles.nameInput}
              value={nameInput}
              onChangeText={setNameInput}
              onBlur={handleNameSave}
              onSubmitEditing={handleNameSave}
              placeholderTextColor={Colors.textTertiary}
              returnKeyType="done"
            />
          </View>

          <View style={styles.actionSection}>
            <Text style={styles.sectionLabel}>ACTION</Text>
            <View style={styles.actionRow}>
              <ActionIcon size={14} color={actionColor} />
              <Text style={[styles.actionText, { color: actionColor }]}> 
                {ACTION_LABELS[rule.action] || rule.action}
                {rule.actionValue ? `: "${rule.actionValue}"` : ''}
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.inlinePickerScroll}>
              {ALL_ACTIONS.map((action) => (
                <TouchableOpacity
                  key={action}
                  style={[styles.inlinePickerBtn, rule.action === action && styles.inlinePickerBtnActive]}
                  onPress={() => onUpdateRule(rule.id, { action })}
                >
                  <Text style={[styles.inlinePickerText, rule.action === action && styles.inlinePickerTextActive]}>
                    {ACTION_LABELS[action]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.scopeSection}>
            <Text style={styles.sectionLabel}>SCOPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.inlinePickerScroll}>
              {scopeOptions.map((scope) => (
                <TouchableOpacity
                  key={scope}
                  style={[styles.inlinePickerBtn, (rule.scope ?? 'all') === scope && styles.inlinePickerBtnActive]}
                  onPress={() => onUpdateRule(rule.id, { scope })}
                >
                  <Text style={[styles.inlinePickerText, (rule.scope ?? 'all') === scope && styles.inlinePickerTextActive]}>
                    {SCOPE_LABELS[scope]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {rule.checkIntervalMinutes > 0 && (
            <View style={styles.intervalSection}>
              <Text style={styles.sectionLabel}>CHECK INTERVAL</Text>
              <View style={styles.intervalRow}>
                <Clock size={12} color={Colors.textTertiary} />
                <Text style={styles.intervalLabel}>Every</Text>
                <TextInput
                  style={styles.intervalInput}
                  value={intervalInput}
                  onChangeText={setIntervalInput}
                  onBlur={handleIntervalSave}
                  onSubmitEditing={handleIntervalSave}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  placeholderTextColor={Colors.textTertiary}
                />
                <Text style={styles.intervalUnit}>min</Text>
              </View>
            </View>
          )}

          <View style={styles.metaSection}>
            <Text style={styles.metaText}>Last run: {lastRunText}</Text>
            {rule.lastResult && (
              <Text style={styles.metaText} numberOfLines={2}>{rule.lastResult}</Text>
            )}
            <Text style={styles.metaText}>Runs: {rule.runCount}</Text>
          </View>

          <View style={styles.ruleActions}>
            <TouchableOpacity
              style={styles.ruleActionBtn}
              onPress={handleRunNow}
            >
              <Play size={13} color={Colors.text} />
              <Text style={styles.ruleActionBtnText}>Run Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ruleActionBtn, styles.deleteBtn]}
              onPress={handleDelete}
            >
              <Trash2 size={13} color={Colors.danger} />
              <Text style={[styles.ruleActionBtnText, { color: Colors.danger }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
});

interface PresetCardProps {
  preset: TorBoxRulePreset;
  onAdd: (id: string) => void;
}

const PresetCard = React.memo(function PresetCard({ preset, onAdd }: PresetCardProps) {
  const ActionIcon = ACTION_ICONS[preset.action] || Settings;
  const actionColor = getActionColor(preset.action);

  const handleAdd = useCallback(() => {
    onAdd(preset.id);
  }, [preset.id, onAdd]);

  return (
    <View style={[styles.presetCard, preset.isDangerous && styles.presetCardDangerous]}>
      <View style={styles.presetHeader}>
        <View style={[styles.actionIconCircle, { backgroundColor: actionColor + '18' }]}>
          <ActionIcon size={14} color={actionColor} />
        </View>
        <View style={styles.presetHeaderText}>
          <Text style={styles.presetName}>{preset.name}</Text>
          <Text style={styles.presetDesc} numberOfLines={2}>{preset.description}</Text>
        </View>
      </View>
      <View style={styles.presetMeta}>
        <View style={styles.presetMetaRow}>
          <View style={[styles.actionBadge, { backgroundColor: actionColor + '15' }]}>
            <Text style={[styles.actionBadgeText, { color: actionColor }]}>
              {ACTION_LABELS[preset.action]}
            </Text>
          </View>
          {preset.checkIntervalMinutes > 0 && (
            <Text style={styles.presetInterval}>Every {preset.checkIntervalMinutes}m</Text>
          )}
          {preset.checkIntervalMinutes === 0 && (
            <Text style={styles.presetInterval}>Event-driven</Text>
          )}
          {preset.isDangerous && (
            <View style={styles.dangerBadge}>
              <AlertTriangle size={10} color={Colors.danger} />
              <Text style={styles.dangerBadgeText}>Dangerous</Text>
            </View>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={styles.addPresetBtn}
        onPress={handleAdd}
        activeOpacity={0.7}
      >
        <Plus size={14} color={Colors.primary} />
        <Text style={styles.addPresetBtnText}>Add as Draft (Disabled)</Text>
      </TouchableOpacity>
    </View>
  );
});

function CustomRuleBuilder({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  const { createCustomRule } = useAutomations();
  const [name, setName] = useState<string>('');
  const [interval, setInterval] = useState<string>('10');
  const [scope, setScope] = useState<TorBoxRuleScope>('all');
  const [conditions, setConditions] = useState<TorBoxRuleCondition[]>([]);
  const [action, setAction] = useState<TorBoxRuleAction>('notify_user');
  const [showFieldPicker, setShowFieldPicker] = useState<boolean>(false);
  const [showActionPicker, setShowActionPicker] = useState<boolean>(false);

  const addCondition = useCallback(() => {
    setConditions(prev => [...prev, { field: 'progress', operator: 'equals', value: '' }]);
  }, []);

  const removeCondition = useCallback((idx: number) => {
    setConditions(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const updateCondition = useCallback((idx: number, updates: Partial<TorBoxRuleCondition>) => {
    setConditions(prev => prev.map((c, i) => i === idx ? { ...c, ...updates } : c));
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please enter a name for the rule.');
      return;
    }
    const parsedInterval = parseInt(interval, 10);
    if (isNaN(parsedInterval) || parsedInterval < 1) {
      Alert.alert('Invalid Interval', 'Interval must be at least 1 minute.');
      return;
    }

    await createCustomRule({
      name: name.trim(),
      checkIntervalMinutes: parsedInterval,
      conditions,
      action,
      scope,
    });

    onSave();
  }, [name, interval, conditions, action, scope, createCustomRule, onSave]);

  const scopes: TorBoxRuleScope[] = ['all', 'torrent', 'usenet', 'web'];

  return (
    <View style={styles.builderContainer}>
      <Text style={styles.builderTitle}>Create Custom Rule</Text>
      <Text style={styles.builderSubtitle}>Rule will be saved as disabled. Enable after review.</Text>

      <View style={styles.builderField}>
        <Text style={styles.builderLabel}>RULE NAME</Text>
        <TextInput
          style={styles.builderInput}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Auto-pause slow downloads"
          placeholderTextColor={Colors.textTertiary}
        />
      </View>

      <View style={styles.builderField}>
        <Text style={styles.builderLabel}>SCOPE</Text>
        <View style={styles.scopeRow}>
          {scopes.map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.scopeBtn, scope === s && styles.scopeBtnActive]}
              onPress={() => setScope(s)}
            >
              <Text style={[styles.scopeBtnText, scope === s && styles.scopeBtnTextActive]}>
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.builderField}>
        <View style={styles.builderFieldHeader}>
          <Text style={styles.builderLabel}>CONDITIONS</Text>
          <TouchableOpacity style={styles.addCondBtn} onPress={addCondition}>
            <Plus size={12} color={Colors.primary} />
            <Text style={styles.addCondBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
        {conditions.length === 0 && (
          <Text style={styles.noCondText}>No conditions (runs on all matching items)</Text>
        )}
        {conditions.map((cond, idx) => (
          <View key={idx} style={styles.condBuilder}>
            <TouchableOpacity
              style={styles.condFieldBtn}
              onPress={() => setShowFieldPicker(showFieldPicker === false ? true : false)}
            >
              <Text style={styles.condFieldBtnText} numberOfLines={1}>
                {CONDITION_FIELD_LABELS[cond.field] || cond.field}
              </Text>
              <ChevronDown size={12} color={Colors.textTertiary} />
            </TouchableOpacity>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.opRow}>
              {OPERATORS.map(op => (
                <TouchableOpacity
                  key={op}
                  style={[styles.opBtn, cond.operator === op && styles.opBtnActive]}
                  onPress={() => updateCondition(idx, { operator: op })}
                >
                  <Text style={[styles.opBtnText, cond.operator === op && styles.opBtnTextActive]}>
                    {OPERATOR_LABELS[op]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.condValueRow}>
              <TextInput
                style={styles.condValueInput}
                value={cond.value}
                onChangeText={(v) => updateCondition(idx, { value: v })}
                placeholder="Value"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="default"
              />
              <TouchableOpacity style={styles.condRemoveBtn} onPress={() => removeCondition(idx)}>
                <X size={14} color={Colors.danger} />
              </TouchableOpacity>
            </View>

            {showFieldPicker && (
              <ScrollView style={styles.fieldPickerList} nestedScrollEnabled>
                {CONDITION_FIELDS.map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.fieldPickerItem, cond.field === f && styles.fieldPickerItemActive]}
                    onPress={() => {
                      updateCondition(idx, { field: f });
                      setShowFieldPicker(false);
                    }}
                  >
                    <Text style={[styles.fieldPickerText, cond.field === f && styles.fieldPickerTextActive]}>
                      {CONDITION_FIELD_LABELS[f]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        ))}
      </View>

      <View style={styles.builderField}>
        <Text style={styles.builderLabel}>ACTION</Text>
        <TouchableOpacity
          style={styles.actionPickerBtn}
          onPress={() => setShowActionPicker(!showActionPicker)}
        >
          <View style={styles.actionPickerRow}>
            {(() => {
              const Icon = ACTION_ICONS[action] || Settings;
              const color = getActionColor(action);
              return (
                <>
                  <View style={[styles.actionIconCircle, { backgroundColor: color + '18' }]}>
                    <Icon size={14} color={color} />
                  </View>
                  <Text style={[styles.actionPickerText, { color }]}>
                    {ACTION_LABELS[action]}
                  </Text>
                </>
              );
            })()}
          </View>
          <ChevronDown size={14} color={Colors.textTertiary} />
        </TouchableOpacity>

        {showActionPicker && (
          <View style={styles.actionPickerList}>
            {ALL_ACTIONS.map(a => {
              const Icon = ACTION_ICONS[a] || Settings;
              const color = getActionColor(a);
              return (
                <TouchableOpacity
                  key={a}
                  style={[styles.actionPickerItem, action === a && styles.actionPickerItemActive]}
                  onPress={() => { setAction(a); setShowActionPicker(false); }}
                >
                  <Icon size={14} color={color} />
                  <Text style={[styles.actionPickerItemText, { color: action === a ? color : Colors.text }]}>
                    {ACTION_LABELS[a]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

      </View>

      <View style={styles.builderField}>
        <Text style={styles.builderLabel}>CHECK INTERVAL (minutes)</Text>
        <TextInput
          style={styles.builderInput}
          value={interval}
          onChangeText={setInterval}
          keyboardType="number-pad"
          placeholder="10"
          placeholderTextColor={Colors.textTertiary}
        />
      </View>

      <View style={styles.builderActions}>
        <TouchableOpacity style={styles.builderCancelBtn} onPress={onCancel}>
          <Text style={styles.builderCancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.builderSaveBtn} onPress={handleSave}>
          <Plus size={14} color={Colors.text} />
          <Text style={styles.builderSaveText}>Save Rule (Disabled)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function AutomationsScreen() {
  const insets = useSafeAreaInsets();
  const {
    rules,
    isLoaded,
    presetsByCategory,
    addRuleFromPreset,
    toggleRule,
    updateRule,
    deleteRule,
    runNow,
    enabledCount,
  } = useAutomations();

  const [showPresets, setShowPresets] = useState<boolean>(false);
  const [showBuilder, setShowBuilder] = useState<boolean>(false);

  const handleAddPreset = useCallback(async (presetId: string) => {
    await addRuleFromPreset(presetId as TorBoxRulePreset['id']);
    setShowPresets(false);
  }, [addRuleFromPreset]);

  const handleUpdateInterval = useCallback(async (ruleId: string, minutes: number) => {
    await updateRule(ruleId, { checkIntervalMinutes: minutes });
  }, [updateRule]);

  const handleUpdateRule = useCallback(async (
    ruleId: string,
    updates: Partial<Pick<TorBoxRule, 'name' | 'checkIntervalMinutes' | 'action' | 'scope'>>,
  ) => {
    await updateRule(ruleId, updates);
  }, [updateRule]);

  const handleBuilderSave = useCallback(() => {
    setShowBuilder(false);
  }, []);

  if (!isLoaded) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading automations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerSection}>
          <View style={styles.headerIcon}>
            <Zap size={28} color={Colors.secondary} />
          </View>
          <Text style={styles.headerTitle}>TorBox Automations</Text>
          <Text style={styles.headerSubtitle}>
            {rules.length} rules {'\u00B7'} {enabledCount} active
          </Text>
        </View>


        <View style={styles.supportCard}>
          <Text style={styles.supportTitle}>Supported by TorBox API</Text>
          <Text style={styles.supportSubtitle}>
            Automations and templates only include actions that map to currently implemented TorBox API endpoints.
          </Text>
          <View style={styles.supportChipWrap}>
            {SUPPORTED_AUTOMATION_ACTIONS.map((item) => (
              <View key={item} style={styles.supportChip}>
                <Text style={styles.supportChipText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {enabledCount === 0 && rules.length > 0 && (
          <View style={styles.noBanner}>
            <Shield size={14} color={Colors.textTertiary} />
            <Text style={styles.noBannerText}>
              No automations are active. Enable a rule to start automation.
            </Text>
          </View>
        )}

        {rules.length === 0 && !showPresets && !showBuilder && (
          <View style={styles.emptyState}>
            <Shield size={32} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No automations configured</Text>
            <Text style={styles.emptyDesc}>
              Automations are opt-in only. No rules run unless you explicitly create and enable them.
            </Text>
            <View style={styles.emptyActions}>
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={() => setShowPresets(true)}
              >
                <Plus size={16} color={Colors.text} />
                <Text style={styles.emptyAddBtnText}>Browse Presets</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.emptyAddBtn, styles.emptyBuildBtn]}
                onPress={() => setShowBuilder(true)}
              >
                <Wrench size={16} color={Colors.accent} />
                <Text style={[styles.emptyAddBtnText, { color: Colors.accent }]}>Build Custom</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {rules.length > 0 && (
          <View style={styles.rulesSection}>
            <View style={styles.rulesSectionHeader}>
              <Text style={styles.rulesSectionTitle}>Your Rules</Text>
              <View style={styles.headerBtns}>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => { setShowBuilder(true); setShowPresets(false); }}
                >
                  <Wrench size={12} color={Colors.accent} />
                  <Text style={[styles.addBtnText, { color: Colors.accent }]}>Custom</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => { setShowPresets(!showPresets); setShowBuilder(false); }}
                >
                  <Plus size={14} color={Colors.primary} />
                  <Text style={styles.addBtnText}>{showPresets ? 'Hide' : 'Presets'}</Text>
                </TouchableOpacity>
              </View>
            </View>
            {rules.map(rule => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onToggle={toggleRule}
                onRunNow={runNow}
                onDelete={deleteRule}
                onUpdateInterval={handleUpdateInterval}
                onUpdateRule={handleUpdateRule}
              />
            ))}
          </View>
        )}

        {showBuilder && (
          <CustomRuleBuilder
            onSave={handleBuilderSave}
            onCancel={() => setShowBuilder(false)}
          />
        )}

        {showPresets && (
          <View style={styles.presetsSection}>
            <View style={styles.presetsSectionHeader}>
              <View style={styles.presetsTitleRow}>
                <Text style={styles.presetsSectionTitle}>TorBox-Supported Templates</Text>
                <TouchableOpacity
                  style={styles.presetsCloseBtn}
                  onPress={() => setShowPresets(false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <X size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.presetsSectionSubtitle}>
                Only actions supported by TorBox API endpoints are included. Templates are added as disabled drafts.
              </Text>
            </View>
            {PRESET_CATEGORIES.map(cat => {
              const presets = presetsByCategory[cat.key];
              if (!presets || presets.length === 0) return null;
              return (
                <View key={cat.key} style={styles.presetCategorySection}>
                  <Text style={styles.presetCategoryTitle}>{cat.label}</Text>
                  {presets.map(preset => (
                    <PresetCard
                      key={preset.id}
                      preset={preset}
                      onAdd={handleAddPreset}
                    />
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {(rules.length > 0 || showPresets || showBuilder) && (
          <View style={styles.footer}>
            <Shield size={16} color={Colors.primary} />
            <Text style={styles.footerText}>
              This page only exposes automations backed by current TorBox API operations (pause/resume/reannounce/delete/request link/stream). Rules remain opt-in and disabled by default.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: Colors.secondary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -0.7,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 5,
    fontWeight: '500' as const,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyBuildBtn: {
    backgroundColor: Colors.accent + '20',
  },
  emptyAddBtnText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
  },

  supportCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  supportTitle: {
    color: Colors.text,
    fontWeight: '700' as const,
    fontSize: 14,
  },
  supportSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  supportChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  supportChip: {
    backgroundColor: Colors.primary + '16',
    borderWidth: 1,
    borderColor: Colors.primary + '26',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  supportChipText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '600' as const,
  },

  noBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  noBannerText: {
    fontSize: 12,
    color: Colors.textTertiary,
    flex: 1,
  },
  rulesSection: {
    marginBottom: 20,
  },
  rulesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rulesSectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  headerBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.primary + '15',
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  ruleCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  ruleCardDangerous: {
    borderColor: Colors.danger + '30',
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  ruleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 12,
  },
  actionIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ruleHeaderText: {
    flex: 1,
  },
  ruleName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  ruleBadges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  actionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  actionBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
  },
  customBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: Colors.accent + '15',
  },
  customBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  dangerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: Colors.danger + '15',
  },
  dangerBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.danger,
  },
  ruleBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
    gap: 14,
  },
  conditionsSection: {
    gap: 6,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  nameSection: {
    gap: 6,
  },
  nameInput: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  conditionField: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '500' as const,
    flex: 1,
  },
  conditionOperator: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700' as const,
    width: 30,
    textAlign: 'center' as const,
  },
  conditionValue: {
    fontSize: 12,
    color: Colors.secondary,
    fontWeight: '600' as const,
    minWidth: 40,
    textAlign: 'right' as const,
  },
  actionSection: {
    gap: 6,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  inlinePickerScroll: {
    marginTop: 4,
  },
  inlinePickerBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: Colors.surface,
  },
  inlinePickerBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '15',
  },
  inlinePickerText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  inlinePickerTextActive: {
    color: Colors.primary,
  },
  scopeSection: {
    gap: 4,
  },
  scopeText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  intervalSection: {
    gap: 6,
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  intervalLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  intervalInput: {
    width: 56,
    height: 30,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: 13,
    textAlign: 'center' as const,
    paddingHorizontal: 6,
  },
  intervalUnit: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  metaSection: {
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  ruleActions: {
    flexDirection: 'row',
    gap: 8,
  },
  ruleActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.primary + '18',
  },
  ruleActionBtnDisabled: {
    backgroundColor: Colors.surface,
  },
  ruleActionBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  ruleActionBtnTextDisabled: {
    color: Colors.textTertiary,
  },
  deleteBtn: {
    backgroundColor: Colors.danger + '12',
  },
  presetsSection: {
    marginBottom: 20,
  },
  presetsSectionHeader: {
    marginBottom: 12,
  },
  presetsTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  presetsSectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  presetsCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetsSectionSubtitle: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 3,
    lineHeight: 17,
  },
  presetCategorySection: {
    marginBottom: 16,
  },
  presetCategoryTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  presetCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  presetCardDangerous: {
    borderColor: Colors.danger + '25',
  },
  presetHeader: {
    flexDirection: 'row',
    gap: 10,
  },
  presetHeaderText: {
    flex: 1,
  },
  presetName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  presetDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 3,
    lineHeight: 17,
  },
  presetMeta: {
    gap: 4,
  },
  presetMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  presetInterval: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  addPresetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primary + '12',
    borderWidth: 1,
    borderColor: Colors.primary + '25',
  },
  addPresetBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  builderContainer: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.accent + '25',
    gap: 18,
  },
  builderTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  builderSubtitle: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: -8,
  },
  builderField: {
    gap: 6,
  },
  builderFieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  builderLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    letterSpacing: 0.8,
  },
  builderInput: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  scopeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  scopeBtnActive: {
    backgroundColor: Colors.primary + '18',
    borderColor: Colors.primary + '50',
  },
  scopeBtnText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
  },
  scopeBtnTextActive: {
    color: Colors.primary,
  },
  addCondBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.primary + '12',
  },
  addCondBtnText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  noCondText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontStyle: 'italic' as const,
  },
  condBuilder: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  condFieldBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  condFieldBtnText: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  opRow: {
    maxHeight: 32,
  },
  opBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.surfaceElevated,
    marginRight: 4,
  },
  opBtnActive: {
    backgroundColor: Colors.primary + '25',
  },
  opBtnText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '600' as const,
  },
  opBtnTextActive: {
    color: Colors.primary,
  },
  condValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  condValueInput: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: Colors.text,
    fontSize: 13,
  },
  condRemoveBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: Colors.danger + '12',
  },
  fieldPickerList: {
    maxHeight: 160,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fieldPickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  fieldPickerItemActive: {
    backgroundColor: Colors.primary + '12',
  },
  fieldPickerText: {
    fontSize: 12,
    color: Colors.text,
  },
  fieldPickerTextActive: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  actionPickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionPickerText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  actionPickerList: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
    overflow: 'hidden',
  },
  actionPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  actionPickerItemActive: {
    backgroundColor: Colors.primary + '08',
  },
  actionPickerItemText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  builderActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  builderCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  builderCancelText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  builderSaveBtn: {
    flex: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  builderSaveText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 12,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
});
