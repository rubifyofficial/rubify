import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Phone, Video, MoreVertical, Plus, Send,
  Image as ImageIcon, MapPin, Sparkles, BookHeart, CheckCheck,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

// ─── Palette (unchanged) ─────────────────────────────────────
const BG          = '#0C0C0C';
const HDR_BG      = '#1A1A1A';
const INP_BG      = '#1C1C1E';
const USER_BUBBLE = '#242424';
const SOFIA_BUBBLE = '#F5F5F3';
const W           = '#FFFFFF';
const MUTED       = '#A1A1AA';
const RED         = '#EF233C';
const BDR         = '#2E2E2E';

// ─── Types ────────────────────────────────────────────────────
type DbMessage = {
  id: string;
  couple_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  read_at: string | null;
  created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────
function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// ─── Screen ──────────────────────────────────────────────────
export default function MensajesScreen() {
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  // Auth & couple state
  const [userId, setUserId]   = useState<string | null>(null);
  const [coupleId, setCoupleId] = useState<string | null>(null);

  // Messages state
  const [messages, setMessages]   = useState<DbMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending]     = useState(false);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // ── 1. Load user + couple on mount ──────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Get current user
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (userErr || !user) {
          console.log('[Mensajes] no user:', userErr);
          router.replace('/(auth)/login');
          return;
        }
        if (!mounted) return;
        setUserId(user.id);

        // Get couple
        const { data: coupleData, error: coupleErr } = await supabase.rpc('get_my_couple');
        console.log('[Mensajes] get_my_couple data:', JSON.stringify(coupleData), 'error:', coupleErr);
        if (coupleErr) {
          console.log('[Mensajes] couple error:', coupleErr.message);
          setError('No se encontró la pareja');
          setLoading(false);
          return;
        }
        const coupleRow = Array.isArray(coupleData) ? coupleData[0] : coupleData;
        const cid: string | undefined = coupleRow?.couple_id;
        if (!cid) {
          console.log('[Mensajes] no couple_id — redirecting to partner-setup');
          router.replace('/partner-setup');
          return;
        }
        if (!mounted) return;
        setCoupleId(cid);
      } catch (e: any) {
        console.log('[Mensajes] init exception:', e);
        if (mounted) setError('No se pudieron cargar los mensajes');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ── 2. Fetch messages when coupleId is known ─────────────────
  const fetchMessages = useCallback(async (cid: string) => {
    const { data, error: fetchErr } = await supabase
      .from('messages')
      .select('*')
      .eq('couple_id', cid)
      .order('created_at', { ascending: true });
    console.log('[Mensajes] fetched', data?.length ?? 0, 'messages, error:', fetchErr?.message);
    if (fetchErr) {
      setError('No se pudieron cargar los mensajes');
      return;
    }
    setMessages(data ?? []);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
  }, []);

  useEffect(() => {
    if (!coupleId) return;
    fetchMessages(coupleId);
  }, [coupleId, fetchMessages]);

  // ── 3. Realtime subscription ─────────────────────────────────
  useEffect(() => {
    if (!coupleId) return;

    const channel = supabase
      .channel(`messages:${coupleId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `couple_id=eq.${coupleId}`,
        },
        (payload) => {
          console.log('[Mensajes] realtime INSERT:', JSON.stringify(payload.new));
          const incoming = payload.new as DbMessage;
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
        }
      )
      .subscribe((status) => {
        console.log('[Mensajes] realtime status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [coupleId]);

  // ── 4. Send message ──────────────────────────────────────────
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !coupleId || !userId || sending) return;

    setSending(true);
    setInputText('');
    try {
      const { error: insertErr } = await supabase.from('messages').insert({
        couple_id: coupleId,
        sender_id: userId,
        content: text,
        message_type: 'text',
      });
      if (insertErr) {
        console.log('[Mensajes] send error:', insertErr.message, '| details:', insertErr.details);
        Alert.alert('Error', 'No se pudo enviar el mensaje');
        setInputText(text); // restore on failure
      } else {
        console.log('[Mensajes] message sent');
        // Realtime will append; also force scroll
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (e: any) {
      console.log('[Mensajes] send exception:', e);
      Alert.alert('Error', 'No se pudo enviar el mensaje');
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  // ── 5. Quick actions ─────────────────────────────────────────
  const handleAction = (action: string) => {
    if (action === 'Foto')      Alert.alert('Función disponible pronto');
    else if (action === 'Nota') router.push('/notes');
    else if (action === 'Ubicacion') router.push('/ubicacion');
    else if (action === 'AI')   router.push('/ai-assistant');
  };

  const go = (msg: string) => Alert.alert(msg, 'Función disponible pronto.');

  // ─── Render ────────────────────────────────────────────────
  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* ══════ HEADER ══════ */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.avatar}>
              <Text style={s.avatarTxt}>P</Text>
            </View>
            <View>
              <Text style={s.headerName}>Pareja</Text>
              <Text style={s.headerStatus}>
                {loading ? 'Cargando...' : coupleId ? 'En línea' : 'Sin conexión'}
              </Text>
            </View>
          </View>
          <View style={s.headerRight}>
            <Pressable onPress={() => go('Llamada')} style={s.iconBtn}>
              <Phone size={20} color={W} />
            </Pressable>
            <Pressable onPress={() => go('Video')} style={s.iconBtn}>
              <Video size={20} color={W} />
            </Pressable>
            <Pressable onPress={() => go('Opciones')} style={s.iconBtn}>
              <MoreVertical size={20} color={W} />
            </Pressable>
          </View>
        </View>

        {/* ══════ BODY ══════ */}
        {loading ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={RED} />
          </View>
        ) : error ? (
          <View style={s.centered}>
            <Text style={s.errorTxt}>{error}</Text>
            <Pressable
              style={s.retryBtn}
              onPress={() => coupleId && fetchMessages(coupleId)}
            >
              <Text style={s.retryTxt}>Reintentar</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* ══════ MESSAGES ══════ */}
            <ScrollView
              ref={scrollRef}
              style={s.chatArea}
              contentContainerStyle={[
                s.chatContent,
                { paddingBottom: 20 },
              ]}
              onContentSizeChange={() =>
                scrollRef.current?.scrollToEnd({ animated: true })
              }
            >
              <View style={s.dateDivider}>
                <Text style={s.dateTxt}>Hoy</Text>
              </View>

              {messages.length === 0 ? (
                <View style={s.emptyWrap}>
                  <Text style={s.emptyTxt}>
                    Empieza la conversación con tu pareja
                  </Text>
                </View>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_id === userId;
                  return (
                    <View
                      key={msg.id}
                      style={[s.bubbleRow, isMe ? s.rowUser : s.rowSofia]}
                    >
                      <View
                        style={[
                          s.bubble,
                          isMe ? s.bubbleUser : s.bubbleSofia,
                        ]}
                      >
                        <Text
                          style={[
                            s.msgTxt,
                            isMe ? s.msgTxtUser : s.msgTxtSofia,
                          ]}
                        >
                          {msg.content}
                        </Text>
                        <View style={s.msgFooter}>
                          <Text
                            style={[
                              s.timeTxt,
                              isMe ? s.timeTxtUser : s.timeTxtSofia,
                            ]}
                          >
                            {fmtTime(msg.created_at)}
                          </Text>
                          {isMe && (
                            <CheckCheck
                              size={12}
                              color={msg.read_at ? '#3B82F6' : MUTED}
                              style={s.readIcon}
                            />
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {/* ══════ QUICK ACTIONS ══════ */}
            <View style={s.quickActions}>
              {[
                { icon: <ImageIcon size={14} color={W} />, lbl: 'Foto' },
                { icon: <BookHeart size={14} color={W} />, lbl: 'Nota' },
                { icon: <MapPin size={14} color={W} />, lbl: 'Ubicacion' },
                { icon: <Sparkles size={14} color={RED} />, lbl: 'AI' },
              ].map((act, i) => (
                <Pressable
                  key={i}
                  style={s.actionChip}
                  onPress={() => handleAction(act.lbl)}
                >
                  {act.icon}
                  <Text style={s.actionTxt}>{act.lbl}</Text>
                </Pressable>
              ))}
            </View>

            {/* ══════ INPUT ══════ */}
            <View style={[s.inputArea, { paddingBottom: 10 }]}>
              <Pressable style={s.attachBtn} onPress={() => go('Adjuntar')}>
                <Plus size={24} color={MUTED} />
              </Pressable>
              <View style={s.inputWrapper}>
                <TextInput
                  style={s.input}
                  placeholder="Escribe un mensaje..."
                  placeholderTextColor={MUTED}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxLength={500}
                  editable={!sending}
                />
              </View>
              <Pressable
                style={[
                  s.sendBtn,
                  (!inputText.trim() || sending) && s.sendBtnDisabled,
                ]}
                onPress={handleSend}
                disabled={!inputText.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={W} />
                ) : (
                  <Send size={18} color={W} style={{ marginLeft: 2 }} />
                )}
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles (identical to original) ──────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: HDR_BG,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BDR,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 38, height: 38, borderRadius: 20,
    backgroundColor: RED,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarTxt:    { color: W, fontSize: 16, fontWeight: '800' },
  headerName:   { color: W, fontSize: 16, fontWeight: '700', letterSpacing: 0 },
  headerStatus: { color: MUTED, fontSize: 12, marginTop: 2, letterSpacing: 0 },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconBtn:      { padding: 4 },

  // Loading / error
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorTxt: { color: RED, fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 16 },
  retryBtn: {
    backgroundColor: '#1C1C1E', paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: BDR,
  },
  retryTxt: { color: W, fontSize: 14, fontWeight: '600' },

  // Chat
  chatArea:    { flex: 1 },
  chatContent: { paddingHorizontal: 16, paddingTop: 16 },
  dateDivider: {
    alignSelf: 'center', backgroundColor: '#1C1C1E',
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 12, marginBottom: 16,
  },
  dateTxt: { color: MUTED, fontSize: 11, fontWeight: '600' },

  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyTxt:  { color: MUTED, fontSize: 14, fontStyle: 'italic' },

  bubbleRow:   { marginBottom: 12, flexDirection: 'row' },
  rowUser:     { justifyContent: 'flex-end' },
  rowSofia:    { justifyContent: 'flex-start' },

  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20,
  },
  bubbleUser:  { backgroundColor: USER_BUBBLE, borderBottomRightRadius: 4 },
  bubbleSofia: { backgroundColor: SOFIA_BUBBLE, borderBottomLeftRadius: 4 },

  msgTxt:      { fontSize: 15, lineHeight: 20, letterSpacing: 0 },
  msgTxtUser:  { color: W },
  msgTxtSofia: { color: '#111111' },

  msgFooter: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'flex-end', marginTop: 4, gap: 4,
  },
  timeTxt:      { fontSize: 10 },
  timeTxtUser:  { color: 'rgba(255,255,255,0.5)' },
  timeTxtSofia: { color: 'rgba(0,0,0,0.4)' },
  readIcon:     { marginLeft: 2 },

  // Quick Actions
  quickActions: {
    flexDirection: 'row', paddingHorizontal: 12,
    paddingVertical: 8, gap: 8, backgroundColor: BG,
  },
  actionChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: INP_BG,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1, borderColor: BDR, gap: 6,
  },
  actionTxt: { color: W, fontSize: 12, fontWeight: '600' },

  // Input
  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingTop: 10,
    backgroundColor: BG, borderTopWidth: 1, borderTopColor: BDR,
  },
  attachBtn:    { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  inputWrapper: {
    flex: 1, backgroundColor: INP_BG, borderRadius: 20,
    minHeight: 40, maxHeight: 100, justifyContent: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    marginHorizontal: 8, marginBottom: 4,
  },
  input:         { color: W, fontSize: 15, maxHeight: 80 },
  sendBtn:       {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: RED,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  sendBtnDisabled: { opacity: 0.5 },
});
