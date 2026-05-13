import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Phone, Video, MoreVertical, Plus, Send,
  Image as ImageIcon, MapPin, Sparkles, BookHeart, CheckCheck
} from 'lucide-react-native';

const BG = '#0C0C0C';
const HDR_BG = '#1A1A1A';
const INP_BG = '#1C1C1E';
const USER_BUBBLE = '#242424';
const SOFIA_BUBBLE = '#F5F5F3';
const W = '#FFFFFF';
const MUTED = '#A1A1AA';
const RED = '#EF233C';
const BDR = '#2E2E2E';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'sofia';
  time: string;
  read?: boolean;
};

const INITIAL_MESSAGES: Message[] = [
  { id: '1', text: 'Amor, ¿ya llegaste?', sender: 'sofia', time: '18:15' },
  { id: '2', text: 'Sí, ya estoy en casa.', sender: 'user', time: '18:16', read: true },
  { id: '3', text: 'Qué bueno, me avisas cuando termines de comer.', sender: 'sofia', time: '18:17' },
  { id: '4', text: 'Claro. También quería decirte que te extraño.', sender: 'user', time: '18:18', read: true },
  { id: '5', text: 'Yo también te extraño mucho.', sender: 'sofia', time: '18:19' },
  { id: '6', text: 'Hoy te dejé una nota en la app.', sender: 'user', time: '18:20', read: true },
  { id: '7', text: 'La vi, está muy bonita ❤️', sender: 'sofia', time: '18:21' },
];

export default function MensajesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const go = (msg: string) => Alert.alert(msg, 'Función disponible pronto.');

  const handleSend = () => {
    if (!inputText.trim()) return;
    const newMsg: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'user',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([...messages, newMsg]);
    setInputText('');
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleAction = (action: string) => {
    if (action === 'Foto') go('Foto');
    else if (action === 'Nota') router.push('/notes');
    else if (action === 'Ubicacion') router.push('/ubicacion');
    else if (action === 'AI') router.push('/ai-assistant');
  };

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
            <Text style={s.avatarTxt}>S</Text>
          </View>
          <View>
            <Text style={s.headerName}>Sofia</Text>
            <Text style={s.headerStatus}>En línea</Text>
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

      {/* ══════ MESSAGES ══════ */}
      <ScrollView
        ref={scrollRef}
        style={s.chatArea}
        contentContainerStyle={[s.chatContent, { paddingBottom: 20 }]}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        <View style={s.dateDivider}>
          <Text style={s.dateTxt}>Hoy</Text>
        </View>

        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <View key={msg.id} style={[s.bubbleRow, isUser ? s.rowUser : s.rowSofia]}>
              <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleSofia]}>
                <Text style={[s.msgTxt, isUser ? s.msgTxtUser : s.msgTxtSofia]}>
                  {msg.text}
                </Text>
                <View style={s.msgFooter}>
                  <Text style={[s.timeTxt, isUser ? s.timeTxtUser : s.timeTxtSofia]}>
                    {msg.time}
                  </Text>
                  {isUser && <CheckCheck size={12} color={msg.read ? '#3B82F6' : MUTED} style={s.readIcon} />}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* ══════ QUICK ACTIONS ══════ */}
      <View style={s.quickActions}>
        {[
          { icon: <ImageIcon size={14} color={W} />, lbl: 'Foto' },
          { icon: <BookHeart size={14} color={W} />, lbl: 'Nota' },
          { icon: <MapPin size={14} color={W} />, lbl: 'Ubicacion' },
          { icon: <Sparkles size={14} color={RED} />, lbl: 'AI' },
        ].map((act, i) => (
          <Pressable key={i} style={s.actionChip} onPress={() => handleAction(act.lbl)}>
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
          />
        </View>
        <Pressable
          style={[s.sendBtn, !inputText.trim() && s.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Send size={18} color={W} style={{ marginLeft: 2 }} />
        </Pressable>
      </View>

      </KeyboardAvoidingView>
    </View>
  );
}

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
  avatar: { width: 38, height: 38, borderRadius: 20, backgroundColor: RED, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarTxt: { color: W, fontSize: 16, fontWeight: '800' },
  headerName: { color: W, fontSize: 16, fontWeight: '700', letterSpacing: 0 },
  headerStatus: { color: MUTED, fontSize: 12, marginTop: 2, letterSpacing: 0 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconBtn: { padding: 4 },

  // Chat Area
  chatArea: { flex: 1 },
  chatContent: { paddingHorizontal: 16, paddingTop: 16 },
  dateDivider: { alignSelf: 'center', backgroundColor: '#1C1C1E', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 16 },
  dateTxt: { color: MUTED, fontSize: 11, fontWeight: '600' },

  bubbleRow: { marginBottom: 12, flexDirection: 'row' },
  rowUser: { justifyContent: 'flex-end' },
  rowSofia: { justifyContent: 'flex-start' },

  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bubbleUser: {
    backgroundColor: USER_BUBBLE,
    borderBottomRightRadius: 4,
  },
  bubbleSofia: {
    backgroundColor: SOFIA_BUBBLE,
    borderBottomLeftRadius: 4,
  },

  msgTxt: { fontSize: 15, lineHeight: 20, letterSpacing: 0 },
  msgTxtUser: { color: W },
  msgTxtSofia: { color: '#111111' },

  msgFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 4 },
  timeTxt: { fontSize: 10 },
  timeTxtUser: { color: 'rgba(255,255,255,0.5)' },
  timeTxtSofia: { color: 'rgba(0,0,0,0.4)' },
  readIcon: { marginLeft: 2 },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: BG,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INP_BG,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BDR,
    gap: 6,
  },
  actionTxt: { color: W, fontSize: 12, fontWeight: '600' },

  // Input
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: BDR,
  },
  attachBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  inputWrapper: {
    flex: 1,
    backgroundColor: INP_BG,
    borderRadius: 20,
    minHeight: 40,
    maxHeight: 100,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 8,
    marginBottom: 4,
  },
  input: { color: W, fontSize: 15, maxHeight: 80 },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: RED,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  sendBtnDisabled: { opacity: 0.5 },
});
