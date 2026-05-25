import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, 
  Dimensions, Image, ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  MapPin, Navigation, Home, Bell, 
  Settings, ChevronRight, Heart, Info 
} from 'lucide-react-native';
import { useProfileAndCouple } from '../../lib/useProfileAndCouple';
import * as Location from 'expo-location';

const { width } = Dimensions.get('window');

// --- Light / Pastel Theme ---
const BG = '#FFFFFF';
const SOFT_PINK = '#FFF1F2';
const ACCENT_RED = '#F4A6A6';
const TEXT_DARK = '#222222';
const TEXT_MUTED = '#9CA3AF';
const BORDER = '#F1DCDC';
const GREEN = '#10B981';

export default function UbicacionScreen() {
  const insets = useSafeAreaInsets();
  const { profile, couple, loading } = useProfileAndCouple();
  const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  const mapboxStaticUri = mapboxToken
    ? `https://api.mapbox.com/styles/v1/mapbox/light-v10/static/-74.006,40.7128,12/800x800?access_token=${mapboxToken}`
    : null;

  // Location tracking states
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [locLoading, setLocLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permiso de ubicación denegado');
          setLocLoading(false);
          return;
        }

        let loc = await Location.getCurrentPositionAsync({});
        setUserLocation(loc);
        setLocLoading(false);
      } catch (e) {
        console.error('Error fetching location:', e);
        setErrorMsg('Error al obtener la ubicación');
        setLocLoading(false);
      }
    })();
  }, []);

  const partnerName = couple?.partner_name || 'Pareja';
  const partnerAvatar = couple?.partner_avatar_url;
  const myAvatar = profile?.avatar_url;

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={ACCENT_RED} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* --- Map Placeholder --- */}
      <View style={s.mapContainer}>
        {/* Mock Map Background */}
        {mapboxStaticUri ? (
          <Image
            source={{ uri: mapboxStaticUri }}
            style={s.mapMock}
          />
        ) : (
          <View style={[s.mapMock, { backgroundColor: SOFT_PINK, justifyContent: 'center', alignItems: 'center', padding: 16 }]}>
            <Text style={{ color: TEXT_MUTED, fontWeight: '700', textAlign: 'center' }}>
              Configura tu token de Mapbox para ver el mapa.
            </Text>
          </View>
        )}
        
        {/* User markers overlay */}
        <View style={s.markersLayer}>
          {/* Me marker */}
          <View style={[s.marker, { top: '40%', left: '30%' }]}>
            <View style={s.markerCircle}>
              <AvatarSource uri={myAvatar} initial={profile?.name?.charAt(0) || 'Y'} size={40} />
            </View>
            <Text style={s.mkLbl}>Yo</Text>
          </View>

          {/* Partner marker */}
          <View style={[s.marker, { top: '55%', left: '60%' }]}>
            <View style={[s.markerCircle, { borderColor: ACCENT_RED }]}>
              <AvatarSource uri={partnerAvatar} initial={partnerName.charAt(0)} size={40} />
            </View>
            <Text style={[s.mkLbl, { color: ACCENT_RED, fontWeight: '800' }]}>{partnerName}</Text>
          </View>
        </View>

        {/* Back button */}
        <View style={[s.hdrOverlay, { paddingTop: Math.max(insets.top, 10) }]}>
          <View style={s.hdrBox}>
            <MapPin size={20} color={ACCENT_RED} />
            <Text style={s.hdrTxt}>Compartiendo ubicación en tiempo real</Text>
          </View>
        </View>
      </View>

      {/* --- Location Details Sheet --- */}
      <View style={s.detailsSheet}>
        <View style={s.sheetHandle} />
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          
          <View style={s.partnerStatusCard}>
            <AvatarSource uri={partnerAvatar} initial={partnerName.charAt(0)} size={60} />
            <View style={s.pInfo}>
              <Text style={s.pName}>{partnerName}</Text>
              <Text style={s.pLoc}>Cerca de la Universidad de las Artes</Text>
              <View style={s.pStatRow}>
                <Navigation size={14} color={GREEN} />
                <Text style={s.pStat}>Moviéndose • 15 km/h</Text>
              </View>
            </View>
            <View style={s.pBat}>
              <Text style={s.pBatTxt}>84%</Text>
            </View>
          </View>

          {/* Real GPS coordinates card */}
          <Text style={s.sectionTitle}>Mi ubicación actual</Text>
          <View style={s.myLocCard}>
            <MapPin size={24} color={ACCENT_RED} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.myLocTitle}>Tus coordenadas GPS</Text>
              {locLoading ? (
                <ActivityIndicator size="small" color={ACCENT_RED} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
              ) : errorMsg ? (
                <Text style={s.myLocCoordsError}>{errorMsg}</Text>
              ) : userLocation ? (
                <Text style={s.myLocCoords}>
                  Lat: {userLocation.coords.latitude.toFixed(6)} • Lon: {userLocation.coords.longitude.toFixed(6)}
                </Text>
              ) : (
                <Text style={s.myLocCoordsError}>Coordenadas no disponibles</Text>
              )}
            </View>
          </View>

          <View style={s.actionsRow}>
            <LocAction icon={<Navigation size={22} color={ACCENT_RED} />} label="Ruta" />
            <LocAction icon={<Bell size={22} color={ACCENT_RED} />} label="Avisar" />
            <LocAction icon={<Settings size={22} color={TEXT_MUTED} />} label="Ajustes" />
          </View>

          <Text style={s.sectionTitle}>Actividad reciente</Text>
          <View style={s.historyBox}>
            <HistoryItem icon={<Bell size={14} color={ACCENT_RED} />} txt={`${partnerName} salió de la universidad`} time="Hoy, 7:10 PM" />
            <HistoryItem icon={<Navigation size={14} color={TEXT_MUTED} />} txt={`${partnerName} está en camino`} time="Hoy, 7:35 PM" />
            <HistoryItem icon={<Home size={14} color={GREEN} />} txt={`${partnerName} llegó a casa`} time="Ayer, 8:42 PM" />
          </View>

          <View style={s.safetyInfo}>
            <Info size={16} color={TEXT_MUTED} />
            <Text style={s.safetyTxt}>Tu ubicación solo es visible para tu pareja.</Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function AvatarSource({ uri, initial, size }: any) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: SOFT_PINK, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: BORDER }}>
      <Text style={{ fontSize: size * 0.4, fontWeight: '800', color: ACCENT_RED }}>{initial}</Text>
    </View>
  );
}

