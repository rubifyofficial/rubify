import React, { useState } from 'react';
import {
  Alert,
  Clipboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart, Copy, Link2, LogOut } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthProvider';

// ─── Palette (same as the rest of the app) ───────────────────
const PAGE_BG = '#FFFFFF';
const CARD_BG = '#FFFFFF';
const BORDER = '#F1DCDC';
const WHITE = '#222222';
const MUTED = '#9CA3AF';
const RED = '#F4A6A6';
const RED_SOFT = '#EF233C18';
const GRAY = '#6B7280';

// ─── Spanish error map (shows real message when no translation found) ───
function translateJoinError(msg: string): string {
  if (!msg) return 'Error al conectar pareja';
  const m = msg.toLowerCase();
  if (m.includes('invalid') || m.includes('not found') || m.includes('expired') || m.includes('no invite'))
    return 'Código inválido o expirado';
  if (m.includes('own') || m.includes('yourself'))
    return 'No puedes usar tu propio código';
  if (m.includes('full') || m.includes('two members') || m.includes('already has') || m.includes('complete'))
    return 'Esta pareja ya está completa';
  // Unknown: show the raw Supabase message so we can see what it says
  return msg;
}

function translateCreateError(msg: string): string {
  if (!msg) return 'Error al crear código';
  return msg;
}

