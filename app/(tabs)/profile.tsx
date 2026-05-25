import React, { useState, useEffect, useCallback } from 'react';
import { 
  ScrollView, StyleSheet, Text, View, Image, TouchableOpacity, 
  Dimensions, Alert, Modal, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Heart, Image as ImageIcon, BookHeart, MessageCircle, Calendar, 
  ChevronRight, User, HeartHandshake, LogOut, X, Save, Camera 
} from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { useProfileAndCouple } from '../../lib/useProfileAndCouple';

const { width } = Dimensions.get('window');

// Premium Palette
const BG_COLOR = '#FFFFFF';
const CARD_BG = '#FFFFFF';
const TEXT_PRIMARY = '#222222';
const TEXT_SECONDARY = '#6B7280';
const TEXT_MUTED = '#9CA3AF';
const ACCENT_RED = '#F4A6A6';
const BORDER_COLOR = '#F1DCDC';
const SOFT_PINK = '#FFF1F2';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, couple, loading: dataLoading, refresh } = useProfileAndCouple();

  // Edit Profile State
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Stats State
  const [stats, setStats] = useState({
    memories: 0,
    notes: 0,
    messages: 0,
    dates: 0
  });

  const fetchStats = useCallback(async (cid: string) => {
    try {
      const [m, n, ms, d] = await Promise.all([
        supabase.from('moments').select('*', { count: 'exact', head: true }).eq('couple_id', cid),
        supabase.from('notes').select('*', { count: 'exact', head: true }).eq('couple_id', cid),
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('couple_id', cid),
        supabase.from('important_dates').select('*', { count: 'exact', head: true }).eq('couple_id', cid)
      ]);
      setStats({
        memories: m.count || 0,
        notes: n.count || 0,
        messages: ms.count || 0,
        dates: d.count || 0
      });
    } catch (e) {
      console.log('[Profile] stats error:', e);
    }
  }, []);

  useEffect(() => {
    if (couple?.couple_id) {
      fetchStats(couple.couple_id);
    }
  }, [couple, fetchStats]);

  const handleOpenEdit = () => {
    setEditedName(profile?.name || '');
    setSelectedImageUri(null);
    setEditModalVisible(true);
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso necesario', 'Permiso necesario para elegir una foto de la galería');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        console.log('[Profile] selected image uri:', uri);
        setSelectedImageUri(uri);
      }
    } catch (e) {
      console.log('[Profile] pick image error:', e);
      Alert.alert('Error', 'No se pudo abrir la galería');
    }
  };

  const handleSaveProfile = async () => {
    if (!editedName.trim()) {
      Alert.alert('Atención', 'Escribe tu nombre');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no encontrado');

      let finalAvatarUrl = profile?.avatar_url || null;

      // 1. Upload image if selected
      if (selectedImageUri) {
        console.log('[Profile] starting image upload...');
        const response = await fetch(selectedImageUri);
        const arrayBuffer = await response.arrayBuffer();

        const filePath = `${user.id}/avatar-${Date.now()}.jpg`;
        console.log('[Profile] storage path:', filePath);

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, arrayBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) {
          console.log('[Profile] storage upload error:', uploadError);
          throw new Error('No se pudo subir la foto');
        }

        const { data: publicData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        finalAvatarUrl = publicData.publicUrl;
        console.log('[Profile] final public url:', finalAvatarUrl);
      }

      // 2. Call RPC
      const { error: rpcError } = await supabase.rpc('update_my_profile', {
        input_name: editedName.trim(),
        input_avatar_url: finalAvatarUrl,
      });

      if (rpcError) throw new Error('No se pudo actualizar el perfil');
      
      Alert.alert('Éxito', 'Perfil actualizado correctamente');
      setEditModalVisible(false);
      setSelectedImageUri(null);
      refresh(); 
    } catch (error: any) {
      console.log('[Profile] handleSave error:', error);
      Alert.alert('Error', error.message || 'Ocurrió un error inesperado');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Seguro que quieres salir de tu cuenta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.auth.signOut();
              if (error) throw error;
            } catch (e) {
              Alert.alert('Error', 'No se pudo cerrar sesión');
            }
          },
        },
      ]
    );
  };

  // UI Helpers
  const myName = profile?.name || 'Yo';
  const partnerName = couple?.partner_name || 'Pareja';
  
  const myAvatar = profile?.avatar_url;
  const partnerAvatar = couple?.partner_avatar_url;
  
  const editPreview = selectedImageUri || myAvatar;

  const getDaysTogether = () => {
    if (!couple?.created_at) return 0;
    const start = new Date(couple.created_at);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const fmtStartDate = () => {
    if (!couple?.created_at) return '...';
    return new Date(couple.created_at).toLocaleDateString('es', { day: 'numeric', month: 'long' });
  };

  if (dataLoading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: BG_COLOR }]}>
        <ActivityIndicator size="large" color={ACCENT_RED} />
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: BG_COLOR }]} 
      contentContainerStyle={[styles.content, { paddingBottom: 100 + insets.bottom, paddingTop: Math.max(insets.top, 20) }]}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar style="dark" />

      {/* 1. Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Perfil</Text>
        <Text style={styles.headerSubtitle}>El rincón especial de su relación</Text>
      </View>

      {/* 2. Main Relationship Card */}
      <View style={styles.mainCard}>
        <View style={styles.avatarsWrapper}>
          <View style={styles.avatarBox}>
            <AvatarSource uri={myAvatar} initial={myName.charAt(0)} size={90} border />
            <Text style={styles.avatarLabel}>{myName}</Text>
          </View>
          
          <View style={styles.heartWrapper}>
            <View style={styles.heartIcon}>
              <Heart size={20} color={ACCENT_RED} fill={ACCENT_RED} />
            </View>
          </View>

          <View style={styles.avatarBox}>
            <AvatarSource uri={partnerAvatar} initial={partnerName.charAt(0)} size={90} border />
            <Text style={styles.avatarLabel}>{partnerName}</Text>
          </View>
        </View>

        <View style={styles.badgePill}>
          <Text style={styles.badgeText}>∞ {getDaysTogether()} días juntos ∞</Text>
        </View>
        <Text style={styles.sinceText}>Desde el {fmtStartDate()}</Text>
      </View>

      {/* 3. Stats Section */}
      <Text style={styles.sectionTitle}>Nuestra historia</Text>
      <View style={styles.statsGrid}>
        <StatItem val={stats.memories} label="Recuerdos" icon={<ImageIcon size={20} color="#FFBA08" />} bg="#FFBA0815" />
        <StatItem val={stats.notes} label="Notas" icon={<BookHeart size={20} color="#F48C06" />} bg="#F48C0615" />
        <StatItem val={stats.messages} label="Mensajes" icon={<MessageCircle size={20} color={ACCENT_RED} />} bg="#EF233C15" />
        <StatItem val={stats.dates} label="Fechas" icon={<Calendar size={20} color="#D90429" />} bg="#D9042915" />
      </View>

      {/* 4. Settings Section */}
      <Text style={styles.sectionTitle}>Ajustes</Text>
      <View style={styles.settingsGroup}>
        <ActionRow 
          icon={<User size={22} color={TEXT_PRIMARY} />} 
          title="Editar perfil" 
          desc="Actualiza tu nombre y foto" 
          onPress={handleOpenEdit} 
        />
        <ActionRow 
          icon={<HeartHandshake size={22} color="#FFBA08" />} 
          title="Invitar pareja" 
          desc="Vincular con otra cuenta" 
          onPress={() => Alert.alert('Próximamente', 'Función de invitación en desarrollo')} 
        />
        <ActionRow 
          icon={<LogOut size={22} color={ACCENT_RED} />} 
          title="Cerrar sesión" 
          desc="Salir de la aplicación" 
          isDestructive
          onPress={handleSignOut} 
        />
      </View>

      {/* 5. Edit Modal */}
      <Modal visible={isEditModalVisible} animationType="fade" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Perfil</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.closeBtn}>
                <X size={24} color={TEXT_PRIMARY} />
              </TouchableOpacity>
            </View>

            <View style={styles.editPhotoSection}>
              <View style={styles.previewWrapper}>
                <AvatarSource uri={editPreview} initial={myName.charAt(0)} size={110} border />
                <TouchableOpacity style={styles.cameraBtn} onPress={handlePickImage}>
                  <Camera size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={handlePickImage}>
                <Text style={styles.changePhotoText}>Cambiar foto de perfil</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Nombre</Text>
              <TextInput
                style={styles.fieldInput}
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Tu nombre"
                placeholderTextColor={TEXT_MUTED}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.mainSaveBtn, saving && { opacity: 0.7 }]} 
                onPress={handleSaveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Save size={20} color="#FFF" />
                    <Text style={styles.mainSaveText}>Guardar cambios</Text>
                  </>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => setEditModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </ScrollView>
  );
}

