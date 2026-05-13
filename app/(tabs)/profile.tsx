import React from 'react';
import { ScrollView, StyleSheet, Text, View, Image, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart, Image as ImageIcon, BookHeart, MessageCircle, Calendar, ChevronRight, User, HeartHandshake, Palette, Shield, LogOut } from 'lucide-react-native';
import { Link } from 'expo-router';

const { width } = Dimensions.get('window');

// Colors matching the spec
const BG_COLOR = '#0F0F0F'; // premium near black
const CARD_BG = '#1C1C1E'; // dark charcoal
const TEXT_CREAM = '#FFFFFF'; // pure white
const TEXT_MUTED = '#A1A1AA'; // zinc 400 neutral gray
const ACCENT_RED = '#EF233C'; // romantic red

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

  const handleAlert = (title: string, message: string) => {
    Alert.alert(title, message);
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: BG_COLOR }]} 
      contentContainerStyle={[styles.content, { paddingBottom: 160 + insets.bottom, paddingTop: Math.max(insets.top, 10) }]}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Header */}
      <Text style={styles.headerTitle}>Perfil</Text>
      <Text style={styles.headerSubtitle}>El espacio privado de ustedes dos</Text>

      {/* 2. Main couple profile card */}
      <View style={styles.mainProfileCard}>
        <View style={styles.avatarsRow}>
          <View style={styles.avatarWithLabel}>
            <Image source={{ uri: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200' }} style={styles.avatarImage} />
            <Text style={styles.avatarName}>Alejandro</Text>
          </View>
          <View style={styles.heartCircleContainer}>
            <View style={styles.heartCircle}>
              <Heart size={20} color={ACCENT_RED} fill={ACCENT_RED} />
            </View>
          </View>
          <View style={styles.avatarWithLabel}>
            <Image source={{ uri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200' }} style={styles.avatarImage} />
            <Text style={styles.avatarName}>Sofia</Text>
          </View>
        </View>

        <View style={styles.counterPill}>
          <Text style={styles.counterText}>∞ 124 días juntos ∞</Text>
        </View>
        <Text style={styles.counterSubtext}>Desde el 10 de enero</Text>
        <Text style={styles.smallSubtitle}>Una historia guardada solo para ustedes</Text>
      </View>

      {/* 3. Relationship stats section */}
      <Text style={styles.sectionTitle}>Nuestra historia</Text>
      <View style={styles.statsGrid}>
        <StatCard val="12" label="Recuerdos" icon={<ImageIcon size={20} color="#FFBA08" />} iconBg="#FFBA0820" />
        <StatCard val="8" label="Notas" icon={<BookHeart size={20} color="#F48C06" />} iconBg="#F48C0620" />
        <StatCard val="5" label="Mensajes" icon={<MessageCircle size={20} color={ACCENT_RED} />} iconBg="#EF233C20" />
        <StatCard val="3" label="Fechas" icon={<Calendar size={20} color="#D90429" />} iconBg="#D9042920" />
      </View>

      {/* 4. Special date card */}
      <View style={styles.specialDateCard}>
        <View style={styles.specialDateHeader}>
          <View style={[styles.iconCircle, { backgroundColor: '#D9042920' }]}>
            <Calendar size={24} color="#D90429" />
          </View>
          <View style={styles.specialDateContent}>
            <Text style={styles.specialDateTitle}>Próximo día especial</Text>
            <Text style={styles.specialDateText}>Aniversario en 15 días</Text>
          </View>
          <View style={styles.specialDateBadge}>
            <Text style={styles.specialDateBadgeText}>10 de junio</Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.navButton} onPress={() => Alert.alert('Función disponible pronto')}>
            <Text style={styles.navButtonText}>Ver calendario</Text>
          </TouchableOpacity>
      </View>

      {/* 5. Settings section */}
      <Text style={styles.sectionTitle}>Ajustes</Text>
      <View style={styles.settingsContainer}>
        <SettingCard 
          icon={<User size={22} color={TEXT_CREAM} />} 
          title="Editar perfil" 
          subtitle="Actualiza nombres y fotos" 
          onPress={() => handleAlert("Próximamente", "Función disponible pronto.")}
        />
        <SettingCard 
          icon={<HeartHandshake size={22} color="#FFBA08" />} 
          iconBg="#FFBA0820"
          title="Invitar pareja" 
          subtitle="Conecta esta app con tu pareja" 
          onPress={() => handleAlert("Próximamente", "Función disponible pronto.")}
        />
        <SettingCard 
          icon={<Palette size={22} color="#48CAE4" />} 
          iconBg="#48CAE420"
          title="Cambiar tema" 
          subtitle="Personaliza los colores" 
          onPress={() => handleAlert("Próximamente", "Función disponible pronto.")}
        />
        <SettingCard 
          icon={<Shield size={22} color="#38B000" />} 
          iconBg="#38B00020"
          title="Privacidad" 
          subtitle="Controla tus notas y recuerdos" 
          onPress={() => handleAlert("Próximamente", "Función disponible pronto.")}
        />
        <SettingCard 
          icon={<LogOut size={22} color={ACCENT_RED} />} 
          iconBg="#EF233C20"
          title="Cerrar sesión" 
          subtitle="Salir de tu cuenta" 
          isDestructive
          onPress={() => handleAlert("Sesión cerrada", "Has cerrado sesión exitosamente.")}
        />
      </View>

    </ScrollView>
  );
}

function StatCard({ val, label, icon, iconBg }: any) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconCircle, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <Text style={styles.statVal}>{val}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SettingCard({ icon, iconBg = '#3D0D17', title, subtitle, isDestructive = false, onPress }: any) {
  return (
    <TouchableOpacity style={styles.settingCard} onPress={onPress}>
      <View style={[styles.settingIconCircle, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <View style={styles.settingTextContainer}>
        <Text style={[styles.settingTitle, isDestructive && { color: ACCENT_RED }]}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <ChevronRight size={20} color={TEXT_MUTED} />
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
    letterSpacing: 0,
  },
  headerSubtitle: {
    fontSize: 16,
    color: TEXT_MUTED,
    marginBottom: 24,
    lineHeight: 22,
    letterSpacing: 0,
  },
  mainProfileCard: {
    backgroundColor: CARD_BG,
    borderRadius: 32,
    alignItems: 'center',
    padding: 30,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  avatarsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  avatarWithLabel: {
    alignItems: 'center',
  },
  avatarImage: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 2,
    borderColor: CARD_BG,
    marginBottom: 8,
  },
  avatarName: {
    color: TEXT_CREAM,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
  },
  heartCircleContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: -24,
    zIndex: 10,
    marginTop: 20,
  },
  heartCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: TEXT_CREAM,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ACCENT_RED,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  counterPill: {
    backgroundColor: '#27272A',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3F3F46',
    marginBottom: 10,
  },
  counterText: {
    color: ACCENT_RED,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
  },
  counterSubtext: {
    color: TEXT_CREAM,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: 0,
  },
  smallSubtitle: {
    color: TEXT_MUTED,
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    letterSpacing: 0,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_CREAM,
    marginBottom: 16,
    letterSpacing: 0,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statCard: {
    width: '48%',
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  statIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statVal: {
    color: TEXT_CREAM,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: 0,
  },
  statLabel: {
    color: TEXT_MUTED,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
  },
  specialDateCard: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: 20,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  specialDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  specialDateContent: {
    flex: 1,
  },
  specialDateTitle: {
    color: TEXT_CREAM,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0,
  },
  specialDateText: {
    color: TEXT_MUTED,
    fontSize: 14,
    letterSpacing: 0,
  },
  specialDateBadge: {
    backgroundColor: '#27272A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  specialDateBadgeText: {
    color: ACCENT_RED,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
  },
  navButton: {
    backgroundColor: '#27272A',
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  navButtonText: {
    color: TEXT_CREAM,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
  },
  settingsContainer: {
    marginBottom: 20,
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  settingIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    color: TEXT_CREAM,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0,
  },
  settingSubtitle: {
    color: TEXT_MUTED,
    fontSize: 13,
    letterSpacing: 0,
  },
});