// ─── Screen ──────────────────────────────────────────────────
export default function PartnerSetupScreen() {
  const insets = useSafeAreaInsets();
  const { refreshCouple } = useAuth();

  // Section 1 — Create invite
  const [inviteCode, setInviteCode]       = useState<string | null>(null);
  const [creatingCode, setCreatingCode]   = useState(false);
  const [createError, setCreateError]     = useState<string | null>(null);

  // Section 2 — Join with code
  const [joinInput, setJoinInput]         = useState('');
  const [joining, setJoining]             = useState(false);
  const [joinError, setJoinError]         = useState<string | null>(null);

  // ── Create invite ──────────────────────────────────────────
  async function handleCreateInvite() {
    setCreatingCode(true);
    setCreateError(null);
    setInviteCode(null);
    try {
      const { data, error } = await supabase.rpc('create_partner_invite');
      console.log('[PartnerSetup] create_partner_invite raw data:', JSON.stringify(data));
      if (error) {
        console.log('[PartnerSetup] create_partner_invite error:', error.message, '| details:', error.details, '| hint:', error.hint);
        setCreateError(translateCreateError(error.message));
        return;
      }
      // RPC returns a table row → always treat as array
      const result = Array.isArray(data) ? data[0] : data;
      const code: string | undefined = result?.invite_code;
      console.log('[PartnerSetup] extracted invite_code:', code);
      if (!code) {
        setCreateError('No se pudo crear el código');
        return;
      }
      setInviteCode(code);
    } catch (e: any) {
      console.log('[PartnerSetup] create_partner_invite exception:', e);
      setCreateError('Error al crear código');
    } finally {
      setCreatingCode(false);
    }
  }

  // ── Copy to clipboard ──────────────────────────────────────
  function handleCopy() {
    if (!inviteCode) return;
    try {
      Clipboard.setString(inviteCode);
      Alert.alert('Código copiado');
    } catch {
      Alert.alert('Código copiado', inviteCode);
    }
  }

  // ── Join with code ─────────────────────────────────────────
  async function handleJoin() {
    const cleanCode = joinInput.trim().toUpperCase();
    console.log('[PartnerSetup] join cleanCode:', cleanCode);
    if (!cleanCode) {
      setJoinError('Ingresa un código válido');
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      const { data, error } = await supabase.rpc('join_couple_with_code', {
        input_code: cleanCode,
      });
      console.log('[PartnerSetup] join data:', JSON.stringify(data));
      console.log('[PartnerSetup] join error:', error);
      if (error) {
        console.log('[PartnerSetup] join error.message:', error.message);
        console.log('[PartnerSetup] join error.details:', error.details);
        console.log('[PartnerSetup] join error.hint:', error.hint);
        setJoinError(translateJoinError(error.message));
        return;
      }
      // Extract result row — RPC returns { joined: bool, joined_couple_id: uuid }
      const result = Array.isArray(data) ? data[0] : data;
      console.log('[PartnerSetup] join result row:', JSON.stringify(result));
      if (!result?.joined || !result?.joined_couple_id) {
        console.log('[PartnerSetup] join succeeded but joined/joined_couple_id missing');
        setJoinError('No se pudo conectar la pareja');
        return;
      }
      // Success — refresh couple state; AuthProvider guard will navigate to /(tabs)
      console.log('[PartnerSetup] join successful, joined_couple_id:', result.joined_couple_id);
      await refreshCouple();
    } catch (e: any) {
      console.log('[PartnerSetup] join_couple_with_code exception:', e);
      setJoinError(e?.message ?? 'Error al conectar pareja');
    } finally {
      setJoining(false);
    }
  }

  // ── Sign out ───────────────────────────────────────────────
  function handleSignOut() {
    Alert.alert(
      'Cerrar sesión',
      '¿Seguro que quieres salir de tu cuenta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            console.log('[PartnerSetup] signing out');
            const { error } = await supabase.auth.signOut();
            if (error) {
              console.log('[PartnerSetup] signOut error:', error);
              Alert.alert('Error', 'No se pudo cerrar sesión');
            } else {
              console.log('[PartnerSetup] signed out successfully');
              // AuthProvider navigation guard handles redirect to /(auth)/login
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={[st.root, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={st.scroll}
          contentContainerStyle={[st.content, { paddingBottom: 48 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={st.header}>
            <View style={st.heartBadge}>
              <Heart size={22} color={RED} fill={RED} />
            </View>
            <Text style={st.title}>Conecta con{'\n'}tu pareja</Text>
            <Text style={st.subtitle}>
              Invita a tu pareja o ingresa su código para empezar.
            </Text>
          </View>

          {/* ── Divider ── */}
          <View style={st.divider} />

          {/* ══════ SECTION 1 — Create invite ══════ */}
          <View style={st.card}>
            <View style={st.cardHeader}>
              <View style={st.cardIconWrap}>
                <Heart size={16} color={RED} />
              </View>
              <Text style={st.cardTitle}>Invitar pareja</Text>
            </View>
            <Text style={st.cardBody}>
              Crea un código para que tu pareja se conecte contigo.
            </Text>

            {/* Generated code box */}
            {inviteCode ? (
              <View style={st.codeBox}>
                <Text style={st.codeText} selectable>{inviteCode}</Text>
                <Pressable
                  style={({ pressed }) => [st.copyBtn, pressed && st.pressed]}
                  onPress={handleCopy}
                  accessibilityLabel="Copiar código"
                >
                  <Copy size={15} color={RED} />
                  <Text style={st.copyBtnText}>Copiar código</Text>
                </Pressable>
              </View>
            ) : null}

            {createError ? (
              <Text style={st.errorText}>{createError}</Text>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                st.primaryBtn,
                creatingCode && st.btnDisabled,
                pressed && !creatingCode && st.pressed,
              ]}
              onPress={handleCreateInvite}
              disabled={creatingCode}
              accessibilityLabel="Crear código de invitación"
            >
              {creatingCode ? (
                <ActivityIndicator size="small" color={WHITE} />
              ) : (
                <Text style={st.primaryBtnText}>Crear código</Text>
              )}
            </Pressable>
          </View>

          {/* ── OR separator ── */}
          <View style={st.orRow}>
            <View style={st.orLine} />
            <Text style={st.orText}>o</Text>
            <View style={st.orLine} />
          </View>

          {/* ══════ SECTION 2 — Join with code ══════ */}
          <View style={st.card}>
            <View style={st.cardHeader}>
              <View style={st.cardIconWrap}>
                <Link2 size={16} color={RED} />
              </View>
              <Text style={st.cardTitle}>Tengo un código</Text>
            </View>
            <Text style={st.cardBody}>
              Ingresa el código que te compartió tu pareja.
            </Text>

            <TextInput
              style={st.input}
              placeholder="Código de invitación"
              placeholderTextColor={GRAY}
              value={joinInput}
              onChangeText={t => {
                setJoinInput(t);
                setJoinError(null);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!joining}
              accessibilityLabel="Campo código de invitación"
            />

            {joinError ? (
              <Text style={st.errorText}>{joinError}</Text>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                st.primaryBtn,
                joining && st.btnDisabled,
                pressed && !joining && st.pressed,
              ]}
              onPress={handleJoin}
              disabled={joining}
              accessibilityLabel="Conectar con código de pareja"
            >
              {joining ? (
                <ActivityIndicator size="small" color={WHITE} />
              ) : (
                <Text style={st.primaryBtnText}>Conectar</Text>
              )}
            </Pressable>
          </View>

          {/* ── Sign out link ── */}
          <Pressable
            style={({ pressed }) => [st.signOutBtn, pressed && st.pressed]}
            onPress={handleSignOut}
            accessibilityLabel="Cerrar sesión"
          >
            <LogOut size={14} color={MUTED} />
            <Text style={st.signOutText}>Cerrar sesión</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const st = StyleSheet.create({
  root:   { flex: 1, backgroundColor: PAGE_BG },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 22 },

  // Header
  header: { alignItems: 'center', paddingTop: 36, paddingBottom: 28 },
  heartBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: RED_SOFT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: `${RED}30`,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: WHITE,
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },

  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginBottom: 24,
  },

  // Card
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  cardIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: RED_SOFT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: WHITE,
    letterSpacing: 0,
  },
  cardBody: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 20,
    marginBottom: 16,
  },

  // Generated code box
  codeBox: {
    backgroundColor: '#0D0D0F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${RED}40`,
    padding: 14,
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  codeText: {
    fontSize: 22,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: 6,
    textAlign: 'center',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: RED_SOFT,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${RED}30`,
  },
  copyBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: RED,
  },

  // Input
  input: {
    height: 50,
    backgroundColor: '#0D0D0F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    fontSize: 16,
    color: WHITE,
    letterSpacing: 2,
    marginBottom: 14,
  },

  // Error
  errorText: {
    fontSize: 13,
    color: RED,
    marginBottom: 12,
    fontWeight: '500',
  },

  // Primary button
  primaryBtn: {
    height: 50,
    backgroundColor: RED,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  btnDisabled: {
    opacity: 0.55,
  },
  pressed: { opacity: 0.88 },

  // OR separator
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    marginBottom: 16,
    gap: 12,
  },
  orLine: { flex: 1, height: 1, backgroundColor: BORDER },
  orText: { fontSize: 13, color: MUTED, fontWeight: '600' },

  // Sign out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 12,
  },
  signOutText: {
    fontSize: 13,
    color: MUTED,
    fontWeight: '500',
  },
});
