import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, Image, ImageBackground
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Phone, Video, Plus, Send, ChevronLeft, Search, Play
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useProfileAndCouple } from '../../lib/useProfileAndCouple';
import { useGlobalCall } from '../../components/calls/CallProvider';

// --- Light / Pastel Theme Constants ---
const BG = '#FFFFFF';
const HDR_BG = '#FFFFFF';
const INP_BG = '#FFF7F7';
const USER_BUBBLE = '#F4A6A6';
const PARTNER_BUBBLE = '#FFF7F7';
const TEXT_DARK = '#222222';
const TEXT_MUTED = '#9CA3AF';
const BORDER = '#F1DCDC';
const MEMORY_SHARE_PREFIX = 'USFULLY_MEMORY_SHARE::';

type MemorySharePayload = {
  kind: 'memory_share';
  memoryId?: string;
  title?: string;
  dateLabel?: string;
  type?: 'photo' | 'video' | string;
  mediaUrl?: string | null;
  comment?: string;
};

const parseMemoryShareMessage = (content?: string): MemorySharePayload | null => {
  if (!content?.startsWith(MEMORY_SHARE_PREFIX)) return null;

  try {
    const raw = content.slice(MEMORY_SHARE_PREFIX.length);
    const parsed = JSON.parse(raw);

    if (parsed?.kind !== 'memory_share') return null;

    return parsed;
  } catch (error) {
    console.log('[Messages] Failed to parse memory share message:', error);
    return null;
  }
};

