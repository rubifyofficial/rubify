import * as Location from 'expo-location';
import {
  Bell,
  Home,
  Info,
  MapPin, Navigation,
  Settings
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useProfileAndCouple } from '../../lib/useProfileAndCouple';

// --- Light / Pastel Theme ---
const BG = '#FFFFFF';
const SOFT_PINK = '#FFF1F2';
const ACCENT_RED = '#F4A6A6';
const TEXT_DARK = '#222222';
const TEXT_MUTED = '#9CA3AF';
const BORDER = '#F1DCDC';
const GREEN = '#10B981';

type CoupleLocationRow = {
  couple_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  recorded_at?: string | null;
};

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const x = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function formatRecordedAt(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('es', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function UbicacionScreen() {
  const insets = useSafeAreaInsets();
  const { profile, couple, loading } = useProfileAndCouple();
  const mapRef = useRef<MapView | null>(null);

  // Location tracking states
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [locLoading, setLocLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saveStatusType, setSaveStatusType] = useState<'success' | 'error' | 'pending' | null>(null);
  const [myLocationRow, setMyLocationRow] = useState<CoupleLocationRow | null>(null);
  const [partnerLocationRow, setPartnerLocationRow] = useState<CoupleLocationRow | null>(null);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState<string | null>(null);

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
  const myName = profile?.name || 'Yo';

  const resolvedUserId = profile?.id ?? null;
  const resolvedCoupleId = (couple as any)?.couple_id || (profile as any)?.couple_id || null;

  const fetchCoupleLocations = async () => {
    if (!resolvedCoupleId || !resolvedUserId) return;
    setLocationsLoading(true);
    setLocationsError(null);
    try {
      const { data, error } = await supabase
        .from('couple_locations')
        .select('couple_id,user_id,latitude,longitude,recorded_at')
        .eq('couple_id', resolvedCoupleId);

      if (error) {
        setLocationsError('No se pudieron cargar las ubicaciones.');
        return;
      }

      const rows = (data ?? []) as any[];
      console.log('couple_locations rows:', rows);

      const myLocation = rows.find(row => row.user_id === resolvedUserId) ?? null;
      const partnerLocation = rows.find(row => row.user_id !== resolvedUserId) ?? null;

      console.log('myLocation:', myLocation);
      console.log('partnerLocation:', partnerLocation);

      setMyLocationRow(myLocation);
      setPartnerLocationRow(partnerLocation);
    } finally {
      setLocationsLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupleLocations();
  }, [resolvedCoupleId, resolvedUserId]);

  useEffect(() => {
    if (!resolvedCoupleId) return;
    try {
      const channel = supabase
        .channel(`public:couple_locations:${resolvedCoupleId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'couple_locations',
            filter: `couple_id=eq.${resolvedCoupleId}`,
          },
          () => {
            fetchCoupleLocations();
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    } catch {
      return;
    }
  }, [resolvedCoupleId]);

  const myRecordedAt = formatRecordedAt(myLocationRow?.recorded_at);
  const partnerRecordedAt = formatRecordedAt(partnerLocationRow?.recorded_at);
  const distanceKm =
    myLocationRow && partnerLocationRow
      ? haversineKm(
          { lat: myLocationRow.latitude, lon: myLocationRow.longitude },
          { lat: partnerLocationRow.latitude, lon: partnerLocationRow.longitude }
        )
      : null;

  const distanceText =
    distanceKm === null
      ? null
      : distanceKm >= 1
        ? `${distanceKm.toFixed(1)} km`
        : `${Math.max(1, Math.round(distanceKm * 1000))} m`;

  const myCoordinate = myLocationRow
    ? { latitude: myLocationRow.latitude, longitude: myLocationRow.longitude }
    : null;
  const partnerCoordinate = partnerLocationRow
    ? { latitude: partnerLocationRow.latitude, longitude: partnerLocationRow.longitude }
    : null;
  const fallbackCoordinate = userLocation
    ? { latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude }
    : { latitude: 40.7128, longitude: -74.006 };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (myCoordinate && partnerCoordinate) {
      map.fitToCoordinates([myCoordinate, partnerCoordinate], {
        edgePadding: { top: 70, right: 70, bottom: 70, left: 70 },
        animated: true,
      });
      return;
    }

    if (myCoordinate) {
      map.animateToRegion(
        {
          latitude: myCoordinate.latitude,
          longitude: myCoordinate.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        450
      );
    }
  }, [myCoordinate?.latitude, myCoordinate?.longitude, partnerCoordinate?.latitude, partnerCoordinate?.longitude]);

  const handleSaveLocation = async () => {
    console.log('Actualizar ubicación pressed');

    setSaveStatus(null);
    setSaveStatusType(null);

    console.log('Profile:', profile);
    console.log('Couple:', couple);
    console.log('Resolved couple_id:', resolvedCoupleId);
    console.log('Resolved user_id:', resolvedUserId);

    if (!resolvedUserId) {
      setSaveStatus('No se encontró tu perfil');
      setSaveStatusType('error');
      return;
    }
    if (!resolvedCoupleId) {
      setSaveStatus('No se encontró la pareja');
      setSaveStatusType('error');
      return;
    }

    setSaving(true);
    setSaveStatus('Actualizando...');
    setSaveStatusType('pending');

    try {
      const existingPerm = await Location.getForegroundPermissionsAsync();
      if (existingPerm.status !== 'granted') {
        const requested = await Location.requestForegroundPermissionsAsync();
        if (requested.status !== 'granted') {
          setSaveStatus('No se pudo obtener tu ubicación.');
          setSaveStatusType('error');
          return;
        }
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation(loc);

      const coords = loc?.coords;
      if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
        setSaveStatus('No se pudo obtener tu ubicación.');
        setSaveStatusType('error');
        return;
      }

      const payload = {
        couple_id: resolvedCoupleId,
        user_id: resolvedUserId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy_m: coords.accuracy ?? null,
        heading: coords.heading ?? null,
        speed_mps: coords.speed ?? null,
        recorded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log('Location payload:', payload);

      const { data, error } = await supabase
        .from('couple_locations')
        .upsert(payload as any, { onConflict: 'couple_id,user_id' })
        .select()
        .single();

      console.log('Location save data:', data);
      console.log('Location save error:', error);

      if (error) {
        setSaveStatus('No se pudo guardar tu ubicación');
        setSaveStatusType('error');
        return;
      }

      setSaveStatus('Ubicación actualizada');
      setSaveStatusType('success');

      const { data: rows, error: fetchError } = await supabase
        .from('couple_locations')
        .select('*')
        .eq('couple_id', resolvedCoupleId);

      console.log('couple_locations fetched after save:', rows);
      console.log('couple_locations fetch error:', fetchError);
      await fetchCoupleLocations();
    } catch (e) {
      setSaveStatus('No se pudo guardar tu ubicación');
      setSaveStatusType('error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.container}>
      {loading ? (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { justifyContent: 'center', alignItems: 'center', paddingTop: Math.max(insets.top, 16), backgroundColor: BG, zIndex: 10 },
          ]}
        >
          <ActivityIndicator color={ACCENT_RED} style={{ marginTop: 14 }} />
        </View>
      ) : null}
      {/* --- Map Placeholder --- */}
      <View style={s.mapContainer}>
        <MapView
          ref={ref => {
            mapRef.current = ref;
          }}
          style={StyleSheet.absoluteFillObject}
          initialRegion={{
            latitude: fallbackCoordinate.latitude,
            longitude: fallbackCoordinate.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
        >
          {myCoordinate ? <Marker coordinate={myCoordinate} title="Tú" /> : null}
          {partnerCoordinate ? <Marker coordinate={partnerCoordinate} title="Tu pareja" /> : null}
        </MapView>

        {!myCoordinate && !partnerCoordinate ? (
          <View style={s.mapEmptyOverlay}>
            <Text style={s.mapEmptyText}>Comparte tu ubicación para verla en el mapa.</Text>
          </View>
        ) : null}

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
              <Text style={s.pLoc}>
                {locationsError
                  ? locationsError
                  : locationsLoading
                  ? 'Cargando ubicaciones...'
                  : partnerLocationRow
                    ? 'Tu pareja compartió su ubicación'
                    : 'Tu pareja aún no compartió su ubicación.'}
              </Text>
              {distanceText !== null ? (
                <View style={s.pStatRow}>
                  <Navigation size={14} color={GREEN} />
                  <Text style={s.pStat}>Distancia aproximada: {distanceText}</Text>
                </View>
              ) : null}
              {partnerRecordedAt ? (
                <Text style={s.pLoc}>Última actualización de tu pareja: {partnerRecordedAt}</Text>
              ) : null}
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
                <View style={{ marginTop: 2 }}>
                  <Text style={s.myLocCoords}>Latitud: {userLocation.coords.latitude.toFixed(6)}</Text>
                  <Text style={s.myLocCoords}>Longitud: {userLocation.coords.longitude.toFixed(6)}</Text>
                </View>
              ) : (
                <Text style={s.myLocCoordsError}>Coordenadas no disponibles</Text>
              )}

              <Pressable
                style={[s.updateBtn, saving && { opacity: 0.7 }]}
                onPress={handleSaveLocation}
                disabled={saving}
              >
                <Text style={s.updateBtnText}>{saving ? 'Actualizando...' : 'Actualizar ubicación'}</Text>
              </Pressable>

              <Text style={s.privacyText}>Tu ubicación solo se comparte con tu pareja.</Text>

              {saveStatus ? (
                <Text
                  style={[
                    s.saveStatusText,
                    saveStatusType === 'success'
                      ? s.saveStatusSuccess
                      : saveStatusType === 'error'
                        ? s.saveStatusError
                        : s.saveStatusPending,
                  ]}
                >
                  {saveStatus}
                </Text>
              ) : null}

              <Text style={s.myLocSaved}>
                {myLocationRow ? 'Mi ubicación está compartida' : 'Aún no compartiste tu ubicación'}
              </Text>
              {myRecordedAt ? <Text style={s.myLocSaved}>Tu última actualización: {myRecordedAt}</Text> : null}
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
  mapEmptyOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  mapEmptyText: { color: TEXT_DARK, fontWeight: '800', textAlign: 'center' },

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
  updateBtn: {
    marginTop: 12,
    backgroundColor: ACCENT_RED,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  updateBtnText: { color: '#FFF', fontWeight: '900' },
  privacyText: { marginTop: 8, fontSize: 12, color: TEXT_MUTED, fontWeight: '700' },
  saveStatusText: { marginTop: 8, fontSize: 12, fontWeight: '800' },
  saveStatusSuccess: { color: '#16A34A' },
  saveStatusError: { color: ACCENT_RED },
  saveStatusPending: { color: TEXT_MUTED },
  myLocSaved: { marginTop: 6, fontSize: 12, fontWeight: '800', color: TEXT_MUTED },

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
