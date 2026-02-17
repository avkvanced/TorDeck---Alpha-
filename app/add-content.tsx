import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  X,
  Magnet,
  Hash,
  Globe,
  Newspaper,
  CheckCircle,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLibrary } from '@/hooks/useLibrary';
import { AddContentType } from '@/types/torbox';

const CONTENT_TYPES: { type: AddContentType; label: string; icon: React.ComponentType<{ size: number; color: string }>; placeholder: string; description: string }[] = [
  { type: 'magnet', label: 'Magnet Link', icon: Magnet, placeholder: 'magnet:?xt=urn:btih:...', description: 'Paste a magnet link to add a torrent' },
  { type: 'hash', label: 'Info Hash', icon: Hash, placeholder: 'e.g. 08ada5a7a6183aae1e09d831df6748d566095a10', description: 'Enter a torrent info hash' },
  { type: 'web', label: 'Web URL', icon: Globe, placeholder: 'https://example.com/file.zip', description: 'Direct download link for web downloads' },
  { type: 'nzb', label: 'NZB Link', icon: Newspaper, placeholder: 'https://example.com/file.nzb', description: 'URL to an NZB file for Usenet' },
];

export default function AddContentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: AddContentType }>();
  const { addMagnet, addHash, addWeb, addNzb, isAddingMagnet, isAddingHash, isAddingWeb, isAddingNzb } = useLibrary();

  const getInitialType = useCallback((): AddContentType => {
    const requestedType = params.type;
    if (requestedType === 'magnet' || requestedType === 'hash' || requestedType === 'web' || requestedType === 'nzb') {
      return requestedType;
    }
    return 'magnet';
  }, [params.type]);

  const [selectedType, setSelectedType] = useState<AddContentType>(getInitialType);
  const [inputValue, setInputValue] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);

  const isAdding = isAddingMagnet || isAddingHash || isAddingWeb || isAddingNzb;

  const currentType = CONTENT_TYPES.find(t => t.type === selectedType)!;

  const handleSubmit = useCallback(async () => {
    const value = inputValue.trim();
    if (!value) {
      Alert.alert('Error', 'Please enter a value');
      return;
    }

    try {
      switch (selectedType) {
        case 'magnet':
          await addMagnet(value);
          break;
        case 'hash':
          await addHash(value);
          break;
        case 'web':
          await addWeb(value);
          break;
        case 'nzb':
          await addNzb(value);
          break;
      }
      setSuccess(true);
      setInputValue('');
      setTimeout(() => {
        setSuccess(false);
        router.back();
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add content';
      Alert.alert('Error', message);
    }
  }, [selectedType, inputValue, addMagnet, addHash, addWeb, addNzb, router]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topBar}>
          <Text style={styles.screenTitle}>Add Content</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID="close-add-content"
          >
            <X size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
          {success ? (
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <CheckCircle size={48} color={Colors.primary} />
              </View>
              <Text style={styles.successText}>Added successfully!</Text>
              <Text style={styles.successSub}>Redirecting...</Text>
            </View>
          ) : (
            <>
              <View style={styles.typeSelector}>
                {CONTENT_TYPES.map(ct => {
                  const Icon = ct.icon;
                  const isActive = selectedType === ct.type;
                  return (
                    <TouchableOpacity
                      key={ct.type}
                      style={[styles.typeChip, isActive && styles.typeChipActive]}
                      onPress={() => {
                        setSelectedType(ct.type);
                        setInputValue('');
                      }}
                    >
                      <Icon size={16} color={isActive ? Colors.primary : Colors.textTertiary} />
                      <Text style={[styles.typeChipText, isActive && styles.typeChipTextActive]}>
                        {ct.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.description}>{currentType.description}</Text>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={inputValue}
                  onChangeText={setInputValue}
                  placeholder={currentType.placeholder}
                  placeholderTextColor={Colors.textTertiary}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="add-content-input"
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, isAdding && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isAdding || !inputValue.trim()}
                activeOpacity={0.7}
                testID="submit-content"
              >
                {isAdding ? (
                  <ActivityIndicator size="small" color={Colors.text} />
                ) : (
                  <Text style={styles.submitText}>
                    Add {currentType.label}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeChipActive: {
    backgroundColor: Colors.primary + '15',
    borderColor: Colors.primary,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  typeChipTextActive: {
    color: Colors.primary,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  inputContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  input: {
    color: Colors.text,
    fontSize: 14,
    padding: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successText: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  successSub: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
});