const getSearchableMessageText = (message: any): string => {
  const parsedMemoryShare = parseMemoryShareMessage(message?.content);
  if (parsedMemoryShare) {
    return [
      parsedMemoryShare.title,
      parsedMemoryShare.dateLabel,
      parsedMemoryShare.comment,
      parsedMemoryShare.type,
      'recuerdo compartido',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  return String(message?.content || '').toLowerCase();
};

export default function MensajesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, couple } = useProfileAndCouple();
  const { startGlobalCall, isStartingCall, canStartCall } = useGlobalCall();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const partnerName = couple?.partner_name || 'Pareja';
  const partnerAvatar = couple?.partner_avatar_url;
  const handleStartAudioCall = useCallback(() => {
    void startGlobalCall('audio');
  }, [startGlobalCall]);

  const handleStartVideoCall = useCallback(() => {
    void startGlobalCall('video');
  }, [startGlobalCall]);

  const filteredMessages = messages.filter((m) =>
    getSearchableMessageText(m).includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (couple?.couple_id) {
      fetchMessages();
      const subscription = subscribeToMessages();
      return () => {
        subscription.unsubscribe();
      };
    }
  }, [couple]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('couple_id', couple?.couple_id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessages(data || []);
    } catch (e: any) {
      console.error('[Messages] fetch error:', JSON.stringify(e, null, 2));
      Alert.alert('Error', 'No se pudieron cargar los mensajes. ' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const openMomentFromChat = useCallback(
    (message: any) => {
      if (!message?.moment_id) {
        router.push('/(tabs)/moments');
        return;
      }

      router.push({
        pathname: '/(tabs)/moments',
        params: { momentId: String(message.moment_id) },
      } as any);
    },
    [router]
  );

  const renderMomentMessage = useCallback(
    (message: any, key: string, memorySharePayload: MemorySharePayload | null = null) => {
      const isMe = message.sender_id === profile?.id;
      const mediaType = memorySharePayload
        ? memorySharePayload.type === 'video'
          ? 'video'
          : 'image'
        : message.media_type === 'video'
          ? 'video'
          : 'image';
      const badge = memorySharePayload
        ? mediaType === 'video'
          ? 'VIDEO'
          : 'FOTO'
        : message.moment_badge || (mediaType === 'video' ? 'VIDEO' : 'FOTO');
      const subtitle = memorySharePayload
        ? memorySharePayload.dateLabel || 'Recuerdo compartido'
        : message.moment_subtitle || 'Una pequeña parte de su historia';
      const comment = memorySharePayload?.comment || message.moment_comment || '';
      const previewUrl = memorySharePayload
        ? mediaType === 'image'
          ? memorySharePayload.mediaUrl || null
          : null
        : message.thumbnail_url || (mediaType === 'image' ? message.media_url : null);

      return (
        <View key={key} style={[s.msgRow, isMe ? s.rowMe : s.rowPartner]}>
          <Pressable
            onPress={() => openMomentFromChat(message)}
            style={[s.bubble, isMe ? s.bubbleMe : s.bubblePartner, s.momentMessageBubble]}
          >
            {previewUrl ? (
              <ImageBackground source={{ uri: previewUrl }} style={s.chatMomentPreview} imageStyle={s.chatMomentPreviewImage}>
                <View style={s.chatMomentOverlay}>
                  <View style={s.chatMomentBadge}>
                    <Text style={s.chatMomentBadgeText}>{badge}</Text>
                  </View>

                  {mediaType === 'video' ? (
                    <View style={s.chatMomentPlayButton}>
                      <Play size={22} color="#fff" fill="#fff" />
                    </View>
                  ) : null}

                  <View style={s.chatMomentBottom}>
                    <Text style={s.chatMomentSubtitle} numberOfLines={2}>
                      {subtitle}
                    </Text>
                    {comment ? (
                      <View style={s.chatMomentCommentBox}>
                        <Text style={s.chatMomentCommentLabel}>Comentario</Text>
                        <Text style={s.chatMomentCommentText}>{comment}</Text>
                      </View>
                    ) : null}
                    <Text style={s.chatMomentOpenText}>Toca para abrir en Momentos</Text>
                  </View>
                </View>
              </ImageBackground>
            ) : (
              <View style={[s.chatMomentPreview, s.chatMomentPreviewFallback]}>
                <View style={s.chatMomentOverlay}>
                  <View style={s.chatMomentBadge}>
                    <Text style={s.chatMomentBadgeText}>{badge}</Text>
                  </View>
                  {mediaType === 'video' ? (
                    <View style={s.chatMomentPlayButton}>
                      <Play size={22} color="#fff" fill="#fff" />
                    </View>
                  ) : null}
                  <View style={s.chatMomentBottom}>
                    <Text style={s.chatMomentSubtitle} numberOfLines={2}>
                      {subtitle}
                    </Text>
                    {comment ? (
                      <View style={s.chatMomentCommentBox}>
                        <Text style={s.chatMomentCommentLabel}>Comentario</Text>
                        <Text style={s.chatMomentCommentText}>{comment}</Text>
                      </View>
                    ) : null}
                    <Text style={s.chatMomentOpenText}>Toca para abrir en Momentos</Text>
                  </View>
                </View>
              </View>
            )}

            <Text style={[s.timeTxt, isMe ? s.timeMe : s.timePartner]}>
              {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </Pressable>
        </View>
      );
    },
    [openMomentFromChat, profile?.id]
  );

  const subscribeToMessages = () => {
    return supabase
      .channel('public:messages')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `couple_id=eq.${couple?.couple_id}`
      }, (payload) => {
        setMessages(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
      })
      .subscribe();
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !couple?.couple_id || !profile?.id) return;
    const text = inputText.trim();
    setInputText('');
    
    try {
      const { data, error } = await supabase.from('messages').insert({
        couple_id: couple.couple_id,
        sender_id: profile.id,
        content: text
      }).select().single();
      
      if (error) throw error;
      
      if (data) {
        setMessages(prev => {
          if (prev.find(m => m.id === data.id)) return prev;
          return [...prev, data];
        });
      }
    } catch (e: any) {
      console.error('[Messages] send error:', JSON.stringify(e, null, 2));
      Alert.alert('Error', 'No se pudo enviar el mensaje. ' + (e.message || ''));
      setInputText(text);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={[s.header, { paddingTop: Math.max(insets.top, 10) }]}>
        <Pressable onPress={() => router.back()} style={s.hdrBtn}>
          <ChevronLeft size={24} color={TEXT_DARK} />
        </Pressable>
        
        <View style={s.hdrUser}>
          <AvatarSource uri={partnerAvatar} initial={partnerName.charAt(0)} size={40} />
          <View style={s.hdrTxtBox}>
            <Text style={s.hdrName}>{partnerName}</Text>
            <View style={s.hdrStatusRow}>
              <View style={s.hdrDot} />
              <Text style={s.hdrStatus}>en línea ahora</Text>
            </View>
          </View>
        </View>

        <View style={s.hdrActions}>
          <Pressable
            style={[s.hdrBtn, (isStartingCall || !canStartCall) && s.hdrBtnDisabled]}
            onPress={handleStartAudioCall}
            disabled={isStartingCall || !canStartCall}
          >
            <Phone size={20} color={TEXT_DARK} />
          </Pressable>
          <Pressable
            style={[s.hdrBtn, (isStartingCall || !canStartCall) && s.hdrBtnDisabled]}
            onPress={handleStartVideoCall}
            disabled={isStartingCall || !canStartCall}
          >
            <Video size={20} color={TEXT_DARK} />
          </Pressable>
        </View>
      </View>

      <View style={s.searchContainer}>
        <Search size={18} color={TEXT_MUTED} style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          placeholder="Buscar mensajes..."
          placeholderTextColor={TEXT_MUTED}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={s.chatArea}
        contentContainerStyle={s.chatContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {loading ? (
          <ActivityIndicator color={USER_BUBBLE} style={{ marginTop: 20 }} />
        ) : filteredMessages.length === 0 && searchQuery ? (
          <Text style={s.noResultsText}>No se encontraron mensajes.</Text>
        ) : (
          filteredMessages.map((m, idx) => {
            const isMe = m.sender_id === profile?.id;
            const parsedMemoryShare = parseMemoryShareMessage(m.content);
            if (m.message_type === 'moment' || parsedMemoryShare) {
              return renderMomentMessage(m, String(m.id || idx), parsedMemoryShare);
            }
            return (
              <View key={m.id || idx} style={[s.msgRow, isMe ? s.rowMe : s.rowPartner]}>
                <View style={[s.bubble, isMe ? s.bubbleMe : s.bubblePartner]}>
                  <Text style={[s.msgTxt, isMe ? s.txtMe : s.txtPartner]}>{m.content}</Text>
                  <Text style={[s.timeTxt, isMe ? s.timeMe : s.timePartner]}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={[s.inputArea, { paddingBottom: Math.max(insets.bottom, 15) }]}>
        <Pressable style={s.inpAdd}><Plus size={24} color={TEXT_MUTED} /></Pressable>
        <TextInput
          style={s.input}
          placeholder="Escribe un mensaje tierno..."
          placeholderTextColor={TEXT_MUTED}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <Pressable style={[s.sendBtn, !inputText.trim() && { opacity: 0.5 }]} onPress={sendMessage}>
          <Send size={20} color="#FFF" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function AvatarSource({ uri, initial, size }: any) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: PARTNER_BUBBLE, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: BORDER }}>
      <Text style={{ fontSize: size * 0.4, fontWeight: '800', color: USER_BUBBLE }}>{initial}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: HDR_BG,
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  hdrBtn: { padding: 8 },
  hdrBtnDisabled: { opacity: 0.45 },
  hdrUser: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
  hdrTxtBox: { marginLeft: 12 },
  hdrName: { fontSize: 17, fontWeight: '800', color: TEXT_DARK },
  hdrStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  hdrDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 6 },
  hdrStatus: { fontSize: 12, color: '#10B981', fontWeight: '600' },
  hdrActions: { flexDirection: 'row' },
  callNoticeBar: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#FFF4F7',
    borderWidth: 1,
    borderColor: '#F3D9E2',
  },
  callNoticeText: {
    color: '#8D6675',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: TEXT_DARK,
  },
  noResultsText: {
    textAlign: 'center',
    color: TEXT_MUTED,
    marginTop: 20,
    fontSize: 15,
  },

  chatArea: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 30 },
  msgRow: { marginBottom: 12, flexDirection: 'row' },
  rowMe: { justifyContent: 'flex-end' },
  rowPartner: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 20 },
  bubbleMe: { backgroundColor: USER_BUBBLE, borderBottomRightRadius: 4 },
  bubblePartner: { backgroundColor: PARTNER_BUBBLE, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: BORDER },
  msgTxt: { fontSize: 16, lineHeight: 22 },
  txtMe: { color: '#FFF', fontWeight: '500' },
  txtPartner: { color: TEXT_DARK },
  timeTxt: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  timeMe: { color: 'rgba(255,255,255,0.7)' },
  timePartner: { color: TEXT_MUTED },

  momentMessageBubble: {
    padding: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    maxWidth: '78%',
    borderRadius: 26,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  chatMomentPreview: {
    width: 230,
    height: 310,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderRadius: 26,
  },
  chatMomentPreviewFallback: {
    borderRadius: 26,
  },
  chatMomentPreviewImage: {
    borderRadius: 26,
  },
  chatMomentOverlay: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.20)',
    borderRadius: 26,
  },
  chatMomentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  chatMomentBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#7b2d3b',
    letterSpacing: 0.8,
  },
  chatMomentPlayButton: {
    position: 'absolute',
    top: '45%',
    left: '50%',
    marginLeft: -26,
    marginTop: -26,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  chatMomentBottom: {
    gap: 4,
  },
  chatMomentCommentBox: {
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chatMomentCommentLabel: {
    color: '#7b2d3b',
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chatMomentCommentText: {
    color: '#3B2730',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  chatMomentSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '700',
  },
  chatMomentOpenText: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '700',
  },

  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: HDR_BG,
    borderTopWidth: 1,
    borderColor: BORDER,
  },
  inpAdd: { padding: 8 },
  input: {
    flex: 1,
    backgroundColor: INP_BG,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: TEXT_DARK,
    marginHorizontal: 8,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: USER_BUBBLE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  incomingCallIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF2F6',
    borderWidth: 1,
    borderColor: '#F3D9E2',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_DARK,
    marginBottom: 8,
  },
  incomingCallerName: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_DARK,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 15,
    color: TEXT_MUTED,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: '#F3F4F6',
  },
  modalBtnConfirm: {
    backgroundColor: USER_BUBBLE,
  },
  modalBtnDisabled: {
    opacity: 0.6,
  },
  modalBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalBtnTextCancel: {
    color: TEXT_DARK,
    fontSize: 16,
    fontWeight: '600',
  },
  incomingCallTitle: {
    marginTop: 16,
  },
});
