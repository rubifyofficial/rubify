import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import * as Notifications from "expo-notifications";
import { useLocalSearchParams } from "expo-router";
import {
    MapPin
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Image,
    Linking,
    Modal,
    PanResponder,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { Marker } from "react-native-maps";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
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

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type CoupleLocationRow = {
  couple_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number | null;
  battery_percent?: number | null;
  recorded_at?: string | null;
};

type SavedPlaceRow = {
  id: string;
  couple_id?: string | null;
  user_id: string;
  name: string;
  color: string | null;
  latitude: number;
  longitude: number;
  address?: string | null;
  created_at: string;
};

type SosEvent = {
  id: string;
  user_id: string;
  couple_id: string | null;
  latitude: number | null;
  longitude: number | null;
  battery_percent: number | null;
  message: string | null;
  seen_by_partner?: boolean | null;
  created_at: string;
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

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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

const getInitial = (name?: string | null, fallback = "?") => {
  if (!name || !name.trim()) return fallback;
  return name.trim().charAt(0).toUpperCase();
};

type MarkerDirection = 'left' | 'right' | 'bottom';

const getMarkerDirection = (location?: any): MarkerDirection => {
  const heading = Number(location?.heading);

  if (Number.isFinite(heading)) {
    if (heading >= 45 && heading <= 135) return 'right';
    if (heading >= 225 && heading <= 315) return 'left';
  }

  return 'bottom';
};

const getPlaceColor = (color?: string | null) => {
  if (!color) return "#e7a4b3";
  const normalized = color.trim();
  if (!normalized) return "#e7a4b3";

  if (normalized.startsWith("#")) return normalized;

  switch (normalized.toLowerCase()) {
    case "rosa":
      return "#e7a4b3";
    case "azul":
      return "#74a7ff";
    case "verde":
      return "#67c587";
    case "amarillo":
      return "#f0c44f";
    case "morado":
      return "#9a7cf2";
    default:
      return "#e7a4b3";
  }
};

const hexToRgba = (hex: string, alpha: number) => {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getBatteryColor = (value?: number | null) => {
  if (value == null || !Number.isFinite(Number(value))) return "#9ca3af";
  const battery = Number(value);
  if (battery <= 20) return "#ef6f88";
  if (battery <= 60) return "#f0b84f";
  return "#2fbf71";
};

const formatBattery = (value?: number | null) => {
  if (value == null || !Number.isFinite(Number(value))) return "--%";
  return `${Math.round(Number(value))}%`;
};

const getBatteryIcon = (value?: number | null) => {
  if (value == null || !Number.isFinite(Number(value))) return "battery-dead-outline";
  const battery = Number(value);
  if (battery <= 20) return "battery-dead-outline";
  if (battery <= 60) return "battery-half-outline";
  return "battery-full-outline";
};

const PLACE_COLORS = [
  "#e7a4b3",
  "#74a7ff",
  "#67c587",
  "#f0c44f",
  "#9a7cf2",
];

const DEFAULT_REGION = {
  latitude: 19.4326,
  longitude: -99.1332,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export default function UbicacionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const hasHandledInitialFocusRef = useRef(false);
  const { profile, couple, loading } = useProfileAndCouple();
  const mapRef = useRef<MapView | null>(null);
  const myMarkerRef = useRef<any>(null);
  const partnerMarkerRef = useRef<any>(null);
  const windowHeight = Dimensions.get('window').height;
  const [myMarkerImageUri, setMyMarkerImageUri] = useState<string | null>(null);
  const [partnerMarkerImageUri, setPartnerMarkerImageUri] = useState<string | null>(null);

  const SHEET_COLLAPSED_HEIGHT = 215;
  const SHEET_EXPANDED_HEIGHT = Math.round(windowHeight * 0.62);

  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const sheetHeight = useRef(new Animated.Value(SHEET_COLLAPSED_HEIGHT)).current;
  const sheetHeightNumber = useRef(SHEET_COLLAPSED_HEIGHT);
  const sheetDragStartHeightRef = useRef(SHEET_COLLAPSED_HEIGHT);

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

  const partnerName = couple?.partner_name || 'Pareja';
  const partnerAvatar = couple?.partner_avatar_url;
  const partnerMarkerTitle = couple?.partner_name || 'Tu pareja';
  const myAvatarUri =
    typeof (profile as any)?.avatar_url === "string" && (profile as any).avatar_url.trim().length > 0
      ? (profile as any).avatar_url.trim()
      : null;
  const partnerAvatarUri =
    typeof couple?.partner_avatar_url === "string" && couple.partner_avatar_url.trim().length > 0
      ? couple.partner_avatar_url.trim()
      : null;

  const myDisplayInitial = (String((profile as any)?.name || "T")).slice(0, 1).toUpperCase();
  const partnerDisplayInitial = (String(couple?.partner_name || "P")).slice(0, 1).toUpperCase();

  const myBubbleCaptureRef = useRef<View | null>(null);
  const partnerBubbleCaptureRef = useRef<View | null>(null);
  const [myBubblePngUri, setMyBubblePngUri] = useState<string | null>(null);
  const [partnerBubblePngUri, setPartnerBubblePngUri] = useState<string | null>(null);

  const [authUserId, setAuthUserId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (cancelled) return;
        setAuthUserId(data.user?.id ?? null);
      })
      .catch(() => {});

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setAuthUserId(session?.user?.id ?? null);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const resolvedUserId = authUserId ?? profile?.id ?? null;
  const resolvedCoupleId = (profile as any)?.couple_id ?? (couple as any)?.couple_id ?? null;

  const [mapType, setMapType] = useState<"standard" | "satellite" | "hybrid">("standard");
  const [showMapLayerModal, setShowMapLayerModal] = useState(false);
  const [showSosModal, setShowSosModal] = useState(false);
  const [sendingSos, setSendingSos] = useState(false);
  const [handledSosIds, setHandledSosIds] = useState<string[]>([]);
  const handledSosIdsRef = useRef<string[]>([]);
  const [activeSosEvent, setActiveSosEvent] = useState<SosEvent | null>(null);

  useEffect(() => {
    handledSosIdsRef.current = handledSosIds;
  }, [handledSosIds]);

  useEffect(() => {
    const setupNotifications = async () => {
      try {
        const permission = await Notifications.getPermissionsAsync();
        if (!permission.granted) {
          await Notifications.requestPermissionsAsync();
        }

        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("sos", {
            name: "SOS Alerts",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#ff4d6d",
            sound: "default",
          });
        }
      } catch (error) {
        console.warn("[Ubicacion] notification setup failed:", error);
      }
    };

    setupNotifications();
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      if (data?.type !== "sos") return;
      const lat = Number(data?.latitude);
      const lng = Number(data?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      mapRef.current?.animateToRegion(
        {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.004,
          longitudeDelta: 0.004,
        },
        700
      );
    });

    return () => subscription.remove();
  }, []);

  const [showPartnerMapActions, setShowPartnerMapActions] = useState(false);

  const [savedPlaces, setSavedPlaces] = useState<SavedPlaceRow[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [placeDeleteModeId, setPlaceDeleteModeId] = useState<string | null>(null);
  const [showSavedPlaceActions, setShowSavedPlaceActions] = useState(false);
  const [savedPlaceMarkerImages, setSavedPlaceMarkerImages] = useState<Record<string, string>>({});
  const savedPlaceMarkerRefs = useRef<Record<string, View | null>>({});
  const [showAddPlaceModal, setShowAddPlaceModal] = useState(false);
  const [addPlaceMode, setAddPlaceMode] = useState<'current' | 'search'>('current');
  const [newPlaceName, setNewPlaceName] = useState('');
  const [newPlaceColor, setNewPlaceColor] = useState<string>(ACCENT_RED);
  const [placeAddress, setPlaceAddress] = useState('');
  const [selectedPlaceCoordinate, setSelectedPlaceCoordinate] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isPickingPlaceOnMap, setIsPickingPlaceOnMap] = useState(false);
  const [pendingPlaceCoordinate, setPendingPlaceCoordinate] = useState<{ latitude: number; longitude: number } | null>(null);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [addPlaceError, setAddPlaceError] = useState<string | null>(null);
  const [savingPlace, setSavingPlace] = useState(false);

  useEffect(() => {
    if (hasHandledInitialFocusRef.current) return;
    if (params?.focus !== "partner") return;

    const lat = Number(partnerLocationRow?.latitude);
    const lng = Number(partnerLocationRow?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    hasHandledInitialFocusRef.current = true;

    setShowPartnerMapActions(true);
    setShowSavedPlaceActions(false);
    setSelectedPlaceId(null);
    setPlaceDeleteModeId(null);

    const t = setTimeout(() => {
      mapRef.current?.animateToRegion(
        {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        },
        700
      );
    }, 400);

    return () => clearTimeout(t);
  }, [params?.focus, partnerLocationRow?.latitude, partnerLocationRow?.longitude]);

  const initialRegion = useMemo(() => {
    const latitude = Number(myLocationRow?.latitude ?? partnerLocationRow?.latitude);
    const longitude = Number(myLocationRow?.longitude ?? partnerLocationRow?.longitude);

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return {
        latitude,
        longitude,
        latitudeDelta: DEFAULT_REGION.latitudeDelta,
        longitudeDelta: DEFAULT_REGION.longitudeDelta,
      };
    }

    return DEFAULT_REGION;
  }, [
    myLocationRow?.latitude,
    myLocationRow?.longitude,
    partnerLocationRow?.latitude,
    partnerLocationRow?.longitude,
  ]);

  const fetchSavedPlaces = useCallback(async () => {
    if (!resolvedCoupleId) return;
    setPlacesLoading(true);
    try {
      const { data, error } = await supabase
        .from('saved_places')
        .select('*')
        .eq('couple_id', resolvedCoupleId)
        .order('created_at', { ascending: false });

      if (error) {
        const msg = String((error as any)?.message || '');
        if (msg.toLowerCase().includes('couple_id') && resolvedUserId) {
          const retry = await supabase
            .from('saved_places')
            .select('*')
            .eq('user_id', resolvedUserId)
            .order('created_at', { ascending: false });
          if (retry.error) {
            console.warn('fetchSavedPlaces error:', retry.error);
            return;
          }
          setSavedPlaces((retry.data ?? []) as any);
          return;
        }

        console.warn('fetchSavedPlaces error:', error);
        return;
      }

      setSavedPlaces((data ?? []) as any);
    } finally {
      setPlacesLoading(false);
    }
  }, [resolvedCoupleId, resolvedUserId]);

  const markSosEventSeen = useCallback(
    async (eventId: string | null | undefined) => {
      if (!eventId || !resolvedCoupleId) return;
      try {
        await supabase
          .from("sos_events")
          .update({ seen_by_partner: true } as any)
          .eq("id", eventId)
          .eq("couple_id", resolvedCoupleId);
      } catch (error) {
        console.warn("[Ubicacion] mark sos seen failed:", error);
      }
    },
    [resolvedCoupleId]
  );

  const showPartnerSosAlert = useCallback(
    async (event: SosEvent) => {
      if (!event?.id) return;
      if (!resolvedUserId) return;
      if (event.user_id === resolvedUserId) return;
      if (handledSosIdsRef.current.includes(event.id)) return;

      handledSosIdsRef.current = [...handledSosIdsRef.current, event.id];
      setHandledSosIds(prev => (prev.includes(event.id) ? prev : [...prev, event.id]));

      const lat = Number(event.latitude);
      const lng = Number(event.longitude);

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "≡ƒÜ¿ SOS de tu pareja",
            body: "Tu pareja necesita ayuda. Revisa su ubicación ahora.",
            sound: "default",
            priority: Notifications.AndroidNotificationPriority.MAX as any,
            data: {
              type: "sos",
              sosEventId: event.id,
              latitude: lat,
              longitude: lng,
            },
          },
          trigger: null,
        });
      } catch (error) {
        console.warn("[Ubicacion] local notification failed:", error);
      }

      setActiveSosEvent(event);
    },
    [resolvedUserId]
  );

  const fetchUnseenSosEvents = useCallback(async () => {
    if (!resolvedUserId || !resolvedCoupleId) return;
    try {
      const cutoffIso = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("sos_events")
        .select("*")
        .eq("couple_id", resolvedCoupleId)
        .neq("user_id", resolvedUserId)
        .eq("seen_by_partner", false)
        .gte("created_at", cutoffIso)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.warn("[Ubicacion] fetch unseen sos error:", error);
        return;
      }

      const latest = (data?.[0] as SosEvent | undefined) ?? undefined;
      if (latest) await showPartnerSosAlert(latest);
    } catch (error) {
      console.warn("[Ubicacion] fetchUnseenSosEvents failed:", error);
    }
  }, [resolvedCoupleId, resolvedUserId, showPartnerSosAlert]);

  useEffect(() => {
    fetchUnseenSosEvents();
  }, [fetchUnseenSosEvents]);

  useEffect(() => {
    if (!resolvedUserId || !resolvedCoupleId) return;

    const channel = supabase
      .channel(`sos-events-${resolvedCoupleId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sos_events",
          filter: `couple_id=eq.${resolvedCoupleId}`,
        },
        async (payload) => {
          const event = payload.new as SosEvent;
          if (!event?.id) return;
          if (event.user_id === resolvedUserId) return;
          await showPartnerSosAlert(event);
        }
      )
      .subscribe((status) => {
        console.log("[Ubicacion] sos realtime status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [resolvedCoupleId, resolvedUserId, showPartnerSosAlert]);

  const sendSosToPartner = useCallback(async () => {
    if (!resolvedUserId || !resolvedCoupleId) {
      Alert.alert("Error", "No se pudo encontrar tu perfil de pareja.");
      return;
    }

    const lat = Number(myLocationRow?.latitude);
    const lng = Number(myLocationRow?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      Alert.alert("Ubicación no disponible", "No pudimos obtener tu ubicación actual.");
      return;
    }

    try {
      setSendingSos(true);

      const batteryPercent =
        typeof myLocationRow?.battery_percent === "number"
          ? myLocationRow.battery_percent
          : null;

      const insertBase = {
        user_id: resolvedUserId,
        couple_id: resolvedCoupleId,
        latitude: lat,
        longitude: lng,
        battery_percent: batteryPercent,
        message: "Necesito ayuda. Esta es mi ubicación actual.",
      };

      const { error } = await supabase
        .from("sos_events")
        .insert({ ...(insertBase as any), seen_by_partner: false } as any);

      if (error) {
        console.warn("[Ubicacion] send sos error:", error);
        Alert.alert("Error", "No se pudo enviar el SOS. Intenta de nuevo.");
        return;
      }

      setShowSosModal(false);
    } catch (error) {
      console.warn("[Ubicacion] sendSosToPartner failed:", error);
      Alert.alert("Error", "No se pudo enviar el SOS.");
    } finally {
      setSendingSos(false);
    }
  }, [myLocationRow?.battery_percent, myLocationRow?.latitude, myLocationRow?.longitude, resolvedCoupleId, resolvedUserId]);

  useEffect(() => {
    let cancelled = false;

    const generateSavedPlaceMarkers = async () => {
      const colorsToGenerate = Array.from(
        new Set([...PLACE_COLORS, ...savedPlaces.map(place => getPlaceColor(place.color))])
      );

      const nextImages: Record<string, string> = {};

      for (const color of colorsToGenerate) {
        if (savedPlaceMarkerImages[color]) continue;
        const ref = savedPlaceMarkerRefs.current[color];
        if (!ref) continue;

        try {
          const uri = await captureRef(ref, {
            format: "png",
            quality: 1,
            result: "tmpfile",
            width: 130,
            height: 130,
          });
          nextImages[color] = uri;
        } catch (error) {
          console.warn("saved place marker capture failed:", color, error);
        }
      }

      if (cancelled) return;
      if (Object.keys(nextImages).length === 0) return;
      setSavedPlaceMarkerImages(prev => ({ ...prev, ...nextImages }));
    };

    const timer = setTimeout(generateSavedPlaceMarkers, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [savedPlaces, savedPlaceMarkerImages]);

  useEffect(() => {
    fetchSavedPlaces();
  }, [fetchSavedPlaces]);

  const selectedSavedPlace = useMemo(() => {
    return savedPlaces.find(place => place.id === selectedPlaceId) ?? null;
  }, [savedPlaces, selectedPlaceId]);

  const focusMapOnPlace = useCallback((place: Pick<SavedPlaceRow, 'latitude' | 'longitude'>) => {
    const lat = Number(place.latitude);
    const lng = Number(place.longitude);
    if (!mapRef.current || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

    mapRef.current.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: 0.003, longitudeDelta: 0.003 },
      600
    );
  }, []);

  const searchAddressLocation = useCallback(async () => {
    const address = placeAddress.trim();
    if (!address) {
      setAddPlaceError("Escribe una dirección o lugar.");
      return;
    }

    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setAddPlaceError("No se encontró Google Maps API key.");
      return;
    }

    try {
      setAddPlaceError(null);

      console.log("geocode query:", address);
      const query = `${address}, Toluca, Estado de México, México`;
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=mx&language=es&key=${apiKey}`;
      const response = await fetch(url);
      const json = await response.json();
      console.log("geocode status:", json?.status);
      console.log("geocode error_message:", json?.error_message);
      console.log("geocode results:", json?.results?.length);

      if (json?.status === "REQUEST_DENIED") {
        setAddPlaceError("La búsqueda por dirección aún no está disponible. Intenta de nuevo en unos minutos o selecciona manualmente en el mapa.");
        return;
      }

      if (json?.status === "ZERO_RESULTS") {
        setAddPlaceError("No se encontró esa dirección. Intenta escribir una referencia más completa.");
        return;
      }

      if (json?.status !== "OK") {
        setAddPlaceError(json?.error_message || `Error de Google Maps: ${json?.status}`);
        return;
      }

      const result = json?.results?.[0];
      if (!result) {
        setAddPlaceError("No se encontró esa dirección. Intenta escribir una referencia más completa.");
        return;
      }

      const latitude = Number(result?.geometry?.location?.lat);
      const longitude = Number(result?.geometry?.location?.lng);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        setAddPlaceError("No se encontró esa dirección. Intenta escribir una referencia más completa.");
        return;
      }

      const coordinate = { latitude, longitude };
      setPendingPlaceCoordinate(coordinate);
      setSelectedPlaceCoordinate(coordinate);
      setShowAddPlaceModal(false);
      setIsPickingPlaceOnMap(true);
      setShowPartnerMapActions(false);
      setShowSavedPlaceActions(false);
      setPlaceDeleteModeId(null);

      mapRef.current?.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: 0.004,
          longitudeDelta: 0.004,
        },
        700
      );
    } catch (error) {
      console.warn("search address error:", error);
      setAddPlaceError("No se pudo buscar la ubicación.");
    }
  }, [placeAddress]);

  const startManualPlacePick = useCallback(() => {
    let latitude = Number(myLocationRow?.latitude);
    let longitude = Number(myLocationRow?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      latitude = Number(userLocation?.coords?.latitude);
      longitude = Number(userLocation?.coords?.longitude);
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      latitude = initialRegion.latitude;
      longitude = initialRegion.longitude;
    }

    const coordinate = { latitude, longitude };
    setPendingPlaceCoordinate(coordinate);
    setSelectedPlaceCoordinate(coordinate);
    setShowAddPlaceModal(false);
    setIsPickingPlaceOnMap(true);
    setShowPartnerMapActions(false);
    setShowSavedPlaceActions(false);
    setPlaceDeleteModeId(null);
    setAddPlaceError(null);

    mapRef.current?.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      },
      700
    );
  }, [
    initialRegion.latitude,
    initialRegion.longitude,
    myLocationRow?.latitude,
    myLocationRow?.longitude,
    userLocation?.coords?.latitude,
    userLocation?.coords?.longitude,
  ]);

  const deleteSavedPlace = useCallback(
    async (placeId: string) => {
      if (!resolvedCoupleId) return;
      try {
        const { error } = await supabase
          .from("saved_places")
          .delete()
          .eq("id", placeId)
          .eq("couple_id", resolvedCoupleId);

        if (error) {
          const msg = String((error as any)?.message || '');
          if (msg.toLowerCase().includes('couple_id') && resolvedUserId) {
            const retry = await supabase
              .from("saved_places")
              .delete()
              .eq("id", placeId)
              .eq("user_id", resolvedUserId);
            if (retry.error) {
              console.warn("delete saved place error:", retry.error);
              return;
            }
          } else {
            console.warn("delete saved place error:", error);
            return;
          }
        }

        setSavedPlaces(prev => prev.filter(place => place.id !== placeId));

        if (selectedPlaceId === placeId) {
          setSelectedPlaceId(null);
          setShowSavedPlaceActions(false);
        }

        setPlaceDeleteModeId(null);
      } catch (error) {
        console.warn("delete saved place failed:", error);
      }
    },
    [resolvedCoupleId, resolvedUserId, selectedPlaceId]
  );

  const openAddPlace = useCallback((presetName?: string) => {
    setNewPlaceName(presetName ?? '');
    setNewPlaceColor('#f3a6b5');
    setPlaceAddress('');
    setSelectedPlaceCoordinate(null);
    setPendingPlaceCoordinate(null);
    setIsPickingPlaceOnMap(false);
    setAddPlaceMode('current');
    setAddPlaceError(null);
    setShowAddPlaceModal(true);
  }, []);

  const snapToNearbySavedPlace = useCallback(
    (latitude: number, longitude: number) => {
      const nearby = savedPlaces.find((place) => {
        const placeLat = Number(place.latitude);
        const placeLng = Number(place.longitude);
        if (!Number.isFinite(placeLat) || !Number.isFinite(placeLng)) return false;
        return getDistanceMeters(latitude, longitude, placeLat, placeLng) <= 12;
      });

      if (!nearby) return { latitude, longitude };
      return { latitude: Number(nearby.latitude), longitude: Number(nearby.longitude) };
    },
    [savedPlaces]
  );

  const saveNewPlace = useCallback(async () => {
    if (!resolvedUserId) {
      setAddPlaceError('No se encontró el usuario.');
      return;
    }
    if (!resolvedCoupleId) {
      setAddPlaceError('No se encontró la pareja.');
      return;
    }
    const name = newPlaceName.trim();
    if (!name) {
      setAddPlaceError('Escribe un nombre para el lugar.');
      return;
    }

    setSavingPlace(true);
    setAddPlaceError(null);
    try {
      let latitude: number | null = null;
      let longitude: number | null = null;

      if (addPlaceMode === 'current') {
        const latFromRow = Number(myLocationRow?.latitude);
        const lngFromRow = Number(myLocationRow?.longitude);
        const latFromUserLocation = Number(userLocation?.coords?.latitude);
        const lngFromUserLocation = Number(userLocation?.coords?.longitude);

        if (Number.isFinite(latFromRow) && Number.isFinite(lngFromRow)) {
          latitude = latFromRow;
          longitude = lngFromRow;
        } else if (Number.isFinite(latFromUserLocation) && Number.isFinite(lngFromUserLocation)) {
          latitude = latFromUserLocation;
          longitude = lngFromUserLocation;
        } else {
          setAddPlaceError("No pudimos obtener tu ubicación actual. Actualiza tu ubicación primero.");
          return;
        }
      } else {
        if (!selectedPlaceCoordinate) {
          setAddPlaceError("Primero selecciona una ubicación en el mapa.");
          return;
        }
        latitude = Number(selectedPlaceCoordinate.latitude);
        longitude = Number(selectedPlaceCoordinate.longitude);
      }

      if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
        setAddPlaceError('Ingresa latitud y longitud válidas.');
        return;
      }

      const snapped = snapToNearbySavedPlace(Number(latitude), Number(longitude));

      console.log("my current marker coordinate:", {
        latitude: myLocationRow?.latitude,
        longitude: myLocationRow?.longitude,
      });
      console.log("saving saved place coordinate:", {
        name,
        latitude: snapped.latitude,
        longitude: snapped.longitude,
      });

      const address = placeAddress.trim() || null;
      const payload: any = {
        couple_id: resolvedCoupleId,
        user_id: resolvedUserId,
        name,
        color: newPlaceColor,
        latitude: snapped.latitude,
        longitude: snapped.longitude,
      };
      if (addPlaceMode === "search") {
        payload.address = address;
      }

      const { data, error } = await supabase.from('saved_places').insert(payload as any).select().single();

      if (error) {
        const msg = String((error as any)?.message || "");
        if (msg.toLowerCase().includes("couple_id")) {
          const fallbackPayload: any = {
            user_id: resolvedUserId,
            name,
            color: newPlaceColor,
            latitude: snapped.latitude,
            longitude: snapped.longitude,
          };
          if (addPlaceMode === "search") fallbackPayload.address = address;
          const retry = await supabase.from('saved_places').insert(fallbackPayload as any).select().single();
          if (retry.error) {
            console.warn('save place error:', retry.error);
            setAddPlaceError(retry.error.message || 'No se pudo guardar el lugar.');
            return;
          }
          const created = retry.data as any;
          setSavedPlaces(prev => [created, ...prev]);
          if (created?.id) setSelectedPlaceId(String(created.id));
          if (typeof created?.latitude === 'number' && typeof created?.longitude === 'number') {
            focusMapOnPlace({ latitude: created.latitude, longitude: created.longitude });
          }

          setNewPlaceName('');
          setNewPlaceColor('#f3a6b5');
          setPlaceAddress('');
          setSelectedPlaceCoordinate(null);
          setPendingPlaceCoordinate(null);
          setIsPickingPlaceOnMap(false);
          setAddPlaceError(null);
          setShowAddPlaceModal(false);
          return;
        }

        if (addPlaceMode === "search" && msg.toLowerCase().includes("address")) {
          const fallbackPayload = {
            couple_id: resolvedCoupleId,
            user_id: resolvedUserId,
            name,
            color: newPlaceColor,
            latitude: snapped.latitude,
            longitude: snapped.longitude,
          };
          const retry = await supabase.from('saved_places').insert(fallbackPayload as any).select().single();
          if (retry.error) {
            console.warn('save place error:', retry.error);
            setAddPlaceError(retry.error.message || 'No se pudo guardar el lugar.');
            return;
          }
          const created = retry.data as any;
          setSavedPlaces(prev => [created, ...prev]);
          if (created?.id) setSelectedPlaceId(String(created.id));
          if (typeof created?.latitude === 'number' && typeof created?.longitude === 'number') {
            focusMapOnPlace({ latitude: created.latitude, longitude: created.longitude });
          }

          setNewPlaceName('');
          setNewPlaceColor('#f3a6b5');
          setPlaceAddress('');
          setSelectedPlaceCoordinate(null);
          setPendingPlaceCoordinate(null);
          setIsPickingPlaceOnMap(false);
          setAddPlaceError(null);
          setShowAddPlaceModal(false);
          return;
        }

        console.warn('save place error:', error);
        setAddPlaceError(error.message || 'No se pudo guardar el lugar.');
        return;
      }

      const created = data as any;
      setSavedPlaces(prev => [created, ...prev]);
      if (created?.id) setSelectedPlaceId(String(created.id));
      if (typeof created?.latitude === 'number' && typeof created?.longitude === 'number') {
        focusMapOnPlace({ latitude: created.latitude, longitude: created.longitude });
      }

      setNewPlaceName('');
      setNewPlaceColor('#f3a6b5');
      setPlaceAddress('');
      setSelectedPlaceCoordinate(null);
      setPendingPlaceCoordinate(null);
      setIsPickingPlaceOnMap(false);
      setAddPlaceError(null);
      setShowAddPlaceModal(false);
    } finally {
      setSavingPlace(false);
    }
  }, [
    addPlaceMode,
    focusMapOnPlace,
    newPlaceColor,
    newPlaceName,
    placeAddress,
    resolvedUserId,
    resolvedCoupleId,
    myLocationRow?.latitude,
    myLocationRow?.longitude,
    userLocation,
    selectedPlaceCoordinate,
    snapToNearbySavedPlace,
  ]);

  const fetchCoupleLocations = useCallback(async () => {
    if (!resolvedCoupleId || !resolvedUserId) return;
    setLocationsLoading(true);
    setLocationsError(null);
    try {
      const { data, error } = await supabase
        .from('couple_locations')
        .select('*')
        .eq('couple_id', resolvedCoupleId)
        .order('updated_at', { ascending: false });

      if (error) {
        const msg = String((error as any)?.message || '');
        if (msg.toLowerCase().includes('updated_at')) {
          const retry = await supabase.from('couple_locations').select('*').eq('couple_id', resolvedCoupleId);
          if (!retry.error) {
            const rows = (retry.data ?? []) as any[];
            console.log("current user id:", resolvedUserId);
            console.log("profile couple_id:", resolvedCoupleId);
            console.log("location rows:", rows);

            const myRow = rows.find(row => row.user_id === resolvedUserId) ?? null;
            const partnerRow = rows.find(row => row.user_id !== resolvedUserId) ?? null;

            console.log("my location row:", myRow);
            console.log("partner location row:", partnerRow);

            setMyLocationRow(myRow);
            setPartnerLocationRow(partnerRow);
            return;
          }
        }
        console.warn('fetchCoupleLocations error:', error);
        setLocationsError('No se pudieron cargar las ubicaciones.');
        return;
      }

      const rows = (data ?? []) as any[];
      console.log("current user id:", resolvedUserId);
      console.log("profile couple_id:", resolvedCoupleId);
      console.log("location rows:", rows);

      const myRow = rows.find(row => row.user_id === resolvedUserId) ?? null;
      const partnerRow = rows.find(row => row.user_id !== resolvedUserId) ?? null;

      console.log("my location row:", myRow);
      console.log("partner location row:", partnerRow);

      setMyLocationRow(myRow);
      setPartnerLocationRow(partnerRow);
    } finally {
      setLocationsLoading(false);
    }
  }, [resolvedCoupleId, resolvedUserId]);

  useEffect(() => {
    fetchCoupleLocations();
  }, [fetchCoupleLocations]);

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
  }, [resolvedCoupleId, fetchCoupleLocations]);

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

  const distanceMeters = distanceKm === null ? null : distanceKm * 1000;

  const myCoordinate = myLocationRow
    ? { latitude: myLocationRow.latitude, longitude: myLocationRow.longitude }
    : null;
  const partnerCoordinate = partnerLocationRow
    ? { latitude: partnerLocationRow.latitude, longitude: partnerLocationRow.longitude }
    : null;
  const myLocation = myLocationRow;
  const partnerLocation = partnerLocationRow;

  const mapCenter = myLocation || partnerLocation;

  const myMarkerDirection = getMarkerDirection(myLocation);
  const partnerMarkerDirection = getMarkerDirection(partnerLocation);

  useEffect(() => {
    const id = sheetHeight.addListener(({ value }) => {
      sheetHeightNumber.current = value;
    });
    return () => {
      sheetHeight.removeListener(id);
    };
  }, [sheetHeight]);

  const snapSheetTo = useCallback(
    (expanded: boolean) => {
      setIsSheetExpanded(expanded);
      Animated.spring(sheetHeight, {
        toValue: expanded ? SHEET_EXPANDED_HEIGHT : SHEET_COLLAPSED_HEIGHT,
        useNativeDriver: false,
        tension: 70,
        friction: 12,
      }).start();
    },
    [SHEET_COLLAPSED_HEIGHT, SHEET_EXPANDED_HEIGHT, sheetHeight]
  );

  const sheetPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dy) > 8,
      onPanResponderGrant: () => {
        sheetDragStartHeightRef.current = sheetHeightNumber.current;
      },
      onPanResponderMove: (_evt, gesture) => {
        const nextHeight = sheetDragStartHeightRef.current - gesture.dy;
        const clampedHeight = Math.max(
          SHEET_COLLAPSED_HEIGHT,
          Math.min(SHEET_EXPANDED_HEIGHT, nextHeight)
        );
        sheetHeight.setValue(clampedHeight);
      },
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dy < -40 || gesture.vy < -0.4) {
          snapSheetTo(true);
          return;
        }
        if (gesture.dy > 40 || gesture.vy > 0.4) {
          snapSheetTo(false);
          return;
        }

        const middle = (SHEET_COLLAPSED_HEIGHT + SHEET_EXPANDED_HEIGHT) / 2;
        snapSheetTo(sheetHeightNumber.current > middle);
      },
    })
  ).current;

  const detailOpacity = sheetHeight.interpolate({
    inputRange: [SHEET_COLLAPSED_HEIGHT + 10, SHEET_COLLAPSED_HEIGHT + 90],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const detailTranslateY = sheetHeight.interpolate({
    inputRange: [SHEET_COLLAPSED_HEIGHT + 10, SHEET_COLLAPSED_HEIGHT + 90],
    outputRange: [24, 0],
    extrapolate: 'clamp',
  });

  const openPartnerInMaps = useCallback(() => {
    if (!partnerLocation) return;

    const lat = Number(partnerLocation.latitude);
    const lng = Number(partnerLocation.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.openURL(url);
  }, [partnerLocation]);

  const openPartnerDirections = useCallback(() => {
    if (!partnerLocation) return;

    const lat = Number(partnerLocation.latitude);
    const lng = Number(partnerLocation.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.openURL(url);
  }, [partnerLocation]);

  const openSavedPlaceInMaps = useCallback(() => {
    if (!selectedSavedPlace) return;

    const lat = Number(selectedSavedPlace.latitude);
    const lng = Number(selectedSavedPlace.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.openURL(url);
  }, [selectedSavedPlace]);

  const openSavedPlaceDirections = useCallback(() => {
    if (!selectedSavedPlace) return;

    const lat = Number(selectedSavedPlace.latitude);
    const lng = Number(selectedSavedPlace.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.openURL(url);
  }, [selectedSavedPlace]);

  const zoomToLocation = useCallback((location: any) => {
    if (!mapRef.current || !location) return;

    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    mapRef.current.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: 0.0025,
        longitudeDelta: 0.0025,
      },
      700
    );
  }, []);

  const focusPartnerLocation = useCallback(() => {
    const lat = Number(partnerLocationRow?.latitude);
    const lng = Number(partnerLocationRow?.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      Alert.alert("Ubicación no disponible", "Todavía no tenemos la ubicación de tu pareja.");
      return;
    }

    setShowPartnerMapActions(true);
    setShowSavedPlaceActions(false);
    setSelectedPlaceId(null);
    setPlaceDeleteModeId(null);

    mapRef.current?.animateToRegion(
      {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.003,
        longitudeDelta: 0.003,
      },
      700
    );
  }, [partnerLocationRow?.latitude, partnerLocationRow?.longitude]);

  const myOffscreenX = useRef(new Animated.Value(0)).current;
  const myOffscreenY = useRef(new Animated.Value(0)).current;
  const myOffscreenOpacity = useRef(new Animated.Value(0)).current;

  const partnerOffscreenX = useRef(new Animated.Value(0)).current;
  const partnerOffscreenY = useRef(new Animated.Value(0)).current;
  const partnerOffscreenOpacity = useRef(new Animated.Value(0)).current;

  const myOffscreenVisibleRef = useRef(false);
  const partnerOffscreenVisibleRef = useRef(false);
  const myOffscreenLastPointRef = useRef({ x: 0, y: 0 });
  const partnerOffscreenLastPointRef = useRef({ x: 0, y: 0 });

  const mapSizeRef = useRef({ width: 0, height: 0 });
  const [currentMapRegion, setCurrentMapRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);
  const currentMapRegionRef = useRef<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);

  type PersonKind = "me" | "partner";

  const updateOffscreenBubbleAnimated = useCallback((person: PersonKind, region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }) => {
    const { width, height } = mapSizeRef.current;
    if (!width || !height) return;

    const bubbleSize = 56;
    const bubbleRadius = bubbleSize / 2;
    const markerRadius = 34;

    const visibleLeft = 0;
    const visibleTop = 0;
    const visibleRight = width;
    const collapsedSheetHeight = typeof SHEET_COLLAPSED_HEIGHT === "number" ? SHEET_COLLAPSED_HEIGHT : 230;
    const rawVisibleBottom = height - collapsedSheetHeight;
    const visibleBottom = Math.max(visibleTop, Math.min(height, rawVisibleBottom));

    const row = person === "me" ? myLocationRow : partnerLocationRow;
    const lat = Number(row?.latitude);
    const lng = Number(row?.longitude);
    const xValue = person === "me" ? myOffscreenX : partnerOffscreenX;
    const yValue = person === "me" ? myOffscreenY : partnerOffscreenY;
    const opacityValue = person === "me" ? myOffscreenOpacity : partnerOffscreenOpacity;
    const visibleRef = person === "me" ? myOffscreenVisibleRef : partnerOffscreenVisibleRef;
    const lastPointRef = person === "me" ? myOffscreenLastPointRef : partnerOffscreenLastPointRef;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      if (visibleRef.current) {
        visibleRef.current = false;
        opacityValue.setValue(0);
      }
      return;
    }

    const minLat = region.latitude - region.latitudeDelta / 2;
    const maxLat = region.latitude + region.latitudeDelta / 2;
    const minLng = region.longitude - region.longitudeDelta / 2;
    const maxLng = region.longitude + region.longitudeDelta / 2;

    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;
    if (!Number.isFinite(latSpan) || !Number.isFinite(lngSpan) || latSpan <= 0 || lngSpan <= 0) return;

    const rawX = ((lng - minLng) / lngSpan) * width;
    const rawY = ((maxLat - lat) / latSpan) * height;

    const intersectsVisibleRect =
      rawX + markerRadius > visibleLeft &&
      rawX - markerRadius < visibleRight &&
      rawY + markerRadius > visibleTop &&
      rawY - markerRadius < visibleBottom;

    if (intersectsVisibleRect) {
      if (visibleRef.current) {
        visibleRef.current = false;
        opacityValue.setValue(0);
      }
      return;
    }

    const halfOutside = bubbleRadius * 0.5;

    let centerX = rawX;
    let centerY = rawY;

    if (rawX < visibleLeft) {
      centerX = visibleLeft - halfOutside;
    } else if (rawX > visibleRight) {
      centerX = visibleRight + halfOutside;
    } else {
      centerX = Math.min(Math.max(rawX, visibleLeft + bubbleRadius), visibleRight - bubbleRadius);
    }

    if (rawY < visibleTop) {
      centerY = visibleTop - halfOutside;
    } else if (rawY > visibleBottom) {
      centerY = visibleBottom + halfOutside;
    } else {
      centerY = Math.min(Math.max(rawY, visibleTop + bubbleRadius), visibleBottom - bubbleRadius);
    }

    const finalX = Math.round(centerX - bubbleRadius);
    const finalY = Math.round(centerY - bubbleRadius);

    const oldPoint = lastPointRef.current;
    if (Math.abs(finalX - oldPoint.x) >= 1) {
      xValue.setValue(finalX);
    }
    if (Math.abs(finalY - oldPoint.y) >= 1) {
      yValue.setValue(finalY);
    }
    lastPointRef.current = { x: finalX, y: finalY };

    if (!visibleRef.current) {
      visibleRef.current = true;
      opacityValue.setValue(1);
    }
  }, [
    myOffscreenOpacity,
    myOffscreenX,
    myOffscreenY,
    partnerOffscreenOpacity,
    partnerOffscreenX,
    partnerOffscreenY,
    myLocationRow,
    partnerLocationRow,
  ]);

  const updateBothOffscreenBubblesAnimated = useCallback((region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }) => {
    updateOffscreenBubbleAnimated("me", region);
    updateOffscreenBubbleAnimated("partner", region);

    if (!myOffscreenVisibleRef.current || !partnerOffscreenVisibleRef.current) return;

    const myPoint = myOffscreenLastPointRef.current;
    const partnerPoint = partnerOffscreenLastPointRef.current;

    const bubbleSize = 56;
    const bubbleRadius = bubbleSize / 2;

    if (Math.abs(myPoint.x - partnerPoint.x) >= bubbleSize || Math.abs(myPoint.y - partnerPoint.y) >= bubbleSize) {
      return;
    }

    const { width, height } = mapSizeRef.current;
    if (!width || !height) return;

    const offset = 64;
    const halfOutside = bubbleRadius * 0.5;

    const visibleLeft = 0;
    const visibleTop = 0;
    const visibleRight = width;
    const collapsedSheetHeight = typeof SHEET_COLLAPSED_HEIGHT === "number" ? SHEET_COLLAPSED_HEIGHT : 230;
    const rawVisibleBottom = height - collapsedSheetHeight;
    const visibleBottom = Math.max(visibleTop, Math.min(height, rawVisibleBottom));

    const minX = Math.round(visibleLeft - halfOutside - bubbleRadius);
    const maxX = Math.round(visibleRight + halfOutside - bubbleRadius);
    const minY = Math.round(visibleTop - halfOutside - bubbleRadius);
    const maxY = Math.round(visibleBottom + halfOutside - bubbleRadius);

    const partnerCenterX = partnerPoint.x + bubbleRadius;
    const partnerCenterY = partnerPoint.y + bubbleRadius;

    const pinnedLeftOrRight = partnerCenterX < visibleLeft || partnerCenterX > visibleRight;
    const pinnedTopOrBottom = partnerCenterY < visibleTop || partnerCenterY > visibleBottom;

    if (pinnedLeftOrRight && !pinnedTopOrBottom) {
      let nextPartnerY = partnerPoint.y + offset;
      if (nextPartnerY > maxY - 1) nextPartnerY = partnerPoint.y - offset;
      nextPartnerY = Math.min(Math.max(Math.round(nextPartnerY), minY), maxY);
      if (Math.abs(nextPartnerY - partnerOffscreenLastPointRef.current.y) >= 1) {
        partnerOffscreenY.setValue(nextPartnerY);
        partnerOffscreenLastPointRef.current = { x: partnerPoint.x, y: nextPartnerY };
      }
      return;
    }

    if (pinnedTopOrBottom && !pinnedLeftOrRight) {
      let nextPartnerX = partnerPoint.x + offset;
      if (nextPartnerX > maxX - 1) nextPartnerX = partnerPoint.x - offset;
      nextPartnerX = Math.min(Math.max(Math.round(nextPartnerX), minX), maxX);
      if (Math.abs(nextPartnerX - partnerOffscreenLastPointRef.current.x) >= 1) {
        partnerOffscreenX.setValue(nextPartnerX);
        partnerOffscreenLastPointRef.current = { x: nextPartnerX, y: partnerPoint.y };
      }
      return;
    }

    if (pinnedLeftOrRight && pinnedTopOrBottom) {
      let nextPartnerY = partnerPoint.y + offset;
      if (nextPartnerY > maxY - 1) nextPartnerY = partnerPoint.y - offset;
      nextPartnerY = Math.min(Math.max(Math.round(nextPartnerY), minY), maxY);
      if (Math.abs(nextPartnerY - partnerOffscreenLastPointRef.current.y) >= 1) {
        partnerOffscreenY.setValue(nextPartnerY);
        partnerOffscreenLastPointRef.current = { x: partnerPoint.x, y: nextPartnerY };
      }
    }
  }, [partnerOffscreenX, partnerOffscreenY, updateOffscreenBubbleAnimated]);

  const focusLocationFromIndicator = useCallback(
    (latitude: number, longitude: number, person: "me" | "partner") => {
      if (person === "partner") {
        setShowPartnerMapActions(true);
        setShowSavedPlaceActions(false);
        setSelectedPlaceId(null);
      } else {
        setShowPartnerMapActions(false);
        setShowSavedPlaceActions(false);
      }

      setPlaceDeleteModeId(null);

      mapRef.current?.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        },
        650
      );
    },
    []
  );

  useEffect(() => {
    if (!currentMapRegion) return;
    updateBothOffscreenBubblesAnimated(currentMapRegion);
  }, [
    updateBothOffscreenBubblesAnimated,
    currentMapRegion,
    myLocationRow?.latitude,
    myLocationRow?.longitude,
    partnerLocationRow?.latitude,
    partnerLocationRow?.longitude,
  ]);

  useEffect(() => {
    let cancelled = false;

    const createMarkerImages = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 700));

        if (myMarkerRef.current) {
          const uri = await captureRef(myMarkerRef.current, {
            format: 'png',
            quality: 1,
            result: 'tmpfile',
            width: 270,
            height: 235,
          });
          if (!cancelled) setMyMarkerImageUri(uri);
        }

        if (partnerMarkerRef.current) {
          const uri = await captureRef(partnerMarkerRef.current, {
            format: 'png',
            quality: 1,
            result: 'tmpfile',
            width: 270,
            height: 235,
          });
          if (!cancelled) setPartnerMarkerImageUri(uri);
        }
      } catch (error) {
        console.log('create marker images error', error);
      }
    };

    createMarkerImages();

    return () => {
      cancelled = true;
    };
  }, [
    (profile as any)?.avatar_url,
    (profile as any)?.name,
    couple?.partner_avatar_url,
    couple?.partner_name,
    myMarkerDirection,
    partnerMarkerDirection,
  ]);

  const captureOffscreenBubblePngs = useCallback(async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 350));

      if (myBubbleCaptureRef.current) {
        const uri = await captureRef(myBubbleCaptureRef.current, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });
        setMyBubblePngUri(uri);
      }

      if (partnerBubbleCaptureRef.current) {
        const uri = await captureRef(partnerBubbleCaptureRef.current, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });
        setPartnerBubblePngUri(uri);
      }
    } catch (error) {
      console.warn('[Ubicacion] offscreen bubble capture failed:', error);
    }
  }, []);

  useEffect(() => {
    captureOffscreenBubblePngs();
  }, [captureOffscreenBubblePngs, myAvatarUri, (profile as any)?.name, partnerAvatarUri, couple?.partner_name]);

  useEffect(() => {
    console.log('Google map initialRegion:', initialRegion);
    console.log('Google map my marker:', myLocation);
    console.log('Google map partner marker:', partnerLocation);
  }, [initialRegion.latitude, initialRegion.longitude, myLocation, partnerLocation]);

  useEffect(() => {
    console.log("partner battery percent:", partnerLocationRow?.battery_percent);
  }, [partnerLocationRow?.battery_percent]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapCenter || !map) return;

    if (myCoordinate && partnerCoordinate) {
      map.fitToCoordinates(
        [
          { latitude: Number(myLocationRow?.latitude), longitude: Number(myLocationRow?.longitude) },
          { latitude: Number(partnerLocationRow?.latitude), longitude: Number(partnerLocationRow?.longitude) },
        ],
        {
          edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
          animated: true,
        }
      );
      return;
    }

    if (myCoordinate) {
      map.animateToRegion(
        {
          latitude: Number(myLocationRow?.latitude),
          longitude: Number(myLocationRow?.longitude),
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        450
      );
    }
  }, [
    mapCenter?.latitude,
    mapCenter?.longitude,
    myLocationRow?.latitude,
    myLocationRow?.longitude,
    partnerLocationRow?.latitude,
    partnerLocationRow?.longitude,
  ]);

  const isUpdatingMyLocationRef = useRef(false);
  const didInitAutoLocationRef = useRef(false);

  const updateMyLocation = useCallback(async () => {
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
    if (isUpdatingMyLocationRef.current) return;
    isUpdatingMyLocationRef.current = true;

    setSaveStatus(null);
    setSaveStatusType(null);

    console.log('Profile:', profile);
    console.log('Couple:', couple);
    console.log('Resolved couple_id:', resolvedCoupleId);
    console.log('Resolved user_id:', resolvedUserId);

    setSaving(true);
    setSaveStatusType('pending');
    if (!didInitAutoLocationRef.current) {
      setLocLoading(true);
      didInitAutoLocationRef.current = true;
    }

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

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
        mayShowUserSettingsDialog: true,
      });
      setUserLocation(loc);

      const coords = loc?.coords;
      if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
        setSaveStatus('No se pudo obtener tu ubicación.');
        setSaveStatusType('error');
        return;
      }

      const accuracy = typeof coords.accuracy === "number" ? coords.accuracy : null;
      if (accuracy !== null && accuracy > 35) {
        console.log("[Ubicacion] location ignored because accuracy is low:", accuracy);
        return;
      }

      const prevLat = Number(myLocationRow?.latitude);
      const prevLng = Number(myLocationRow?.longitude);
      if (Number.isFinite(prevLat) && Number.isFinite(prevLng)) {
        const movedMeters = getDistanceMeters(prevLat, prevLng, coords.latitude, coords.longitude);
        if (movedMeters < 8) {
          console.log("[Ubicacion] location ignored because movement is too small:", movedMeters);
          return;
        }
      }

      let batteryPercent: number | null = null;
      try {
        const batteryLevel = await Battery.getBatteryLevelAsync();
        if (typeof batteryLevel === "number" && batteryLevel >= 0) {
          batteryPercent = Math.round(batteryLevel * 100);
        }
      } catch (error) {
        console.warn("battery read failed:", error);
      }
      console.log("my battery percent:", batteryPercent);

      const payload = {
        couple_id: resolvedCoupleId,
        user_id: resolvedUserId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy_m: accuracy,
        heading: coords.heading ?? null,
        speed_mps: coords.speed ?? null,
        battery_percent: batteryPercent,
        recorded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log('Location payload:', payload);

      const { data, error } = await supabase
        .from('couple_locations')
        .upsert(payload as any, { onConflict: 'couple_id,user_id' })
        .select()
        .single();

      if (error) {
        const msg = String((error as any)?.message || "");
        if (msg.toLowerCase().includes("battery_percent")) {
          const fallbackPayload = {
            couple_id: resolvedCoupleId,
            user_id: resolvedUserId,
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy_m: accuracy,
            heading: coords.heading ?? null,
            speed_mps: coords.speed ?? null,
            recorded_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const retry = await supabase
            .from('couple_locations')
            .upsert(fallbackPayload as any, { onConflict: 'couple_id,user_id' })
            .select()
            .single();

          console.log('Location save data:', retry.data);
          console.log('Location save error:', retry.error);

          if (retry.error) {
            setSaveStatus('No se pudo actualizar tu ubicación automáticamente.');
            setSaveStatusType('error');
            return;
          }

          setSaveStatusType('success');
          setMyLocationRow((retry.data as any) ?? (fallbackPayload as any));
          await fetchCoupleLocations();
          return;
        }
      }

      console.log('Location save data:', data);
      console.log('Location save error:', error);

      if (error) {
        setSaveStatus('No se pudo actualizar tu ubicación automáticamente.');
        setSaveStatusType('error');
        return;
      }

      setSaveStatusType('success');
      setMyLocationRow((data as any) ?? (payload as any));

      const { data: rows, error: fetchError } = await supabase
        .from('couple_locations')
        .select('*')
        .eq('couple_id', resolvedCoupleId);

      console.log('couple_locations fetched after save:', rows);
      console.log('couple_locations fetch error:', fetchError);
      await fetchCoupleLocations();
    } catch (e) {
      setSaveStatus('No se pudo actualizar tu ubicación automáticamente.');
      setSaveStatusType('error');
    } finally {
      setSaving(false);
      setLocLoading(false);
      isUpdatingMyLocationRef.current = false;
    }
  }, [fetchCoupleLocations, resolvedCoupleId, resolvedUserId]);

  useEffect(() => {
    if (!resolvedUserId || !resolvedCoupleId) return;

    updateMyLocation();

    const interval = setInterval(() => {
      updateMyLocation();
    }, 60000);

    return () => clearInterval(interval);
  }, [resolvedCoupleId, resolvedUserId, updateMyLocation]);

  const markerFactoryColors = Array.from(
    new Set([...PLACE_COLORS, ...savedPlaces.map(place => getPlaceColor(place.color))])
  );

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
      <View style={s.hiddenMarkerFactory} pointerEvents="none">
        <View ref={myMarkerRef} collapsable={false} style={s.generatedMarker}>
          <View
            style={[
              s.generatedMarkerBubble,
              s.myGeneratedMarkerBubble,
              myMarkerDirection === 'left' && s.generatedMarkerBubbleLeft,
              myMarkerDirection === 'right' && s.generatedMarkerBubbleRight,
            ]}
          >
            {(profile as any)?.avatar_url ? (
              <Image
                source={{ uri: (profile as any).avatar_url }}
                style={s.generatedMarkerImage}
                resizeMode="cover"
              />
            ) : (
              <Text style={s.generatedMarkerInitial}>
                {getInitial((profile as any)?.name, 'T')}
              </Text>
            )}
          </View>
          {myMarkerDirection === 'left' ? (
            <View style={[s.generatedMarkerTailLeft, s.myGeneratedMarkerTail]} />
          ) : myMarkerDirection === 'right' ? (
            <View style={[s.generatedMarkerTailRight, s.myGeneratedMarkerTail]} />
          ) : (
            <View style={[s.generatedMarkerTailBottom, s.myGeneratedMarkerTail]} />
          )}
        </View>
        <View ref={partnerMarkerRef} collapsable={false} style={s.generatedMarker}>
          <View
            style={[
              s.generatedMarkerBubble,
              partnerMarkerDirection === 'left' && s.generatedMarkerBubbleLeft,
              partnerMarkerDirection === 'right' && s.generatedMarkerBubbleRight,
            ]}
          >
            {couple?.partner_avatar_url ? (
              <Image
                source={{ uri: couple.partner_avatar_url }}
                style={s.generatedMarkerImage}
                resizeMode="cover"
              />
            ) : (
              <Text style={s.generatedMarkerInitial}>
                {getInitial(couple?.partner_name, 'P')}
              </Text>
            )}
          </View>
          {partnerMarkerDirection === 'left' ? (
            <View style={s.generatedMarkerTailLeft} />
          ) : partnerMarkerDirection === 'right' ? (
            <View style={s.generatedMarkerTailRight} />
          ) : (
            <View style={s.generatedMarkerTailBottom} />
          )}
        </View>
        {markerFactoryColors.map(color => (
          <View
            key={color}
            ref={ref => {
              savedPlaceMarkerRefs.current[color] = ref;
            }}
            collapsable={false}
            style={s.savedPlaceMarkerFactoryItem}
          >
            <View
              style={[
                s.savedPlaceMarkerHalo,
                {
                  backgroundColor: hexToRgba(color, 0.22),
                  shadowColor: color,
                },
              ]}
            />
            <View style={[s.savedPlaceMarkerBadge, { borderColor: color }]}>
              <MaterialCommunityIcons name="heart" size={42} color={color} />
            </View>
          </View>
        ))}
      </View>
      <View style={s.hiddenCaptureArea} pointerEvents="none">
        <View ref={myBubbleCaptureRef} collapsable={false} style={s.captureBubble}>
          <View style={s.captureBubbleFrame} renderToHardwareTextureAndroid collapsable={false}>
            {myAvatarUri ? (
              <Image
                source={{ uri: myAvatarUri }}
                style={s.captureBubbleAvatar}
                resizeMode="cover"
                fadeDuration={0}
                onLoadEnd={captureOffscreenBubblePngs}
              />
            ) : (
              <View style={s.captureBubbleInitial}>
                <Text style={s.captureBubbleInitialText}>{myDisplayInitial}</Text>
              </View>
            )}
          </View>
        </View>
        <View ref={partnerBubbleCaptureRef} collapsable={false} style={s.captureBubble}>
          <View style={s.captureBubbleFrame} renderToHardwareTextureAndroid collapsable={false}>
            {partnerAvatarUri ? (
              <Image
                source={{ uri: partnerAvatarUri }}
                style={s.captureBubbleAvatar}
                resizeMode="cover"
                fadeDuration={0}
                onLoadEnd={captureOffscreenBubblePngs}
              />
            ) : (
              <View style={s.captureBubbleInitial}>
                <Text style={s.captureBubbleInitialText}>{partnerDisplayInitial}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      <View style={[s.topPlacesContainer, { paddingTop: Math.max(insets.top, 10) }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.placesScrollContent}
        >
          {placesLoading ? (
            <View style={s.placeChip}>
              <Text style={s.placeChipText}>Cargando...</Text>
            </View>
          ) : savedPlaces.length > 0
            ? savedPlaces.map(place => {
                const isActive = selectedPlaceId === place.id;
                return (
                  <TouchableOpacity
                    key={place.id}
                    style={[s.placeChip, isActive && s.placeChipActive]}
                    onPress={() => {
                      setSelectedPlaceId(place.id);
                      setShowSavedPlaceActions(true);
                      setShowPartnerMapActions(false);
                      setPlaceDeleteModeId(null);
                      mapRef.current?.animateToRegion(
                        {
                          latitude: Number(place.latitude),
                          longitude: Number(place.longitude),
                          latitudeDelta: 0.003,
                          longitudeDelta: 0.003,
                        },
                        600
                      );
                    }}
                    onLongPress={() => {
                      setPlaceDeleteModeId(place.id);
                      setSelectedPlaceId(place.id);
                      setShowSavedPlaceActions(false);
                      setShowPartnerMapActions(false);
                    }}
                  >
                    <View style={[s.placeColorDot, { backgroundColor: getPlaceColor(place.color) }]} />
                    <Text style={[s.placeChipText, isActive && s.placeChipTextActive]} numberOfLines={1}>
                      {place.name}
                    </Text>

                    {placeDeleteModeId === place.id ? (
                      <Pressable style={s.placeDeleteOverlay} onPress={() => deleteSavedPlace(place.id)}>
                        <Ionicons name="trash" size={22} color="#ffffff" />
                      </Pressable>
                    ) : null}
                  </TouchableOpacity>
                );
              })
            : null}
        </ScrollView>

        <TouchableOpacity
          style={s.addPlaceButton}
          onPress={() => {
            setPlaceDeleteModeId(null);
            setAddPlaceError("");
            setShowAddPlaceModal(true);
            openAddPlace();
          }}
        >
          <Text style={s.addPlaceButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showAddPlaceModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddPlaceModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeaderRow}>
              <Text style={s.modalTitle}>Nuevo lugar</Text>
              <TouchableOpacity style={s.modalCloseBtn} onPress={() => setShowAddPlaceModal(false)}>
                <Text style={s.modalCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={s.modeRow}>
              <TouchableOpacity
                style={[s.modeButton, addPlaceMode === 'current' && s.modeButtonActive]}
                onPress={() => setAddPlaceMode('current')}
              >
                <Text style={[s.modeButtonText, addPlaceMode === 'current' && s.modeButtonTextActive]}>
                  Usar mi ubicación actual
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modeButton, addPlaceMode === 'search' && s.modeButtonActive]}
                onPress={() => setAddPlaceMode('search')}
              >
                <Text style={[s.modeButtonText, addPlaceMode === 'search' && s.modeButtonTextActive]}>
                  Buscar o escribir
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              value={newPlaceName}
              onChangeText={setNewPlaceName}
              placeholder="Nombre del lugar"
              placeholderTextColor={TEXT_MUTED}
              style={s.input}
            />

            <Text style={s.modalLabel}>Color</Text>
            <View style={s.colorPickerRow}>
              {[
                { label: 'Rosa', value: '#f3a6b5' },
                { label: 'Azul', value: '#60a5fa' },
                { label: 'Verde', value: '#35c779' },
                { label: 'Amarillo', value: '#fbbf24' },
                { label: 'Morado', value: '#a78bfa' },
              ].map(c => {
                const active = newPlaceColor === c.value;
                return (
                  <TouchableOpacity
                    key={c.value}
                    style={[s.colorOption, active && s.colorOptionActive]}
                    onPress={() => setNewPlaceColor(c.value)}
                  >
                    <View style={[s.colorOptionDot, { backgroundColor: c.value }]} />
                    <Text style={s.colorOptionText}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.modalLabel}>Ubicación</Text>
            {addPlaceMode === 'search' ? (
              <>
                <TextInput
                  value={placeAddress}
                  onChangeText={setPlaceAddress}
                  placeholder="Dirección o nombre del lugar"
                  placeholderTextColor={TEXT_MUTED}
                  style={s.input}
                />

                <TouchableOpacity style={s.searchLocationButton} onPress={searchAddressLocation}>
                  <Text style={s.searchLocationButtonText}>Buscar en el mapa</Text>
                </TouchableOpacity>

                {selectedPlaceCoordinate ? (
                  <Text style={s.locationSelectedText}>Ubicación seleccionada</Text>
                ) : null}

                <Pressable style={s.manualPickLink} onPress={startManualPlacePick}>
                  <Text style={s.manualPickLinkText}>Seleccionar manualmente en el mapa</Text>
                </Pressable>
              </>
            ) : (
              <View style={s.locationInfoBox}>
                <Text style={s.locationInfoText}>Se usará tu ubicación actual.</Text>
              </View>
            )}

            {addPlaceError ? <Text style={s.modalErrorText}>{addPlaceError}</Text> : null}

            <TouchableOpacity
              style={[
                s.savePlaceButton,
                ((!newPlaceName.trim() || savingPlace) || (addPlaceMode === "search" && !selectedPlaceCoordinate)) && { opacity: 0.6 },
              ]}
              onPress={() => {
                if (addPlaceMode === "search" && !selectedPlaceCoordinate) {
                  setAddPlaceError("Primero selecciona una ubicación en el mapa.");
                  return;
                }
                saveNewPlace();
              }}
              disabled={!newPlaceName.trim() || savingPlace}
            >
              <Text style={s.savePlaceButtonText}>{savingPlace ? 'Guardando...' : 'Guardar lugar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMapLayerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMapLayerModal(false)}
      >
        <Pressable style={s.layerModalBackdrop} onPress={() => setShowMapLayerModal(false)}>
          <View style={s.layerModalCard}>
            <Text style={s.layerModalTitle}>Tipo de mapa</Text>

            <TouchableOpacity
              style={[s.layerOption, mapType === "standard" ? s.layerOptionActive : null]}
              onPress={() => {
                setMapType("standard");
                setShowMapLayerModal(false);
              }}
            >
              <Text style={s.layerOptionText}>Estándar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.layerOption, mapType === "satellite" ? s.layerOptionActive : null]}
              onPress={() => {
                setMapType("satellite");
                setShowMapLayerModal(false);
              }}
            >
              <Text style={s.layerOptionText}>Satélite</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.layerOption, mapType === "hybrid" ? s.layerOptionActive : null]}
              onPress={() => {
                setMapType("hybrid");
                setShowMapLayerModal(false);
              }}
            >
              <Text style={s.layerOptionText}>Híbrido</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showSosModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSosModal(false)}
      >
        <Pressable style={s.sosModalBackdrop} onPress={() => setShowSosModal(false)}>
          <Pressable style={s.sosModalCard} onPress={() => {}}>
            <Text style={s.sosModalTitle}>Emergencia</Text>
            <Text style={s.sosModalSubtitle}>
              Elige una acción. No llamaremos automáticamente sin confirmar.
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              style={s.sosPrimaryAction}
              disabled={sendingSos}
              onPress={sendSosToPartner}
            >
              <Ionicons name="location" size={20} color="#ffffff" />
              <Text style={s.sosPrimaryActionText}>
                {sendingSos ? "Enviando..." : "Enviar SOS a mi pareja"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={s.sosAction}
              onPress={async () => {
                setShowSosModal(false);
                try {
                  await updateMyLocation();
                } catch (error) {
                  console.warn("[Ubicacion] share current location failed:", error);
                }
              }}
            >
              <Ionicons name="navigate" size={20} color="#d96f86" />
              <Text style={s.sosActionText}>Compartir ubicación ahora</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={s.sosAction}
              onPress={() => {
                Alert.alert(
                  "Llamar al 911",
                  "┬┐Seguro que quieres llamar a emergencias?",
                  [
                    { text: "Cancelar", style: "cancel" },
                    {
                      text: "Llamar",
                      style: "destructive",
                      onPress: () => {
                        setShowSosModal(false);
                        Linking.openURL("tel:911");
                      },
                    },
                  ]
                );
              }}
            >
              <Ionicons name="call" size={20} color="#d96f86" />
              <Text style={s.sosActionText}>Llamar al 911</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={s.sosCancelButton}
              onPress={() => setShowSosModal(false)}
            >
              <Text style={s.sosCancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!activeSosEvent}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveSosEvent(null)}
      >
        <View style={s.sosAlertBackdrop}>
          <View style={s.sosAlertCard}>
            <View style={s.sosAlertIconWrap}>
              <Text style={s.sosAlertIcon}>!</Text>
            </View>

            <Text style={s.sosAlertTitle}>SOS de tu pareja</Text>
            <Text style={s.sosAlertSubtitle}>
              Tu pareja necesita ayuda. Revisa su ubicación ahora.
            </Text>

            {activeSosEvent?.message ? (
              <Text style={s.sosAlertMessage}>{activeSosEvent.message}</Text>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.88}
              style={s.sosAlertPrimaryButton}
              onPress={async () => {
                const lat = Number(activeSosEvent?.latitude);
                const lng = Number(activeSosEvent?.longitude);
                const eventId = activeSosEvent?.id ?? null;

                setActiveSosEvent(null);

                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                  mapRef.current?.animateToRegion(
                    {
                      latitude: lat,
                      longitude: lng,
                      latitudeDelta: 0.004,
                      longitudeDelta: 0.004,
                    },
                    700
                  );
                }

                await markSosEventSeen(eventId);
              }}
            >
              <Ionicons name="location" size={21} color="#ffffff" />
              <Text style={s.sosAlertPrimaryButtonText}>Ver ubicación</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={s.sosAlertSecondaryButton}
              onPress={async () => {
                const eventId = activeSosEvent?.id ?? null;
                setActiveSosEvent(null);
                await markSosEventSeen(eventId);
              }}
            >
              <Text style={s.sosAlertSecondaryButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View
        style={s.mapContainer}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          mapSizeRef.current = { width, height };
        }}
      >
        {myLocationRow || partnerLocationRow ? (
          <>
            <MapView
              ref={mapRef}
              style={s.map}
              initialRegion={initialRegion}
              mapType={mapType}
              googleRenderer="LEGACY"
              showsUserLocation={false}
              showsMyLocationButton={true}
              onMapReady={() => {
                currentMapRegionRef.current = initialRegion;
                setCurrentMapRegion(initialRegion);
                updateBothOffscreenBubblesAnimated(initialRegion);
              }}
              onRegionChange={(region) => {
                currentMapRegionRef.current = region;
                updateBothOffscreenBubblesAnimated(region);
              }}
              onRegionChangeComplete={(region) => {
                currentMapRegionRef.current = region;
                setCurrentMapRegion(region);
                updateBothOffscreenBubblesAnimated(region);
              }}
              onPress={(event) => {
                if (isPickingPlaceOnMap) {
                  const coordinate = event?.nativeEvent?.coordinate;
                  if (coordinate) setPendingPlaceCoordinate(coordinate);
                  return;
                }
                setShowPartnerMapActions(false);
                setShowSavedPlaceActions(false);
                setPlaceDeleteModeId(null);
              }}
            >
              {myLocation ? (
                <Marker
                  coordinate={{
                    latitude: Number(myLocation.latitude),
                    longitude: Number(myLocation.longitude),
                  }}
                  image={
                    myMarkerImageUri
                      ? { uri: myMarkerImageUri }
                      : require('../../assets/images/favicon.png')
                  }
                  anchor={
                    myMarkerDirection === 'left'
                      ? { x: 0.12, y: 0.55 }
                      : myMarkerDirection === 'right'
                        ? { x: 0.88, y: 0.55 }
                        : { x: 0.5, y: 0.95 }
                  }
                  title="Tú"
                  onPress={() => {
                    setShowPartnerMapActions(false);
                    setShowSavedPlaceActions(false);
                    setPlaceDeleteModeId(null);
                    zoomToLocation(myLocation);
                  }}
                />
              ) : null}

              {partnerLocation ? (
                <Marker
                  coordinate={{
                    latitude: Number(partnerLocation.latitude),
                    longitude: Number(partnerLocation.longitude),
                  }}
                  image={
                    partnerMarkerImageUri
                      ? { uri: partnerMarkerImageUri }
                      : require('../../assets/images/favicon.png')
                  }
                  anchor={
                    partnerMarkerDirection === 'left'
                      ? { x: 0.12, y: 0.55 }
                      : partnerMarkerDirection === 'right'
                        ? { x: 0.88, y: 0.55 }
                        : { x: 0.5, y: 0.95 }
                  }
                  title={couple?.partner_name || 'Tu pareja'}
                  onPress={() => {
                    setShowPartnerMapActions(true);
                    setShowSavedPlaceActions(false);
                    setPlaceDeleteModeId(null);
                    zoomToLocation(partnerLocation);
                  }}
                />
              ) : null}

              {isPickingPlaceOnMap && pendingPlaceCoordinate ? (
                <Marker
                  coordinate={pendingPlaceCoordinate}
                  draggable
                  onDragEnd={(event) => {
                    const coordinate = event?.nativeEvent?.coordinate;
                    if (coordinate) setPendingPlaceCoordinate(coordinate);
                  }}
                  title="Ubicación seleccionada"
                />
              ) : null}

              {savedPlaces.map(place => {
                const latitude = Number(place.latitude);
                const longitude = Number(place.longitude);
                if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
                const markerColor = getPlaceColor(place.color ?? undefined);
                const markerImageUri = savedPlaceMarkerImages[markerColor];
                if (!markerImageUri) return null;
                return (
                  <Marker
                    key={place.id}
                    coordinate={{ latitude, longitude }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    image={{ uri: markerImageUri }}
                    zIndex={5}
                    title={place.name}
                    onPress={() => {
                      setSelectedPlaceId(place.id);
                      setShowSavedPlaceActions(true);
                      setShowPartnerMapActions(false);
                      setPlaceDeleteModeId(null);
                      mapRef.current?.animateToRegion(
                        {
                          latitude,
                          longitude,
                          latitudeDelta: 0.003,
                          longitudeDelta: 0.003,
                        },
                        600
                      );
                    }}
                  />
                );
              })}
            </MapView>

            <TouchableOpacity
              activeOpacity={0.85}
              style={s.mapLayerButtonOnMap}
              onPress={() => setShowMapLayerModal(true)}
            >
              <Ionicons name="layers-outline" size={25} color="#d96f86" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={s.sosButtonOnMap}
              onPress={() => setShowSosModal(true)}
            >
              <Text style={s.sosButtonText}>SOS</Text>
            </TouchableOpacity>

            <Animated.View
              pointerEvents="box-none"
              renderToHardwareTextureAndroid
              collapsable={false}
              style={[
                s.offscreenPersonIndicator,
                {
                  opacity: myOffscreenOpacity,
                  transform: [{ translateX: myOffscreenX }, { translateY: myOffscreenY }],
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.9}
                style={s.offscreenTouchable}
                onPress={() => {
                  if (!myOffscreenVisibleRef.current) return;
                  const lat = Number(myLocationRow?.latitude);
                  const lng = Number(myLocationRow?.longitude);
                  if (Number.isFinite(lat) && Number.isFinite(lng)) {
                    focusLocationFromIndicator(lat, lng, "me");
                  }
                }}
              >
                {myBubblePngUri ? (
                  <Image
                    source={{ uri: myBubblePngUri }}
                    style={s.offscreenBubbleImage}
                    resizeMode="contain"
                    fadeDuration={0}
                  />
                ) : myAvatarUri ? (
                  <Image
                    source={{ uri: myAvatarUri }}
                    style={s.offscreenBubbleImage}
                    resizeMode="cover"
                    fadeDuration={0}
                  />
                ) : (
                  <View style={s.captureBubbleFrame}>
                    <View style={s.captureBubbleInitial}>
                      <Text style={s.captureBubbleInitialText}>{myDisplayInitial}</Text>
                    </View>
                  </View>
                )}
                <View style={s.offscreenBubbleTail} />
              </TouchableOpacity>
            </Animated.View>

            <Animated.View
              pointerEvents="box-none"
              renderToHardwareTextureAndroid
              collapsable={false}
              style={[
                s.offscreenPersonIndicator,
                {
                  opacity: partnerOffscreenOpacity,
                  transform: [{ translateX: partnerOffscreenX }, { translateY: partnerOffscreenY }],
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.9}
                style={s.offscreenTouchable}
                onPress={() => {
                  if (!partnerOffscreenVisibleRef.current) return;
                  const lat = Number(partnerLocationRow?.latitude);
                  const lng = Number(partnerLocationRow?.longitude);
                  if (Number.isFinite(lat) && Number.isFinite(lng)) {
                    focusLocationFromIndicator(lat, lng, "partner");
                  }
                }}
              >
                {partnerBubblePngUri ? (
                  <Image
                    source={{ uri: partnerBubblePngUri }}
                    style={s.offscreenBubbleImage}
                    resizeMode="contain"
                    fadeDuration={0}
                  />
                ) : partnerAvatarUri ? (
                  <Image
                    source={{ uri: partnerAvatarUri }}
                    style={s.offscreenBubbleImage}
                    resizeMode="cover"
                    fadeDuration={0}
                  />
                ) : (
                  <View style={s.captureBubbleFrame}>
                    <View style={s.captureBubbleInitial}>
                      <Text style={s.captureBubbleInitialText}>{partnerDisplayInitial}</Text>
                    </View>
                  </View>
                )}
                <View style={s.offscreenBubbleTail} />
              </TouchableOpacity>
            </Animated.View>

            {isPickingPlaceOnMap && pendingPlaceCoordinate ? (
              <View style={s.pickLocationPanel}>
                <Text style={s.pickLocationTitle}>Ajusta la ubicación</Text>
                <Text style={s.pickLocationSubtitle}>
                  Toca el mapa o mueve el marcador para elegir el punto exacto.
                </Text>
                <View style={s.pickLocationActions}>
                  <TouchableOpacity
                    style={s.pickLocationCancelButton}
                    onPress={() => {
                      setIsPickingPlaceOnMap(false);
                      setPendingPlaceCoordinate(null);
                      setSelectedPlaceCoordinate(null);
                      setShowAddPlaceModal(true);
                    }}
                  >
                    <Text style={s.pickLocationCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.pickLocationConfirmButton}
                    onPress={() => {
                      setSelectedPlaceCoordinate(pendingPlaceCoordinate);
                      setIsPickingPlaceOnMap(false);
                      setShowAddPlaceModal(true);
                    }}
                  >
                    <Text style={s.pickLocationConfirmText}>Confirmar ubicación</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {showPartnerMapActions && partnerLocation ? (
              <View style={s.mapFloatingActions}>
                <TouchableOpacity style={s.mapFloatingButton} onPress={openPartnerInMaps}>
                  <Text style={s.mapFloatingButtonText}>Ver en mapa</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.mapFloatingButton, s.mapFloatingButtonPrimary]}
                  onPress={openPartnerDirections}
                >
                  <Text style={[s.mapFloatingButtonText, s.mapFloatingButtonTextPrimary]}>Cómo llegar</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {showSavedPlaceActions && selectedSavedPlace ? (
              <View style={s.mapFloatingActions}>
                <TouchableOpacity style={s.mapFloatingButton} onPress={openSavedPlaceInMaps}>
                  <Text style={s.mapFloatingButtonText}>Ver en mapa</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.mapFloatingButton, s.mapFloatingButtonPrimary]}
                  onPress={openSavedPlaceDirections}
                >
                  <Text style={[s.mapFloatingButtonText, s.mapFloatingButtonTextPrimary]}>Cómo llegar</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        ) : (
          <View style={[s.mapEmptyOverlay, { position: 'relative', left: undefined, right: undefined, bottom: undefined, margin: 16 }]}>
            <Text style={s.mapEmptyText}>Comparte tu ubicación para verla en el mapa.</Text>
          </View>
        )}
      </View>

      <Animated.View
        style={[
          s.bottomSheet,
          {
            height: sheetHeight,
          },
        ]}
      >
        <View {...sheetPanResponder.panHandlers} style={s.sheetHandleArea}>
          <View style={s.sheetHandle} />
        </View>

        <ScrollView
          scrollEnabled={isSheetExpanded}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.sheetContent}
        >
          <TouchableOpacity activeOpacity={0.9} style={s.partnerStatusCard} onPress={focusPartnerLocation}>
            <View style={s.partnerAvatarColumn}>
              <View style={s.partnerAvatarCircle}>
                <AvatarSource uri={partnerAvatar} initial={partnerName.charAt(0)} size={62} />
              </View>
              <View style={s.partnerBatteryBadge}>
                <Ionicons
                  name={getBatteryIcon(partnerLocationRow?.battery_percent)}
                  size={13}
                  color={getBatteryColor(partnerLocationRow?.battery_percent)}
                />
                <Text style={[s.partnerBatteryText, { color: getBatteryColor(partnerLocationRow?.battery_percent) }]}>
                  {formatBattery(partnerLocationRow?.battery_percent)}
                </Text>
              </View>
            </View>

            <View style={s.partnerInfoContent}>
              <Text style={s.partnerName}>{partnerName}</Text>
              <Text style={s.partnerStatus}>
                {partnerLocationRow ? 'Compartiendo ubicación' : locationsLoading ? 'Cargando...' : 'Sin ubicación'}
              </Text>
              {distanceText !== null ? (
                <Text style={s.partnerDistance}>Distancia aproximada: {distanceText}</Text>
              ) : null}
              <Text style={s.partnerUpdatedAt}>Última actualización: {partnerRecordedAt ?? '--'}</Text>
            </View>
          </TouchableOpacity>

          <Animated.View
            pointerEvents={isSheetExpanded ? 'auto' : 'none'}
            style={[
              s.expandedDetails,
              {
                opacity: detailOpacity,
                transform: [{ translateY: detailTranslateY }],
              },
            ]}
          >
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

                <View style={s.myLocationStatusRow}>
                  <View style={s.liveDot} />
                  <Text style={s.myLocationStatusText}>Compartiendo automáticamente</Text>
                </View>

                <Text style={s.locationMetaText}>Actualización automática cada 60 s</Text>
                <Text style={s.locationMetaText}>
                  Última actualización: {myRecordedAt ? myRecordedAt : 'Esperando actualización...'}
                </Text>
                {typeof myLocationRow?.accuracy_m === 'number' ? (
                  <Text style={s.locationMetaText}>
                    Precisión aproximada: {Math.round(Number(myLocationRow.accuracy_m))} m
                  </Text>
                ) : null}
                <Text style={s.locationMetaText}>Tu ubicación solo se comparte con tu pareja.</Text>
                {saveStatusType === 'error' && saveStatus ? (
                  <Text style={s.locationMetaText}>{saveStatus}</Text>
                ) : null}
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </Animated.View>
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  mapContainer: { flex: 1, width: '100%', position: 'relative', backgroundColor: '#e5e7eb', overflow: 'hidden' },
  map: { flex: 1, width: '100%', backgroundColor: '#e5e7eb' },
  mapEmptyOverlay: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignSelf: 'center',
  },
  mapEmptyText: { color: TEXT_DARK, fontWeight: '800', textAlign: 'center' },
  mapFloatingActions: {
    position: 'absolute',
    left: 16,
    bottom: 230,
    flexDirection: 'row',
    gap: 10,
    zIndex: 30,
    elevation: 30,
  },
  mapFloatingButton: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f3c2cf',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  mapFloatingButtonPrimary: { backgroundColor: '#f3a6b5', borderColor: '#f3a6b5' },
  mapFloatingButtonText: { fontSize: 13, fontWeight: '800', color: '#d96f86' },
  mapFloatingButtonTextPrimary: { color: '#ffffff' },

  savedPlaceMarkerFactoryItem: {
    width: 130,
    height: 130,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  savedPlaceMarkerHalo: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 46,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 12,
  },
  savedPlaceMarkerBadge: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#ffffff",
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },

  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
    overflow: 'hidden',
    zIndex: 20,
  },
  sheetHandleArea: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    height: 34,
  },
  sheetHandle: {
    width: 88,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#e99aaa',
  },
  sheetContent: {
    paddingHorizontal: 24,
    paddingBottom: 0,
  },
  expandedDetails: {
    marginTop: 16,
    paddingBottom: 24,
  },

  topPlacesContainer: {
    minHeight: 76,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 12,
    backgroundColor: '#ffffff',
    zIndex: 30,
    elevation: 8,
  },
  placesScrollContent: {
    alignItems: 'center',
    gap: 10,
    paddingRight: 8,
  },
  mapLayerButtonOnMap: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f3c2cf',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 999,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  sosButtonOnMap: {
    position: "absolute",
    top: 82,
    right: 16,
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: "#ff4d6d",
    borderWidth: 1,
    borderColor: "#ff9aac",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    elevation: 999,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  sosButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  offscreenPersonIndicator: {
    position: "absolute",
    width: 56,
    height: 66,
    borderRadius: 28,
    zIndex: 9998,
    elevation: 0,
    backgroundColor: "transparent",
    overflow: "visible",
    backfaceVisibility: "hidden",
  },
  offscreenTouchable: {
    width: 56,
    height: 66,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  offscreenBubbleImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backfaceVisibility: "hidden",
  },
  offscreenBubbleTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#f3a6b5",
    marginTop: -1,
    alignSelf: "center",
  },
  hiddenCaptureArea: {
    position: "absolute",
    left: -1000,
    top: -1000,
    width: 140,
    height: 140,
    opacity: 1,
    pointerEvents: "none",
  },
  captureBubble: {
    width: 56,
    height: 56,
    backgroundColor: "transparent",
  },
  captureBubbleFrame: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#f3a6b5",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  captureBubbleAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  captureBubbleInitial: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#fff0f4",
    alignItems: "center",
    justifyContent: "center",
  },
  captureBubbleInitialText: {
    color: "#d96f86",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    includeFontPadding: false,
  },
  placeChip: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: 'rgba(255,255,255,0.96)',
    gap: 8,
    maxWidth: 140,
  },
  placeDeleteOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: "rgba(239, 111, 136, 0.88)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    elevation: 20,
  },
  placeChipActive: {
    backgroundColor: SOFT_PINK,
    borderColor: '#f3c2cf',
  },
  placeColorDot: { width: 10, height: 10, borderRadius: 999 },
  placeChipText: { fontSize: 13, fontWeight: '700', color: TEXT_DARK },
  placeChipTextActive: { color: '#d96f86' },
  addPlaceButton: {
    width: 42,
    height: 42,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3a6b5',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  addPlaceButtonText: { fontSize: 26, fontWeight: '900', color: '#ffffff', marginTop: -2 },

  layerModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  layerModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 18,
  },
  layerModalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#252525',
    marginBottom: 16,
  },
  layerOption: {
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f3d8df',
    backgroundColor: '#fffafa',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  layerOptionActive: {
    backgroundColor: '#fff0f4',
    borderColor: '#f3a6b5',
  },
  layerOptionText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#d96f86',
  },
  sosModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.32)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  sosModalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 30,
    backgroundColor: "#ffffff",
    padding: 22,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 20,
  },
  sosModalTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#252525",
    marginBottom: 6,
  },
  sosModalSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#777",
    lineHeight: 20,
    marginBottom: 18,
  },
  sosPrimaryAction: {
    minHeight: 56,
    borderRadius: 20,
    backgroundColor: "#ff4d6d",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 10,
  },
  sosPrimaryActionText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  sosAction: {
    minHeight: 54,
    borderRadius: 20,
    backgroundColor: "#fff5f8",
    borderWidth: 1,
    borderColor: "#f3c2cf",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 10,
  },
  sosActionText: {
    color: "#d96f86",
    fontSize: 15,
    fontWeight: "800",
  },
  sosCancelButton: {
    height: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  sosCancelButtonText: {
    color: "#777",
    fontSize: 15,
    fontWeight: "800",
  },
  sosAlertBackdrop: {
    flex: 1,
    backgroundColor: "rgba(25, 10, 15, 0.42)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
  },
  sosAlertCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 34,
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ffd0da",
    shadowColor: "#ff4d6d",
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 24,
  },
  sosAlertIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#fff0f4",
    borderWidth: 2,
    borderColor: "#ff4d6d",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  sosAlertIcon: {
    color: "#ff4d6d",
    fontSize: 42,
    fontWeight: "900",
  },
  sosAlertTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#25181d",
    textAlign: "center",
    marginBottom: 8,
  },
  sosAlertSubtitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#7a626a",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 14,
  },
  sosAlertMessage: {
    width: "100%",
    borderRadius: 22,
    backgroundColor: "#fff7f9",
    borderWidth: 1,
    borderColor: "#ffd7df",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#5f4b52",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 18,
  },
  sosAlertPrimaryButton: {
    width: "100%",
    height: 58,
    borderRadius: 22,
    backgroundColor: "#ff4d6d",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#ff4d6d",
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 14,
  },
  sosAlertPrimaryButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },
  sosAlertSecondaryButton: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  sosAlertSecondaryButtonText: {
    color: "#9a7b84",
    fontSize: 15,
    fontWeight: "800",
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 18 },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: TEXT_DARK },
  modalCloseBtn: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: SOFT_PINK },
  modalCloseText: { fontSize: 22, fontWeight: '900', color: '#d96f86', marginTop: -1 },
  modalLabel: { fontSize: 13, fontWeight: '800', color: TEXT_DARK, marginTop: 12, marginBottom: 8 },
  input: {
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    color: TEXT_DARK,
    fontWeight: '700',
  },
  modeRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: "transparent",
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modeButtonActive: { backgroundColor: SOFT_PINK },
  modeButtonText: { fontSize: 11, fontWeight: "800", color: TEXT_MUTED, textAlign: "center" },
  modeButtonTextActive: { color: "#d96f86" },
  colorPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorOption: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 40, borderRadius: 16, borderWidth: 1, borderColor: BORDER, backgroundColor: '#ffffff' },
  colorOptionActive: { backgroundColor: SOFT_PINK, borderColor: '#f3c2cf' },
  colorOptionDot: { width: 12, height: 12, borderRadius: 999 },
  colorOptionText: { fontSize: 12, fontWeight: '800', color: TEXT_DARK },
  locationInfoBox: { borderRadius: 16, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FAFAFA', padding: 12 },
  locationInfoText: { fontSize: 13, fontWeight: '700', color: TEXT_MUTED },
  searchLocationButton: {
    height: 50,
    borderRadius: 18,
    backgroundColor: "#fff5f8",
    borderWidth: 1,
    borderColor: "#f3c2cf",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  searchLocationButtonText: {
    color: "#d96f86",
    fontSize: 15,
    fontWeight: "800",
  },
  locationSelectedText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "700",
    color: "#2fbf71",
  },
  manualPickLink: {
    marginTop: 10,
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  manualPickLinkText: {
    color: "#d96f86",
    fontSize: 13,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  modalErrorText: { marginTop: 10, fontSize: 12, fontWeight: '800', color: ACCENT_RED },
  savePlaceButton: { marginTop: 14, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3a6b5' },
  savePlaceButtonText: { fontSize: 14, fontWeight: '900', color: '#ffffff' },

  pickLocationPanel: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 250,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    padding: 18,
    zIndex: 60,
    elevation: 20,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  pickLocationTitle: { fontSize: 18, fontWeight: "900", color: "#252525" },
  pickLocationSubtitle: { marginTop: 6, fontSize: 13, color: "#8a8f98", fontWeight: "600" },
  pickLocationActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  pickLocationCancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f3c2cf",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff5f8",
  },
  pickLocationConfirmButton: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3a6b5",
  },
  pickLocationCancelText: { color: "#d96f86", fontSize: 14, fontWeight: "800" },
  pickLocationConfirmText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },

  hdrInline: { width: '100%', alignItems: 'center', backgroundColor: BG },
  hdrBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  hdrTxt: { fontSize: 13, fontWeight: '700', color: TEXT_DARK },
  hiddenMarkerFactory: {
    position: 'absolute',
    left: -2000,
    top: -2000,
    width: 1200,
    height: 700,
    opacity: 1,
  },
  generatedMarker: {
    width: 270,
    height: 235,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    position: 'relative',
  },
  generatedMarkerBubble: {
    width: 198,
    height: 198,
    borderRadius: 99,
    backgroundColor: '#ffffff',
    borderWidth: 6,
    borderColor: '#f3a6b5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 2,
  },
  myGeneratedMarkerBubble: { borderColor: '#ec5f7c' },
  generatedMarkerImage: { width: 198, height: 198, borderRadius: 99 },
  generatedMarkerInitial: { fontSize: 72, fontWeight: '900', color: '#ec5f7c' },
  generatedMarkerBubbleLeft: { marginLeft: 33 },
  generatedMarkerBubbleRight: { marginRight: 33 },
  generatedMarkerTailLeft: {
    position: 'absolute',
    left: 26,
    top: 104,
    width: 51,
    height: 51,
    backgroundColor: '#ffffff',
    borderLeftWidth: 5,
    borderBottomWidth: 5,
    borderColor: '#f3a6b5',
    borderRadius: 4,
    transform: [{ rotate: '45deg' }],
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    zIndex: 1,
  },
  generatedMarkerTailRight: {
    position: 'absolute',
    right: 26,
    top: 104,
    width: 51,
    height: 51,
    backgroundColor: '#ffffff',
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderColor: '#f3a6b5',
    borderRadius: 4,
    transform: [{ rotate: '-45deg' }],
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    zIndex: 1,
  },
  generatedMarkerTailBottom: {
    position: 'absolute',
    left: 110,
    bottom: 9,
    width: 51,
    height: 51,
    backgroundColor: '#ffffff',
    borderLeftWidth: 5,
    borderBottomWidth: 5,
    borderColor: '#f3a6b5',
    borderRadius: 4,
    transform: [{ rotate: '-45deg' }],
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    zIndex: 1,
  },
  myGeneratedMarkerTail: { borderColor: '#ec5f7c' },
  content: { flex: 1, backgroundColor: BG },
  contentContainer: { padding: 20 },
  
  partnerStatusCard: {
    borderRadius: 28,
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: '#fff5f8',
    borderWidth: 1,
    borderColor: '#f3d8df',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 0,
    minHeight: 112,
  },
  partnerAvatarColumn: { width: 76, alignItems: 'center', justifyContent: 'center' },
  partnerAvatarCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3d8df',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  partnerBatteryBadge: {
    marginTop: 8,
    minWidth: 54,
    height: 24,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f3d8df',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  partnerBatteryText: { fontSize: 12, fontWeight: '800' },
  partnerInfoContent: { flex: 1 },
  partnerName: { fontSize: 21, fontWeight: '900', color: '#252525' },
  partnerStatus: { marginTop: 3, fontSize: 14, fontWeight: '700', color: '#9ca3af' },
  partnerDistance: { marginTop: 8, fontSize: 15, fontWeight: '900', color: '#2fbf71' },
  partnerUpdatedAt: { marginTop: 5, fontSize: 13, fontWeight: '700', color: '#9ca3af' },
  pInfo: { flex: 1, marginLeft: 14 },
  pName: { fontSize: 16, fontWeight: '800', color: TEXT_DARK },
  pLoc: { fontSize: 12, color: TEXT_MUTED, marginTop: 1 },
  pStatRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  pStat: { fontSize: 11, color: GREEN, fontWeight: '700' },

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
  myLocationStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 8 },
  liveDot: { width: 9, height: 9, borderRadius: 999, backgroundColor: '#35c779' },
  myLocationStatusText: { fontSize: 14, fontWeight: '800', color: '#2fa866' },
  locationMetaText: { fontSize: 13, fontWeight: '600', color: '#8f98a8', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: TEXT_DARK, marginBottom: 16 },
});