function AvatarSource({ uri, initial, size, border }: any) {
  if (uri) {
    return (
      <Image 
        source={{ uri }} 
        style={{ 
          width: size, 
          height: size, 
          borderRadius: size / 2, 
          borderWidth: border ? 3 : 0, 
          borderColor: BORDER_COLOR 
        }} 
      />
    );
  }
  return (
    <View style={{ 
      width: size, 
      height: size, 
      borderRadius: size / 2, 
      backgroundColor: SOFT_PINK, 
      justifyContent: 'center', 
      alignItems: 'center',
      borderWidth: border ? 3 : 1,
      borderColor: border ? BORDER_COLOR : BORDER_COLOR
    }}>
      <Text style={{ fontSize: size * 0.4, fontWeight: '800', color: ACCENT_RED }}>{initial}</Text>
    </View>
  );
}

function StatItem({ val, label, icon, bg }: any) {
  return (
    <View style={styles.statItem}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}>{icon}</View>
      <Text style={styles.statVal}>{val}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionRow({ icon, title, desc, isDestructive, onPress }: any) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress}>
      <View style={styles.actionIconBox}>{icon}</View>
      <View style={styles.actionTextBox}>
        <Text style={[styles.actionTitle, isDestructive && { color: ACCENT_RED }]}>{title}</Text>
        <Text style={styles.actionDesc}>{desc}</Text>
      </View>
      <ChevronRight size={18} color={TEXT_MUTED} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 20 },
  header: { marginBottom: 24 },
  headerTitle: { fontSize: 32, fontWeight: '900', color: TEXT_PRIMARY, marginBottom: 4 },
  headerSubtitle: { fontSize: 16, color: TEXT_SECONDARY },
  
  mainCard: {
    backgroundColor: CARD_BG,
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  avatarsWrapper: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  avatarBox: { alignItems: 'center' },
  avatarLabel: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY, marginTop: 8 },
  heartWrapper: { marginHorizontal: -15, zIndex: 10, marginTop: 10 },
  heartIcon: { 
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF', 
    justifyContent: 'center', alignItems: 'center', 
    borderWidth: 1, borderColor: BORDER_COLOR,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2
  },
  badgePill: { backgroundColor: '#FFF1F2', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginBottom: 10 },
  badgeText: { color: ACCENT_RED, fontWeight: '800', fontSize: 15 },
  sinceText: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '500' },

  sectionTitle: { fontSize: 20, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 14 },
  statItem: { width: '48%', backgroundColor: CARD_BG, borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: BORDER_COLOR },
  statIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  statVal: { fontSize: 26, fontWeight: '900', color: TEXT_PRIMARY, marginBottom: 2 },
  statLabel: { fontSize: 13, color: TEXT_SECONDARY, fontWeight: '600' },

  settingsGroup: { marginBottom: 30 },
  actionRow: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: CARD_BG, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: BORDER_COLOR },
  actionIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FAFAFA', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  actionTextBox: { flex: 1 },
  actionTitle: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 2 },
  actionDesc: { fontSize: 13, color: TEXT_SECONDARY },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalSheet: { width: '100%', backgroundColor: '#FFF', borderRadius: 32, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: TEXT_PRIMARY },
  closeBtn: { padding: 4 },
  
  editPhotoSection: { alignItems: 'center', marginBottom: 24 },
  previewWrapper: { position: 'relative', marginBottom: 12 },
  cameraBtn: { position: 'absolute', right: 0, bottom: 0, backgroundColor: ACCENT_RED, width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF' },
  changePhotoText: { color: ACCENT_RED, fontWeight: '700', fontSize: 14 },

  fieldGroup: { marginBottom: 24 },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: TEXT_SECONDARY, marginBottom: 8, marginLeft: 4 },
  fieldInput: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, fontSize: 16, color: TEXT_PRIMARY, borderWidth: 1, borderColor: BORDER_COLOR },
  
  modalActions: { gap: 12 },
  mainSaveBtn: { backgroundColor: ACCENT_RED, padding: 18, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  mainSaveText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  cancelBtn: { padding: 16, alignItems: 'center' },
  cancelText: { color: TEXT_SECONDARY, fontWeight: '600', fontSize: 15 },
});
