import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles, Heart, MessageCircleHeart, Wand2, Coffee, ShieldAlert, CheckCircle2, SendHorizontal } from 'lucide-react-native';
import { Stack } from 'expo-router';

// Colors matching the spec
const BG_COLOR = '#0F0F0F'; // premium near black
const CARD_BG = '#1C1C1E'; // dark charcoal
const TEXT_CREAM = '#FFFFFF'; // pure white
const TEXT_MUTED = '#A1A1AA'; // zinc 400 neutral gray
const ACCENT_RED = '#EF233C'; // romantic red

export default function AIAssistantScreen() {
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState("");

  const handleChipPress = (prompt: string) => {
    setInputText(prompt);
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG_COLOR }}>
      <Stack.Screen options={{ 
        title: 'AI Amor', 
        headerStyle: { backgroundColor: BG_COLOR },
        headerTintColor: TEXT_CREAM,
        headerShadowVisible: false 
      }} />
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom, paddingTop: 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Header */}
        <Text style={styles.headerTitle}>AI Amor</Text>
        <Text style={styles.headerSubtitle}>Te ayudo a expresar lo que sientes</Text>

        {/* 2. Main assistant card */}
        <View style={styles.featuredCard}>
          <View style={styles.featuredHeader}>
            <View style={styles.topLabelBadge}>
              <Text style={styles.topLabelText}>Asistente romántico</Text>
            </View>
            <View style={[styles.iconCircle, { backgroundColor: '#EF233C20' }]}>
              <MessageCircleHeart size={24} color={ACCENT_RED} />
            </View>
          </View>
          <Text style={styles.featuredTitle}>¿Qué quieres decir hoy?</Text>
          <Text style={styles.featuredDesc}>Escribe lo que sientes y te ayudo a convertirlo en un mensaje bonito.</Text>
        </View>

        {/* 3. Prompt chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipContent}>
          {['Pedir perdón', 'Buenos días', 'Buenas noches', 'Te extraño', 'Aniversario', 'Explicar lo que siento', 'Idea para cita'].map((prompt, idx) => (
            <TouchableOpacity 
              key={idx} 
              style={styles.chip}
              onPress={() => handleChipPress(prompt)}
            >
              <Text style={styles.chipText}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 4. Mock chat area */}
        <View style={styles.chatArea}>
          <UserBubble text="Quiero decirle que la extraño." />
          <AssistantBubble text="Podrías decirle: Te extraño más de lo que pensaba. Hay momentos en los que solo quisiera abrazarte y estar contigo." />
          
          <UserBubble text="Quiero pedir perdón." />
          <AssistantBubble text="Puedes escribir: Perdón si te hice sentir mal. No era mi intención lastimarte, quiero escucharte y entenderte mejor." />
        </View>

        {/* 5. Mock input area */}
        <View style={styles.inputArea}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Escribe lo que sientes..."
              placeholderTextColor={TEXT_MUTED}
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            <TouchableOpacity 
              style={styles.sendButton}
              onPress={() => Alert.alert("Mensaje creado", "¡El asistente ha generado una respuesta para ti!")}
            >
              <SendHorizontal size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => Alert.alert("Mensaje creado", "Tu mensaje romántico está listo.")}
          >
            <Sparkles size={16} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Crear mensaje</Text>
          </TouchableOpacity>
        </View>

        {/* 6. Quick actions section */}
        <Text style={styles.sectionTitle}>Acciones rápidas</Text>
        
        <ActionCard 
          title="Crear mensaje romántico"
          subtitle="Para un detalle inesperado"
          icon={<Heart size={20} color={ACCENT_RED} />}
          iconBg="#EF233C20"
        />
        <ActionCard 
          title="Mejorar un texto"
          subtitle="Haz que suene más bonito"
          icon={<Wand2 size={20} color="#7209B7" />}
          iconBg="#7209B720"
        />
        <ActionCard 
          title="Sugerir una cita"
          subtitle="Ideas basadas en lo que les gusta"
          icon={<Coffee size={20} color="#FF9F1C" />}
          iconBg="#FF9F1C20"
        />
        <ActionCard 
          title="Calmar una discusión"
          subtitle="Ayuda para comunicarse mejor"
          icon={<ShieldAlert size={20} color="#48CAE4" />}
          iconBg="#48CAE420"
        />

      </ScrollView>
    </View>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <View style={styles.userBubbleContainer}>
      <View style={styles.userBubble}>
        <Text style={styles.bubbleText}>{text}</Text>
      </View>
    </View>
  );
}

function AssistantBubble({ text }: { text: string }) {
  return (
    <View style={styles.assistantBubbleContainer}>
      <View style={styles.assistantBubble}>
        <Sparkles size={14} color="#FFBA08" style={{ marginBottom: 6 }} />
        <Text style={styles.bubbleText}>{text}</Text>
      </View>
    </View>
  );
}

function ActionCard({ title, subtitle, icon, iconBg }: { title: string, subtitle: string, icon: React.ReactNode, iconBg: string }) {
  return (
    <TouchableOpacity 
      style={styles.actionCard}
      onPress={() => Alert.alert("Asistente activado", "Función disponible pronto")}
    >
      <View style={[styles.actionIconCircle, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <View style={styles.actionContent}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: TEXT_CREAM,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: TEXT_MUTED,
    marginBottom: 24,
    lineHeight: 22,
  },
  featuredCard: {
    backgroundColor: CARD_BG,
    borderRadius: 32,
    padding: 24,
    marginBottom: 24,
    shadowColor: ACCENT_RED,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  featuredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topLabelBadge: {
    backgroundColor: '#27272A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  topLabelText: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  featuredTitle: {
    color: TEXT_CREAM,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  featuredDesc: {
    color: TEXT_MUTED,
    fontSize: 15,
    lineHeight: 22,
  },
  chipScroll: {
    marginBottom: 24,
    marginHorizontal: -20,
  },
  chipContent: {
    paddingHorizontal: 20,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3F3F46',
    backgroundColor: '#27272A',
    marginRight: 10,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_CREAM,
  },
  chatArea: {
    marginBottom: 16,
  },
  userBubbleContainer: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  userBubble: {
    backgroundColor: ACCENT_RED,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomRightRadius: 4,
    maxWidth: '80%',
    shadowColor: ACCENT_RED,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  assistantBubbleContainer: {
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  assistantBubble: {
    backgroundColor: '#27272A',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    maxWidth: '85%',
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  bubbleText: {
    color: TEXT_CREAM,
    fontSize: 15,
    lineHeight: 22,
  },
  inputArea: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: 16,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#3F3F46',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#1A050A',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3D0D17',
  },
  textInput: {
    flex: 1,
    color: TEXT_CREAM,
    fontSize: 15,
    maxHeight: 100,
    minHeight: 24,
    padding: 0,
    marginRight: 12,
  },
  sendButton: {
    backgroundColor: ACCENT_RED,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: ACCENT_RED,
    paddingVertical: 14,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ACCENT_RED,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_CREAM,
    marginBottom: 16,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    color: TEXT_CREAM,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  actionSubtitle: {
    color: TEXT_MUTED,
    fontSize: 14,
  },
});
