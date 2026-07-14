import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Phone, Video, ChevronLeft, Search, MoreVertical } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';

const HEADER_BG = '#FFF8FA';
const HEADER_BORDER = '#F1DDE3';
const AVATAR_BG = '#FFF2F5';

interface AvatarSourceProps {
  uri?: string | null;
  initial: string;
  size: number;
}

export function AvatarSource({ uri, initial, size }: AvatarSourceProps) {
  if (uri) {
    return <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} />;
  }
  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitial, { fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  );
}

interface MessagesHeaderProps {
  partnerName: string;
  partnerAvatar?: string | null;
  onBackPress: () => void;
  onSearchPress: () => void;
  onStartAudioCall: () => void;
  onStartVideoCall: () => void;
  onOptionsPress: () => void;
  isStartingCall: boolean;
  canStartCall: boolean;
  topInset: number;
}

export function MessagesHeader({
  partnerName,
  partnerAvatar,
  onBackPress,
  onSearchPress,
  onStartAudioCall,
  onStartVideoCall,
  onOptionsPress,
  isStartingCall,
  canStartCall,
  topInset,
}: MessagesHeaderProps) {
  return (
    <View style={[styles.header, { paddingTop: Math.max(topInset, 10) }]}>
      <Pressable onPress={onBackPress} style={styles.hdrBtn}>
        <ChevronLeft size={24} color={Colors.light.text} />
      </Pressable>

      <View style={styles.hdrUser}>
        <AvatarSource uri={partnerAvatar} initial={partnerName.charAt(0)} size={42} />
        <View style={styles.hdrTxtBox}>
          <Text style={styles.hdrName}>{partnerName}</Text>
          <View style={styles.hdrStatusRow}>
            <View style={styles.hdrDot} />
            <Text style={styles.hdrStatus}>en línea ahora</Text>
          </View>
        </View>
      </View>

      <View style={styles.hdrActions}>
        <Pressable onPress={onSearchPress} style={styles.hdrBtn}>
          <Search size={22} color={Colors.light.textMuted} />
        </Pressable>
        <Pressable
          style={[styles.hdrBtn, (isStartingCall || !canStartCall) && styles.hdrBtnDisabled]}
          onPress={onStartAudioCall}
          disabled={isStartingCall || !canStartCall}
        >
          <Phone size={22} color={Colors.light.textMuted} />
        </Pressable>
        <Pressable
          style={[styles.hdrBtn, (isStartingCall || !canStartCall) && styles.hdrBtnDisabled]}
          onPress={onStartVideoCall}
          disabled={isStartingCall || !canStartCall}
        >
          <Video size={22} color={Colors.light.textMuted} />
        </Pressable>
        <Pressable onPress={onOptionsPress} style={styles.hdrBtn}>
          <MoreVertical size={21} color={Colors.light.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: HEADER_BG,
    borderBottomWidth: 1,
    borderColor: HEADER_BORDER,
  },
  hdrBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hdrBtnDisabled: { opacity: 0.45 },
  hdrUser: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 4, gap: 10 },
  hdrTxtBox: { gap: 2 },
  hdrName: { fontSize: 17, fontWeight: '800', color: Colors.light.text },
  hdrStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hdrDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  hdrStatus: { fontSize: 12, color: '#10B981', fontWeight: '600' },
  hdrActions: { flexDirection: 'row', gap: 0 },
  avatar: { backgroundColor: AVATAR_BG },
  avatarPlaceholder: {
    backgroundColor: AVATAR_BG,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: HEADER_BORDER,
  },
  avatarInitial: { fontWeight: '800', color: Colors.light.tint },
});
