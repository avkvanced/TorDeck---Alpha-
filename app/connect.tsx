import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Key, ArrowRight, AlertTriangle, Heart, ExternalLink } from 'lucide-react-native';
import * as Linking from 'expo-linking';
import Colors from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';

const REFERRAL_URL = 'https://torbox.app/subscription?referral=25f7a56b-f344-4771-babc-f9b790c66483';
const LOGO_ICON = require('@/assets/images/icon.png');

export default function ConnectScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { connect, isConnecting, connectError } = useAuth();
  const [token, setToken] = useState<string>('');
  const [showReferral, setShowReferral] = useState<boolean>(false);

  const handleConnect = useCallback(async () => {
    if (!token.trim()) return;
    try {
      await connect(token.trim());
      router.replace('/(tabs)/(library)' as any);
    } catch {
      // error handled by connectError
    }
  }, [token, connect, router]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heroSection}>
            <View style={styles.logoContainer}>
              <Image
                source={LOGO_ICON}
                style={styles.logoImage}
              />
            </View>
            <Text style={styles.appName}>TorDeck</Text>
            <Text style={styles.tagline}>Your TorBox dashboard</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Key size={20} color={Colors.primary} />
              <Text style={styles.cardTitle}>Connect TorBox</Text>
            </View>
            <Text style={styles.cardDescription}>
              Enter your TorBox API token to get started. You can find it in your TorBox account settings.
            </Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={token}
                onChangeText={setToken}
                placeholder="Paste your API token here..."
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                editable={!isConnecting}
                testID="token-input"
              />
            </View>

            {connectError && (
              <View style={styles.errorContainer}>
                <AlertTriangle size={16} color={Colors.danger} />
                <Text style={styles.errorText}>{connectError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.connectButton,
                (!token.trim() || isConnecting) && styles.connectButtonDisabled,
              ]}
              onPress={handleConnect}
              disabled={!token.trim() || isConnecting}
              activeOpacity={0.8}
              testID="connect-button"
            >
              {isConnecting ? (
                <ActivityIndicator color={Colors.text} size="small" />
              ) : (
                <>
                  <Text style={styles.connectButtonText}>Connect</Text>
                  <ArrowRight size={18} color={Colors.text} />
                </>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.referralBanner}
            onPress={() => setShowReferral(true)}
            activeOpacity={0.8}
          >
            <Heart size={16} color="#F472B6" />
            <Text style={styles.referralBannerText}>
              Don't have a TorBox account? Sign up to support the project!
            </Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Your token is stored securely on-device only.
            </Text>
            <Text style={styles.footerText}>
              Get your API token at torbox.app/settings
            </Text>
          </View>
        </ScrollView>

        <Modal
          visible={showReferral}
          transparent
          animationType="fade"
          onRequestClose={() => setShowReferral(false)}
        >
          <TouchableOpacity
            style={styles.referralOverlay}
            activeOpacity={1}
            onPress={() => setShowReferral(false)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.referralModal}>
              <View style={styles.referralModalHeader}>
                <View style={styles.referralHeartWrap}>
                  <Heart size={24} color="#F472B6" />
                </View>
                <Text style={styles.referralModalTitle}>Support TorDeck</Text>
                <Text style={styles.referralModalDesc}>
                  Don't have a TorBox account yet? Using this referral link to sign up or upgrade directly supports TorDeck's development at no extra cost to you.
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
                onPress={() => setShowReferral(false)}
              >
                <Text style={styles.referralCloseBtnText}>Maybe Later</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
    ...(Platform.OS === 'web' ? {
      maxWidth: 480,
      alignSelf: 'center' as const,
      width: '100%' as any,
    } : {}),
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoImage: {
    width: 132,
    height: 132,
    borderRadius: 32,
  },
  appName: {
    fontSize: 34,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 6,
    fontWeight: '500' as const,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 26,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  cardDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger + '15',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    flex: 1,
  },
  connectButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  connectButtonDisabled: {
    opacity: 0.5,
  },
  connectButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  referralBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F472B6' + '10',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F472B6' + '25',
  },
  referralBannerText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500' as const,
    flex: 1,
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
