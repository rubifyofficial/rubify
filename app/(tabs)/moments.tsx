import React from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, Dimensions, ImageBackground, Alert, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart, MessageCircle, Bookmark, Plus, Video, Image as ImageIcon } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

// Colors matching the spec
const BG_COLOR = '#0F0F0F'; // premium near black
const TEXT_CREAM = '#FFFFFF'; // pure white
const TEXT_MUTED = '#A1A1AA'; // zinc 400 neutral gray
const ACCENT_RED = '#EF233C'; // romantic red

export default function MomentsScreen() {
  const insets = useSafeAreaInsets();

  const handleAlert = (title: string, message: string) => {
    Alert.alert(title, message);
  };

  return (
    <View style={[styles.container, { backgroundColor: BG_COLOR }]}>
      <ScrollView 
        contentContainerStyle={[styles.content, { paddingBottom: 160 + insets.bottom, paddingTop: Math.max(insets.top, 10) }]}
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Momentos</Text>
          <Text style={styles.headerSubtitle}>Recuerdos en movimiento</Text>
          
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => handleAlert("Función disponible pronto", "Podrás subir tus propios recuerdos pronto.")}
          >
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Agregar recuerdo</Text>
          </TouchableOpacity>
        </View>

        {/* Reels Feed */}
        <ReelCard 
          title="Nuestro primer viaje"
          date="12 de marzo"
          description="Un día que nunca vamos a olvidar."
          type="Video"
          imageUrl="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800"
          onHeart={() => handleAlert("Recuerdo guardado", "Has guardado este recuerdo en tus favoritos.")}
          onComment={() => handleAlert("Comentarios disponibles pronto", "La función de comentarios se habilitará próximamente.")}
          onSave={() => handleAlert("Guardado", "Recuerdo guardado en tu colección privada.")}
        />

        <ReelCard 
          title="Cena especial"
          date="20 de abril"
          description="Una noche tranquila, solo nosotros dos."
          type="Foto"
          imageUrl="https://images.unsplash.com/photo-1544025162-811114cd354c?w=800"
          onHeart={() => handleAlert("Recuerdo guardado", "Has guardado este recuerdo en tus favoritos.")}
          onComment={() => handleAlert("Comentarios disponibles pronto", "La función de comentarios se habilitará próximamente.")}
          onSave={() => handleAlert("Guardado", "Recuerdo guardado en tu colección privada.")}
        />

        <ReelCard 
          title="Una tarde juntos"
          date="5 de mayo"
          description="Café, risas y una caminata sin prisa."
          type="Video"
          imageUrl="https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=800"
          onHeart={() => handleAlert("Recuerdo guardado", "Has guardado este recuerdo en tus favoritos.")}
          onComment={() => handleAlert("Comentarios disponibles pronto", "La función de comentarios se habilitará próximamente.")}
          onSave={() => handleAlert("Guardado", "Recuerdo guardado en tu colección privada.")}
        />

        <ReelCard 
          title="La primera foto"
          date="10 de enero"
          description="El inicio de nuestra historia."
          type="Foto"
          imageUrl="https://images.unsplash.com/photo-1518599904199-0ca897819ddb?w=800"
          onHeart={() => handleAlert("Recuerdo guardado", "Has guardado este recuerdo en tus favoritos.")}
          onComment={() => handleAlert("Comentarios disponibles pronto", "La función de comentarios se habilitará próximamente.")}
          onSave={() => handleAlert("Guardado", "Recuerdo guardado en tu colección privada.")}
        />

        <ReelCard 
          title="Un día inolvidable"
          date="1 de junio"
          description="Pequeños detalles, grandes recuerdos."
          type="Video"
          imageUrl="https://images.unsplash.com/photo-1472396961693-142e6e269027?w=800"
          onHeart={() => handleAlert("Recuerdo guardado", "Has guardado este recuerdo en tus favoritos.")}
          onComment={() => handleAlert("Comentarios disponibles pronto", "La función de comentarios se habilitará próximamente.")}
          onSave={() => handleAlert("Guardado", "Recuerdo guardado en tu colección privada.")}
        />

      </ScrollView>
    </View>
  );
}

function ReelCard({ title, date, description, type, imageUrl, onHeart, onComment, onSave }: any) {
  return (
    <View style={styles.reelCard}>
      <ImageBackground 
        source={{ uri: imageUrl }} 
        style={styles.reelImage}
        imageStyle={{ borderRadius: 24 }}
      >
        <View style={styles.darkOverlay}>
          
          {/* Top Badges */}
          <View style={styles.topBadgesRow}>
            <View style={styles.privateBadge}>
              <Text style={styles.privateBadgeText}>Recuerdo privado</Text>
            </View>
            <View style={styles.typeBadge}>
              {type === 'Video' ? <Video size={12} color="#FFFFFF" /> : <ImageIcon size={12} color="#FFFFFF" />}
              <Text style={styles.typeBadgeText}>{type}</Text>
            </View>
          </View>

          {/* Right Actions */}
          <View style={styles.actionsColumn}>
            <TouchableOpacity style={styles.actionButton} onPress={onHeart}>
              <Heart size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={onComment}>
              <MessageCircle size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={onSave}>
              <Bookmark size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Bottom Caption Area */}
          <View style={styles.captionArea}>
            <View style={styles.captionHeader}>
              <View style={styles.avatarMiniContainer}>
                <Image source={{ uri: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100' }} style={styles.avatarMini} />
                <Image source={{ uri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' }} style={[styles.avatarMini, { marginLeft: -10, borderWidth: 1, borderColor: '#1A050A' }]} />
              </View>
              <View style={styles.dateBadge}>
                <Text style={styles.dateText}>{date}</Text>
              </View>
            </View>
            <Text style={styles.reelTitle}>{title}</Text>
            <Text style={styles.reelDesc}>{description}</Text>
          </View>

        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  headerContainer: {
    marginBottom: 24,
    paddingHorizontal: 4,
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
    marginBottom: 16,
    letterSpacing: 0,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272A',
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EF233C50',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    letterSpacing: 0,
  },
  reelCard: {
    width: '100%',
    height: height * 0.75, // 75% of screen height
    marginBottom: 24,
    borderRadius: 24,
    shadowColor: ACCENT_RED,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  reelImage: {
    width: '100%',
    height: '100%',
  },
  darkOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 5, 10, 0.4)', // Dark romantic overlay
    borderRadius: 24,
    padding: 20,
    justifyContent: 'space-between',
  },
  topBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  privateBadge: {
    backgroundColor: 'rgba(45, 10, 17, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 35, 60, 0.3)',
  },
  privateBadgeText: {
    color: TEXT_CREAM,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    letterSpacing: 0,
  },
  actionsColumn: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    alignItems: 'center',
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  captionArea: {
    width: '85%',
  },
  captionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarMiniContainer: {
    flexDirection: 'row',
    marginRight: 12,
  },
  avatarMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  dateBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  dateText: {
    color: TEXT_CREAM,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0,
  },
  reelTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0,
  },
  reelDesc: {
    color: TEXT_CREAM,
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.9,
    letterSpacing: 0,
  },
});