function LocAction({ icon, label }: any) {
  return (
    <View style={s.locAction}>
      <View style={s.locActionIcon}>{icon}</View>
      <Text style={s.locActionLabel}>{label}</Text>
    </View>
  );
}

function HistoryItem({ icon, txt, time }: any) {
  return (
    <View style={s.histItem}>
      <View style={s.histIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={s.histTxt}>{txt}</Text>
        <Text style={s.histTime}>{time}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  mapContainer: { height: '55%', width: '100%', position: 'relative' },
  mapMock: { width: '100%', height: '100%', opacity: 0.8 },
  markersLayer: { ...StyleSheet.absoluteFillObject },
  marker: { position: 'absolute', alignItems: 'center' },
  markerCircle: { padding: 4, backgroundColor: '#FFF', borderRadius: 30, borderWidth: 2, borderColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  mkLbl: { marginTop: 4, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, fontSize: 12, fontWeight: '700', color: TEXT_DARK },

  hdrOverlay: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  hdrBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  hdrTxt: { fontSize: 13, fontWeight: '700', color: TEXT_DARK },

  detailsSheet: { flex: 1, backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -32, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  sheetHandle: { width: 40, height: 4, backgroundColor: BORDER, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  
  partnerStatusCard: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: SOFT_PINK, borderRadius: 24, marginBottom: 20, borderWidth: 1, borderColor: BORDER },
  pInfo: { flex: 1, marginLeft: 16 },
  pName: { fontSize: 18, fontWeight: '800', color: TEXT_DARK },
  pLoc: { fontSize: 13, color: TEXT_MUTED, marginTop: 2 },
  pStatRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  pStat: { fontSize: 12, color: GREEN, fontWeight: '700' },
  pBat: { backgroundColor: '#FFF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: BORDER },
  pBatTxt: { fontSize: 12, fontWeight: '800', color: TEXT_DARK },

  myLocCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FAFAFA',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 20,
  },
  myLocTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_DARK,
  },
  myLocCoords: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginTop: 2,
    fontWeight: '700',
  },
  myLocCoordsError: {
    fontSize: 13,
    color: ACCENT_RED,
    marginTop: 2,
    fontWeight: '600',
  },

  actionsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 30 },
  locAction: { alignItems: 'center' },
  locActionIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: BORDER, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  locActionLabel: { fontSize: 12, fontWeight: '700', color: TEXT_DARK, marginTop: 8 },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: TEXT_DARK, marginBottom: 16 },
  historyBox: { backgroundColor: '#FAFAFA', borderRadius: 24, padding: 16, marginBottom: 20 },
  histItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  histIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  histTxt: { fontSize: 14, color: TEXT_DARK, fontWeight: '600' },
  histTime: { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },

  safetyInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  safetyTxt: { fontSize: 12, color: TEXT_MUTED, fontStyle: 'italic' }
});
