import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  ImageBackground,
  Keyboard,
  BackHandler,
  Animated,
  Easing,
  Modal,
  Linking,
  useWindowDimensions,
  Switch,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import {
  Play,
  Pause,
  ChevronLeft,
  Search,
  Image as ImageIcon,
  MapPin,
  UserRound,
  FileText,
  Bookmark,
  Heart,
  Settings2,
  Palette,
  Languages,
  Images,
  BellOff,
  Bell,
  ChevronRight,
  Check,
  Pencil,
  Shield,
  TimerReset,
  Palette as PaletteIcon,
  Sparkles,
  Download,
  Trash2,
  Lock,
} from 'lucide-react-native';
import { supabase, supabaseAnonKey, supabaseUrl } from '../../lib/supabase';
import { useProfileAndCouple } from '../../lib/useProfileAndCouple';
import { useGlobalCall } from '../../components/calls/CallProvider';
import { Colors } from '../../constants/Colors';
import { MessagesHeader, AvatarSource } from '../../components/messages/MessagesHeader';
import { MessagesSearchBar } from '../../components/messages/MessagesSearchBar';
import { MessagesComposer } from '../../components/messages/MessagesComposer';

// --- Theme Constants ---
const USER_BUBBLE = Colors.light.tint;
const PARTNER_BUBBLE = Colors.light.backgroundSoft;
const TEXT_DARK = Colors.light.text;
const TEXT_MUTED = Colors.light.textMuted;
const BORDER = Colors.light.border;
const SCREEN_BG = '#FFF8FA';
const CHAT_BG = '#FCF7F9';
const SETTINGS_PAGE_BACKGROUND = '#FFF9FC';
const SURFACE_BG = '#FFF8FA';
const SOFT_PANEL_BG = '#FFFDFE';
const DIVIDER = '#F1DDE3';
const MEMORY_SHARE_PREFIX = 'USFULLY_MEMORY_SHARE::';
const PANEL_HEIGHT = 260;
const PANEL_ANIM_MS = 180;
const SUPABASE_URL = supabaseUrl;
const SUPABASE_ANON_KEY = supabaseAnonKey;

function getErrorInfo(error: unknown) {
  const err = error as any;

  return {
    name: err?.name,
    message: err?.message,
    status: err?.status,
    code: err?.code,
    details: err?.details,
    hint: err?.hint,
    stack: err?.stack,
    raw: String(error),
  };
}

function logVoiceError(step: string, error: unknown) {
  console.log(`[Mensajes][Voice] ${step}`, getErrorInfo(error));
}

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
  if (message?.message_type === 'audio') {
    return ['mensaje de voz', message?.content].filter(Boolean).join(' ').toLowerCase();
  }

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

const parseMessageMetadata = (metadata: unknown): Record<string, any> => {
  if (!metadata) return {};
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof metadata === 'object' ? (metadata as Record<string, any>) : {};
};

const buildGoogleMapsUrl = (latitude: number, longitude: number) =>
  `https://www.google.com/maps?q=${latitude},${longitude}`;

const sanitizeFileName = (fileName?: string | null, fallback = 'archivo') =>
  String(fileName || fallback)
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-');

const getFileNameFromUri = (uri?: string | null, fallback = 'archivo') => {
  if (!uri) return fallback;
  const parts = uri.split('/');
  return parts[parts.length - 1] || fallback;
};

const getMimeTypeFromFileName = (fileName?: string | null, fallback = 'application/octet-stream') => {
  const normalized = String(fileName || '').toLowerCase();
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.webp')) return 'image/webp';
  if (normalized.endsWith('.mp4')) return 'video/mp4';
  if (normalized.endsWith('.mov')) return 'video/quicktime';
  if (normalized.endsWith('.pdf')) return 'application/pdf';
  if (normalized.endsWith('.doc')) return 'application/msword';
  if (normalized.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (normalized.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (normalized.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (normalized.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
  if (normalized.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (normalized.endsWith('.txt')) return 'text/plain';
  return fallback;
};

const formatFileSize = (fileSize?: number | null) => {
  if (typeof fileSize !== 'number' || !Number.isFinite(fileSize) || fileSize <= 0) return 'Tamaño desconocido';
  if (fileSize < 1024) return `${fileSize} B`;
  if (fileSize < 1024 * 1024) return `${(fileSize / 1024).toFixed(1)} KB`;
  return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
};

const formatMessageTime = (createdAt?: string | null) =>
  new Date(String(createdAt || '')).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

const getFavoriteMessageLabel = (message: FavoriteMessageItem) => {
  switch (message.message_type) {
    case 'audio':
      return 'Mensaje de voz';
    case 'image':
      return 'Foto';
    case 'video':
      return 'Video';
    case 'document':
      return 'Documento';
    case 'location':
      return 'Ubicación';
    case 'contact':
      return 'Contacto';
    case 'saved':
      return 'Guardado';
    default:
      return String(message.content || 'Mensaje');
  }
};

const getThemeLabel = (themeKey: ThemeKey) => {
  switch (themeKey) {
    case 'sakura':
      return 'Sakura';
    case 'mint':
      return 'Menta';
    case 'sea':
      return 'Mar';
    case 'chocolate':
      return 'Chocolate';
    case 'midnight':
      return 'Medianoche';
    case 'vanilla':
      return 'Vainilla';
    case 'coral':
      return 'Coral';
    case 'pearl':
      return 'Perla';
    case 'night':
      return 'Noche';
    case 'forest':
      return 'Bosque';
    case 'sunset':
      return 'Atardecer';
    case 'custom':
      return 'Personalizado';
    case 'soft_pink':
      return 'Rosa suave';
    case 'lavender':
      return 'Lavanda';
    case 'sky':
      return 'Cielo';
    case 'cream':
      return 'Crema';
    default:
      return 'Clásico';
  }
};

const getNotificationStatusLabel = (settings: ChatSettingsState) => {
  if (!settings.notifications_muted) return 'Activadas';
  if (settings.mute_until) {
    const muteDate = new Date(settings.mute_until);
    if (!Number.isNaN(muteDate.getTime()) && muteDate.getTime() > Date.now()) {
      return `Silenciadas hasta ${muteDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }
  }
  return 'Silenciadas siempre';
};

const getSelectedNotificationOptionKey = (settings: ChatSettingsState) => {
  if (!settings.notifications_muted) return 'active';
  if (!settings.mute_until) return 'always';

  const muteDate = new Date(settings.mute_until);
  if (Number.isNaN(muteDate.getTime()) || muteDate.getTime() <= Date.now()) {
    return 'always';
  }

  const diffHours = Math.round((muteDate.getTime() - Date.now()) / (60 * 60 * 1000));
  if (diffHours <= 1) return '1h';
  if (diffHours <= 8) return '8h';
  if (diffHours <= 24) return '1d';
  return '1w';
};

const getDisappearingStatusLabel = (settings: ChatSettingsState) => {
  if (!settings.disappearing_enabled || !settings.disappearing_timer_seconds) return 'Desactivado';
  if (settings.disappearing_timer_seconds === 24 * 60 * 60) return '24 horas';
  if (settings.disappearing_timer_seconds === 7 * 24 * 60 * 60) return '7 días';
  if (settings.disappearing_timer_seconds === 30 * 24 * 60 * 60) return '30 días';
  if (settings.disappearing_timer_seconds === 90 * 24 * 60 * 60) return '90 días';
  return 'Activado';
};

type SavedPlaceShareItem = {
  id: string;
  name: string;
  color?: string | null;
  latitude: number;
  longitude: number;
  address?: string | null;
  created_at?: string | null;
};

type ContactShareItem = {
  name?: string;
  phoneNumbers?: Array<{ number?: string | null }>;
  emails?: Array<{ email?: string | null }>;
};

type AttachmentUploadParams = {
  bucket: 'chat-media' | 'chat-documents';
  localUri: string;
  path: string;
  contentType: string;
};

type OptionsPanelKey = null | 'chat_settings' | 'themes' | 'translation' | 'shared_media' | 'favorites';

type ThemeKey =
  | 'default'
  | 'soft_pink'
  | 'lavender'
  | 'sky'
  | 'cream'
  | 'night'
  | 'forest'
  | 'sunset'
  | 'sakura'
  | 'mint'
  | 'sea'
  | 'chocolate'
  | 'midnight'
  | 'vanilla'
  | 'coral'
  | 'pearl'
  | 'custom';

type AppearanceMode = 'light' | 'dark' | 'system';

type WallpaperPresetKey = 'solid' | 'gradient_soft' | 'pink_light' | 'lavender_light' | 'night_soft';

type ThemeEditorPage = null | 'bubbles' | 'background';

type BubbleEditorTarget = 'own' | 'partner';

type BackgroundEditorMode = 'color' | 'gradient' | 'image';

type TranslationTarget = 'es' | 'en' | 'tr';

type CustomThemeConfig = {
  background: string;
  ownBubble: string;
  partnerBubble: string;
  text: string;
  partnerText: string;
  accent: string;
  appearance: 'light' | 'dark';
  backgroundType: BackgroundEditorMode;
  backgroundValue: string;
  brightness: number;
  saturation: number;
  softness: number;
};

type ChatSettingsState = {
  theme_key: ThemeKey;
  appearance_mode: AppearanceMode;
  translation_enabled: boolean;
  translation_target: TranslationTarget;
  notifications_muted: boolean;
  mute_until: string | null;
  chat_nickname: string | null;
  auto_save_media: boolean;
  confirm_before_delete: boolean;
  disappearing_enabled: boolean;
  disappearing_timer_seconds: number | null;
  lock_enabled: boolean;
  wallpaper_key: ThemeKey;
  custom_theme: CustomThemeConfig | null;
  bubble_color: string;
  partner_bubble_color: string;
  chat_background_color: string;
  chat_wallpaper_type: string;
  chat_wallpaper_value: string;
  text_color: string;
  accent_color: string;
  sound_enabled: boolean;
};

type SharedMediaItem = {
  id: string;
  message_type: 'image' | 'video' | 'document';
  media_url?: string | null;
  created_at?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  content?: string | null;
};

type FavoriteMessageItem = {
  id: string;
  content?: string | null;
  message_type?: string | null;
  media_url?: string | null;
  created_at?: string | null;
  is_favorite?: boolean | null;
};

type BaseThemeDefinition = {
  label: string;
  appearance: 'light' | 'dark';
  background: string;
  ownBubble: string;
  partnerBubble: string;
  text: string;
  partnerText: string;
  accent: string;
};

type ResolvedThemePalette = {
  label: string;
  appearance: 'light' | 'dark';
  chatBackground: string;
  chatBackgroundType: BackgroundEditorMode;
  chatBackgroundValue: string;
  chatBackgroundBrightness: number;
  outgoingBubble: string;
  outgoingBubbleText: string;
  incomingBubble: string;
  incomingBubbleText: string;
  incomingSecondaryText: string;
  incomingBorder: string;
  accent: string;
  outgoingTime: string;
  incomingTime: string;
  voiceOwnTrack: string;
  voiceOwnFill: string;
  voiceOwnThumb: string;
  voiceOwnPlayBg: string;
  voicePartnerTrack: string;
  voicePartnerFill: string;
  voicePartnerThumb: string;
  voicePartnerPlayBg: string;
  voicePartnerIcon: string;
  composerBackground: string;
  composerSurface: string;
  composerBorder: string;
  composerText: string;
  composerPlaceholder: string;
  composerIcon: string;
  sendButton: string;
  recordingSurface: string;
  cardPartnerIconBg: string;
};

const CHAT_THEMES: Record<Exclude<ThemeKey, 'custom'>, BaseThemeDefinition> = {
  default: {
    label: 'Clásico',
    appearance: 'light',
    background: '#FFF9FC',
    ownBubble: '#F4A4AE',
    partnerBubble: '#FFFFFF',
    text: '#2E2E2E',
    partnerText: '#2E2E2E',
    accent: '#F4A4AE',
  },
  soft_pink: {
    label: 'Rosa suave',
    appearance: 'light',
    background: '#FFF6FA',
    ownBubble: '#F6A6B5',
    partnerBubble: '#FFFFFF',
    text: '#2E2E2E',
    partnerText: '#2E2E2E',
    accent: '#F6A6B5',
  },
  lavender: {
    label: 'Lavanda',
    appearance: 'light',
    background: '#F8F5FF',
    ownBubble: '#B9A7F2',
    partnerBubble: '#FFFFFF',
    text: '#2E2E2E',
    partnerText: '#2E2E2E',
    accent: '#B9A7F2',
  },
  sky: {
    label: 'Cielo',
    appearance: 'light',
    background: '#F3FAFF',
    ownBubble: '#8DC5E8',
    partnerBubble: '#FFFFFF',
    text: '#2E2E2E',
    partnerText: '#2E2E2E',
    accent: '#8DC5E8',
  },
  cream: {
    label: 'Crema',
    appearance: 'light',
    background: '#FFF9EE',
    ownBubble: '#E8D28F',
    partnerBubble: '#FFFFFF',
    text: '#2E2E2E',
    partnerText: '#2E2E2E',
    accent: '#E8D28F',
  },
  night: {
    label: 'Noche',
    appearance: 'dark',
    background: '#121218',
    ownBubble: '#7B4D64',
    partnerBubble: '#24242E',
    text: '#FFFFFF',
    partnerText: '#FFFFFF',
    accent: '#E7A3B3',
  },
  forest: {
    label: 'Bosque',
    appearance: 'dark',
    background: '#101A15',
    ownBubble: '#4E8B6A',
    partnerBubble: '#1E2A23',
    text: '#FFFFFF',
    partnerText: '#FFFFFF',
    accent: '#79C69A',
  },
  sunset: {
    label: 'Atardecer',
    appearance: 'light',
    background: '#FFF4EF',
    ownBubble: '#F09A83',
    partnerBubble: '#FFFFFF',
    text: '#2E2E2E',
    partnerText: '#2E2E2E',
    accent: '#F09A83',
  },
  sakura: {
    label: 'Sakura',
    appearance: 'light',
    background: '#FFF3F7',
    ownBubble: '#F3A6C1',
    partnerBubble: '#FFFFFF',
    text: '#2E2E2E',
    partnerText: '#2E2E2E',
    accent: '#F3A6C1',
  },
  mint: {
    label: 'Menta',
    appearance: 'light',
    background: '#F1FFF8',
    ownBubble: '#8ED7B5',
    partnerBubble: '#FFFFFF',
    text: '#26322D',
    partnerText: '#26322D',
    accent: '#8ED7B5',
  },
  sea: {
    label: 'Mar',
    appearance: 'light',
    background: '#F0FAFF',
    ownBubble: '#6FB9D9',
    partnerBubble: '#FFFFFF',
    text: '#23313A',
    partnerText: '#23313A',
    accent: '#6FB9D9',
  },
  chocolate: {
    label: 'Chocolate',
    appearance: 'light',
    background: '#FFF7F1',
    ownBubble: '#B7836B',
    partnerBubble: '#FFFFFF',
    text: '#2E241F',
    partnerText: '#2E241F',
    accent: '#B7836B',
  },
  midnight: {
    label: 'Medianoche',
    appearance: 'dark',
    background: '#0E111B',
    ownBubble: '#4D6AA3',
    partnerBubble: '#1D2230',
    text: '#FFFFFF',
    partnerText: '#FFFFFF',
    accent: '#7EA1FF',
  },
  vanilla: {
    label: 'Vainilla',
    appearance: 'light',
    background: '#FFFDF4',
    ownBubble: '#EBD993',
    partnerBubble: '#FFFFFF',
    text: '#2E2E2E',
    partnerText: '#2E2E2E',
    accent: '#EBD993',
  },
  coral: {
    label: 'Coral',
    appearance: 'light',
    background: '#FFF5F2',
    ownBubble: '#F28C7D',
    partnerBubble: '#FFFFFF',
    text: '#2E2E2E',
    partnerText: '#2E2E2E',
    accent: '#F28C7D',
  },
  pearl: {
    label: 'Perla',
    appearance: 'light',
    background: '#FAFAFF',
    ownBubble: '#D8CDEB',
    partnerBubble: '#FFFFFF',
    text: '#2E2E2E',
    partnerText: '#2E2E2E',
    accent: '#D8CDEB',
  },
};

const THEME_COLOR_OPTIONS = [
  '#F4A4AE',
  '#F6B3C1',
  '#EFA6B8',
  '#F09A83',
  '#F6B38A',
  '#C98D74',
  '#B9A7F2',
  '#D5C6F7',
  '#9FB6F5',
  '#8DC5E8',
  '#B9DDF2',
  '#8ED7B5',
  '#A7D8C8',
  '#D8EACF',
  '#E8D28F',
  '#F3E3C2',
  '#C8A27A',
  '#A97D67',
  '#5C74B8',
  '#24242E',
  '#3A3A46',
  '#FFFFFF',
  '#F5F5F7',
  '#111111',
] as const;

const BACKGROUND_COLOR_OPTIONS = [
  '#FFF7FB',
  '#FDEEF4',
  '#F8E8F1',
  '#F3E8FF',
  '#EAF4FF',
  '#EAF8F0',
  '#F7F5EA',
  '#F5ECE7',
  '#F5F5F7',
  '#FFD6E0',
  '#F6C4D0',
  '#F4A4AE',
  '#F09A83',
  '#F6B38A',
  '#D9C2F0',
  '#AFCBFF',
  '#A7D8C8',
  '#D8EACF',
  '#E8D28F',
  '#C8A27A',
  '#232433',
  '#0F1720',
  '#0D1B16',
  '#FFFFFF',
] as const;

const BACKGROUND_GRADIENT_OPTIONS = [
  {
    key: 'rose_cream',
    title: 'Rosa crema',
    colors: ['#FFF3F7', '#FFF8EC'],
    preview: '#FFF1F4',
  },
  {
    key: 'lavender_soft',
    title: 'Lavanda suave',
    colors: ['#F7F1FF', '#F1EEFF'],
    preview: '#F2EEFF',
  },
  {
    key: 'sky_clear',
    title: 'Cielo claro',
    colors: ['#EFF9FF', '#F7FCFF'],
    preview: '#EEF8FF',
  },
  {
    key: 'night_soft',
    title: 'Noche suave',
    colors: ['#1A1A24', '#25283A'],
    preview: '#1C1F2B',
  },
  {
    key: 'sunset_glow',
    title: 'Atardecer',
    colors: ['#FFF0EB', '#FFDCCF'],
    preview: '#FFE9DF',
  },
] as const;

const CHAT_BACKGROUND_OPTIONS: Array<{
  key: WallpaperPresetKey;
  title: string;
  description: string;
  type: 'color' | 'preset';
  preview: string;
}> = [
  { key: 'solid', title: 'Color sólido', description: 'Usa el color principal del tema', type: 'color', preview: '#FFF9FC' },
  { key: 'gradient_soft', title: 'Degradado suave', description: 'Rosa y crema delicados', type: 'preset', preview: '#FBEFF5' },
  { key: 'pink_light', title: 'Rosa claro', description: 'Fondo romántico claro', type: 'preset', preview: '#FFF1F6' },
  { key: 'lavender_light', title: 'Lavanda claro', description: 'Tono suave y limpio', type: 'preset', preview: '#F3EEFF' },
  { key: 'night_soft', title: 'Noche suave', description: 'Oscuro elegante para el chat', type: 'preset', preview: '#1A1A24' },
];

const THEME_DB_FIELD_KEYS = [
  'appearance_mode',
  'custom_theme',
  'bubble_color',
  'partner_bubble_color',
  'chat_background_color',
  'chat_wallpaper_type',
  'chat_wallpaper_value',
  'text_color',
  'accent_color',
  'theme_key',
  'wallpaper_key',
] as const;

const normalizeHexColor = (color: string | null | undefined, fallback: string) => {
  const value = String(color || '').trim();
  if (/^#([0-9A-Fa-f]{6})$/.test(value)) return value.toUpperCase();
  return fallback.toUpperCase();
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const hexToRgb = (color: string) => {
  const normalized = normalizeHexColor(color, '#000000').replace('#', '');
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
};

const rgbToHex = ({ r, g, b }: { r: number; g: number; b: number }) =>
  `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;

const hsvToRgb = ({ h, s, v }: { h: number; s: number; v: number }) => {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 0, 100) / 100;
  const brightness = clamp(v, 0, 100) / 100;
  const chroma = brightness * saturation;
  const segment = hue / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const match = brightness - chroma;

  let red = 0;
  let green = 0;
  let blue = 0;

  if (segment >= 0 && segment < 1) {
    red = chroma;
    green = secondary;
  } else if (segment < 2) {
    red = secondary;
    green = chroma;
  } else if (segment < 3) {
    green = chroma;
    blue = secondary;
  } else if (segment < 4) {
    green = secondary;
    blue = chroma;
  } else if (segment < 5) {
    red = secondary;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondary;
  }

  return {
    r: (red + match) * 255,
    g: (green + match) * 255,
    b: (blue + match) * 255,
  };
};

const rgbToHsv = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const red = clamp(r, 0, 255) / 255;
  const green = clamp(g, 0, 255) / 255;
  const blue = clamp(b, 0, 255) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === red) {
      hue = 60 * (((green - blue) / delta) % 6);
    } else if (max === green) {
      hue = 60 * ((blue - red) / delta + 2);
    } else {
      hue = 60 * ((red - green) / delta + 4);
    }
  }

  return {
    h: Math.round((hue + 360) % 360),
    s: Math.round(max === 0 ? 0 : (delta / max) * 100),
    v: Math.round(max * 100),
  };
};

const mixHexColors = (base: string, mixWith: string, weight: number) => {
  const first = hexToRgb(base);
  const second = hexToRgb(mixWith);
  const ratio = Math.max(0, Math.min(1, weight));
  return rgbToHex({
    r: first.r + (second.r - first.r) * ratio,
    g: first.g + (second.g - first.g) * ratio,
    b: first.b + (second.b - first.b) * ratio,
  });
};

const getColorLuminance = (color: string) => {
  const { r, g, b } = hexToRgb(color);
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const isDarkColor = (color: string) => getColorLuminance(color) < 0.45;

const withAlpha = (color: string, alpha: number) => {
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
};

const adjustBrightness = (color: string, brightnessPercent: number) => {
  const hsv = rgbToHsv(hexToRgb(color));
  return rgbToHex(hsvToRgb({ h: hsv.h, s: hsv.s, v: clamp(brightnessPercent, 0, 100) }));
};

const adjustSaturation = (color: string, saturationPercent: number) => {
  const hsv = rgbToHsv(hexToRgb(color));
  return rgbToHex(hsvToRgb({ h: hsv.h, s: clamp(saturationPercent, 0, 100), v: hsv.v }));
};

const applyBrightnessToColor = (color: string, brightnessPercent: number) => {
  const normalized = normalizeHexColor(color, color);
  const brightness = clamp(brightnessPercent, 70, 120);
  if (brightness === 100) return normalized;
  if (brightness < 100) {
    return mixHexColors(normalized, '#000000', (100 - brightness) / 100);
  }
  return mixHexColors(normalized, '#FFFFFF', (brightness - 100) / 50);
};

const getBrightnessOverlay = (brightnessPercent: number) => {
  const brightness = clamp(brightnessPercent, 70, 120);
  if (brightness === 100) return null;
  if (brightness < 100) {
    return {
      color: '#000000',
      opacity: clamp((100 - brightness) / 60, 0, 0.55),
    };
  }
  return {
    color: '#FFFFFF',
    opacity: clamp((brightness - 100) / 40, 0, 0.45),
  };
};

const getReadableTextColor = (background: string, preferred?: string | null) => {
  if (preferred) {
    const normalizedPreferred = normalizeHexColor(preferred, '#2E2E2E');
    const contrast = Math.abs(getColorLuminance(normalizedPreferred) - getColorLuminance(background));
    if (contrast >= 0.32) {
      return normalizedPreferred;
    }
  }
  return isDarkColor(background) ? '#FFFFFF' : '#2E2E2E';
};

const resolveWallpaperBackground = (
  wallpaperType: string,
  wallpaperValue: string,
  fallbackColor: string,
  brightness = 100,
  saturation = 100,
  softness = 0
) => {
  let resolvedBase = normalizeHexColor(fallbackColor, '#FFF9FC');

  if (wallpaperType === 'gradient') {
    const gradient = BACKGROUND_GRADIENT_OPTIONS.find((option) => option.key === wallpaperValue);
    resolvedBase = gradient?.preview || resolvedBase;
  } else if (wallpaperType === 'color') {
    if (/^#([0-9A-Fa-f]{6})$/.test(wallpaperValue || '')) {
      resolvedBase = normalizeHexColor(wallpaperValue, resolvedBase);
    }
  } else {
    switch (wallpaperValue) {
      case 'gradient_soft':
        resolvedBase = '#FBEFF5';
        break;
      case 'pink_light':
        resolvedBase = '#FFF1F6';
        break;
      case 'lavender_light':
        resolvedBase = '#F3EEFF';
        break;
      case 'night_soft':
        resolvedBase = '#181A24';
        break;
      default:
        break;
    }
  }

  let nextColor = adjustSaturation(resolvedBase, saturation);
  nextColor = adjustBrightness(nextColor, brightness);
  if (softness > 0) {
    nextColor = mixHexColors(nextColor, isDarkColor(nextColor) ? '#22252F' : '#FFFFFF', clamp(softness, 0, 100) / 180);
  }
  return nextColor;
};

const resolveThemeAppearance = (appearanceMode: AppearanceMode, systemColorScheme: ReturnType<typeof useColorScheme>) => {
  if (appearanceMode === 'dark') return 'dark';
  if (appearanceMode === 'system') {
    return systemColorScheme === 'dark' ? 'dark' : 'light';
  }
  return 'light';
};

const ensureSurfaceForAppearance = (color: string, appearance: 'light' | 'dark', fallback: string) => {
  const normalized = normalizeHexColor(color, fallback);
  if (appearance === 'dark') {
    return isDarkColor(normalized) ? normalized : mixHexColors(normalized, '#14151C', 0.78);
  }
  return isDarkColor(normalized) ? mixHexColors(normalized, '#FFFFFF', 0.84) : normalized;
};

const createCustomThemeFromState = (
  settings: Pick<
    ChatSettingsState,
    | 'chat_background_color'
    | 'bubble_color'
    | 'partner_bubble_color'
    | 'text_color'
    | 'accent_color'
    | 'appearance_mode'
    | 'chat_wallpaper_type'
    | 'chat_wallpaper_value'
  >,
  extras?: Partial<Pick<CustomThemeConfig, 'brightness' | 'saturation' | 'softness'>>
): CustomThemeConfig => ({
  background: settings.chat_background_color,
  ownBubble: settings.bubble_color,
  partnerBubble: settings.partner_bubble_color,
  text: settings.text_color,
  partnerText: getReadableTextColor(settings.partner_bubble_color, settings.text_color),
  accent: settings.accent_color,
  appearance: settings.appearance_mode === 'dark' ? 'dark' : 'light',
  backgroundType: (settings.chat_wallpaper_type as BackgroundEditorMode) || 'color',
  backgroundValue: settings.chat_wallpaper_value,
  brightness: clamp(extras?.brightness ?? 100, 50, 120),
  saturation: clamp(extras?.saturation ?? 100, 0, 100),
  softness: clamp(extras?.softness ?? 20, 0, 100),
});

const getResolvedThemePalette = (settings: ChatSettingsState, systemColorScheme: ReturnType<typeof useColorScheme>): ResolvedThemePalette => {
  const presetTheme =
    settings.theme_key !== 'custom' && settings.theme_key in CHAT_THEMES
      ? CHAT_THEMES[settings.theme_key as Exclude<ThemeKey, 'custom'>]
      : CHAT_THEMES.default;

  const customTheme = settings.custom_theme;
  const appearance = resolveThemeAppearance(settings.appearance_mode, systemColorScheme);
  const customBrightness = clamp(customTheme?.brightness ?? 100, 70, 120);
  const customSaturation = clamp(customTheme?.saturation ?? 100, 0, 100);
  const customSoftness = clamp(customTheme?.softness ?? 20, 0, 100);
  const backgroundType = customTheme?.backgroundType || (settings.chat_wallpaper_type as BackgroundEditorMode) || 'color';
  const backgroundValue = customTheme?.backgroundValue || settings.chat_wallpaper_value || 'solid';
  const baseBackground = normalizeHexColor(
    customTheme?.background || settings.chat_background_color || presetTheme.background,
    presetTheme.background
  );
  const chatBackground = ensureSurfaceForAppearance(
    resolveWallpaperBackground(backgroundType, backgroundValue, baseBackground, customBrightness, customSaturation, customSoftness),
    appearance,
    presetTheme.background
  );
  const outgoingBubble = ensureSurfaceForAppearance(
    normalizeHexColor(customTheme?.ownBubble || settings.bubble_color || presetTheme.ownBubble, presetTheme.ownBubble),
    appearance === 'dark' ? 'dark' : 'light',
    presetTheme.ownBubble
  );
  const incomingBubble = ensureSurfaceForAppearance(
    normalizeHexColor(
      customTheme?.partnerBubble || settings.partner_bubble_color || presetTheme.partnerBubble,
      presetTheme.partnerBubble
    ),
    appearance,
    presetTheme.partnerBubble
  );
  const accent = normalizeHexColor(customTheme?.accent || settings.accent_color || presetTheme.accent, presetTheme.accent);
  const outgoingBubbleText = getReadableTextColor(outgoingBubble, customTheme?.text || settings.text_color || presetTheme.text);
  const incomingBubbleText = getReadableTextColor(
    incomingBubble,
    customTheme?.partnerText || settings.text_color || presetTheme.partnerText
  );
  const incomingSecondaryText = withAlpha(incomingBubbleText, appearance === 'dark' ? 0.7 : 0.62);
  const incomingBorder =
    appearance === 'dark' ? withAlpha(incomingBubbleText, 0.08) : withAlpha(mixHexColors(incomingBubble, '#D6AFBC', 0.38), 0.85);

  return {
    label: settings.theme_key === 'custom' ? 'Personalizado' : presetTheme.label,
    appearance,
    chatBackground,
    chatBackgroundType: backgroundType,
    chatBackgroundValue: String(settings.chat_wallpaper_type === 'image' ? settings.chat_wallpaper_value : backgroundValue),
    chatBackgroundBrightness: customBrightness,
    outgoingBubble,
    outgoingBubbleText,
    incomingBubble,
    incomingBubbleText,
    incomingSecondaryText,
    incomingBorder,
    accent,
    outgoingTime: withAlpha(outgoingBubbleText, 0.72),
    incomingTime: withAlpha(incomingBubbleText, appearance === 'dark' ? 0.58 : 0.5),
    voiceOwnTrack: withAlpha(outgoingBubbleText, 0.22),
    voiceOwnFill: withAlpha(outgoingBubbleText, 0.92),
    voiceOwnThumb: withAlpha(outgoingBubbleText, 0.96),
    voiceOwnPlayBg: withAlpha(outgoingBubbleText, 0.16),
    voicePartnerTrack: withAlpha(accent, appearance === 'dark' ? 0.3 : 0.18),
    voicePartnerFill: withAlpha(accent, 0.82),
    voicePartnerThumb: withAlpha(accent, 0.98),
    voicePartnerPlayBg: appearance === 'dark' ? withAlpha('#FFFFFF', 0.08) : withAlpha(accent, 0.12),
    voicePartnerIcon: appearance === 'dark' ? '#F6E7EC' : accent,
    composerBackground: appearance === 'dark' ? mixHexColors(chatBackground, '#0E1015', 0.22) : mixHexColors(chatBackground, '#FFFFFF', 0.18),
    composerSurface: appearance === 'dark' ? '#181B22' : '#FFFDFE',
    composerBorder: appearance === 'dark' ? '#2B2E38' : '#F0E3E8',
    composerText: appearance === 'dark' ? '#F7F4F6' : '#2E2E2E',
    composerPlaceholder: appearance === 'dark' ? '#9EA3AF' : TEXT_MUTED,
    composerIcon: appearance === 'dark' ? '#C7CAD3' : TEXT_MUTED,
    sendButton: accent,
    recordingSurface: appearance === 'dark' ? '#232631' : '#F6EEF1',
    cardPartnerIconBg: appearance === 'dark' ? withAlpha('#FFFFFF', 0.08) : withAlpha(accent, 0.13),
  };
};

const DEFAULT_CHAT_SETTINGS: ChatSettingsState = {
  theme_key: 'default',
  appearance_mode: 'light',
  translation_enabled: false,
  translation_target: 'es',
  notifications_muted: false,
  mute_until: null,
  chat_nickname: null,
  auto_save_media: false,
  confirm_before_delete: true,
  disappearing_enabled: false,
  disappearing_timer_seconds: null,
  lock_enabled: false,
  wallpaper_key: 'default',
  custom_theme: null,
  bubble_color: CHAT_THEMES.default.ownBubble,
  partner_bubble_color: CHAT_THEMES.default.partnerBubble,
  chat_background_color: CHAT_THEMES.default.background,
  chat_wallpaper_type: 'color',
  chat_wallpaper_value: 'solid',
  text_color: CHAT_THEMES.default.text,
  accent_color: CHAT_THEMES.default.accent,
  sound_enabled: true,
};

const WALLPAPER_PRESETS: Record<ThemeKey, string> = {
  default: CHAT_THEMES.default.background,
  soft_pink: '#FDF1F6',
  lavender: '#F5F0FD',
  sky: '#EFF7FF',
  cream: '#FFF8F0',
  night: '#181A24',
  forest: '#122019',
  sunset: '#FFF1EB',
  sakura: '#FFF3F7',
  mint: '#F1FFF8',
  sea: '#F0FAFF',
  chocolate: '#FFF7F1',
  midnight: '#111622',
  vanilla: '#FFFDF4',
  coral: '#FFF4EF',
  pearl: '#FAFAFF',
  custom: CHAT_THEMES.default.background,
};

const NOTIFICATION_OPTIONS = [
  { key: 'active', title: 'Activadas', muted: false, hours: null as number | null, permanent: false },
  { key: '1h', title: 'Silenciar 1 hora', muted: true, hours: 1, permanent: false },
  { key: '8h', title: 'Silenciar 8 horas', muted: true, hours: 8, permanent: false },
  { key: '1d', title: 'Silenciar 1 día', muted: true, hours: 24, permanent: false },
  { key: '1w', title: 'Silenciar 1 semana', muted: true, hours: 24 * 7, permanent: false },
  { key: 'always', title: 'Silenciar siempre', muted: true, hours: null, permanent: true },
] as const;

const DISAPPEARING_OPTIONS = [
  { key: 'off', title: 'Desactivado', enabled: false, seconds: null as number | null },
  { key: '24h', title: '24 horas', enabled: true, seconds: 24 * 60 * 60 },
  { key: '7d', title: '7 días', enabled: true, seconds: 7 * 24 * 60 * 60 },
  { key: '30d', title: '30 días', enabled: true, seconds: 30 * 24 * 60 * 60 },
  { key: '90d', title: '90 días', enabled: true, seconds: 90 * 24 * 60 * 60 },
] as const;

function ThemeValueSlider({
  label,
  value,
  min,
  max,
  onChange,
  fillColor,
  valueFormatter,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  fillColor?: string;
  valueFormatter?: (value: number) => string;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const clampedValue = clamp(value, min, max);
  const ratio = max === min ? 0 : (clampedValue - min) / (max - min);

  const updateValueFromPosition = (locationX: number) => {
    if (trackWidth <= 0) return;
    const nextRatio = clamp(locationX / trackWidth, 0, 1);
    const nextValue = min + (max - min) * nextRatio;
    onChange(Math.round(nextValue));
  };

  return (
    <View style={s.themeSliderBlock}>
      <View style={s.themeSliderHeader}>
        <Text style={s.themeSliderLabel}>{label}</Text>
        <Text style={s.themeSliderValue}>{valueFormatter ? valueFormatter(clampedValue) : `${clampedValue}`}</Text>
      </View>
      <View
        style={s.themeSliderTrack}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => updateValueFromPosition(event.nativeEvent.locationX)}
        onResponderMove={(event) => updateValueFromPosition(event.nativeEvent.locationX)}
      >
        <View style={[s.themeSliderTrackFill, { width: `${ratio * 100}%`, backgroundColor: fillColor ?? '#E5AFC0' }]} />
        <View style={[s.themeSliderThumb, { left: `${ratio * 100}%` }]} />
      </View>
    </View>
  );
}

export default function MensajesScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const systemColorScheme = useColorScheme();
  const router = useRouter();
  const { profile, couple } = useProfileAndCouple();
  const { startGlobalCall, isStartingCall, canStartCall } = useGlobalCall();

  type ComposerPanel = null | 'attachments' | 'stickers';

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [activeComposerPanel, setActiveComposerPanel] = useState<ComposerPanel>(null);
  const [composerHeight, setComposerHeight] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput | null>(null);
  const isSwitchingFromPanelToKeyboardRef = useRef(false);
  const pendingInputFocusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelOpenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partnerName = couple?.partner_name || 'Pareja';
  const partnerAvatar = couple?.partner_avatar_url;

  const stickers = ['❤️', '😂', '🥺', '😘', '🌸'];

  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const isRecording = recorderState.isRecording;
  const recordingSeconds = Math.round((recorderState.durationMillis ?? 0) / 1000);

  const [activeAudioMessageId, setActiveAudioMessageId] = useState<string | null>(null);
  const [isAttachmentBusy, setIsAttachmentBusy] = useState(false);
  const [attachmentBusyLabel, setAttachmentBusyLabel] = useState('');
  const [contactsModalVisible, setContactsModalVisible] = useState(false);
  const [contactsSearchQuery, setContactsSearchQuery] = useState('');
  const [availableContacts, setAvailableContacts] = useState<Contacts.Contact[]>([]);
  const [savedSheetVisible, setSavedSheetVisible] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlaceShareItem[]>([]);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [activeOptionsPanel, setActiveOptionsPanel] = useState<OptionsPanelKey>(null);
  const [chatSettings, setChatSettings] = useState<ChatSettingsState>(DEFAULT_CHAT_SETTINGS);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [expandedChatSettingsSection, setExpandedChatSettingsSection] = useState<
    null | 'nickname' | 'wallpaper' | 'notifications' | 'disappearing'
  >(null);
  const [activeThemeEditorPage, setActiveThemeEditorPage] = useState<ThemeEditorPage>(null);
  const [bubbleEditorTarget, setBubbleEditorTarget] = useState<BubbleEditorTarget>('own');
  const [bubbleBaseColor, setBubbleBaseColor] = useState(CHAT_THEMES.default.ownBubble);
  const [bubbleEditorBrightness, setBubbleEditorBrightness] = useState(100);
  const [backgroundEditorMode, setBackgroundEditorMode] = useState<BackgroundEditorMode>('color');
  const [backgroundBaseColor, setBackgroundBaseColor] = useState(CHAT_THEMES.default.background);
  const [backgroundOverlayBrightness, setBackgroundOverlayBrightness] = useState(100);
  const [galleryDraftUri, setGalleryDraftUri] = useState<string | null>(null);
  const [galleryDraftBrightness, setGalleryDraftBrightness] = useState(100);
  const [isEditingChatNickname, setIsEditingChatNickname] = useState(false);
  const [chatNicknameDraft, setChatNicknameDraft] = useState('');
  const [sharedMediaItems, setSharedMediaItems] = useState<SharedMediaItem[]>([]);
  const [isLoadingSharedMedia, setIsLoadingSharedMedia] = useState(false);
  const [favoriteMessages, setFavoriteMessages] = useState<FavoriteMessageItem[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
  const [messageActionTarget, setMessageActionTarget] = useState<any | null>(null);
  const optionsAnim = useRef(new Animated.Value(0)).current;
  const optionsPageAnim = useRef(new Animated.Value(0)).current;

  const filteredContacts = useMemo(() => {
    const normalizedQuery = contactsSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) return availableContacts;
    return availableContacts.filter((contact) => {
      const phone = contact.phoneNumbers?.[0]?.number || '';
      const email = contact.emails?.[0]?.email || '';
      return [contact.name, phone, email].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(normalizedQuery)
      );
    });
  }, [availableContacts, contactsSearchQuery]);

  const activeTheme = useMemo(() => getResolvedThemePalette(chatSettings, systemColorScheme), [chatSettings, systemColorScheme]);
  const currentChatName = chatSettings.chat_nickname?.trim() || partnerName;
  const currentChatBackground = activeTheme.chatBackground;
  const currentChatBackgroundImageUri = activeTheme.chatBackgroundType === 'image' ? activeTheme.chatBackgroundValue : null;
  const currentChatBackgroundImageOverlay = getBrightnessOverlay(activeTheme.chatBackgroundBrightness);
  const fondoPreviewImageUri =
    backgroundEditorMode === 'image'
      ? galleryDraftUri ?? (chatSettings.chat_wallpaper_type === 'image' ? chatSettings.chat_wallpaper_value : null)
      : null;
  const fondoPreviewImageBrightness = galleryDraftUri ? galleryDraftBrightness : backgroundOverlayBrightness;
  const fondoPreviewImageOverlay = getBrightnessOverlay(fondoPreviewImageBrightness);

  const presetThemeChoices = useMemo(
    () => [
      { key: 'default' as const, title: 'Clásico' },
      { key: 'soft_pink' as const, title: 'Rosa suave' },
      { key: 'lavender' as const, title: 'Lavanda' },
      { key: 'sky' as const, title: 'Cielo' },
      { key: 'cream' as const, title: 'Crema' },
      { key: 'night' as const, title: 'Noche' },
      { key: 'forest' as const, title: 'Bosque' },
      { key: 'sunset' as const, title: 'Atardecer' },
      { key: 'sakura' as const, title: 'Sakura' },
      { key: 'mint' as const, title: 'Menta' },
      { key: 'sea' as const, title: 'Mar' },
      { key: 'chocolate' as const, title: 'Chocolate' },
      { key: 'midnight' as const, title: 'Medianoche' },
      { key: 'vanilla' as const, title: 'Vainilla' },
      { key: 'coral' as const, title: 'Coral' },
      { key: 'pearl' as const, title: 'Perla' },
    ],
    []
  );

  const wallpaperChoices = useMemo(
    () => [
      { key: 'default' as const, title: 'Predeterminado' },
      { key: 'soft_pink' as const, title: 'Rosa suave' },
      { key: 'lavender' as const, title: 'Lavanda' },
      { key: 'sky' as const, title: 'Cielo' },
      { key: 'cream' as const, title: 'Crema' },
    ],
    []
  );

  const appearanceChoices = useMemo(
    () => [
      { key: 'light' as const, title: 'Claro' },
      { key: 'dark' as const, title: 'Oscuro' },
      { key: 'system' as const, title: 'Automático' },
    ],
    []
  );

  const translationChoices = useMemo(
    () => [
      { key: 'es' as const, title: 'Español' },
      { key: 'en' as const, title: 'Inglés' },
      { key: 'tr' as const, title: 'Turco' },
    ],
    []
  );

  const optionsMenuItems = useMemo(
    () => [
      {
        key: 'chat-settings',
        title: 'Ajustes del chat',
        icon: Settings2,
      },
      {
        key: 'themes',
        title: 'Temas',
        icon: Palette,
      },
      {
        key: 'translation',
        title: 'Ajustes de traducción',
        icon: Languages,
      },
      {
        key: 'shared-media',
        title: 'Multimedia compartida',
        icon: Images,
      },
      {
        key: 'favorite-messages',
        title: 'Mensajes favoritos',
        icon: Heart,
      },
      {
        key: 'mute-notifications',
        title: chatSettings.notifications_muted ? 'Activar notificaciones' : 'Silenciar notificaciones',
        icon: BellOff,
      },
    ],
    [chatSettings.notifications_muted]
  );

  const closeComposerPanel = useCallback(() => {
    if (panelOpenTimeoutRef.current) {
      clearTimeout(panelOpenTimeoutRef.current);
      panelOpenTimeoutRef.current = null;
    }
    if (pendingInputFocusTimeoutRef.current) {
      clearTimeout(pendingInputFocusTimeoutRef.current);
      pendingInputFocusTimeoutRef.current = null;
    }
    setActiveComposerPanel(null);
  }, []);

  const handleOptionsMenuClose = useCallback((afterClose?: () => void) => {
    Animated.timing(optionsAnim, {
      toValue: 0,
      duration: 140,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setIsOptionsMenuOpen(false);
      afterClose?.();
    });
  }, [optionsAnim]);

  const handleOptionsMenuPress = useCallback(() => {
    if (isOptionsMenuOpen) {
      handleOptionsMenuClose();
      return;
    }
    optionsAnim.setValue(0);
    setIsOptionsMenuOpen(true);
    requestAnimationFrame(() => {
      Animated.timing(optionsAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [handleOptionsMenuClose, isOptionsMenuOpen, optionsAnim]);

  const persistChatSettings = useCallback(
    async (nextSettings: ChatSettingsState, showGenericError = true) => {
      if (!couple?.couple_id) return true;

      const fullPayload = {
        couple_id: couple.couple_id,
        ...nextSettings,
        updated_by: profile?.id ?? null,
        updated_at: new Date().toISOString(),
      };
      const fallbackPayload = {
        couple_id: couple.couple_id,
        theme_key: nextSettings.theme_key,
        translation_enabled: nextSettings.translation_enabled,
        translation_target: nextSettings.translation_target,
        notifications_muted: nextSettings.notifications_muted,
        mute_until: nextSettings.mute_until,
        chat_nickname: nextSettings.chat_nickname,
        auto_save_media: nextSettings.auto_save_media,
        confirm_before_delete: nextSettings.confirm_before_delete,
        disappearing_enabled: nextSettings.disappearing_enabled,
        disappearing_timer_seconds: nextSettings.disappearing_timer_seconds,
        lock_enabled: nextSettings.lock_enabled,
        wallpaper_key: nextSettings.wallpaper_key,
        sound_enabled: nextSettings.sound_enabled,
        updated_by: profile?.id ?? null,
        updated_at: new Date().toISOString(),
      };

      console.log('[Mensajes][ChatSettings] save start', nextSettings);
      try {
        const { error } = await supabase.from('chat_settings').upsert(fullPayload, { onConflict: 'couple_id' });
        if (error) throw error;
        console.log('[Mensajes][ChatSettings] save success');
        return true;
      } catch (error) {
        const errorInfo = getErrorInfo(error);
        const missingColumnMatch =
          String(errorInfo.message || '').match(/'([^']+)' column/i) ||
          String(errorInfo.message || '').match(/column ["']?([^"']+)["']?/i);

        if (missingColumnMatch?.[1]) {
          console.warn('[Mensajes][Themes] missing field warning', missingColumnMatch[1]);
          try {
            const { error: fallbackError } = await supabase.from('chat_settings').upsert(fallbackPayload, {
              onConflict: 'couple_id',
            });
            if (!fallbackError) {
              console.log('[Mensajes][ChatSettings] save success (fallback)');
              return true;
            }
            throw fallbackError;
          } catch (fallbackError) {
            console.log('[Mensajes][ChatSettings] save failed', getErrorInfo(fallbackError));
            if (showGenericError) {
              Alert.alert('Error', 'No se pudieron guardar los cambios.');
            }
            return false;
          }
        }

        console.log('[Mensajes][ChatSettings] save failed', getErrorInfo(error));
        if (showGenericError) {
          Alert.alert('Error', 'No se pudieron guardar los cambios.');
        }
        return false;
      }
    },
    [couple?.couple_id, profile?.id]
  );

  const applyChatSettingsPatch = useCallback(
    async (
      patch: Partial<ChatSettingsState>,
      options?: {
        showGenericError?: boolean;
        onSaveFailed?: () => void;
        onSaveSuccess?: () => void;
      }
    ) => {
      const previous = chatSettings;
      const nextSettings = {
        ...chatSettings,
        ...patch,
      };
      setChatSettings(nextSettings);
      const saved = await persistChatSettings(nextSettings, options?.showGenericError ?? true);
      if (!saved) {
        setChatSettings(previous);
        options?.onSaveFailed?.();
        return false;
      }
      options?.onSaveSuccess?.();
      return true;
    },
    [chatSettings, persistChatSettings]
  );

  const loadChatSettings = useCallback(async () => {
    if (!couple?.couple_id) return;

    setIsLoadingSettings(true);
    console.log('[Mensajes][ChatSettings] load start');
    console.log('[Mensajes][Themes] load start');
    try {
      const { data, error } = await supabase
        .from('chat_settings')
        .select('*')
        .eq('couple_id', couple.couple_id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setChatSettings(DEFAULT_CHAT_SETTINGS);
        await persistChatSettings(DEFAULT_CHAT_SETTINGS, false);
      } else {
        const missingThemeFields = THEME_DB_FIELD_KEYS.filter((fieldKey) => !(fieldKey in (data as Record<string, unknown>)));
        if (missingThemeFields.length > 0) {
          console.warn('[Mensajes][Themes] missing fields on load', missingThemeFields);
        }

        const safeThemeKey = (data.theme_key as ThemeKey) || 'default';
        const presetFallback =
          safeThemeKey !== 'custom' && safeThemeKey in CHAT_THEMES
            ? CHAT_THEMES[safeThemeKey as Exclude<ThemeKey, 'custom'>]
            : CHAT_THEMES.default;
        const rawCustomTheme =
          data.custom_theme && typeof data.custom_theme === 'object'
            ? (data.custom_theme as Partial<CustomThemeConfig>)
            : null;
        const customTheme: CustomThemeConfig | null = rawCustomTheme
          ? {
              background: normalizeHexColor(rawCustomTheme.background, presetFallback.background),
              ownBubble: normalizeHexColor(rawCustomTheme.ownBubble, presetFallback.ownBubble),
              partnerBubble: normalizeHexColor(rawCustomTheme.partnerBubble, presetFallback.partnerBubble),
              text: normalizeHexColor(rawCustomTheme.text, presetFallback.text),
              partnerText: normalizeHexColor(
                rawCustomTheme.partnerText,
                getReadableTextColor(rawCustomTheme.partnerBubble || presetFallback.partnerBubble, rawCustomTheme.text || presetFallback.text)
              ),
              accent: normalizeHexColor(rawCustomTheme.accent, presetFallback.accent),
              appearance: rawCustomTheme.appearance === 'dark' ? 'dark' : 'light',
              backgroundType: rawCustomTheme.backgroundType === 'gradient' || rawCustomTheme.backgroundType === 'image' ? rawCustomTheme.backgroundType : 'color',
              backgroundValue: String(rawCustomTheme.backgroundValue || 'solid'),
              brightness: clamp(typeof rawCustomTheme.brightness === 'number' ? rawCustomTheme.brightness : 100, 50, 120),
              saturation: clamp(typeof rawCustomTheme.saturation === 'number' ? rawCustomTheme.saturation : 100, 0, 100),
              softness: clamp(typeof rawCustomTheme.softness === 'number' ? rawCustomTheme.softness : 20, 0, 100),
            }
          : null;
        const normalizedSettings: ChatSettingsState = {
          theme_key: safeThemeKey,
          appearance_mode: (data.appearance_mode as AppearanceMode) || 'light',
          translation_enabled: Boolean(data.translation_enabled),
          translation_target: (data.translation_target as TranslationTarget) || 'es',
          notifications_muted: Boolean(data.notifications_muted),
          mute_until: data.mute_until || null,
          chat_nickname: data.chat_nickname || null,
          auto_save_media: Boolean(data.auto_save_media),
          confirm_before_delete:
            typeof data.confirm_before_delete === 'boolean' ? Boolean(data.confirm_before_delete) : true,
          disappearing_enabled: Boolean(data.disappearing_enabled),
          disappearing_timer_seconds:
            typeof data.disappearing_timer_seconds === 'number' ? data.disappearing_timer_seconds : null,
          lock_enabled: Boolean(data.lock_enabled),
          wallpaper_key: (data.wallpaper_key as ThemeKey) || 'default',
          custom_theme: customTheme,
          bubble_color: normalizeHexColor(data.bubble_color as string, customTheme?.ownBubble || presetFallback.ownBubble),
          partner_bubble_color: normalizeHexColor(
            data.partner_bubble_color as string,
            customTheme?.partnerBubble || presetFallback.partnerBubble
          ),
          chat_background_color: normalizeHexColor(
            data.chat_background_color as string,
            customTheme?.background || presetFallback.background
          ),
          chat_wallpaper_type: String(data.chat_wallpaper_type || 'color'),
          chat_wallpaper_value: String(data.chat_wallpaper_value || 'solid'),
          text_color: normalizeHexColor(data.text_color as string, customTheme?.text || presetFallback.text),
          accent_color: normalizeHexColor(data.accent_color as string, customTheme?.accent || presetFallback.accent),
          sound_enabled: typeof data.sound_enabled === 'boolean' ? Boolean(data.sound_enabled) : true,
        };
        setChatSettings(normalizedSettings);
        setChatNicknameDraft(normalizedSettings.chat_nickname || partnerName);
      }
      console.log('[Mensajes][ChatSettings] load success');
      console.log('[Mensajes][Themes] load success');
    } catch (error) {
      console.log('[Mensajes][ChatSettings] load failed', getErrorInfo(error));
      console.log('[Mensajes][Themes] load failed', getErrorInfo(error));
      setChatSettings(DEFAULT_CHAT_SETTINGS);
      Alert.alert('Error', 'No se pudieron cargar los ajustes.');
    } finally {
      setIsLoadingSettings(false);
    }
  }, [couple?.couple_id, partnerName, persistChatSettings]);

  const openOptionsPanel = useCallback((panel: Exclude<OptionsPanelKey, null>) => {
    closeComposerPanel();
    Keyboard.dismiss();
    setMessageActionTarget(null);
    setExpandedChatSettingsSection(null);
    setActiveThemeEditorPage(null);
    setIsEditingChatNickname(false);
    setChatNicknameDraft(chatSettings.chat_nickname?.trim() || partnerName);
    optionsPageAnim.setValue(0);
    setActiveOptionsPanel(panel);
    requestAnimationFrame(() => {
      Animated.timing(optionsPageAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [chatSettings.chat_nickname, closeComposerPanel, optionsPageAnim, partnerName]);

  const closeOptionsPanel = useCallback(() => {
    Animated.timing(optionsPageAnim, {
      toValue: 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setActiveOptionsPanel(null);
      setExpandedChatSettingsSection(null);
      setActiveThemeEditorPage(null);
      setIsEditingChatNickname(false);
    });
  }, [optionsPageAnim]);

  const loadSharedMedia = useCallback(async () => {
    if (!couple?.couple_id) return;

    setIsLoadingSharedMedia(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, message_type, media_url, created_at, file_name, file_size, content')
        .eq('couple_id', couple.couple_id)
        .in('message_type', ['image', 'video', 'document'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSharedMediaItems(((data ?? []) as SharedMediaItem[]).filter((item) => Boolean(item.media_url)));
    } catch (error) {
      console.log('[Mensajes][Options] shared media load failed', getErrorInfo(error));
      setSharedMediaItems([]);
      Alert.alert('Error', 'No se pudieron cargar los ajustes.');
    } finally {
      setIsLoadingSharedMedia(false);
    }
  }, [couple?.couple_id]);

  const loadFavoriteMessages = useCallback(async () => {
    if (!couple?.couple_id) return;

    setIsLoadingFavorites(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, content, message_type, media_url, created_at, is_favorite')
        .eq('couple_id', couple.couple_id)
        .eq('is_favorite', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFavoriteMessages((data ?? []) as FavoriteMessageItem[]);
    } catch (error) {
      console.log('[Mensajes][Options] favorites load failed', getErrorInfo(error));
      setFavoriteMessages([]);
      Alert.alert('Error', 'No se pudieron cargar los mensajes favoritos.');
    } finally {
      setIsLoadingFavorites(false);
    }
  }, [couple?.couple_id]);

  const toggleMuteNotifications = useCallback(async () => {
    console.log('[Mensajes][Options] mute toggled');
    const nextMuted = !chatSettings.notifications_muted;
    await applyChatSettingsPatch(
      {
        notifications_muted: nextMuted,
        mute_until: null,
      },
      {
        onSaveSuccess: () => {
          Alert.alert(
            nextMuted ? 'Notificaciones silenciadas' : 'Notificaciones activadas',
            nextMuted ? 'No recibirás avisos de este chat.' : 'Volverás a recibir avisos de este chat.'
          );
        },
      }
    );
  }, [applyChatSettingsPatch, chatSettings.notifications_muted]);

  const handleOptionsMenuItemPress = useCallback(
    (key: string) => {
      const afterClose = () => {
        if (key === 'chat-settings') {
          console.log('[Mensajes][Options] chat settings pressed');
          openOptionsPanel('chat_settings');
          return;
        }
        if (key === 'themes') {
          console.log('[Mensajes][Options] themes pressed');
          openOptionsPanel('themes');
          return;
        }
        if (key === 'translation') {
          console.log('[Mensajes][Options] translation pressed');
          openOptionsPanel('translation');
          return;
        }
        if (key === 'shared-media') {
          console.log('[Mensajes][Options] shared media pressed');
          openOptionsPanel('shared_media');
          void loadSharedMedia();
          return;
        }
        if (key === 'favorite-messages') {
          console.log('[Mensajes][Options] favorites pressed');
          openOptionsPanel('favorites');
          void loadFavoriteMessages();
          return;
        }
        if (key === 'mute-notifications') {
          void toggleMuteNotifications();
        }
      };

      handleOptionsMenuClose(afterClose);
    },
    [handleOptionsMenuClose, loadFavoriteMessages, loadSharedMedia, openOptionsPanel, toggleMuteNotifications]
  );

  const setAttachmentLoading = useCallback((visible: boolean, label = '') => {
    setIsAttachmentBusy(visible);
    setAttachmentBusyLabel(visible ? label : '');
  }, []);

  const appendMessageIfMissing = useCallback((data: any) => {
    if (!data) return;
    setMessages((prev) => {
      if (prev.find((message) => message.id === data.id)) return prev;
      return [...prev, data];
    });
  }, []);

  const insertChatMessage = useCallback(
    async (payload: Record<string, any>) => {
      const { data, error } = await supabase.from('messages').insert(payload).select().single();
      if (error) throw error;
      appendMessageIfMissing(data);
      return data;
    },
    [appendMessageIfMissing]
  );

  const uploadLocalFileToSupabaseStorage = useCallback(
    async ({ bucket, localUri, path, contentType }: AttachmentUploadParams) => {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Missing Supabase storage configuration.');
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('Missing Supabase access token.');
      }

      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (!fileInfo.exists || fileInfo.size === 0) {
        throw new Error('Selected file does not exist or is empty.');
      }

      const encodedPath = path
        .split('/')
        .map(encodeURIComponent)
        .join('/');
      const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodedPath}`;

      console.log('[Mensajes][Attachment] upload start', { bucket, path, contentType });

      try {
        const uploadResult = await FileSystem.uploadAsync(uploadUrl, localUri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': contentType,
            'x-upsert': 'false',
          },
        });

        if (uploadResult.status < 200 || uploadResult.status >= 300) {
          console.log('[Mensajes][Attachment] upload failed', {
            bucket,
            path,
            status: uploadResult.status,
            body: uploadResult.body,
          });
          throw new Error(`Upload failed with status ${uploadResult.status}.`);
        }

        const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);
        const publicUrl = publicUrlData?.publicUrl;
        if (!publicUrl) {
          throw new Error('Missing public URL after upload.');
        }

        console.log('[Mensajes][Attachment] upload success', { bucket, path, status: uploadResult.status });
        return { publicUrl, fileInfo, uploadResult };
      } catch (error) {
        console.log('[Mensajes][Attachment] upload failed', getErrorInfo(error));
        throw error;
      }
    },
    []
  );

  const openExternalUrl = useCallback(async (url: string, alertMessage: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', alertMessage);
    }
  }, []);

  const formatDurationMs = (durationMs?: number | null) => {
    const safeMs = typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
    const seconds = Math.floor(safeMs / 1000);
    const mm = Math.floor(seconds / 60);
    const ss = seconds % 60;
    return `${mm}:${String(ss).padStart(2, '0')}`;
  };

  const getVoiceBubbleWidth = (durationMs?: number | null) => {
    const seconds = Math.max(0, (durationMs ?? 0) / 1000);

    const minWidth = 170;
    const maxWidth = 300;
    const maxDuration = 20;

    const ratio = Math.min(seconds / maxDuration, 1);
    return Math.round(minWidth + (maxWidth - minWidth) * ratio);
  };

  const handleSearchToggle = () => {
    if (showSearchBar) {
      handleSearchClose();
    } else {
      setShowSearchBar(true);
    }
  };

  const handleSearchClose = () => {
    setShowSearchBar(false);
    setSearchQuery('');
  };

  const handleCameraPress = async () => {
    pickImage(true);
  };

  const pickImage = async (useCamera: boolean) => {
    setActiveComposerPanel(null);

    try {
      const { status } = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permisos necesarios', 'Necesitamos permisos para acceder a tu galería/cámara.');
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'] as any,
            allowsEditing: false,
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'] as any,
            allowsEditing: false,
            quality: 0.8,
          });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log('[Messages] Image selected:', result.assets[0].uri);
        Alert.alert('Imagen seleccionada', 'Funcionalidad de envío de imágenes próximamente');
      }
    } catch (error) {
      console.log('[Messages] image picker error:', getErrorInfo(error));
    }
  };

  const handleStickerPress = (sticker: string) => {
    setInputText((prev) => prev + sticker);
    setActiveComposerPanel(null);
  };

  const ensureMicrophonePermission = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (perm.granted) return true;
    } catch {
    }

    Alert.alert(
      'Permiso necesario',
      'Necesitamos acceso al micrófono para enviar mensajes de voz.',
      [{ text: 'Entendido' }]
    );
    return false;
  };

  const startVoiceRecording = useCallback(async () => {
    if (isRecording || isSendingVoice) return;
    if (!couple?.couple_id || !profile?.id) return;

    closeComposerPanel();
    Keyboard.dismiss();
    inputRef.current?.blur();

    const ok = await ensureMicrophonePermission();
    if (!ok) return;

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (e: any) {
      logVoiceError('start recording error', e);
      Alert.alert('Error', 'No se pudo grabar el audio.');
    }
  }, [audioRecorder, closeComposerPanel, couple?.couple_id, inputRef, isRecording, isSendingVoice, profile?.id]);

  const cancelVoiceRecording = useCallback(async () => {
    if (!isRecording) return;
    try {
      await audioRecorder.stop();
    } catch {
    }
  }, [audioRecorder, isRecording]);

  const sendVoiceRecording = useCallback(async () => {
    console.log('[Mensajes][Voice] SEND BUTTON PRESSED');
    if (!isRecording || isSendingVoice) return;
    if (!couple?.couple_id || !profile?.id) return;

    setIsSendingVoice(true);

    let audioUri: string | null = null;
    let durationMs: number | null = null;

    try {
      const ok = await ensureMicrophonePermission();
      if (!ok) return;

      durationMs =
        typeof recorderState.durationMillis === 'number' && Number.isFinite(recorderState.durationMillis)
          ? recorderState.durationMillis
          : null;

      console.log('[Mensajes][Voice] stopping recording...');
      await audioRecorder.stop();
      audioUri = audioRecorder.uri ?? null;
      console.log('[Mensajes][Voice] audioUri:', audioUri);
    } catch (e: any) {
      logVoiceError('stop recording failed', e);
      Alert.alert('Error', 'No se pudo grabar el audio.');
      setIsSendingVoice(false);
      return;
    }

    try {
      if (!audioUri) {
        logVoiceError('recording URI missing', new Error('audioUri is missing after stopping the recorder.'));
        Alert.alert('Error', 'No se pudo preparar el audio.');
        return;
      }

      console.log('[Mensajes][Voice] checking file info...');
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      console.log('[Mensajes][Voice] fileInfo:', fileInfo);

      if (!fileInfo.exists) {
        logVoiceError('local file missing', new Error(`Recorded file does not exist at ${audioUri}.`));
        Alert.alert('Error', 'No se pudo preparar el audio.');
        return;
      }

      if (fileInfo.size === 0) {
        logVoiceError('local file size is 0', new Error(`Recorded file is empty at ${audioUri}.`));
        Alert.alert('Error', 'No se pudo preparar el audio.');
        return;
      }

      console.log('[Mensajes][Voice] getting Supabase session...');
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log('[Mensajes][Voice] has session:', !!sessionData.session);
      console.log('[Mensajes][Voice] has access token:', !!sessionData.session?.access_token);
      if (sessionError) {
        logVoiceError('session error', sessionError);
        Alert.alert('Error', 'Inicia sesión de nuevo.');
        return;
      }

      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        logVoiceError('no Supabase session/access token', new Error('Supabase access token is missing.'));
        Alert.alert('Error', 'Inicia sesión de nuevo.');
        return;
      }

      console.log('[Mensajes][Voice] SUPABASE_URL exists:', !!SUPABASE_URL);
      console.log('[Mensajes][Voice] SUPABASE_ANON_KEY exists:', !!SUPABASE_ANON_KEY);
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        if (!SUPABASE_URL) {
          console.log('[Mensajes][Voice] missing env: EXPO_PUBLIC_SUPABASE_URL');
        }
        if (!SUPABASE_ANON_KEY) {
          console.log('[Mensajes][Voice] missing env: EXPO_PUBLIC_SUPABASE_ANON_KEY');
        }
        Alert.alert('Error', 'No se pudo conectar con el servidor.');
        return;
      }

      const fileExt = 'm4a';
      const filePath = `${profile.id}/${couple.couple_id}/${Date.now()}.${fileExt}`;
      const encodedFilePath = filePath
        .split('/')
        .map(encodeURIComponent)
        .join('/');
      const uploadUrl = `${SUPABASE_URL}/storage/v1/object/voice-messages/${encodedFilePath}`;
      console.log('[Mensajes][Voice] uploadUrl:', uploadUrl);
      console.log('[Mensajes][Voice] uploading file...');

      let uploadResult;
      try {
        uploadResult = await FileSystem.uploadAsync(uploadUrl, audioUri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'audio/mp4',
            'x-upsert': 'false',
          },
        });
      } catch (error) {
        logVoiceError('upload request failed', error);
        Alert.alert('Error', 'No se pudo subir el audio.');
        return;
      }
      console.log('[Mensajes][Voice] uploadResult:', uploadResult);

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        logVoiceError('upload returned non-200 status', new Error(`Storage upload returned status ${uploadResult.status}.`));
        Alert.alert('Error', 'No se pudo subir el audio.');
        return;
      }

      const { data: publicUrlData } = supabase.storage.from('voice-messages').getPublicUrl(filePath);
      const mediaUrl = publicUrlData.publicUrl;
      if (!mediaUrl) {
        Alert.alert('Error', 'No se pudo preparar el mensaje de voz.');
        return;
      }

      console.log('[Mensajes][Voice] inserting audio message...');
      const { error: insertError } = await supabase.from('messages').insert({
        couple_id: couple.couple_id,
        sender_id: profile.id,
        content: 'Mensaje de voz',
        message_type: 'audio',
        media_url: mediaUrl,
        duration_ms: durationMs ?? null,
      });

      if (insertError) {
        logVoiceError('insert message failed', insertError);
        Alert.alert('Error', 'El audio se subió, pero no se pudo enviar el mensaje.');
        return;
      }

      console.log('[Mensajes][Voice] voice message sent successfully');
    } catch (error) {
      const err = error as any;
      console.log('[Mensajes][Voice] sendVoiceRecording failed', {
        name: err?.name,
        message: err?.message,
        status: err?.status,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        stack: err?.stack,
        raw: String(error),
      });
      Alert.alert('Error', 'No se pudo enviar el mensaje de voz.');
    } finally {
      setIsSendingVoice(false);
    }
  }, [audioRecorder, couple?.couple_id, isRecording, isSendingVoice, profile?.id, recorderState.durationMillis]);

  const handleGalleryOptionPress = () => {
    console.log('[Mensajes][Attachment] Galería pressed');
    closeComposerPanel();
    if (isAttachmentBusy || !couple?.couple_id || !profile?.id) return;

    void (async () => {
      try {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted') {
          Alert.alert(
            'Permiso necesario',
            'Necesitamos acceso a tus fotos para compartir archivos.',
            [{ text: 'Entendido' }]
          );
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images', 'videos'] as any,
          allowsEditing: false,
          quality: 0.9,
          selectionLimit: 1,
        });

        if (result.canceled || !result.assets?.length) return;

        const asset = result.assets[0];
        const fallbackName =
          asset.type === 'video' ? `video-${Date.now()}.mp4` : `foto-${Date.now()}.jpg`;
        const fileName = sanitizeFileName(asset.fileName ?? getFileNameFromUri(asset.uri, fallbackName), fallbackName);
        const mimeType =
          asset.mimeType ??
          (asset.type === 'video' ? getMimeTypeFromFileName(fileName, 'video/mp4') : getMimeTypeFromFileName(fileName, 'image/jpeg'));
        const path = `${profile.id}/${couple.couple_id}/${Date.now()}-${fileName}`;

        setAttachmentLoading(true, 'Enviando archivo...');
        const { publicUrl, fileInfo } = await uploadLocalFileToSupabaseStorage({
          bucket: 'chat-media',
          localUri: asset.uri,
          path,
          contentType: mimeType,
        });

        const fileSize =
          typeof asset.fileSize === 'number' && Number.isFinite(asset.fileSize)
            ? asset.fileSize
            : fileInfo.size ?? null;
        const isVideo = asset.type === 'video';

        await insertChatMessage({
          couple_id: couple.couple_id,
          sender_id: profile.id,
          content: isVideo ? 'Video' : 'Foto',
          message_type: isVideo ? 'video' : 'image',
          media_url: publicUrl,
          file_name: fileName,
          mime_type: mimeType,
          file_size: fileSize,
          metadata: {
            width: asset.width ?? null,
            height: asset.height ?? null,
            duration: isVideo ? asset.duration ?? null : null,
          },
        });
      } catch (error) {
        console.log('[Mensajes][Attachment] Galería failed', getErrorInfo(error));
        Alert.alert('Error', 'No se pudo enviar el archivo.');
      } finally {
        setAttachmentLoading(false);
      }
    })();
  };

  const handleLocationOptionPress = () => {
    console.log('[Mensajes][Attachment] Ubicación pressed');
    closeComposerPanel();
    if (isAttachmentBusy || !couple?.couple_id || !profile?.id) return;

    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          Alert.alert(
            'Permiso necesario',
            'Necesitamos acceso a tu ubicación para compartirla.',
            [{ text: 'Entendido' }]
          );
          return;
        }

        setAttachmentLoading(true, 'Compartiendo ubicación...');
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        await insertChatMessage({
          couple_id: couple.couple_id,
          sender_id: profile.id,
          content: 'Ubicación compartida',
          message_type: 'location',
          metadata: {
            latitude,
            longitude,
            accuracy: position.coords.accuracy ?? null,
            mapsUrl: buildGoogleMapsUrl(latitude, longitude),
          },
        });
      } catch (error) {
        console.log('[Mensajes][Attachment] Ubicación failed', getErrorInfo(error));
        Alert.alert('Error', 'No se pudo compartir la ubicación.');
      } finally {
        setAttachmentLoading(false);
      }
    })();
  };

  const handleContactOptionPress = () => {
    console.log('[Mensajes][Attachment] Contacto pressed');
    closeComposerPanel();
    if (isAttachmentBusy) return;

    void (async () => {
      try {
        const permission = await Contacts.requestPermissionsAsync();
        if (permission.status !== 'granted') {
          Alert.alert(
            'Permiso necesario',
            'Necesitamos acceso a tus contactos para compartir uno.',
            [{ text: 'Entendido' }]
          );
          return;
        }

        setAttachmentLoading(true, 'Cargando contactos...');
        const result = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
          sort: Contacts.SortTypes.FirstName,
        });
        setAvailableContacts(result.data.filter((contact) => Boolean(contact.name?.trim())));
        setContactsSearchQuery('');
        setContactsModalVisible(true);
      } catch (error) {
        console.log('[Mensajes][Attachment] Contacto failed', getErrorInfo(error));
        Alert.alert('Error', 'No se pudo compartir el contacto.');
      } finally {
        setAttachmentLoading(false);
      }
    })();
  };

  const handleSelectContact = useCallback(
    (contact: Contacts.Contact) => {
      if (isAttachmentBusy || !couple?.couple_id || !profile?.id) return;

      const phoneNumbers = (contact.phoneNumbers ?? [])
        .map((item) => item.number)
        .filter((value): value is string => Boolean(value));
      const emails = (contact.emails ?? [])
        .map((item) => item.email)
        .filter((value): value is string => Boolean(value));

      setContactsModalVisible(false);

      void (async () => {
        try {
          setAttachmentLoading(true, 'Compartiendo contacto...');
          await insertChatMessage({
            couple_id: couple.couple_id,
            sender_id: profile.id,
            content: contact.name || 'Contacto',
            message_type: 'contact',
            metadata: {
              name: contact.name || 'Contacto',
              phoneNumbers,
              emails,
            },
          });
        } catch (error) {
          console.log('[Mensajes][Attachment] Contacto share failed', getErrorInfo(error));
          Alert.alert('Error', 'No se pudo compartir el contacto.');
        } finally {
          setAttachmentLoading(false);
        }
      })();
    },
    [couple?.couple_id, insertChatMessage, isAttachmentBusy, profile?.id, setAttachmentLoading]
  );

  const handleDocumentOptionPress = () => {
    console.log('[Mensajes][Attachment] Documento pressed');
    closeComposerPanel();
    if (isAttachmentBusy || !couple?.couple_id || !profile?.id) return;

    void (async () => {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          multiple: false,
          copyToCacheDirectory: true,
          type: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'image/*',
          ],
        });

        if (result.canceled || !result.assets?.length) return;

        const asset = result.assets[0];
        const fileName = sanitizeFileName(asset.name ?? getFileNameFromUri(asset.uri, `documento-${Date.now()}`));
        const mimeType = asset.mimeType ?? getMimeTypeFromFileName(fileName);
        const path = `${profile.id}/${couple.couple_id}/${Date.now()}-${fileName}`;

        setAttachmentLoading(true, 'Enviando documento...');
        const { publicUrl, fileInfo } = await uploadLocalFileToSupabaseStorage({
          bucket: 'chat-documents',
          localUri: asset.uri,
          path,
          contentType: mimeType,
        });

        await insertChatMessage({
          couple_id: couple.couple_id,
          sender_id: profile.id,
          content: fileName,
          message_type: 'document',
          media_url: publicUrl,
          file_name: fileName,
          mime_type: mimeType,
          file_size:
            typeof asset.size === 'number' && Number.isFinite(asset.size) ? asset.size : fileInfo.size ?? null,
          metadata: {
            uriType: 'document',
          },
        });
      } catch (error) {
        console.log('[Mensajes][Attachment] Documento failed', getErrorInfo(error));
        Alert.alert('Error', 'No se pudo enviar el archivo.');
      } finally {
        setAttachmentLoading(false);
      }
    })();
  };

  const handleSavedOptionPress = () => {
    console.log('[Mensajes][Attachment] Guardados pressed');
    closeComposerPanel();
    if (isAttachmentBusy || !couple?.couple_id) return;

    void (async () => {
      try {
        setAttachmentLoading(true, 'Cargando guardados...');
        const { data, error } = await supabase
          .from('saved_places')
          .select('id, name, color, latitude, longitude, address, created_at')
          .eq('couple_id', couple.couple_id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setSavedPlaces((data as SavedPlaceShareItem[]) ?? []);
        setSavedSheetVisible(true);
      } catch (error) {
        console.log('[Mensajes][Attachment] Guardados failed', getErrorInfo(error));
        Alert.alert('Error', 'No se pudieron cargar los guardados.');
      } finally {
        setAttachmentLoading(false);
      }
    })();
  };

  const handleShareSavedPlace = useCallback(
    (place: SavedPlaceShareItem) => {
      if (isAttachmentBusy || !couple?.couple_id || !profile?.id) return;

      setSavedSheetVisible(false);

      void (async () => {
        try {
          setAttachmentLoading(true, 'Compartiendo guardado...');
          await insertChatMessage({
            couple_id: couple.couple_id,
            sender_id: profile.id,
            content: place.name,
            message_type: 'saved',
            metadata: {
              kind: 'saved_place',
              name: place.name,
              address: place.address ?? null,
              latitude: place.latitude,
              longitude: place.longitude,
              color: place.color ?? null,
              mapsUrl: buildGoogleMapsUrl(place.latitude, place.longitude),
            },
          });
        } catch (error) {
          console.log('[Mensajes][Attachment] Guardados share failed', getErrorInfo(error));
          Alert.alert('Error', 'No se pudo enviar el archivo.');
        } finally {
          setAttachmentLoading(false);
        }
      })();
    },
    [couple?.couple_id, insertChatMessage, isAttachmentBusy, profile?.id, setAttachmentLoading]
  );

  const handleFavoriteMessagesOptionPress = () => {
    console.log('[Mensajes][Attachment] Mensajes favoritos pressed');
    closeComposerPanel();
    openOptionsPanel('favorites');
    void loadFavoriteMessages();
  };

  const lastPanelRef = useRef<ComposerPanel>(null);
  const panelAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (activeComposerPanel) lastPanelRef.current = activeComposerPanel;

    Animated.timing(panelAnim, {
      toValue: activeComposerPanel ? 1 : 0,
      duration: PANEL_ANIM_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeComposerPanel, panelAnim]);

  const closeComposerPanelWithAfterClose = useCallback(
    (afterClose?: () => void) => {
      closeComposerPanel();
      if (!afterClose) return;
      pendingInputFocusTimeoutRef.current = setTimeout(() => {
        pendingInputFocusTimeoutRef.current = null;
        afterClose();
      }, PANEL_ANIM_MS);
    },
    [closeComposerPanel]
  );

  const handleInputRequestFocus = useCallback(() => {
    if (!activeComposerPanel) {
      inputRef.current?.focus();
      return;
    }

    if (isSwitchingFromPanelToKeyboardRef.current) return;
    isSwitchingFromPanelToKeyboardRef.current = true;

    closeComposerPanelWithAfterClose(() => {
      isSwitchingFromPanelToKeyboardRef.current = false;
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    });
  }, [activeComposerPanel, closeComposerPanelWithAfterClose]);

  const requestOpenPanel = useCallback(
    (panel: Exclude<ComposerPanel, null>) => {
      if (isRecording || isSendingVoice) return;

      if (panelOpenTimeoutRef.current) {
        clearTimeout(panelOpenTimeoutRef.current);
        panelOpenTimeoutRef.current = null;
      }

      if (activeComposerPanel === panel) {
        closeComposerPanel();
        return;
      }

      Keyboard.dismiss();
      inputRef.current?.blur();
      setKeyboardHeight(0);

      if (activeComposerPanel) {
        setActiveComposerPanel(null);
        panelOpenTimeoutRef.current = setTimeout(() => {
          setActiveComposerPanel(panel);
          panelOpenTimeoutRef.current = null;
        }, PANEL_ANIM_MS);
        return;
      }

      panelOpenTimeoutRef.current = setTimeout(() => {
        setActiveComposerPanel(panel);
        panelOpenTimeoutRef.current = null;
      }, 60);
    },
    [activeComposerPanel, closeComposerPanel, isRecording, isSendingVoice]
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isOptionsMenuOpen) {
        handleOptionsMenuClose();
        return true;
      }
      if (messageActionTarget) {
        setMessageActionTarget(null);
        return true;
      }
      if (activeOptionsPanel === 'themes' && activeThemeEditorPage) {
        setActiveThemeEditorPage(null);
        return true;
      }
      if (activeOptionsPanel) {
        closeOptionsPanel();
        return true;
      }
      if (activeComposerPanel) {
        closeComposerPanel();
        return true;
      }
      return false;
    });

    return () => {
      sub.remove();
    };
  }, [
    activeComposerPanel,
    activeOptionsPanel,
    activeThemeEditorPage,
    closeComposerPanel,
    closeOptionsPanel,
    handleOptionsMenuClose,
    isOptionsMenuOpen,
    messageActionTarget,
  ]);

  const handleStartAudioCall = useCallback(() => {
    void startGlobalCall('audio');
  }, [startGlobalCall]);

  const handleStartVideoCall = useCallback(() => {
    void startGlobalCall('video');
  }, [startGlobalCall]);

  const filteredMessages = messages.filter((m) =>
    getSearchableMessageText(m).includes(searchQuery.toLowerCase())
  );

  const chatPaddingBottom = Math.max(36, composerHeight + 18);
  const panelBottomOffset = Math.max(
    0,
    Math.max(0, activeComposerPanel ? 0 : keyboardHeight) + Math.max(composerHeight, 72) - 1
  );
  const optionsDropdownTop = Math.max(insets.top + 56, 84);
  const optionsDropdownWidth = Math.min(272, Math.max(220, windowWidth - 32));
  const optionsPageTranslateX = optionsPageAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [windowWidth, 0],
  });
  const optionsPageOpacity = optionsPageAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1],
  });
  const handleOptionsPageBack = useCallback(() => {
    if (activeOptionsPanel === 'themes' && activeThemeEditorPage) {
      setActiveThemeEditorPage(null);
      return;
    }
    closeOptionsPanel();
  }, [activeOptionsPanel, activeThemeEditorPage, closeOptionsPanel]);
  const activeOptionsPageTitle =
    activeOptionsPanel === 'chat_settings'
      ? 'Ajustes del chat'
      : activeOptionsPanel === 'themes'
        ? activeThemeEditorPage === 'bubbles'
          ? 'Burbujas del chat'
          : activeThemeEditorPage === 'background'
            ? 'Fondo del chat'
            : 'Temas'
        : activeOptionsPanel === 'translation'
          ? 'Ajustes de traducción'
          : activeOptionsPanel === 'shared_media'
            ? 'Multimedia compartida'
            : 'Mensajes favoritos';

  useEffect(() => {
    if (couple?.couple_id) {
      void loadChatSettings();
    }
  }, [couple?.couple_id, loadChatSettings]);

  useEffect(() => {
    if (!isEditingChatNickname) {
      setChatNicknameDraft(currentChatName);
    }
  }, [currentChatName, isEditingChatNickname]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      const nextHeight = e?.endCoordinates?.height ?? 0;
      setKeyboardHeight(nextHeight);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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

  const applyThemeSettingsPatch = useCallback(
    async (
      patch: Partial<ChatSettingsState>,
      options?: {
        selectedTheme?: ThemeKey;
        customField?: 'bubble_color' | 'partner_bubble_color' | 'accent_color' | 'text_color';
      }
    ) => {
      console.log('[Mensajes][Themes] save start', patch);
      const saved = await applyChatSettingsPatch(patch, { showGenericError: false });
      if (!saved) {
        console.log('[Mensajes][Themes] save failed', patch);
        Alert.alert('Error', 'No se pudo guardar el tema.');
        return false;
      }
      console.log('[Mensajes][Themes] save success');
      if (options?.selectedTheme) {
        console.log('[Mensajes][Themes] selected theme', options.selectedTheme);
      }
      if (options?.customField) {
        console.log('[Mensajes][Themes] custom color changed', {
          field: options.customField,
          value: patch[options.customField],
        });
      }
      return true;
    },
    [applyChatSettingsPatch]
  );

  const buildCustomThemePatch = useCallback(
    (
      overrides: Partial<
        Pick<
          ChatSettingsState,
          | 'appearance_mode'
          | 'bubble_color'
          | 'partner_bubble_color'
          | 'chat_background_color'
          | 'chat_wallpaper_type'
          | 'chat_wallpaper_value'
          | 'text_color'
          | 'accent_color'
          | 'wallpaper_key'
        >
      > = {},
      customThemeOverrides?: Partial<Pick<CustomThemeConfig, 'brightness' | 'saturation' | 'softness'>>
    ) => {
      const currentCustomTheme = chatSettings.custom_theme;
      const nextThemeState = {
        appearance_mode: overrides.appearance_mode ?? chatSettings.appearance_mode,
        bubble_color: overrides.bubble_color ?? chatSettings.bubble_color ?? activeTheme.outgoingBubble,
        partner_bubble_color:
          overrides.partner_bubble_color ?? chatSettings.partner_bubble_color ?? activeTheme.incomingBubble,
        chat_background_color:
          overrides.chat_background_color ?? chatSettings.chat_background_color ?? activeTheme.chatBackground,
        chat_wallpaper_type: overrides.chat_wallpaper_type ?? chatSettings.chat_wallpaper_type,
        chat_wallpaper_value: overrides.chat_wallpaper_value ?? chatSettings.chat_wallpaper_value,
        text_color: overrides.text_color ?? chatSettings.text_color ?? activeTheme.outgoingBubbleText,
        accent_color: overrides.accent_color ?? chatSettings.accent_color ?? activeTheme.accent,
        wallpaper_key: overrides.wallpaper_key ?? chatSettings.wallpaper_key,
      };

      return {
        theme_key: 'custom' as const,
        ...nextThemeState,
        custom_theme: createCustomThemeFromState(nextThemeState, {
          brightness: customThemeOverrides?.brightness ?? currentCustomTheme?.brightness ?? 100,
          saturation: customThemeOverrides?.saturation ?? currentCustomTheme?.saturation ?? 100,
          softness: customThemeOverrides?.softness ?? currentCustomTheme?.softness ?? 20,
        }),
      };
    },
    [
      activeTheme.accent,
      activeTheme.chatBackground,
      activeTheme.incomingBubble,
      activeTheme.outgoingBubble,
      activeTheme.outgoingBubbleText,
      chatSettings.accent_color,
      chatSettings.appearance_mode,
      chatSettings.bubble_color,
      chatSettings.chat_background_color,
      chatSettings.chat_wallpaper_type,
      chatSettings.chat_wallpaper_value,
      chatSettings.custom_theme,
      chatSettings.partner_bubble_color,
      chatSettings.text_color,
      chatSettings.wallpaper_key,
    ]
  );

  const handleThemeSelect = useCallback(
    async (themeKey: ChatSettingsState['theme_key']) => {
      if (themeKey === 'custom') return;
      const themePreset = CHAT_THEMES[themeKey];
      const patch: Partial<ChatSettingsState> = {
        theme_key: themeKey,
        appearance_mode: themePreset.appearance,
        bubble_color: themePreset.ownBubble,
        partner_bubble_color: themePreset.partnerBubble,
        chat_background_color: themePreset.background,
        text_color: themePreset.text,
        accent_color: themePreset.accent,
        custom_theme: null,
        chat_wallpaper_type: 'color',
        chat_wallpaper_value: 'solid',
        wallpaper_key: themeKey in WALLPAPER_PRESETS ? themeKey : 'default',
      };
      await applyThemeSettingsPatch(patch, { selectedTheme: themeKey });
    },
    [applyThemeSettingsPatch]
  );

  const handleTranslationEnabledChange = useCallback(
    async (value: boolean) => {
      await applyChatSettingsPatch({
        translation_enabled: value,
      });
    },
    [applyChatSettingsPatch]
  );

  const handleTranslationTargetChange = useCallback(
    async (target: ChatSettingsState['translation_target']) => {
      await applyChatSettingsPatch({
        translation_target: target,
      });
    },
    [applyChatSettingsPatch]
  );

  const handleAppearanceModeSelect = useCallback(
    async (appearanceMode: AppearanceMode) => {
      if (chatSettings.theme_key === 'custom') {
        await applyThemeSettingsPatch(buildCustomThemePatch({ appearance_mode: appearanceMode }));
        return;
      }

      if (
        appearanceMode === 'dark' &&
        CHAT_THEMES[chatSettings.theme_key as Exclude<ThemeKey, 'custom'>]?.appearance !== 'dark'
      ) {
        await handleThemeSelect('night');
        return;
      }

      await applyThemeSettingsPatch({
        appearance_mode: appearanceMode,
      });
    },
    [applyThemeSettingsPatch, buildCustomThemePatch, chatSettings.theme_key, handleThemeSelect]
  );

  const handleWallpaperSelect = useCallback(
    async (wallpaperKey: ThemeKey) => {
      const backgroundColor = WALLPAPER_PRESETS[wallpaperKey] ?? activeTheme.chatBackground;
      const patch =
        chatSettings.theme_key === 'custom'
          ? buildCustomThemePatch({
              wallpaper_key: wallpaperKey,
              chat_background_color: backgroundColor,
              chat_wallpaper_type: 'color',
              chat_wallpaper_value: 'solid',
            })
          : {
              wallpaper_key: wallpaperKey,
              chat_background_color: backgroundColor,
              chat_wallpaper_type: 'color',
              chat_wallpaper_value: 'solid',
            };
      await applyChatSettingsPatch({
        ...patch,
        wallpaper_key: wallpaperKey,
      });
    },
    [activeTheme.chatBackground, applyChatSettingsPatch, buildCustomThemePatch, chatSettings.theme_key]
  );

  const handleThemeColorChange = useCallback(
    async (field: 'bubble_color' | 'partner_bubble_color' | 'accent_color' | 'text_color', color: string) => {
      const patch = buildCustomThemePatch({
        [field]: normalizeHexColor(color, color),
      });
      await applyThemeSettingsPatch(patch, { customField: field });
    },
    [applyThemeSettingsPatch, buildCustomThemePatch]
  );

  const handleThemeBackgroundPresetSelect = useCallback(
    async (backgroundKey: WallpaperPresetKey) => {
      const option = CHAT_BACKGROUND_OPTIONS.find((item) => item.key === backgroundKey);
      if (!option) return;

      const basePatch = {
        chat_wallpaper_type: option.type,
        chat_wallpaper_value: option.key,
      };

      if (chatSettings.theme_key === 'custom') {
        await applyThemeSettingsPatch(buildCustomThemePatch(basePatch));
        return;
      }

      await applyThemeSettingsPatch(basePatch);
    },
    [applyThemeSettingsPatch, buildCustomThemePatch, chatSettings.theme_key]
  );

  const handleThemeImagePlaceholderPress = useCallback(() => {
    Alert.alert('Próximamente', 'Podrás elegir una imagen como fondo del chat.');
  }, []);

  const handlePickBackgroundFromGallery = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para elegir una imagen.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        selectionLimit: 1,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setBackgroundEditorMode('image');
      setGalleryDraftUri(result.assets[0].uri);
      setGalleryDraftBrightness(100);
    } catch (error) {
      console.log('[Mensajes][Themes] gallery pick failed', getErrorInfo(error));
      Alert.alert(
        'Nueva versión necesaria',
        'Instala la nueva versión de prueba de Usfully para usar esta función.'
      );
    }
  }, []);

  const handleCancelGalleryDraft = useCallback(() => {
    setGalleryDraftUri(null);
    setGalleryDraftBrightness(100);
  }, []);

  const handleGalleryDraftBrightnessChange = useCallback((value: number) => {
    setGalleryDraftBrightness(clamp(value, 70, 120));
  }, []);

  const getBubbleTargetColor = useCallback(
    (target: BubbleEditorTarget) => {
      if (target === 'partner') return chatSettings.partner_bubble_color;
      return chatSettings.bubble_color;
    },
    [chatSettings.bubble_color, chatSettings.partner_bubble_color]
  );

  const applyBubbleTargetColor = useCallback(
    async (target: BubbleEditorTarget, color: string) => {
      const normalizedColor = normalizeHexColor(color, getBubbleTargetColor(target));
      const field = target === 'partner' ? 'partner_bubble_color' : 'bubble_color';
      const patch = buildCustomThemePatch({
        [field]: normalizedColor,
      });
      await applyThemeSettingsPatch(patch, { customField: field });
    },
    [applyThemeSettingsPatch, buildCustomThemePatch, getBubbleTargetColor]
  );

  const applyBackgroundThemePatch = useCallback(
    async (
      mode: BackgroundEditorMode,
      value: string,
      options?: {
        backgroundColor?: string;
        brightness?: number;
      }
    ) => {
      const nextBrightness = clamp(options?.brightness ?? backgroundOverlayBrightness, 70, 120);
      const nextBackgroundColor = normalizeHexColor(
        options?.backgroundColor ?? chatSettings.chat_background_color ?? activeTheme.chatBackground,
        activeTheme.chatBackground
      );

      const patch = buildCustomThemePatch(
        {
          chat_background_color: nextBackgroundColor,
          chat_wallpaper_type: mode,
          chat_wallpaper_value: value,
        },
        {
          brightness: nextBrightness,
          saturation: 100,
          softness: 20,
        }
      );
      await applyThemeSettingsPatch(patch);
    },
    [activeTheme.chatBackground, applyThemeSettingsPatch, backgroundOverlayBrightness, buildCustomThemePatch, chatSettings.chat_background_color]
  );

  const handleApplyGalleryDraft = useCallback(async () => {
    if (!galleryDraftUri) return;
    if (!couple?.couple_id) return;

    console.log('[Mensajes][Themes] save start', { mode: 'image' });
    try {
      const fallbackName = `fondo-chat-${Date.now()}.jpg`;
      const fileName = sanitizeFileName(getFileNameFromUri(galleryDraftUri, fallbackName), fallbackName);
      const contentType = getMimeTypeFromFileName(fileName, 'image/jpeg');
      const path = `${profile?.id ?? 'user'}/${couple.couple_id}/${Date.now()}-${fileName}`;

      const { publicUrl } = await uploadLocalFileToSupabaseStorage({
        bucket: 'chat-media',
        localUri: galleryDraftUri,
        path,
        contentType,
      });

      await applyBackgroundThemePatch('image', publicUrl, {
        backgroundColor: chatSettings.chat_background_color,
        brightness: galleryDraftBrightness,
      });

      setBackgroundOverlayBrightness(galleryDraftBrightness);
      setGalleryDraftUri(null);
      console.log('[Mensajes][Themes] save success');
    } catch (error) {
      console.log('[Mensajes][Themes] save failed', getErrorInfo(error));
      Alert.alert('Error', 'No se pudo guardar el tema.');
    }
  }, [
    applyBackgroundThemePatch,
    chatSettings.chat_background_color,
    couple?.couple_id,
    galleryDraftBrightness,
    galleryDraftUri,
    profile?.id,
    uploadLocalFileToSupabaseStorage,
  ]);

  const handleOpenThemeEditorPage = useCallback(
    (page: Exclude<ThemeEditorPage, null>) => {
      if (page === 'background') {
        setBackgroundEditorMode(
          chatSettings.chat_wallpaper_type === 'gradient'
            ? 'gradient'
            : chatSettings.chat_wallpaper_type === 'image'
              ? 'image'
              : 'color'
        );
      }
      setActiveThemeEditorPage(page);
    },
    [chatSettings.chat_wallpaper_type]
  );

  const handleBubblePaletteSelect = useCallback(
    async (color: string) => {
      const normalizedColor = normalizeHexColor(color, color);
      setBubbleBaseColor(normalizedColor);
      setBubbleEditorBrightness(100);
      await applyBubbleTargetColor(bubbleEditorTarget, normalizedColor);
    },
    [applyBubbleTargetColor, bubbleEditorTarget]
  );

  const handleBubbleBrightnessChange = useCallback(
    async (value: number) => {
      const nextBrightness = clamp(value, 70, 120);
      setBubbleEditorBrightness(nextBrightness);
      await applyBubbleTargetColor(bubbleEditorTarget, applyBrightnessToColor(bubbleBaseColor, nextBrightness));
    },
    [applyBubbleTargetColor, bubbleBaseColor, bubbleEditorTarget]
  );

  const handleBackgroundColorPaletteSelect = useCallback(
    async (color: string) => {
      const normalizedColor = normalizeHexColor(color, color);
      setBackgroundEditorMode('color');
      setBackgroundBaseColor(normalizedColor);
      setBackgroundOverlayBrightness(100);
      setGalleryDraftUri(null);
      setGalleryDraftBrightness(100);
      await applyBackgroundThemePatch('color', normalizedColor, {
        backgroundColor: normalizedColor,
        brightness: 100,
      });
    },
    [applyBackgroundThemePatch]
  );

  const handleBackgroundBrightnessChange = useCallback(
    async (value: number) => {
      const nextBrightness = clamp(value, 70, 120);
      setBackgroundOverlayBrightness(nextBrightness);
      const nextColor = applyBrightnessToColor(backgroundBaseColor, nextBrightness);
      await applyBackgroundThemePatch(
        backgroundEditorMode,
        backgroundEditorMode === 'gradient' ? chatSettings.chat_wallpaper_value : nextColor,
        {
          backgroundColor: nextColor,
          brightness: nextBrightness,
        }
      );
    },
    [applyBackgroundThemePatch, backgroundBaseColor, backgroundEditorMode, chatSettings.chat_wallpaper_value]
  );

  const handleBackgroundGradientSelect = useCallback(
    async (gradientKey: (typeof BACKGROUND_GRADIENT_OPTIONS)[number]['key']) => {
      const gradient = BACKGROUND_GRADIENT_OPTIONS.find((item) => item.key === gradientKey);
      if (!gradient) return;
      setBackgroundEditorMode('gradient');
      setBackgroundBaseColor(gradient.preview);
      setBackgroundOverlayBrightness(100);
      setGalleryDraftUri(null);
      setGalleryDraftBrightness(100);
      await applyBackgroundThemePatch('gradient', gradientKey, {
        backgroundColor: gradient.preview,
        brightness: 100,
      });
    },
    [applyBackgroundThemePatch]
  );

  const handleBackgroundModeSelect = useCallback(
    async (mode: BackgroundEditorMode) => {
      setBackgroundEditorMode(mode);
      if (mode === 'image') {
        await handlePickBackgroundFromGallery();
        return;
      }
      if (mode === 'gradient') {
        const currentGradient = BACKGROUND_GRADIENT_OPTIONS.find((item) => item.key === chatSettings.chat_wallpaper_value);
        await handleBackgroundGradientSelect(currentGradient?.key ?? BACKGROUND_GRADIENT_OPTIONS[0].key);
        return;
      }
      await applyBackgroundThemePatch('color', chatSettings.chat_background_color, {
        backgroundColor: chatSettings.chat_background_color,
        brightness: backgroundOverlayBrightness,
      });
    },
    [
      applyBackgroundThemePatch,
      backgroundOverlayBrightness,
      chatSettings.chat_background_color,
      chatSettings.chat_wallpaper_value,
      handleBackgroundGradientSelect,
      handlePickBackgroundFromGallery,
    ]
  );

  const handleBackgroundBrightnessControlChange = useCallback(
    async (value: number) => {
      const nextBrightness = clamp(value, 70, 120);
      setBackgroundOverlayBrightness(nextBrightness);
      const nextColor = applyBrightnessToColor(backgroundBaseColor, nextBrightness);
      await applyBackgroundThemePatch(
        backgroundEditorMode,
        backgroundEditorMode === 'gradient' ? chatSettings.chat_wallpaper_value : nextColor,
        {
          backgroundColor: nextColor,
          brightness: nextBrightness,
        }
      );
    },
    [
      applyBackgroundThemePatch,
      backgroundBaseColor,
      backgroundEditorMode,
      chatSettings.chat_wallpaper_value,
    ]
  );

  useEffect(() => {
    if (activeThemeEditorPage !== 'bubbles') return;
    const selectedColor = getBubbleTargetColor(bubbleEditorTarget);
    setBubbleBaseColor(selectedColor);
    setBubbleEditorBrightness(100);
  }, [activeThemeEditorPage, bubbleEditorTarget, getBubbleTargetColor]);

  useEffect(() => {
    if (activeThemeEditorPage !== 'background') return;
    const baseColor = normalizeHexColor(chatSettings.chat_background_color, activeTheme.chatBackground);
    setBackgroundEditorMode(
      chatSettings.chat_wallpaper_type === 'gradient'
        ? 'gradient'
        : chatSettings.chat_wallpaper_type === 'image'
          ? 'image'
          : 'color'
    );
    setBackgroundBaseColor(baseColor);
    setBackgroundOverlayBrightness(clamp(chatSettings.custom_theme?.brightness ?? 100, 70, 120));
    setGalleryDraftUri(null);
    setGalleryDraftBrightness(100);
  }, [activeTheme.chatBackground, activeThemeEditorPage, chatSettings.chat_background_color, chatSettings.chat_wallpaper_type, chatSettings.custom_theme]);

  const handleResetTheme = useCallback(() => {
    Alert.alert('Restablecer tema', '¿Quieres volver al tema clásico?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Restablecer',
        style: 'destructive',
        onPress: () => {
          void applyThemeSettingsPatch(
            {
              theme_key: 'default',
              appearance_mode: 'light',
              custom_theme: null,
              bubble_color: CHAT_THEMES.default.ownBubble,
              partner_bubble_color: CHAT_THEMES.default.partnerBubble,
              chat_background_color: CHAT_THEMES.default.background,
              chat_wallpaper_type: 'color',
              chat_wallpaper_value: 'solid',
              text_color: CHAT_THEMES.default.text,
              accent_color: CHAT_THEMES.default.accent,
              wallpaper_key: 'default',
            },
            { selectedTheme: 'default' }
          );
        },
      },
    ]);
  }, [applyThemeSettingsPatch]);

  const handleSoundEnabledChange = useCallback(
    async (value: boolean) => {
      await applyChatSettingsPatch({
        sound_enabled: value,
      });
    },
    [applyChatSettingsPatch]
  );

  const handleAutoSaveMediaChange = useCallback(
    async (value: boolean) => {
      await applyChatSettingsPatch({
        auto_save_media: value,
      });
    },
    [applyChatSettingsPatch]
  );

  const handleConfirmBeforeDeleteChange = useCallback(
    async (value: boolean) => {
      await applyChatSettingsPatch({
        confirm_before_delete: value,
      });
    },
    [applyChatSettingsPatch]
  );

  const handleLockEnabledChange = useCallback(
    async (value: boolean) => {
      const saved = await applyChatSettingsPatch({
        lock_enabled: value,
      });
      if (saved && value) {
        Alert.alert('Bloqueo activado', 'El bloqueo real con biometría se añadirá próximamente.');
      }
    },
    [applyChatSettingsPatch]
  );

  const handleNotificationOptionSelect = useCallback(
    async (option: (typeof NOTIFICATION_OPTIONS)[number]) => {
      const muteUntil =
        option.muted && option.hours
          ? new Date(Date.now() + option.hours * 60 * 60 * 1000).toISOString()
          : null;

      await applyChatSettingsPatch({
        notifications_muted: option.muted,
        mute_until: option.permanent ? null : muteUntil,
      });
      setExpandedChatSettingsSection(null);
    },
    [applyChatSettingsPatch]
  );

  const handleDisappearingOptionSelect = useCallback(
    async (option: (typeof DISAPPEARING_OPTIONS)[number]) => {
      await applyChatSettingsPatch({
        disappearing_enabled: option.enabled,
        disappearing_timer_seconds: option.seconds,
      });
      setExpandedChatSettingsSection(null);
    },
    [applyChatSettingsPatch]
  );

  const handleSaveChatNickname = useCallback(async () => {
    const trimmedName = chatNicknameDraft.trim();
    const saved = await applyChatSettingsPatch({
      chat_nickname: trimmedName.length > 0 ? trimmedName : null,
    });
    if (saved) {
      setIsEditingChatNickname(false);
    }
  }, [applyChatSettingsPatch, chatNicknameDraft]);

  const handleOpenChatSearchFromSettings = useCallback(() => {
    closeOptionsPanel();
    setShowSearchBar(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [closeOptionsPanel]);

  const handleOpenFavoritesFromSettings = useCallback(() => {
    void loadFavoriteMessages();
    openOptionsPanel('favorites');
  }, [loadFavoriteMessages, openOptionsPanel]);

  const handleStoragePlaceholderPress = useCallback(() => {
    Alert.alert('Próximamente', 'Esta opción estará disponible muy pronto.');
  }, []);

  const handleExportChatPress = useCallback(() => {
    Alert.alert('Próximamente', 'Podrás exportar tus recuerdos del chat.');
  }, []);

  const handleClearChatPress = useCallback(() => {
    const showPlaceholder = () => {
      Alert.alert('Próximamente', 'Esta opción estará disponible muy pronto.');
    };

    if (chatSettings.confirm_before_delete) {
      Alert.alert('Limpiar chat', 'Esta acción eliminará los mensajes de esta conversación.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Limpiar', style: 'destructive', onPress: showPlaceholder },
      ]);
      return;
    }

    showPlaceholder();
  }, [chatSettings.confirm_before_delete]);

  const toggleFavoriteMessage = useCallback(
    async (message: any) => {
      if (!message?.id) return;

      const nextFavorite = !Boolean(message?.is_favorite);

      setMessages((prev) =>
        prev.map((item) => (item.id === message.id ? { ...item, is_favorite: nextFavorite } : item))
      );
      setFavoriteMessages((prev) => {
        if (nextFavorite) {
          const exists = prev.some((item) => item.id === message.id);
          if (exists) {
            return prev.map((item) => (item.id === message.id ? { ...item, is_favorite: true } : item));
          }
          return [
            {
              id: message.id,
              content: message.content,
              message_type: message.message_type,
              media_url: message.media_url,
              created_at: message.created_at,
              is_favorite: true,
            },
            ...prev,
          ];
        }
        return prev.filter((item) => item.id !== message.id);
      });
      setMessageActionTarget(null);

      try {
        const { error } = await supabase.from('messages').update({ is_favorite: nextFavorite }).eq('id', message.id);
        if (error) throw error;
      } catch (error) {
        console.log('[Mensajes][Options] favorite toggle failed', getErrorInfo(error));
        setMessages((prev) =>
          prev.map((item) => (item.id === message.id ? { ...item, is_favorite: !nextFavorite } : item))
        );
        if (nextFavorite) {
          setFavoriteMessages((prev) => prev.filter((item) => item.id !== message.id));
        } else {
          setFavoriteMessages((prev) => [
            {
              id: message.id,
              content: message.content,
              message_type: message.message_type,
              media_url: message.media_url,
              created_at: message.created_at,
              is_favorite: true,
            },
            ...prev,
          ]);
        }
        Alert.alert('Error', 'No se pudieron guardar los cambios.');
      }
    },
    []
  );

  const handleMessageLongPress = useCallback((message: any) => {
    setMessageActionTarget(message);
  }, []);

  const renderFavoriteBadge = useCallback(
    (message: any) =>
      message?.is_favorite ? (
        <View style={[s.favoriteBadge, message.sender_id === profile?.id ? s.favoriteBadgeMe : s.favoriteBadgePartner]}>
          <Heart size={11} color={message.sender_id === profile?.id ? '#FFF8FB' : '#C26D87'} fill={message.sender_id === profile?.id ? '#FFF8FB' : '#C26D87'} />
        </View>
      ) : null,
    [profile?.id]
  );

  const renderImageMessage = useCallback(
    (message: any, key: string) => {
      const isMe = message.sender_id === profile?.id;
      return (
        <View key={key} style={[s.msgRow, isMe ? s.rowMe : s.rowPartner]}>
          <Pressable
            onPress={() => void openExternalUrl(String(message.media_url || ''), 'No se pudo abrir la imagen.')}
            onLongPress={() => handleMessageLongPress(message)}
            delayLongPress={240}
            style={[
              s.bubble,
              isMe ? s.bubbleMe : s.bubblePartner,
              s.attachmentMediaBubble,
              isMe
                ? { backgroundColor: activeTheme.outgoingBubble }
                : { backgroundColor: activeTheme.incomingBubble, borderColor: activeTheme.incomingBorder },
            ]}
          >
            {renderFavoriteBadge(message)}
            <Image source={{ uri: String(message.media_url || '') }} style={s.attachmentImagePreview} />
            <View style={s.attachmentMediaFooter}>
              <Text
                style={[
                  s.attachmentMediaLabel,
                  isMe ? s.txtMe : s.txtPartner,
                  isMe
                    ? { color: activeTheme.outgoingBubbleText }
                    : { color: activeTheme.incomingBubbleText },
                ]}
              >
                Foto
              </Text>
              <Text
                style={[
                  s.timeTxt,
                  isMe ? s.timeMe : s.timePartner,
                  isMe ? { color: activeTheme.outgoingTime } : { color: activeTheme.incomingTime },
                ]}
              >
                {formatMessageTime(message.created_at)}
              </Text>
            </View>
          </Pressable>
        </View>
      );
    },
    [
      activeTheme.incomingBorder,
      activeTheme.incomingBubble,
      activeTheme.incomingBubbleText,
      activeTheme.incomingTime,
      activeTheme.outgoingBubble,
      activeTheme.outgoingBubbleText,
      activeTheme.outgoingTime,
      handleMessageLongPress,
      openExternalUrl,
      profile?.id,
      renderFavoriteBadge,
    ]
  );

  const renderVideoMessage = useCallback(
    (message: any, key: string) => {
      const isMe = message.sender_id === profile?.id;
      const metadata = parseMessageMetadata(message.metadata);
      return (
        <View key={key} style={[s.msgRow, isMe ? s.rowMe : s.rowPartner]}>
          <Pressable
            onPress={() => void openExternalUrl(String(message.media_url || ''), 'No se pudo abrir el video.')}
            onLongPress={() => handleMessageLongPress(message)}
            delayLongPress={240}
            style={[
              s.bubble,
              isMe ? s.bubbleMe : s.bubblePartner,
              s.infoCardBubble,
              isMe
                ? { backgroundColor: activeTheme.outgoingBubble }
                : { backgroundColor: activeTheme.incomingBubble, borderColor: activeTheme.incomingBorder },
            ]}
          >
            {renderFavoriteBadge(message)}
            <View style={s.infoCardRow}>
              <View
                style={[
                  s.infoCardIconWrap,
                  isMe ? s.infoCardIconWrapMe : s.infoCardIconWrapPartner,
                  !isMe ? { backgroundColor: activeTheme.cardPartnerIconBg } : null,
                ]}
              >
                <Play
                  size={18}
                  color={isMe ? activeTheme.outgoingBubbleText : activeTheme.accent}
                  fill={isMe ? activeTheme.outgoingBubbleText : 'transparent'}
                />
              </View>
              <View style={s.infoCardTextWrap}>
                <Text
                  style={[
                    s.infoCardTitle,
                    isMe ? s.txtMe : s.txtPartner,
                    isMe ? { color: activeTheme.outgoingBubbleText } : { color: activeTheme.incomingBubbleText },
                  ]}
                >
                  Video
                </Text>
                <Text
                  style={[
                    s.infoCardSubtitle,
                    isMe ? s.infoCardSubtitleMe : s.infoCardSubtitlePartner,
                    !isMe ? { color: activeTheme.incomingSecondaryText } : null,
                  ]}
                  numberOfLines={1}
                >
                  {metadata.duration ? `${Math.round(Number(metadata.duration) / 1000)} s` : 'Toca para abrir'}
                </Text>
              </View>
            </View>
            <Text
              style={[
                s.timeTxt,
                isMe ? s.timeMe : s.timePartner,
                isMe ? { color: activeTheme.outgoingTime } : { color: activeTheme.incomingTime },
              ]}
            >
              {formatMessageTime(message.created_at)}
            </Text>
          </Pressable>
        </View>
      );
    },
    [
      activeTheme.accent,
      activeTheme.cardPartnerIconBg,
      activeTheme.incomingBorder,
      activeTheme.incomingBubble,
      activeTheme.incomingBubbleText,
      activeTheme.incomingSecondaryText,
      activeTheme.incomingTime,
      activeTheme.outgoingBubble,
      activeTheme.outgoingBubbleText,
      activeTheme.outgoingTime,
      handleMessageLongPress,
      openExternalUrl,
      profile?.id,
      renderFavoriteBadge,
    ]
  );

  const renderDocumentMessage = useCallback(
    (message: any, key: string) => {
      const isMe = message.sender_id === profile?.id;
      return (
        <View key={key} style={[s.msgRow, isMe ? s.rowMe : s.rowPartner]}>
          <Pressable
            onPress={() => void openExternalUrl(String(message.media_url || ''), 'No se pudo abrir el documento.')}
            onLongPress={() => handleMessageLongPress(message)}
            delayLongPress={240}
            style={[
              s.bubble,
              isMe ? s.bubbleMe : s.bubblePartner,
              s.infoCardBubble,
              isMe
                ? { backgroundColor: activeTheme.outgoingBubble }
                : { backgroundColor: activeTheme.incomingBubble, borderColor: activeTheme.incomingBorder },
            ]}
          >
            {renderFavoriteBadge(message)}
            <View style={s.infoCardRow}>
              <View
                style={[
                  s.infoCardIconWrap,
                  isMe ? s.infoCardIconWrapMe : s.infoCardIconWrapPartner,
                  !isMe ? { backgroundColor: activeTheme.cardPartnerIconBg } : null,
                ]}
              >
                <FileText size={18} color={isMe ? activeTheme.outgoingBubbleText : activeTheme.accent} />
              </View>
              <View style={s.infoCardTextWrap}>
                <Text
                  style={[
                    s.infoCardTitle,
                    isMe ? s.txtMe : s.txtPartner,
                    isMe ? { color: activeTheme.outgoingBubbleText } : { color: activeTheme.incomingBubbleText },
                  ]}
                  numberOfLines={1}
                >
                  {message.file_name || message.content || 'Documento'}
                </Text>
                <Text
                  style={[
                    s.infoCardSubtitle,
                    isMe ? s.infoCardSubtitleMe : s.infoCardSubtitlePartner,
                    !isMe ? { color: activeTheme.incomingSecondaryText } : null,
                  ]}
                  numberOfLines={1}
                >
                  {formatFileSize(message.file_size)}
                </Text>
              </View>
            </View>
            <Text
              style={[
                s.timeTxt,
                isMe ? s.timeMe : s.timePartner,
                isMe ? { color: activeTheme.outgoingTime } : { color: activeTheme.incomingTime },
              ]}
            >
              {formatMessageTime(message.created_at)}
            </Text>
          </Pressable>
        </View>
      );
    },
    [
      activeTheme.accent,
      activeTheme.cardPartnerIconBg,
      activeTheme.incomingBorder,
      activeTheme.incomingBubble,
      activeTheme.incomingBubbleText,
      activeTheme.incomingSecondaryText,
      activeTheme.incomingTime,
      activeTheme.outgoingBubble,
      activeTheme.outgoingBubbleText,
      activeTheme.outgoingTime,
      handleMessageLongPress,
      openExternalUrl,
      profile?.id,
      renderFavoriteBadge,
    ]
  );

  const renderLocationMessage = useCallback(
    (message: any, key: string) => {
      const isMe = message.sender_id === profile?.id;
      const metadata = parseMessageMetadata(message.metadata);
      const mapsUrl =
        metadata.mapsUrl ||
        (typeof metadata.latitude === 'number' && typeof metadata.longitude === 'number'
          ? buildGoogleMapsUrl(metadata.latitude, metadata.longitude)
          : null);
      return (
        <View key={key} style={[s.msgRow, isMe ? s.rowMe : s.rowPartner]}>
          <Pressable
            onPress={() => mapsUrl && void openExternalUrl(String(mapsUrl), 'No se pudo abrir Maps.')}
            onLongPress={() => handleMessageLongPress(message)}
            delayLongPress={240}
            style={[
              s.bubble,
              isMe ? s.bubbleMe : s.bubblePartner,
              s.infoCardBubble,
              isMe
                ? { backgroundColor: activeTheme.outgoingBubble }
                : { backgroundColor: activeTheme.incomingBubble, borderColor: activeTheme.incomingBorder },
            ]}
          >
            {renderFavoriteBadge(message)}
            <View style={s.infoCardRow}>
              <View
                style={[
                  s.infoCardIconWrap,
                  isMe ? s.infoCardIconWrapMe : s.infoCardIconWrapPartner,
                  !isMe ? { backgroundColor: activeTheme.cardPartnerIconBg } : null,
                ]}
              >
                <MapPin size={18} color={isMe ? activeTheme.outgoingBubbleText : activeTheme.accent} />
              </View>
              <View style={s.infoCardTextWrap}>
                <Text
                  style={[
                    s.infoCardTitle,
                    isMe ? s.txtMe : s.txtPartner,
                    isMe ? { color: activeTheme.outgoingBubbleText } : { color: activeTheme.incomingBubbleText },
                  ]}
                >
                  Ubicación
                </Text>
                <Text
                  style={[
                    s.infoCardSubtitle,
                    isMe ? s.infoCardSubtitleMe : s.infoCardSubtitlePartner,
                    !isMe ? { color: activeTheme.incomingSecondaryText } : null,
                  ]}
                >
                  Toca para abrir en Maps
                </Text>
              </View>
            </View>
            <Text
              style={[
                s.timeTxt,
                isMe ? s.timeMe : s.timePartner,
                isMe ? { color: activeTheme.outgoingTime } : { color: activeTheme.incomingTime },
              ]}
            >
              {formatMessageTime(message.created_at)}
            </Text>
          </Pressable>
        </View>
      );
    },
    [
      activeTheme.accent,
      activeTheme.cardPartnerIconBg,
      activeTheme.incomingBorder,
      activeTheme.incomingBubble,
      activeTheme.incomingBubbleText,
      activeTheme.incomingSecondaryText,
      activeTheme.incomingTime,
      activeTheme.outgoingBubble,
      activeTheme.outgoingBubbleText,
      activeTheme.outgoingTime,
      handleMessageLongPress,
      openExternalUrl,
      profile?.id,
      renderFavoriteBadge,
    ]
  );

  const renderContactMessage = useCallback(
    (message: any, key: string) => {
      const isMe = message.sender_id === profile?.id;
      const metadata = parseMessageMetadata(message.metadata);
      const primaryDetail = metadata.phoneNumbers?.[0] || metadata.emails?.[0] || 'Sin información adicional';
      return (
        <View key={key} style={[s.msgRow, isMe ? s.rowMe : s.rowPartner]}>
          <Pressable
            onLongPress={() => handleMessageLongPress(message)}
            delayLongPress={240}
            style={[
              s.bubble,
              isMe ? s.bubbleMe : s.bubblePartner,
              s.infoCardBubble,
              isMe
                ? { backgroundColor: activeTheme.outgoingBubble }
                : { backgroundColor: activeTheme.incomingBubble, borderColor: activeTheme.incomingBorder },
            ]}
          >
            {renderFavoriteBadge(message)}
            <View style={s.infoCardRow}>
              <View
                style={[
                  s.infoCardIconWrap,
                  isMe ? s.infoCardIconWrapMe : s.infoCardIconWrapPartner,
                  !isMe ? { backgroundColor: activeTheme.cardPartnerIconBg } : null,
                ]}
              >
                <UserRound size={18} color={isMe ? activeTheme.outgoingBubbleText : activeTheme.accent} />
              </View>
              <View style={s.infoCardTextWrap}>
                <Text
                  style={[
                    s.infoCardTitle,
                    isMe ? s.txtMe : s.txtPartner,
                    isMe ? { color: activeTheme.outgoingBubbleText } : { color: activeTheme.incomingBubbleText },
                  ]}
                  numberOfLines={1}
                >
                  {metadata.name || message.content || 'Contacto'}
                </Text>
                <Text
                  style={[
                    s.infoCardSubtitle,
                    isMe ? s.infoCardSubtitleMe : s.infoCardSubtitlePartner,
                    !isMe ? { color: activeTheme.incomingSecondaryText } : null,
                  ]}
                  numberOfLines={1}
                >
                  {primaryDetail}
                </Text>
              </View>
            </View>
            <Text
              style={[
                s.timeTxt,
                isMe ? s.timeMe : s.timePartner,
                isMe ? { color: activeTheme.outgoingTime } : { color: activeTheme.incomingTime },
              ]}
            >
              {formatMessageTime(message.created_at)}
            </Text>
          </Pressable>
        </View>
      );
    },
    [
      activeTheme.accent,
      activeTheme.cardPartnerIconBg,
      activeTheme.incomingBorder,
      activeTheme.incomingBubble,
      activeTheme.incomingBubbleText,
      activeTheme.incomingSecondaryText,
      activeTheme.incomingTime,
      activeTheme.outgoingBubble,
      activeTheme.outgoingBubbleText,
      activeTheme.outgoingTime,
      handleMessageLongPress,
      profile?.id,
      renderFavoriteBadge,
    ]
  );

  const renderSavedMessage = useCallback(
    (message: any, key: string) => {
      const isMe = message.sender_id === profile?.id;
      const metadata = parseMessageMetadata(message.metadata);
      const mapsUrl =
        metadata.mapsUrl ||
        (typeof metadata.latitude === 'number' && typeof metadata.longitude === 'number'
          ? buildGoogleMapsUrl(metadata.latitude, metadata.longitude)
          : null);
      return (
        <View key={key} style={[s.msgRow, isMe ? s.rowMe : s.rowPartner]}>
          <Pressable
            onPress={() => mapsUrl && void openExternalUrl(String(mapsUrl), 'No se pudo abrir Maps.')}
            onLongPress={() => handleMessageLongPress(message)}
            delayLongPress={240}
            style={[
              s.bubble,
              isMe ? s.bubbleMe : s.bubblePartner,
              s.infoCardBubble,
              isMe
                ? { backgroundColor: activeTheme.outgoingBubble }
                : { backgroundColor: activeTheme.incomingBubble, borderColor: activeTheme.incomingBorder },
            ]}
          >
            {renderFavoriteBadge(message)}
            <View style={s.infoCardRow}>
              <View
                style={[
                  s.infoCardIconWrap,
                  isMe ? s.infoCardIconWrapMe : s.infoCardIconWrapPartner,
                  !isMe ? { backgroundColor: activeTheme.cardPartnerIconBg } : null,
                ]}
              >
                <Bookmark size={18} color={isMe ? activeTheme.outgoingBubbleText : activeTheme.accent} />
              </View>
              <View style={s.infoCardTextWrap}>
                <Text
                  style={[
                    s.infoCardTitle,
                    isMe ? s.txtMe : s.txtPartner,
                    isMe ? { color: activeTheme.outgoingBubbleText } : { color: activeTheme.incomingBubbleText },
                  ]}
                  numberOfLines={1}
                >
                  {metadata.name || message.content || 'Guardado'}
                </Text>
                <Text
                  style={[
                    s.infoCardSubtitle,
                    isMe ? s.infoCardSubtitleMe : s.infoCardSubtitlePartner,
                    !isMe ? { color: activeTheme.incomingSecondaryText } : null,
                  ]}
                  numberOfLines={1}
                >
                  {metadata.address || 'Toca para abrir en Maps'}
                </Text>
              </View>
            </View>
            <Text
              style={[
                s.timeTxt,
                isMe ? s.timeMe : s.timePartner,
                isMe ? { color: activeTheme.outgoingTime } : { color: activeTheme.incomingTime },
              ]}
            >
              {formatMessageTime(message.created_at)}
            </Text>
          </Pressable>
        </View>
      );
    },
    [
      activeTheme.accent,
      activeTheme.cardPartnerIconBg,
      activeTheme.incomingBorder,
      activeTheme.incomingBubble,
      activeTheme.incomingBubbleText,
      activeTheme.incomingSecondaryText,
      activeTheme.incomingTime,
      activeTheme.outgoingBubble,
      activeTheme.outgoingBubbleText,
      activeTheme.outgoingTime,
      handleMessageLongPress,
      openExternalUrl,
      profile?.id,
      renderFavoriteBadge,
    ]
  );

  type VoiceMessageBubbleProps = {
    message: any;
    messageId: string;
    isOwnMessage: boolean;
    audioUrl: string;
    durationMs?: number | null;
    createdAt: string;
  };

  const VoiceMessageBubble = ({
    message,
    messageId,
    isOwnMessage,
    audioUrl,
    durationMs,
    createdAt,
  }: VoiceMessageBubbleProps) => {
    const isActive = activeAudioMessageId === messageId;
    const player = useAudioPlayer(audioUrl, { updateInterval: 250, downloadFirst: true });
    const status = useAudioPlayerStatus(player);

    useEffect(() => {
      if (!isActive && status.playing) {
        player.pause();
      }
    }, [isActive, player, status.playing]);

    useEffect(() => {
      if (!isActive) return;
      if (status.duration > 0 && !status.playing && status.currentTime >= status.duration) {
        setActiveAudioMessageId(null);
        player.seekTo(0);
      }
    }, [isActive, player, status.currentTime, status.duration, status.playing]);

    const handleTogglePlay = () => {
      if (!audioUrl) return;

      if (isActive && status.playing) {
        player.pause();
        setActiveAudioMessageId(null);
        return;
      }

      setActiveAudioMessageId(messageId);

      if (status.duration > 0 && status.currentTime >= status.duration) {
        player.seekTo(0);
      }
      player.play();
    };

    const resolvedDurationMs =
      typeof durationMs === 'number' && Number.isFinite(durationMs)
        ? durationMs
        : typeof status.duration === 'number' && Number.isFinite(status.duration)
          ? Math.floor(status.duration * 1000)
          : 0;
    const currentMs =
      typeof status.currentTime === 'number' && Number.isFinite(status.currentTime)
        ? Math.max(0, Math.floor(status.currentTime * 1000))
        : 0;
    const progressRatio =
      resolvedDurationMs > 0 ? Math.min(1, Math.max(0, currentMs / resolvedDurationMs)) : 0;
    const bubbleWidth = getVoiceBubbleWidth(resolvedDurationMs);

    const isThisPlaying = isActive && status.playing;

    return (
      <View style={[s.msgRow, isOwnMessage ? s.rowMe : s.rowPartner]}>
        <Pressable
          onLongPress={() => handleMessageLongPress(message)}
          delayLongPress={240}
          style={[
            s.bubble,
            isOwnMessage ? s.bubbleMe : s.bubblePartner,
            s.audioBubble,
            isOwnMessage
              ? { backgroundColor: activeTheme.outgoingBubble }
              : { backgroundColor: activeTheme.incomingBubble, borderColor: activeTheme.incomingBorder },
            { width: bubbleWidth },
          ]}
        >
          {renderFavoriteBadge(message)}
          <View style={s.audioMainRow}>
            <Pressable
              style={[
                s.audioPlayBtn,
                isOwnMessage ? s.audioPlayBtnMe : s.audioPlayBtnPartner,
                isOwnMessage
                  ? { backgroundColor: activeTheme.voiceOwnPlayBg }
                  : { backgroundColor: activeTheme.voicePartnerPlayBg, borderColor: activeTheme.incomingBorder },
              ]}
              onPress={handleTogglePlay}
            >
              {isThisPlaying ? (
                <Pause size={16} color={isOwnMessage ? activeTheme.outgoingBubbleText : activeTheme.voicePartnerIcon} />
              ) : (
                <Play size={16} color={isOwnMessage ? activeTheme.outgoingBubbleText : activeTheme.voicePartnerIcon} />
              )}
            </Pressable>

            <View style={s.audioProgressWrap}>
              <View
                style={[
                  s.audioProgressTrack,
                  isOwnMessage ? s.audioProgressTrackMe : s.audioProgressTrackPartner,
                  isOwnMessage ? { backgroundColor: activeTheme.voiceOwnTrack } : { backgroundColor: activeTheme.voicePartnerTrack },
                ]}
              >
                <View
                  style={[
                    s.audioProgressFill,
                    isOwnMessage ? s.audioProgressFillMe : s.audioProgressFillPartner,
                    isOwnMessage ? { backgroundColor: activeTheme.voiceOwnFill } : { backgroundColor: activeTheme.voicePartnerFill },
                    { width: `${progressRatio * 100}%` },
                  ]}
                />
                <View
                  style={[
                    s.audioProgressThumb,
                    isOwnMessage ? s.audioProgressThumbMe : s.audioProgressThumbPartner,
                    isOwnMessage ? { backgroundColor: activeTheme.voiceOwnThumb } : { backgroundColor: activeTheme.voicePartnerThumb },
                    { left: `${progressRatio * 100}%` },
                  ]}
                />
              </View>
            </View>

            <View style={s.audioDurationWrap}>
              <Text
                style={[
                  s.audioDuration,
                  isOwnMessage ? s.audioDurationMe : s.audioDurationPartner,
                  isOwnMessage ? { color: activeTheme.outgoingBubbleText } : { color: activeTheme.incomingBubbleText },
                ]}
              >
                {formatDurationMs(resolvedDurationMs)}
              </Text>
            </View>
          </View>

          <Text
            style={[
              s.timeTxt,
              isOwnMessage ? s.timeMe : s.timePartner,
              s.audioTimestamp,
              isOwnMessage ? { color: activeTheme.outgoingTime } : { color: activeTheme.incomingTime },
            ]}
          >
            {formatMessageTime(createdAt)}
          </Text>
        </Pressable>
      </View>
    );
  };

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
            onLongPress={() => handleMessageLongPress(message)}
            delayLongPress={240}
            style={[s.bubble, isMe ? s.bubbleMe : s.bubblePartner, s.momentMessageBubble]}
          >
            {previewUrl ? (
              <ImageBackground
                source={{ uri: previewUrl }}
                style={s.chatMomentPreview}
                imageStyle={s.chatMomentPreviewImage}
              >
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

            <Text style={[s.timeTxt, isMe ? s.timeMe : s.timePartner]}>{formatMessageTime(message.created_at)}</Text>
          </Pressable>
        </View>
      );
    },
    [handleMessageLongPress, openMomentFromChat, profile?.id]
  );

  const subscribeToMessages = () => {
    return supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `couple_id=eq.${couple?.couple_id}`,
        },
        (payload) => {
          setMessages((prev) => {
            if (prev.find((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !couple?.couple_id || !profile?.id) return;
    const text = inputText.trim();
    setInputText('');
    closeComposerPanel();

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          couple_id: couple.couple_id,
          sender_id: profile.id,
          content: text,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setMessages((prev) => {
          if (prev.find((m) => m.id === data.id)) return prev;
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
      style={[s.container, { backgroundColor: SCREEN_BG }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <MessagesHeader
        partnerName={currentChatName}
        partnerAvatar={partnerAvatar}
        onBackPress={() => router.back()}
        onSearchPress={handleSearchToggle}
        onStartAudioCall={handleStartAudioCall}
        onStartVideoCall={handleStartVideoCall}
        onOptionsPress={handleOptionsMenuPress}
        isStartingCall={isStartingCall}
        canStartCall={canStartCall}
        topInset={insets.top}
      />

      {showSearchBar && (
        <MessagesSearchBar
          searchQuery={searchQuery}
          onChangeText={setSearchQuery}
          onClose={handleSearchClose}
        />
      )}

      {currentChatBackgroundImageUri ? (
        <ImageBackground
          source={{ uri: currentChatBackgroundImageUri }}
          style={s.chatImageBackground}
          resizeMode="cover"
        >
          {currentChatBackgroundImageOverlay ? (
            <View
              pointerEvents="none"
              style={[
                s.chatImageOverlay,
                {
                  backgroundColor: currentChatBackgroundImageOverlay.color,
                  opacity: currentChatBackgroundImageOverlay.opacity,
                },
              ]}
            />
          ) : null}
          <ScrollView
            ref={scrollViewRef}
            style={[s.chatArea, { backgroundColor: 'transparent' }]}
            contentContainerStyle={[s.chatContent, { paddingBottom: chatPaddingBottom, backgroundColor: 'transparent' }]}
            onContentSizeChange={() =>
              scrollViewRef.current?.scrollToEnd({ animated: true })
            }
            onScrollBeginDrag={() => {
              if (activeComposerPanel) closeComposerPanel();
            }}
          >
            {loading ? (
              <ActivityIndicator color={USER_BUBBLE} style={{ marginTop: 30 }} />
            ) : filteredMessages.length === 0 && searchQuery ? (
              <Text style={s.noResultsText}>No se encontraron mensajes.</Text>
            ) : (
              filteredMessages.map((m, idx) => {
                const isMe = m.sender_id === profile?.id;
                const parsedMemoryShare = parseMemoryShareMessage(m.content);
                if (m.message_type === 'audio' && m.media_url) {
                  return (
                    <VoiceMessageBubble
                      key={m.id || idx}
                      message={m}
                      messageId={String(m.id || idx)}
                      isOwnMessage={m.sender_id === profile?.id}
                      audioUrl={String(m.media_url || '')}
                      durationMs={m.duration_ms}
                      createdAt={String(m.created_at || '')}
                    />
                  );
                }
                if (m.message_type === 'image' && m.media_url) {
                  return renderImageMessage(m, String(m.id || idx));
                }
                if (m.message_type === 'video' && m.media_url) {
                  return renderVideoMessage(m, String(m.id || idx));
                }
                if (m.message_type === 'document' && m.media_url) {
                  return renderDocumentMessage(m, String(m.id || idx));
                }
                if (m.message_type === 'location') {
                  return renderLocationMessage(m, String(m.id || idx));
                }
                if (m.message_type === 'contact') {
                  return renderContactMessage(m, String(m.id || idx));
                }
                if (m.message_type === 'saved') {
                  return renderSavedMessage(m, String(m.id || idx));
                }
                if (m.message_type === 'moment' || parsedMemoryShare) {
                  return renderMomentMessage(m, String(m.id || idx), parsedMemoryShare);
                }
                return (
                  <View key={m.id || idx} style={[s.msgRow, isMe ? s.rowMe : s.rowPartner]}>
                    <Pressable
                      onLongPress={() => handleMessageLongPress(m)}
                      delayLongPress={240}
                      style={[
                        s.bubble,
                        isMe ? s.bubbleMe : s.bubblePartner,
                        isMe
                          ? { backgroundColor: activeTheme.outgoingBubble }
                          : { backgroundColor: activeTheme.incomingBubble, borderColor: activeTheme.incomingBorder },
                      ]}
                    >
                      {renderFavoriteBadge(m)}
                      <Text
                        style={[
                          s.msgTxt,
                          isMe ? s.txtMe : s.txtPartner,
                          isMe ? { color: activeTheme.outgoingBubbleText } : { color: activeTheme.incomingBubbleText },
                        ]}
                      >
                        {m.content}
                      </Text>
                      <Text
                        style={[
                          s.timeTxt,
                          isMe ? s.timeMe : s.timePartner,
                          isMe ? { color: activeTheme.outgoingTime } : { color: activeTheme.incomingTime },
                        ]}
                      >
                        {formatMessageTime(m.created_at)}
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </ScrollView>
        </ImageBackground>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={[s.chatArea, { backgroundColor: currentChatBackground }]}
          contentContainerStyle={[s.chatContent, { paddingBottom: chatPaddingBottom, backgroundColor: currentChatBackground }]}
          onContentSizeChange={() =>
            scrollViewRef.current?.scrollToEnd({ animated: true })
          }
          onScrollBeginDrag={() => {
            if (activeComposerPanel) closeComposerPanel();
          }}
        >
        {loading ? (
          <ActivityIndicator color={USER_BUBBLE} style={{ marginTop: 30 }} />
        ) : filteredMessages.length === 0 && searchQuery ? (
          <Text style={s.noResultsText}>No se encontraron mensajes.</Text>
        ) : (
          filteredMessages.map((m, idx) => {
            const isMe = m.sender_id === profile?.id;
            const parsedMemoryShare = parseMemoryShareMessage(m.content);
            if (m.message_type === 'audio' && m.media_url) {
              return (
                <VoiceMessageBubble
                  key={m.id || idx}
                  message={m}
                  messageId={String(m.id || idx)}
                  isOwnMessage={m.sender_id === profile?.id}
                  audioUrl={String(m.media_url || '')}
                  durationMs={m.duration_ms}
                  createdAt={String(m.created_at || '')}
                />
              );
            }
            if (m.message_type === 'image' && m.media_url) {
              return renderImageMessage(m, String(m.id || idx));
            }
            if (m.message_type === 'video' && m.media_url) {
              return renderVideoMessage(m, String(m.id || idx));
            }
            if (m.message_type === 'document' && m.media_url) {
              return renderDocumentMessage(m, String(m.id || idx));
            }
            if (m.message_type === 'location') {
              return renderLocationMessage(m, String(m.id || idx));
            }
            if (m.message_type === 'contact') {
              return renderContactMessage(m, String(m.id || idx));
            }
            if (m.message_type === 'saved') {
              return renderSavedMessage(m, String(m.id || idx));
            }
            if (m.message_type === 'moment' || parsedMemoryShare) {
              return renderMomentMessage(m, String(m.id || idx), parsedMemoryShare);
            }
            return (
              <View key={m.id || idx} style={[s.msgRow, isMe ? s.rowMe : s.rowPartner]}>
                <Pressable
                  onLongPress={() => handleMessageLongPress(m)}
                  delayLongPress={240}
                  style={[
                    s.bubble,
                    isMe ? s.bubbleMe : s.bubblePartner,
                    isMe
                      ? { backgroundColor: activeTheme.outgoingBubble }
                      : { backgroundColor: activeTheme.incomingBubble, borderColor: activeTheme.incomingBorder },
                  ]}
                >
                  {renderFavoriteBadge(m)}
                  <Text
                    style={[
                      s.msgTxt,
                      isMe ? s.txtMe : s.txtPartner,
                      isMe ? { color: activeTheme.outgoingBubbleText } : { color: activeTheme.incomingBubbleText },
                    ]}
                  >
                    {m.content}
                  </Text>
                  <Text
                    style={[
                      s.timeTxt,
                      isMe ? s.timeMe : s.timePartner,
                      isMe ? { color: activeTheme.outgoingTime } : { color: activeTheme.incomingTime },
                    ]}
                  >
                    {formatMessageTime(m.created_at)}
                  </Text>
                </Pressable>
              </View>
            );
          })
        )}
        </ScrollView>
      )}

      <View onLayout={(e) => setComposerHeight(e.nativeEvent.layout.height)}>
        <MessagesComposer
          inputText={inputText}
          onChangeText={setInputText}
          onSend={sendMessage}
          onCameraPress={handleCameraPress}
          onPlusPress={() => requestOpenPanel('attachments')}
          onStickerPress={() => requestOpenPanel('stickers')}
          onVoicePress={() => {
            if (!inputText.trim()) {
              void startVoiceRecording();
            }
          }}
          inputRef={inputRef}
          onInputFocus={() => {
            if (activeComposerPanel && !isSwitchingFromPanelToKeyboardRef.current) {
              inputRef.current?.blur();
              handleInputRequestFocus();
              return;
            }
          }}
          isPanelOpen={activeComposerPanel !== null}
          onInputPressWhenPanelOpen={handleInputRequestFocus}
          isRecording={isRecording}
          recordingSeconds={recordingSeconds}
          onCancelRecording={() => {
            void cancelVoiceRecording();
          }}
          onSendRecording={() => {
            void sendVoiceRecording();
          }}
          bottomInset={insets.bottom}
          themeColors={{
            containerBackground: activeTheme.composerBackground,
            surfaceBackground: activeTheme.composerSurface,
            borderColor: activeTheme.composerBorder,
            inputTextColor: activeTheme.composerText,
            placeholderTextColor: activeTheme.composerPlaceholder,
            mutedIconColor: activeTheme.composerIcon,
            sendButtonColor: activeTheme.sendButton,
            recordingSurface: activeTheme.recordingSurface,
            recordingTextColor: activeTheme.composerText,
            recordingMutedTextColor: activeTheme.composerPlaceholder,
          }}
        />
      </View>

      <View
        pointerEvents={activeComposerPanel ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, { bottom: panelBottomOffset }]}
      >
        <Pressable style={s.composerPanelBackdrop} onPress={closeComposerPanel} />
        <Animated.View
          style={[
            s.composerPanelContainer,
            {
              opacity: panelAnim,
              transform: [
                {
                  translateY: panelAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [PANEL_HEIGHT + 24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {(() => {
            const renderPanel = activeComposerPanel ?? lastPanelRef.current;
            if (renderPanel === 'stickers') {
              return (
                <View style={s.stickerMenu}>
                  <View style={s.stickerHandle} />
                  <Text style={s.stickerTitle}>Stickers</Text>
                  <View style={s.stickerOptions}>
                    {stickers.map((sticker, idx) => (
                      <Pressable
                        key={idx}
                        style={s.stickerOption}
                        onPress={() => handleStickerPress(sticker)}
                      >
                        <Text style={s.stickerEmoji}>{sticker}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            }

            return (
              <View style={s.attachmentMenu}>
                <View style={s.attachmentHandle} />
                <Text style={s.attachmentTitle}>¿Qué quieres compartir?</Text>
                <View style={s.attachmentOptions}>
                  <Pressable style={s.attachmentOption} onPress={handleGalleryOptionPress} disabled={isAttachmentBusy}>
                    <View style={[s.attachmentIconWrap, { backgroundColor: '#FFF5EB' }]}>
                      <ImageIcon size={17} color={Colors.light.tint} />
                    </View>
                    <Text style={s.attachmentOptionText} numberOfLines={2}>
                      Galería
                    </Text>
                  </Pressable>

                  <Pressable style={s.attachmentOption} onPress={handleLocationOptionPress} disabled={isAttachmentBusy}>
                    <View style={[s.attachmentIconWrap, { backgroundColor: '#F7F2FF' }]}>
                      <MapPin size={17} color={Colors.light.tint} />
                    </View>
                    <Text style={s.attachmentOptionText} numberOfLines={2}>
                      Ubicación
                    </Text>
                  </Pressable>

                  <Pressable style={s.attachmentOption} onPress={handleContactOptionPress} disabled={isAttachmentBusy}>
                    <View style={[s.attachmentIconWrap, { backgroundColor: '#F5F7FF' }]}>
                      <UserRound size={17} color={Colors.light.tint} />
                    </View>
                    <Text style={s.attachmentOptionText} numberOfLines={2}>
                      Contacto
                    </Text>
                  </Pressable>

                  <Pressable style={s.attachmentOption} onPress={handleDocumentOptionPress} disabled={isAttachmentBusy}>
                    <View style={[s.attachmentIconWrap, { backgroundColor: '#F0F8FF' }]}>
                      <FileText size={17} color={Colors.light.tint} />
                    </View>
                    <Text style={s.attachmentOptionText} numberOfLines={2}>
                      Documento
                    </Text>
                  </Pressable>

                  <Pressable style={s.attachmentOption} onPress={handleSavedOptionPress} disabled={isAttachmentBusy}>
                    <View style={[s.attachmentIconWrap, { backgroundColor: '#FFF8F0' }]}>
                      <Bookmark size={17} color={Colors.light.tint} />
                    </View>
                    <Text style={s.attachmentOptionText} numberOfLines={2}>
                      Guardados
                    </Text>
                  </Pressable>

                  <Pressable style={s.attachmentOption} onPress={handleFavoriteMessagesOptionPress} disabled={isAttachmentBusy}>
                    <View style={[s.attachmentIconWrap, { backgroundColor: '#FFF0F4' }]}>
                      <Heart size={17} color={Colors.light.tint} />
                    </View>
                    <Text style={s.attachmentOptionText} numberOfLines={2}>
                      Mensajes favoritos
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })()}
        </Animated.View>
      </View>

      {isOptionsMenuOpen ? (
        <View style={s.optionsDropdownOverlay} pointerEvents="box-none">
          <Pressable style={s.optionsDropdownBackdrop} onPress={() => handleOptionsMenuClose()} />
          <Animated.View
            style={[
              s.optionsDropdown,
              {
                top: optionsDropdownTop,
                right: 16,
                width: optionsDropdownWidth,
                opacity: optionsAnim,
                transform: [
                  {
                    translateY: optionsAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-8, 0],
                    }),
                  },
                  {
                    scale: optionsAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.98, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={s.optionsMenuList}>
              {optionsMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Pressable
                    key={item.key}
                    style={s.optionsMenuRow}
                    onPress={() => handleOptionsMenuItemPress(item.key)}
                  >
                    <View style={s.optionsMenuRowLeft}>
                      <View style={s.optionsMenuIconWrap}>
                        <Icon size={17} color={Colors.light.textMuted} />
                      </View>
                      <View style={s.optionsMenuTextWrap}>
                        <Text style={s.optionsMenuTitle}>{item.title}</Text>
                      </View>
                    </View>
                    <ChevronRight size={16} color={TEXT_MUTED} />
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </View>
      ) : null}

      {activeOptionsPanel ? (
        <Animated.View
          style={[
            s.optionsPageContainer,
            {
              backgroundColor: SETTINGS_PAGE_BACKGROUND,
              opacity: optionsPageOpacity,
              transform: [{ translateX: optionsPageTranslateX }],
            },
          ]}
        >
          <View style={[s.optionsPageHeader, { paddingTop: insets.top + 6 }]}>
            <Pressable style={s.optionsPageBackButton} onPress={handleOptionsPageBack}>
              <ChevronLeft size={20} color={TEXT_DARK} />
            </Pressable>
            <Text style={s.optionsPageTitle}>{activeOptionsPageTitle}</Text>
            <View style={s.optionsPageHeaderSpacer} />
          </View>

          <ScrollView
            style={[s.optionsPageScroll, { backgroundColor: SETTINGS_PAGE_BACKGROUND }]}
            contentContainerStyle={[
              s.optionsPageContent,
              {
                paddingBottom: Math.max(insets.bottom + 28, 36),
                backgroundColor: SETTINGS_PAGE_BACKGROUND,
              },
            ]}
          >
            {activeOptionsPanel === 'chat_settings' ? (
              <View>
                {isLoadingSettings ? (
                  <ActivityIndicator color={Colors.light.tint} style={{ marginTop: 12 }} />
                ) : (
                  <>
                    <Text style={s.settingsSectionTitle}>Información</Text>
                    <View style={s.settingsSectionCard}>
                      <View style={s.chatProfileCard}>
                        {partnerAvatar ? (
                          <Image source={{ uri: partnerAvatar }} style={s.chatProfileAvatar} />
                        ) : (
                          <View style={[s.chatProfileAvatar, s.chatProfileAvatarFallback]}>
                            <Text style={s.chatProfileAvatarInitial}>{currentChatName.charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                        <View style={s.chatProfileTextWrap}>
                          <Text style={s.chatProfileTitle}>{currentChatName}</Text>
                          <Text style={s.chatProfileStatus}>en línea ahora</Text>
                          <Text style={s.chatProfileSubtitle}>Chat privado de pareja</Text>
                        </View>
                      </View>

                      <View style={s.settingsDivider} />

                      <Pressable
                        style={s.settingsSelectorRow}
                        onPress={() => {
                          setExpandedChatSettingsSection((prev) => (prev === 'nickname' ? null : 'nickname'));
                          setIsEditingChatNickname(true);
                        }}
                      >
                        <View style={[s.settingsRowIconWrap, { backgroundColor: '#FFF0F4' }]}>
                          <Pencil size={16} color={Colors.light.tint} />
                        </View>
                        <View style={s.settingsTextWrap}>
                          <Text style={s.settingsRowTitle}>Nombre del chat</Text>
                          <Text style={s.settingsRowSubtitle}>{currentChatName}</Text>
                        </View>
                        <ChevronRight size={17} color={TEXT_MUTED} />
                      </Pressable>

                      {isEditingChatNickname ? (
                        <>
                          <View style={s.settingsDivider} />
                          <View style={s.inlineEditorCard}>
                            <TextInput
                              value={chatNicknameDraft}
                              onChangeText={setChatNicknameDraft}
                              placeholder="Nombre del chat"
                              placeholderTextColor={TEXT_MUTED}
                              style={s.inlineEditorInput}
                              autoFocus
                            />
                            <View style={s.inlineEditorActions}>
                              <Pressable
                                style={[s.inlineEditorButton, s.inlineEditorButtonGhost]}
                                onPress={() => {
                                  setIsEditingChatNickname(false);
                                  setChatNicknameDraft(currentChatName);
                                }}
                              >
                                <Text style={s.inlineEditorButtonGhostText}>Cancelar</Text>
                              </Pressable>
                              <Pressable style={s.inlineEditorButton} onPress={() => void handleSaveChatNickname()}>
                                <Text style={s.inlineEditorButtonText}>Guardar</Text>
                              </Pressable>
                            </View>
                          </View>
                        </>
                      ) : null}
                    </View>

                    <Text style={s.settingsSectionTitle}>Personalización</Text>
                    <View style={s.settingsSectionCard}>
                      <Pressable style={s.settingsSelectorRow} onPress={() => openOptionsPanel('themes')}>
                        <View style={[s.settingsRowIconWrap, { backgroundColor: '#FFF0F6' }]}>
                          <PaletteIcon size={16} color={Colors.light.tint} />
                        </View>
                        <View style={s.settingsTextWrap}>
                          <Text style={s.settingsRowTitle}>Tema del chat</Text>
                          <Text style={s.settingsRowSubtitle}>{getThemeLabel(chatSettings.theme_key)}</Text>
                        </View>
                        <ChevronRight size={17} color={TEXT_MUTED} />
                      </Pressable>

                      <View style={s.settingsDivider} />

                      <Pressable
                        style={s.settingsSelectorRow}
                        onPress={() =>
                          setExpandedChatSettingsSection((prev) => (prev === 'wallpaper' ? null : 'wallpaper'))
                        }
                      >
                        <View style={[s.settingsRowIconWrap, { backgroundColor: '#FFF5EB' }]}>
                          <ImageIcon size={16} color={Colors.light.tint} />
                        </View>
                        <View style={s.settingsTextWrap}>
                          <Text style={s.settingsRowTitle}>Fondo del chat</Text>
                          <Text style={s.settingsRowSubtitle}>Elige un fondo para esta conversación</Text>
                        </View>
                        <ChevronRight size={17} color={TEXT_MUTED} />
                      </Pressable>

                      {expandedChatSettingsSection === 'wallpaper' ? (
                        <>
                          <View style={s.settingsDivider} />
                          <View style={s.selectorCard}>
                            {wallpaperChoices.map((wallpaper, index) => {
                              const isSelected = chatSettings.wallpaper_key === wallpaper.key;
                              return (
                                <React.Fragment key={wallpaper.key}>
                                  <Pressable
                                    style={[s.selectorOption, isSelected ? s.selectorOptionSelected : null]}
                                    onPress={() => void handleWallpaperSelect(wallpaper.key)}
                                  >
                                    <View
                                      style={[s.wallpaperPreview, { backgroundColor: WALLPAPER_PRESETS[wallpaper.key] }]}
                                    />
                                    <Text style={s.selectorOptionText}>{wallpaper.title}</Text>
                                    {isSelected ? <Check size={16} color={Colors.light.tint} /> : null}
                                  </Pressable>
                                  {index < wallpaperChoices.length - 1 ? <View style={s.selectorDivider} /> : null}
                                </React.Fragment>
                              );
                            })}
                          </View>
                          <View style={s.settingsDivider} />
                        </>
                      ) : (
                        <View style={s.settingsDivider} />
                      )}

                      <Pressable style={s.settingsSelectorRow} onPress={() => openOptionsPanel('themes')}>
                        <View style={[s.settingsRowIconWrap, { backgroundColor: '#F9EEF9' }]}>
                          <Sparkles size={16} color={Colors.light.tint} />
                        </View>
                        <View style={s.settingsTextWrap}>
                          <Text style={s.settingsRowTitle}>Color de burbujas</Text>
                          <Text style={s.settingsRowSubtitle}>Personaliza tus mensajes</Text>
                        </View>
                        <ChevronRight size={17} color={TEXT_MUTED} />
                      </Pressable>
                    </View>

                    <Text style={s.settingsSectionTitle}>Notificaciones</Text>
                    <View style={s.settingsSectionCard}>
                      <Pressable
                        style={s.settingsSelectorRow}
                        onPress={() =>
                          setExpandedChatSettingsSection((prev) => (prev === 'notifications' ? null : 'notifications'))
                        }
                      >
                        <View style={[s.settingsRowIconWrap, { backgroundColor: '#FFF5EB' }]}>
                          <Bell size={16} color={Colors.light.tint} />
                        </View>
                        <View style={s.settingsTextWrap}>
                          <Text style={s.settingsRowTitle}>Notificaciones</Text>
                          <Text style={s.settingsRowSubtitle}>{getNotificationStatusLabel(chatSettings)}</Text>
                        </View>
                        <ChevronRight size={17} color={TEXT_MUTED} />
                      </Pressable>

                      {expandedChatSettingsSection === 'notifications' ? (
                        <>
                          <View style={s.settingsDivider} />
                          <View style={s.selectorCard}>
                            {NOTIFICATION_OPTIONS.map((option, index) => {
                              const isSelected = getSelectedNotificationOptionKey(chatSettings) === option.key;
                              return (
                                <React.Fragment key={option.key}>
                                  <Pressable
                                    style={[s.selectorOption, isSelected ? s.selectorOptionSelected : null]}
                                    onPress={() => void handleNotificationOptionSelect(option)}
                                  >
                                    <Text style={s.selectorOptionText}>{option.title}</Text>
                                    {isSelected ? <Check size={16} color={Colors.light.tint} /> : null}
                                  </Pressable>
                                  {index < NOTIFICATION_OPTIONS.length - 1 ? <View style={s.selectorDivider} /> : null}
                                </React.Fragment>
                              );
                            })}
                          </View>
                        </>
                      ) : null}

                      <View style={s.settingsDivider} />

                      <View style={s.settingsRow}>
                        <View style={s.settingsRowInline}>
                          <View style={[s.settingsRowIconWrap, { backgroundColor: '#FFF0F4' }]}>
                            <Bell size={16} color={Colors.light.tint} />
                          </View>
                          <View style={s.settingsTextWrap}>
                            <Text style={s.settingsRowTitle}>Sonidos del chat</Text>
                          </View>
                        </View>
                        <Switch
                          value={chatSettings.sound_enabled}
                          onValueChange={(value) => void handleSoundEnabledChange(value)}
                          trackColor={{ false: '#EADDE2', true: '#E9B7C7' }}
                          thumbColor="#FFFFFF"
                        />
                      </View>
                    </View>

                    <Text style={s.settingsSectionTitle}>Privacidad</Text>
                    <View style={s.settingsSectionCard}>
                      <Pressable
                        style={s.settingsSelectorRow}
                        onPress={() =>
                          setExpandedChatSettingsSection((prev) => (prev === 'disappearing' ? null : 'disappearing'))
                        }
                      >
                        <View style={[s.settingsRowIconWrap, { backgroundColor: '#F7F2FF' }]}>
                          <TimerReset size={16} color={Colors.light.tint} />
                        </View>
                        <View style={s.settingsTextWrap}>
                          <Text style={s.settingsRowTitle}>Mensajes temporales</Text>
                          <Text style={s.settingsRowSubtitle}>{getDisappearingStatusLabel(chatSettings)}</Text>
                        </View>
                        <ChevronRight size={17} color={TEXT_MUTED} />
                      </Pressable>

                      {expandedChatSettingsSection === 'disappearing' ? (
                        <>
                          <View style={s.settingsDivider} />
                          <View style={s.selectorCard}>
                            {DISAPPEARING_OPTIONS.map((option, index) => {
                              const isSelected =
                                option.enabled === chatSettings.disappearing_enabled &&
                                option.seconds === chatSettings.disappearing_timer_seconds;
                              return (
                                <React.Fragment key={option.key}>
                                  <Pressable
                                    style={[s.selectorOption, isSelected ? s.selectorOptionSelected : null]}
                                    onPress={() => void handleDisappearingOptionSelect(option)}
                                  >
                                    <Text style={s.selectorOptionText}>{option.title}</Text>
                                    {isSelected ? <Check size={16} color={Colors.light.tint} /> : null}
                                  </Pressable>
                                  {index < DISAPPEARING_OPTIONS.length - 1 ? <View style={s.selectorDivider} /> : null}
                                </React.Fragment>
                              );
                            })}
                          </View>
                        </>
                      ) : null}

                      <View style={s.settingsDivider} />

                      <View style={s.settingsRow}>
                        <View style={s.settingsRowInline}>
                          <View style={[s.settingsRowIconWrap, { backgroundColor: '#F5F7FF' }]}>
                            <Lock size={16} color={Colors.light.tint} />
                          </View>
                          <View style={s.settingsTextWrap}>
                            <Text style={s.settingsRowTitle}>Bloquear chat</Text>
                          </View>
                        </View>
                        <Switch
                          value={chatSettings.lock_enabled}
                          onValueChange={(value) => void handleLockEnabledChange(value)}
                          trackColor={{ false: '#EADDE2', true: '#E9B7C7' }}
                          thumbColor="#FFFFFF"
                        />
                      </View>

                      <View style={s.settingsDivider} />

                      <View style={s.settingsRow}>
                        <View style={s.settingsRowInline}>
                          <View style={[s.settingsRowIconWrap, { backgroundColor: '#FFF5EB' }]}>
                            <Shield size={16} color={Colors.light.tint} />
                          </View>
                          <View style={s.settingsTextWrap}>
                            <Text style={s.settingsRowTitle}>Confirmar antes de eliminar</Text>
                          </View>
                        </View>
                        <Switch
                          value={chatSettings.confirm_before_delete}
                          onValueChange={(value) => void handleConfirmBeforeDeleteChange(value)}
                          trackColor={{ false: '#EADDE2', true: '#E9B7C7' }}
                          thumbColor="#FFFFFF"
                        />
                      </View>
                    </View>

                    <Text style={s.settingsSectionTitle}>Multimedia</Text>
                    <View style={s.settingsSectionCard}>
                      <Pressable style={s.settingsSelectorRow} onPress={() => openOptionsPanel('shared_media')}>
                        <View style={[s.settingsRowIconWrap, { backgroundColor: '#FFF0F4' }]}>
                          <Images size={16} color={Colors.light.tint} />
                        </View>
                        <View style={s.settingsTextWrap}>
                          <Text style={s.settingsRowTitle}>Multimedia compartida</Text>
                          <Text style={s.settingsRowSubtitle}>Fotos, videos y documentos</Text>
                        </View>
                        <ChevronRight size={17} color={TEXT_MUTED} />
                      </Pressable>

                      <View style={s.settingsDivider} />

                      <View style={s.settingsRow}>
                        <View style={s.settingsRowInline}>
                          <View style={[s.settingsRowIconWrap, { backgroundColor: '#F7F2FF' }]}>
                            <Download size={16} color={Colors.light.tint} />
                          </View>
                          <View style={s.settingsTextWrap}>
                            <Text style={s.settingsRowTitle}>Guardar multimedia automáticamente</Text>
                          </View>
                        </View>
                        <Switch
                          value={chatSettings.auto_save_media}
                          onValueChange={(value) => void handleAutoSaveMediaChange(value)}
                          trackColor={{ false: '#EADDE2', true: '#E9B7C7' }}
                          thumbColor="#FFFFFF"
                        />
                      </View>

                      <View style={s.settingsDivider} />

                      <Pressable style={s.settingsSelectorRow} onPress={handleStoragePlaceholderPress}>
                        <View style={[s.settingsRowIconWrap, { backgroundColor: '#FFF5EB' }]}>
                          <FileText size={16} color={Colors.light.tint} />
                        </View>
                        <View style={s.settingsTextWrap}>
                          <Text style={s.settingsRowTitle}>Uso de almacenamiento</Text>
                          <Text style={s.settingsRowSubtitle}>Revisa archivos grandes</Text>
                        </View>
                        <ChevronRight size={17} color={TEXT_MUTED} />
                      </Pressable>
                    </View>

                    <Text style={s.settingsSectionTitle}>Acciones</Text>
                    <View style={s.settingsSectionCard}>
                      <Pressable style={s.settingsSelectorRow} onPress={handleOpenChatSearchFromSettings}>
                        <View style={[s.settingsRowIconWrap, { backgroundColor: '#FFF0F4' }]}>
                          <Search size={16} color={Colors.light.tint} />
                        </View>
                        <View style={s.settingsTextWrap}>
                          <Text style={s.settingsRowTitle}>Buscar en el chat</Text>
                        </View>
                        <ChevronRight size={17} color={TEXT_MUTED} />
                      </Pressable>

                      <View style={s.settingsDivider} />

                      <Pressable style={s.settingsSelectorRow} onPress={handleOpenFavoritesFromSettings}>
                        <View style={[s.settingsRowIconWrap, { backgroundColor: '#FFF5EB' }]}>
                          <Heart size={16} color={Colors.light.tint} />
                        </View>
                        <View style={s.settingsTextWrap}>
                          <Text style={s.settingsRowTitle}>Mensajes favoritos</Text>
                        </View>
                        <ChevronRight size={17} color={TEXT_MUTED} />
                      </Pressable>

                      <View style={s.settingsDivider} />

                      <Pressable style={s.settingsSelectorRow} onPress={handleExportChatPress}>
                        <View style={[s.settingsRowIconWrap, { backgroundColor: '#F7F2FF' }]}>
                          <Download size={16} color={Colors.light.tint} />
                        </View>
                        <View style={s.settingsTextWrap}>
                          <Text style={s.settingsRowTitle}>Exportar chat</Text>
                        </View>
                        <ChevronRight size={17} color={TEXT_MUTED} />
                      </Pressable>

                      <View style={s.settingsDivider} />

                      <Pressable style={s.settingsSelectorRow} onPress={handleClearChatPress}>
                        <View style={[s.settingsRowIconWrap, s.settingsRowIconWrapDestructive]}>
                          <Trash2 size={16} color="#C26D87" />
                        </View>
                        <View style={s.settingsTextWrap}>
                          <Text style={[s.settingsRowTitle, s.settingsRowTitleDestructive]}>Limpiar chat</Text>
                        </View>
                        <ChevronRight size={17} color="#D09AA8" />
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            ) : null}

            {activeOptionsPanel === 'themes' ? (
              activeThemeEditorPage === 'bubbles' ? (
                <View>
                  <Text style={s.settingsSectionTitle}>Vista previa</Text>
                  <View style={s.settingsSectionCard}>
                    <View style={[s.themePreviewCard, { backgroundColor: activeTheme.chatBackground }]}>
                      <View style={s.themePreviewHeader}>
                        <Text style={[s.themePreviewHeaderText, { color: activeTheme.incomingSecondaryText }]}>Burbujas del chat</Text>
                        <View style={[s.themePreviewAccentDot, { backgroundColor: activeTheme.accent }]} />
                      </View>
                      <View style={[s.themePreviewBubblePartner, { backgroundColor: activeTheme.incomingBubble, borderColor: activeTheme.incomingBorder }]}>
                        <Text style={[s.themePreviewBubbleText, { color: activeTheme.incomingBubbleText }]}>Hola amor</Text>
                        <Text style={[s.themePreviewTimestamp, { color: activeTheme.incomingTime }]}>12:12</Text>
                      </View>
                      <View style={[s.themePreviewBubbleOwn, { backgroundColor: activeTheme.outgoingBubble }]}>
                        <Text style={[s.themePreviewBubbleText, { color: activeTheme.outgoingBubbleText }]}>Así se verá nuestro chat</Text>
                        <Text style={[s.themePreviewTimestamp, { color: activeTheme.outgoingTime }]}>12:13</Text>
                      </View>
                    </View>
                  </View>

                  <Text style={s.settingsSectionTitle}>Editar</Text>
                  <View style={s.settingsSectionCard}>
                    <View style={s.themeModeGroup}>
                      {([
                        { key: 'own' as const, title: 'Tus mensajes' },
                        { key: 'partner' as const, title: 'Mensajes recibidos' },
                      ]).map((target) => {
                        const isSelected = bubbleEditorTarget === target.key;
                        return (
                          <Pressable
                            key={target.key}
                            style={[s.themeModeChip, isSelected ? s.themeModeChipSelected : null]}
                            onPress={() => setBubbleEditorTarget(target.key)}
                          >
                            <Text style={[s.themeModeChipText, isSelected ? s.themeModeChipTextSelected : null]}>
                              {target.title}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <View style={s.settingsDividerWide} />

                    <View style={s.themeColorPalette}>
                          {THEME_COLOR_OPTIONS.map((color) => {
                            const isSelected = normalizeHexColor(bubbleBaseColor, color) === color;
                        return (
                          <Pressable
                            key={`${bubbleEditorTarget}-${color}`}
                            style={[
                              s.themeColorSwatch,
                              { backgroundColor: color },
                              isSelected ? s.themeColorSwatchSelected : null,
                              color === '#FFFFFF' ? s.themeColorSwatchLight : null,
                            ]}
                            onPress={() => void handleBubblePaletteSelect(color)}
                          >
                            {isSelected ? <Check size={14} color={getReadableTextColor(color)} /> : null}
                          </Pressable>
                        );
                      })}
                    </View>

                    <View style={s.themeEditorControls}>
                      <ThemeValueSlider
                        label="Brillo"
                        value={bubbleEditorBrightness}
                        min={70}
                        max={120}
                        onChange={(value) => void handleBubbleBrightnessChange(value)}
                        fillColor={bubbleBaseColor}
                        valueFormatter={(value) => `${value}%`}
                      />
                    </View>
                  </View>
                </View>
              ) : activeThemeEditorPage === 'background' ? (
                <View>
                  <Text style={s.settingsSectionTitle}>Vista previa</Text>
                  <View style={s.settingsSectionCard}>
                    {backgroundEditorMode === 'image' && fondoPreviewImageUri ? (
                      <ImageBackground
                        source={{ uri: fondoPreviewImageUri }}
                        style={s.themePreviewCard}
                        imageStyle={s.themePreviewImageStyle}
                        resizeMode="cover"
                      >
                        {fondoPreviewImageOverlay ? (
                          <View
                            pointerEvents="none"
                            style={[
                              s.themePreviewImageOverlay,
                              {
                                backgroundColor: fondoPreviewImageOverlay.color,
                                opacity: fondoPreviewImageOverlay.opacity,
                              },
                            ]}
                          />
                        ) : null}
                        <View style={s.themePreviewHeader}>
                          <Text style={[s.themePreviewHeaderText, { color: activeTheme.incomingSecondaryText }]}>Fondo del chat</Text>
                          <View style={[s.themePreviewAccentDot, { backgroundColor: activeTheme.accent }]} />
                        </View>
                        <View style={[s.themePreviewBubblePartner, { backgroundColor: activeTheme.incomingBubble, borderColor: activeTheme.incomingBorder }]}>
                          <Text style={[s.themePreviewBubbleText, { color: activeTheme.incomingBubbleText }]}>Hola amor</Text>
                          <Text style={[s.themePreviewTimestamp, { color: activeTheme.incomingTime }]}>12:12</Text>
                        </View>
                        <View style={[s.themePreviewBubbleOwn, { backgroundColor: activeTheme.outgoingBubble }]}>
                          <Text style={[s.themePreviewBubbleText, { color: activeTheme.outgoingBubbleText }]}>Así se verá nuestro chat</Text>
                          <Text style={[s.themePreviewTimestamp, { color: activeTheme.outgoingTime }]}>12:13</Text>
                        </View>
                      </ImageBackground>
                    ) : (
                      <View style={[s.themePreviewCard, { backgroundColor: activeTheme.chatBackground }]}>
                        <View style={s.themePreviewHeader}>
                          <Text style={[s.themePreviewHeaderText, { color: activeTheme.incomingSecondaryText }]}>Fondo del chat</Text>
                          <View style={[s.themePreviewAccentDot, { backgroundColor: activeTheme.accent }]} />
                        </View>
                        <View style={[s.themePreviewBubblePartner, { backgroundColor: activeTheme.incomingBubble, borderColor: activeTheme.incomingBorder }]}>
                          <Text style={[s.themePreviewBubbleText, { color: activeTheme.incomingBubbleText }]}>Hola amor</Text>
                          <Text style={[s.themePreviewTimestamp, { color: activeTheme.incomingTime }]}>12:12</Text>
                        </View>
                        <View style={[s.themePreviewBubbleOwn, { backgroundColor: activeTheme.outgoingBubble }]}>
                          <Text style={[s.themePreviewBubbleText, { color: activeTheme.outgoingBubbleText }]}>Así se verá nuestro chat</Text>
                          <Text style={[s.themePreviewTimestamp, { color: activeTheme.outgoingTime }]}>12:13</Text>
                        </View>
                      </View>
                    )}
                  </View>

                  <Text style={s.settingsSectionTitle}>Tipo de fondo</Text>
                  <View style={s.settingsSectionCard}>
                    <View style={s.themeModeGroup}>
                      {([
                        { key: 'color' as const, title: 'Color' },
                        { key: 'gradient' as const, title: 'Degradado' },
                        { key: 'image' as const, title: 'Galería' },
                      ]).map((mode) => {
                        const isSelected = backgroundEditorMode === mode.key;
                        return (
                          <Pressable
                            key={mode.key}
                            style={[s.themeModeChip, isSelected ? s.themeModeChipSelected : null]}
                            onPress={() => void handleBackgroundModeSelect(mode.key)}
                          >
                            <Text style={[s.themeModeChipText, isSelected ? s.themeModeChipTextSelected : null]}>
                              {mode.title}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {backgroundEditorMode === 'color' ? (
                      <>
                        <View style={s.settingsDividerWide} />
                        <View style={s.themeColorPalette}>
                          {BACKGROUND_COLOR_OPTIONS.map((color) => {
                            const isSelected = normalizeHexColor(backgroundBaseColor, color) === color;
                            return (
                              <Pressable
                                key={`bg-${color}`}
                                style={[
                                  s.themeColorSwatch,
                                  { backgroundColor: color },
                                  isSelected ? s.themeColorSwatchSelected : null,
                                ]}
                                onPress={() => void handleBackgroundColorPaletteSelect(color)}
                              >
                                {isSelected ? <Check size={14} color={getReadableTextColor(color)} /> : null}
                              </Pressable>
                            );
                          })}
                        </View>

                      </>
                    ) : null}

                    {backgroundEditorMode === 'gradient' ? (
                      <>
                        <View style={s.settingsDividerWide} />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.themeGradientCarousel}>
                          {BACKGROUND_GRADIENT_OPTIONS.map((option) => {
                            const isSelected = chatSettings.chat_wallpaper_type === 'gradient' && chatSettings.chat_wallpaper_value === option.key;
                            return (
                              <Pressable
                                key={option.key}
                                style={[s.themeGradientCard, isSelected ? s.themeGradientCardSelected : null]}
                                onPress={() => void handleBackgroundGradientSelect(option.key)}
                              >
                                <View style={[s.themeGradientPreview, { backgroundColor: option.preview }]}>
                                  <View style={[s.themeGradientBlob, { backgroundColor: option.colors[0] }]} />
                                  <View style={[s.themeGradientBlobSecondary, { backgroundColor: option.colors[1] }]} />
                                </View>
                                <Text style={s.themeGradientTitle}>{option.title}</Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      </>
                    ) : null}

                    {backgroundEditorMode === 'image' ? (
                      <>
                        <View style={s.settingsDividerWide} />
                        <Pressable style={s.settingsSelectorRow} onPress={() => void handlePickBackgroundFromGallery()}>
                          <View style={[s.settingsRowIconWrap, { backgroundColor: '#FFF5EB' }]}>
                            <ImageIcon size={16} color={Colors.light.tint} />
                          </View>
                          <View style={s.settingsTextWrap}>
                            <Text style={s.settingsRowTitle}>Elegir de Galería</Text>
                            <Text style={s.settingsRowSubtitle}>Selecciona una imagen como fondo del chat</Text>
                          </View>
                          <ChevronRight size={17} color={TEXT_MUTED} />
                        </Pressable>
                        {galleryDraftUri ? (
                          <View style={s.themeGalleryActions}>
                            <Pressable style={s.themeGalleryButtonSecondary} onPress={handleCancelGalleryDraft}>
                              <Text style={s.themeGalleryButtonSecondaryText}>Cancelar</Text>
                            </Pressable>
                            <Pressable style={s.themeGalleryButtonPrimary} onPress={() => void handleApplyGalleryDraft()}>
                              <Text style={s.themeGalleryButtonPrimaryText}>Aplicar</Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </>
                    ) : null}

                    {(backgroundEditorMode === 'color' ||
                      backgroundEditorMode === 'gradient' ||
                      (backgroundEditorMode === 'image' && fondoPreviewImageUri)) ? (
                      <>
                        <View style={s.settingsDividerWide} />
                        <View style={s.themeEditorControls}>
                          <ThemeValueSlider
                            label="Brillo"
                            value={
                              backgroundEditorMode === 'image' && galleryDraftUri
                                ? galleryDraftBrightness
                                : backgroundOverlayBrightness
                            }
                            min={70}
                            max={120}
                            onChange={(value) =>
                              backgroundEditorMode === 'image' && galleryDraftUri
                                ? void handleGalleryDraftBrightnessChange(value)
                                : void handleBackgroundBrightnessControlChange(value)
                            }
                            fillColor={backgroundEditorMode === 'image' ? activeTheme.accent : backgroundBaseColor}
                            valueFormatter={(value) => `${value}%`}
                          />
                        </View>
                      </>
                    ) : null}
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={s.settingsSectionTitle}>Vista previa</Text>
                  <View style={s.settingsSectionCard}>
                    <View style={[s.themePreviewCard, { backgroundColor: activeTheme.chatBackground }]}>
                      <View style={s.themePreviewHeader}>
                        <Text style={[s.themePreviewHeaderText, { color: activeTheme.incomingSecondaryText }]}>Vista previa</Text>
                        <View style={[s.themePreviewAccentDot, { backgroundColor: activeTheme.accent }]} />
                      </View>
                      <View style={[s.themePreviewBubblePartner, { backgroundColor: activeTheme.incomingBubble, borderColor: activeTheme.incomingBorder }]}>
                        <Text style={[s.themePreviewBubbleText, { color: activeTheme.incomingBubbleText }]}>Hola amor</Text>
                        <Text style={[s.themePreviewTimestamp, { color: activeTheme.incomingTime }]}>12:12</Text>
                      </View>
                      <View style={[s.themePreviewVoiceMini, { backgroundColor: activeTheme.incomingBubble, borderColor: activeTheme.incomingBorder }]}>
                        <View style={[s.themePreviewVoicePlay, { backgroundColor: activeTheme.voicePartnerPlayBg }]}>
                          <Play size={12} color={activeTheme.voicePartnerIcon} />
                        </View>
                        <View style={[s.themePreviewVoiceTrack, { backgroundColor: activeTheme.voicePartnerTrack }]}>
                          <View style={[s.themePreviewVoiceFill, { backgroundColor: activeTheme.voicePartnerFill, width: '56%' }]} />
                        </View>
                      </View>
                      <View style={[s.themePreviewBubbleOwn, { backgroundColor: activeTheme.outgoingBubble }]}>
                        <Text style={[s.themePreviewBubbleText, { color: activeTheme.outgoingBubbleText }]}>Así se verá nuestro chat</Text>
                        <Text style={[s.themePreviewTimestamp, { color: activeTheme.outgoingTime }]}>12:13</Text>
                      </View>
                    </View>
                  </View>

                  <Text style={s.settingsSectionTitle}>Modo</Text>
                  <View style={s.settingsSectionCard}>
                    <View style={s.themeCompactSegmented}>
                      {appearanceChoices.map((mode) => {
                        const isSelected = chatSettings.appearance_mode === mode.key;
                        return (
                          <Pressable
                            key={mode.key}
                            style={[s.themeCompactSegment, isSelected ? s.themeCompactSegmentSelected : null]}
                            onPress={() => void handleAppearanceModeSelect(mode.key)}
                          >
                            <Text style={[s.themeCompactSegmentText, isSelected ? s.themeCompactSegmentTextSelected : null]}>
                              {mode.title}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <Text style={s.settingsSectionTitle}>Temas prediseñados</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.themePresetCarousel}>
                    {presetThemeChoices.map((theme) => {
                      const baseTheme = CHAT_THEMES[theme.key];
                      const isSelected = chatSettings.theme_key === theme.key;
                      return (
                        <Pressable
                          key={theme.key}
                          style={[s.themeCarouselCard, isSelected ? s.themeCarouselCardSelected : null]}
                          onPress={() => void handleThemeSelect(theme.key)}
                        >
                          <View style={[s.themeCarouselPreview, { backgroundColor: baseTheme.background }]}>
                            <View style={[s.themeCarouselReceived, { backgroundColor: baseTheme.partnerBubble }]} />
                            <View style={[s.themeCarouselSent, { backgroundColor: baseTheme.ownBubble }]} />
                            <View style={[s.themeCarouselAccent, { backgroundColor: baseTheme.accent }]} />
                            {isSelected ? (
                              <View style={s.themeCarouselCheck}>
                                <Check size={14} color="#FFFFFF" />
                              </View>
                            ) : null}
                          </View>
                          <Text style={s.themeCarouselTitle}>{theme.title}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <Text style={s.settingsSectionTitle}>Personalizar</Text>
                  <View style={s.settingsSectionCard}>
                    <Pressable style={s.themeEditorEntryCard} onPress={() => handleOpenThemeEditorPage('bubbles')}>
                      <View style={s.themeEditorEntryHeader}>
                        <View>
                          <Text style={s.themeEditorEntryTitle}>Burbujas del chat</Text>
                          <Text style={s.themeEditorEntrySubtitle}>Colores de tus mensajes y recibidos</Text>
                        </View>
                        <ChevronRight size={17} color={TEXT_MUTED} />
                      </View>
                      <View style={s.themeEditorBubblePreviewRow}>
                        <View style={[s.themeEditorMiniBubblePartner, { backgroundColor: activeTheme.incomingBubble, borderColor: activeTheme.incomingBorder }]} />
                        <View style={[s.themeEditorMiniBubbleOwn, { backgroundColor: activeTheme.outgoingBubble }]} />
                      </View>
                    </Pressable>

                    <View style={s.settingsDividerWide} />

                    <Pressable style={s.themeEditorEntryCard} onPress={() => handleOpenThemeEditorPage('background')}>
                      <View style={s.themeEditorEntryHeader}>
                        <View>
                          <Text style={s.themeEditorEntryTitle}>Fondo del chat</Text>
                          <Text style={s.themeEditorEntrySubtitle}>Color, degradado o imagen</Text>
                        </View>
                        <ChevronRight size={17} color={TEXT_MUTED} />
                      </View>
                      <View style={[s.themeEditorBackgroundPreview, { backgroundColor: activeTheme.chatBackground }]}>
                        <View style={[s.themeEditorBackgroundBubble, { backgroundColor: activeTheme.incomingBubble, borderColor: activeTheme.incomingBorder }]} />
                        <View style={[s.themeEditorBackgroundBubbleOwn, { backgroundColor: activeTheme.outgoingBubble }]} />
                      </View>
                    </Pressable>
                  </View>

                  <Text style={s.settingsSectionTitle}>Acciones</Text>
                  <View style={s.settingsSectionCard}>
                    <Pressable style={s.settingsSelectorRow} onPress={handleResetTheme}>
                      <View style={[s.settingsRowIconWrap, { backgroundColor: '#FFF0F4' }]}>
                        <Sparkles size={16} color={Colors.light.tint} />
                      </View>
                      <View style={s.settingsTextWrap}>
                        <Text style={s.settingsRowTitle}>Restablecer tema</Text>
                      </View>
                      <ChevronRight size={17} color={TEXT_MUTED} />
                    </Pressable>
                    <View style={s.settingsDivider} />
                    <View style={s.themeAutoSaveRow}>
                      <Text style={s.themeAutoSaveText}>Los cambios se guardan automáticamente.</Text>
                    </View>
                  </View>
                </View>
              )
            ) : null}

            {activeOptionsPanel === 'translation' ? (
              <View>
                <View style={s.settingsRow}>
                  <View style={s.settingsTextWrap}>
                    <Text style={s.settingsRowTitle}>Traducir mensajes automáticamente</Text>
                  </View>
                  <Switch
                    value={chatSettings.translation_enabled}
                    onValueChange={(value) => void handleTranslationEnabledChange(value)}
                    trackColor={{ false: '#EADDE2', true: '#E9B7C7' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
                <Text style={s.optionsSectionLabel}>Idioma de destino</Text>
                <View style={s.chipGroup}>
                  {translationChoices.map((language) => {
                    const isSelected = chatSettings.translation_target === language.key;
                    return (
                      <Pressable
                        key={language.key}
                        style={[s.choiceChip, isSelected ? s.choiceChipSelected : null]}
                        onPress={() => void handleTranslationTargetChange(language.key)}
                      >
                        <Text style={[s.choiceChipText, isSelected ? s.choiceChipTextSelected : null]}>
                          {language.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {chatSettings.translation_enabled ? (
                  <Text style={s.translationNote}>
                    La traducción automática se aplicará cuando esté disponible.
                  </Text>
                ) : null}
              </View>
            ) : null}

            {activeOptionsPanel === 'shared_media' ? (
              isLoadingSharedMedia ? (
                <ActivityIndicator color={Colors.light.tint} style={{ marginTop: 16 }} />
              ) : sharedMediaItems.length > 0 ? (
                <View>
                  <View style={s.sharedMediaGrid}>
                    {sharedMediaItems
                      .filter((item) => item.message_type !== 'document')
                      .map((item) => (
                        <Pressable
                          key={item.id}
                          style={s.sharedMediaCard}
                          onPress={() => item.media_url && void openExternalUrl(String(item.media_url), 'No se pudo abrir el archivo.')}
                        >
                          {item.message_type === 'image' ? (
                            <Image source={{ uri: String(item.media_url || '') }} style={s.sharedMediaPreview} />
                          ) : (
                            <View style={[s.sharedMediaPreview, s.sharedMediaVideoPreview]}>
                              <Play size={22} color="#FFFFFF" fill="#FFFFFF" />
                            </View>
                          )}
                          <Text style={s.sharedMediaCaption}>{item.message_type === 'video' ? 'Video' : 'Foto'}</Text>
                        </Pressable>
                      ))}
                  </View>

                  {sharedMediaItems.some((item) => item.message_type === 'document') ? (
                    <View style={s.sharedDocumentsList}>
                      {sharedMediaItems
                        .filter((item) => item.message_type === 'document')
                        .map((item) => (
                          <Pressable
                            key={item.id}
                            style={s.sheetListItem}
                            onPress={() => item.media_url && void openExternalUrl(String(item.media_url), 'No se pudo abrir el archivo.')}
                          >
                            <Text style={s.sheetListTitle} numberOfLines={1}>
                              {item.file_name || item.content || 'Documento'}
                            </Text>
                            <Text style={s.sheetListSubtitle}>{formatFileSize(item.file_size)}</Text>
                          </Pressable>
                        ))}
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={s.sheetEmptyState}>
                  <Text style={s.sheetEmptyTitle}>No hay multimedia compartida</Text>
                  <Text style={s.sheetEmptySubtitle}>Las fotos, videos y documentos aparecerán aquí.</Text>
                </View>
              )
            ) : null}

            {activeOptionsPanel === 'favorites' ? (
              isLoadingFavorites ? (
                <ActivityIndicator color={Colors.light.tint} style={{ marginTop: 16 }} />
              ) : favoriteMessages.length > 0 ? (
                <View>
                  {favoriteMessages.map((item) => (
                    <View key={item.id} style={s.sheetListItem}>
                      <Text style={s.sheetListTitle} numberOfLines={1}>
                        {getFavoriteMessageLabel(item)}
                      </Text>
                      <Text style={s.sheetListSubtitle} numberOfLines={1}>
                        {formatMessageTime(item.created_at)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={s.sheetEmptyState}>
                  <Text style={s.sheetEmptyTitle}>No hay mensajes favoritos</Text>
                  <Text style={s.sheetEmptySubtitle}>Marca mensajes como favoritos para verlos aquí.</Text>
                </View>
              )
            ) : null}
          </ScrollView>
        </Animated.View>
      ) : null}

      <Modal
        visible={contactsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setContactsModalVisible(false)}
      >
        <View style={s.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setContactsModalVisible(false)} />
          <View style={s.sheetCard}>
            <Text style={s.sheetTitle}>Compartir contacto</Text>
            <TextInput
              value={contactsSearchQuery}
              onChangeText={setContactsSearchQuery}
              placeholder="Buscar contacto"
              placeholderTextColor={TEXT_MUTED}
              style={s.sheetSearchInput}
            />
            <ScrollView style={s.sheetScrollArea} contentContainerStyle={s.sheetScrollContent}>
              {filteredContacts.length > 0 ? (
                filteredContacts.map((contact, index) => {
                  const phone = contact.phoneNumbers?.[0]?.number || '';
                  const email = contact.emails?.[0]?.email || '';
                  return (
                    <Pressable
                      key={`${contact.name || 'contacto'}-${phone || email || index}`}
                      style={s.sheetListItem}
                      onPress={() => handleSelectContact(contact)}
                      disabled={isAttachmentBusy}
                    >
                      <Text style={s.sheetListTitle}>{contact.name || 'Contacto'}</Text>
                      <Text style={s.sheetListSubtitle} numberOfLines={1}>
                        {phone || email || 'Sin teléfono ni correo'}
                      </Text>
                    </Pressable>
                  );
                })
              ) : (
                <View style={s.sheetEmptyState}>
                  <Text style={s.sheetEmptyTitle}>No hay contactos disponibles</Text>
                  <Text style={s.sheetEmptySubtitle}>Tus contactos aparecerán aquí para compartir uno.</Text>
                </View>
              )}
            </ScrollView>
            <Pressable style={s.sheetPrimaryButton} onPress={() => setContactsModalVisible(false)}>
              <Text style={s.sheetPrimaryButtonText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={savedSheetVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSavedSheetVisible(false)}
      >
        <View style={s.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setSavedSheetVisible(false)} />
          <View style={s.sheetCard}>
            <Text style={s.sheetTitle}>Guardados</Text>
            {savedPlaces.length > 0 ? (
              <ScrollView style={s.sheetScrollArea} contentContainerStyle={s.sheetScrollContent}>
                {savedPlaces.map((place) => (
                  <Pressable
                    key={place.id}
                    style={s.sheetListItem}
                    onPress={() => handleShareSavedPlace(place)}
                    disabled={isAttachmentBusy}
                  >
                    <Text style={s.sheetListTitle}>{place.name}</Text>
                    <Text style={s.sheetListSubtitle} numberOfLines={1}>
                      {place.address || 'Toca para compartir este guardado'}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <View style={s.sheetEmptyState}>
                <Text style={s.sheetEmptyTitle}>No hay guardados todavia</Text>
                <Text style={s.sheetEmptySubtitle}>Tus recuerdos guardados apareceran aqui.</Text>
              </View>
            )}
            <Pressable style={s.sheetPrimaryButton} onPress={() => setSavedSheetVisible(false)}>
              <Text style={s.sheetPrimaryButtonText}>Entendido</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(messageActionTarget)}
        transparent
        animationType="fade"
        onRequestClose={() => setMessageActionTarget(null)}
      >
        <View style={s.messageActionBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setMessageActionTarget(null)} />
          <View style={s.messageActionCard}>
            <Pressable
              style={s.messageActionButton}
              onPress={() => {
                if (!messageActionTarget) return;
                void toggleFavoriteMessage(messageActionTarget);
              }}
            >
              <Heart
                size={16}
                color={Colors.light.tint}
                fill={messageActionTarget?.is_favorite ? Colors.light.tint : 'transparent'}
              />
              <Text style={s.messageActionButtonText}>
                {messageActionTarget?.is_favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
              </Text>
            </Pressable>
            <Pressable style={[s.messageActionButton, s.messageActionCancel]} onPress={() => setMessageActionTarget(null)}>
              <Text style={s.messageActionCancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {isAttachmentBusy ? (
        <View style={s.attachmentLoadingOverlay} pointerEvents="auto">
          <View style={s.attachmentLoadingCard}>
            <ActivityIndicator color={Colors.light.tint} />
            <Text style={s.attachmentLoadingText}>{attachmentBusyLabel || 'Procesando...'}</Text>
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: SCREEN_BG },

  chatArea: { flex: 1, backgroundColor: CHAT_BG },
  chatContent: { padding: 18, paddingBottom: 36, backgroundColor: CHAT_BG },
  chatImageBackground: { flex: 1 },
  chatImageOverlay: { ...StyleSheet.absoluteFillObject },

  msgRow: { marginBottom: 16, flexDirection: 'row' },
  rowMe: { justifyContent: 'flex-end' },
  rowPartner: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    padding: 14,
    borderRadius: 26,
  },
  bubbleMe: {
    backgroundColor: USER_BUBBLE,
    borderBottomRightRadius: 6,
  },
  bubblePartner: {
    backgroundColor: PARTNER_BUBBLE,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: BORDER,
  },
  msgTxt: { fontSize: 16, lineHeight: 24 },
  txtMe: { color: '#FFF', fontWeight: '500' },
  txtPartner: { color: TEXT_DARK },
  timeTxt: { fontSize: 10, marginTop: 6, alignSelf: 'flex-end' },
  timeMe: { color: 'rgba(255,255,255,0.75)' },
  timePartner: { color: TEXT_MUTED },

  audioBubble: {
    maxWidth: '82%',
    minHeight: 54,
    maxHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  audioMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  audioPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.94,
  },
  audioPlayBtnMe: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  audioPlayBtnPartner: {
    backgroundColor: 'rgba(255,247,250,0.98)',
    borderWidth: 1,
    borderColor: '#F2DDE4',
  },
  audioProgressWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    marginLeft: 12,
    marginRight: 12,
  },
  audioProgressTrack: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  audioProgressTrackMe: {
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  audioProgressTrackPartner: {
    backgroundColor: '#F6E8ED',
  },
  audioProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  audioProgressFillMe: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  audioProgressFillPartner: {
    backgroundColor: '#DFA7B6',
  },
  audioProgressThumb: {
    position: 'absolute',
    top: '50%',
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: -4,
    marginLeft: -4,
  },
  audioProgressThumbMe: {
    backgroundColor: 'rgba(255,248,251,0.98)',
  },
  audioProgressThumbPartner: {
    backgroundColor: '#D38EA0',
  },
  audioDurationWrap: {
    width: 42,
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  audioDuration: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.92,
  },
  audioDurationMe: {
    color: 'rgba(255,255,255,0.94)',
  },
  audioDurationPartner: {
    color: '#8D6674',
  },
  audioTimestamp: {
    marginTop: 2,
    paddingRight: 1,
    fontSize: 10,
    lineHeight: 11,
    opacity: 0.66,
  },

  momentMessageBubble: {
    padding: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    maxWidth: '78%',
    borderRadius: 30,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  chatMomentPreview: {
    width: 240,
    height: 320,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderRadius: 30,
  },
  chatMomentPreviewFallback: {
    borderRadius: 30,
  },
  chatMomentPreviewImage: {
    borderRadius: 30,
  },
  chatMomentOverlay: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 30,
  },
  chatMomentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
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
    borderColor: 'rgba(255,255,255,0.55)',
  },
  chatMomentBottom: {
    gap: 6,
  },
  chatMomentCommentBox: {
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chatMomentCommentLabel: {
    color: '#7b2d3b',
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chatMomentCommentText: {
    color: '#3B2730',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  chatMomentSubtitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 15,
    fontWeight: '700',
  },
  chatMomentOpenText: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '700',
  },

  attachmentMediaBubble: {
    padding: 0,
    overflow: 'hidden',
    maxWidth: 246,
  },
  attachmentImagePreview: {
    width: 246,
    height: 246,
    backgroundColor: '#F7E8EE',
  },
  attachmentMediaFooter: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attachmentMediaLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  infoCardBubble: {
    minWidth: 196,
    maxWidth: 280,
    paddingVertical: 12,
  },
  infoCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoCardIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCardIconWrapMe: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  infoCardIconWrapPartner: {
    backgroundColor: '#FFF5F8',
    borderWidth: 1,
    borderColor: '#F2DDE4',
  },
  infoCardTextWrap: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoCardSubtitle: {
    marginTop: 2,
    fontSize: 12.5,
    lineHeight: 17,
  },
  infoCardSubtitleMe: {
    color: 'rgba(255,255,255,0.82)',
  },
  infoCardSubtitlePartner: {
    color: TEXT_MUTED,
  },

  optionsDropdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  optionsDropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  optionsDropdown: {
    position: 'absolute',
    borderRadius: 20,
    backgroundColor: '#FFFDFE',
    borderWidth: 1,
    borderColor: DIVIDER,
    paddingVertical: 8,
    overflow: 'hidden',
    shadowColor: '#7A5B66',
    shadowOpacity: 0.10,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  optionsMenuList: {
    gap: 0,
  },
  optionsMenuRow: {
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionsMenuRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  optionsMenuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1F5',
    borderWidth: 1,
    borderColor: '#F2DDE4',
  },
  optionsMenuTextWrap: {
    flex: 1,
    minWidth: 0,
    marginLeft: 11,
    marginRight: 10,
  },
  optionsMenuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_DARK,
  },
  optionsPageContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  optionsPageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: DIVIDER,
    backgroundColor: SETTINGS_PAGE_BACKGROUND,
  },
  optionsPageBackButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsPageTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  optionsPageHeaderSpacer: {
    width: 38,
    height: 38,
  },
  optionsPageScroll: {
    flex: 1,
  },
  optionsPageContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  optionsPageIntroCard: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#FFF6F9',
    borderWidth: 1,
    borderColor: DIVIDER,
    marginBottom: 12,
  },
  optionsPageIntroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_MUTED,
    marginBottom: 4,
  },
  optionsPageIntroValue: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  settingsRow: {
    minHeight: 68,
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  settingsRowTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
    color: TEXT_DARK,
  },
  settingsRowTitleDestructive: {
    color: '#B9637D',
  },
  settingsRowSubtitle: {
    marginTop: 2,
    fontSize: 13.5,
    lineHeight: 18,
    color: TEXT_MUTED,
  },
  settingsSectionTitle: {
    marginTop: 22,
    marginBottom: 8,
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '700',
    color: '#9A7682',
  },
  settingsSectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F3E6EB',
    backgroundColor: '#FFFDFE',
    overflow: 'hidden',
    marginBottom: 24,
  },
  chatProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 82,
    backgroundColor: 'transparent',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  chatProfileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F6E2E8',
  },
  chatProfileAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatProfileAvatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#9A5B70',
  },
  chatProfileTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  chatProfileTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  chatProfileStatus: {
    marginTop: 2,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#C07A90',
  },
  chatProfileSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: TEXT_MUTED,
  },
  settingsSelectorRow: {
    minHeight: 68,
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(221, 196, 205, 0.7)',
    marginLeft: 76,
  },
  settingsRowInline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsRowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingsRowIconWrapDestructive: {
    backgroundColor: '#FCEFF3',
  },
  selectorCard: {
    marginHorizontal: 12,
    marginVertical: 10,
    borderRadius: 18,
    backgroundColor: '#FFF7FA',
    overflow: 'hidden',
  },
  selectorOption: {
    minHeight: 46,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 0,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorOptionSelected: {
    backgroundColor: '#FFF1F6',
  },
  selectorOptionText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: TEXT_DARK,
  },
  selectorDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(221, 196, 205, 0.55)',
    marginLeft: 48,
  },
  wallpaperPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7D7DE',
    marginRight: 10,
  },
  inlineEditorCard: {
    marginHorizontal: 12,
    marginVertical: 10,
    borderRadius: 18,
    backgroundColor: '#FFF7FA',
    padding: 12,
  },
  inlineEditorInput: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EBD8DF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    color: TEXT_DARK,
    fontSize: 14,
  },
  inlineEditorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  inlineEditorButton: {
    minWidth: 88,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#E8B8C7',
  },
  inlineEditorButtonGhost: {
    backgroundColor: '#FFF4F7',
    borderWidth: 1,
    borderColor: '#ECD8E0',
  },
  inlineEditorButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7A4454',
  },
  inlineEditorButtonGhostText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_MUTED,
  },
  themePreviewCard: {
    borderRadius: 20,
    minHeight: 190,
    overflow: 'hidden',
    padding: 16,
    justifyContent: 'flex-end',
  },
  themePreviewImageStyle: {
    borderRadius: 20,
  },
  themePreviewImageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  themePreviewHeader: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themePreviewHeaderText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  themePreviewAccentDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  themePreviewBubblePartner: {
    alignSelf: 'flex-start',
    maxWidth: '72%',
    borderRadius: 18,
    borderBottomLeftRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  themePreviewBubbleOwn: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
    borderRadius: 18,
    borderBottomRightRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  themePreviewBubbleText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  themePreviewTimestamp: {
    marginTop: 5,
    fontSize: 10,
    alignSelf: 'flex-end',
  },
  themeModeGroup: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  themeModeChip: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EBDDE2',
    backgroundColor: '#FFF7FA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  themeModeChipSelected: {
    backgroundColor: '#F8E4EB',
    borderColor: '#E4AFC0',
  },
  themeModeChipText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  themeModeChipTextSelected: {
    color: '#8A5062',
  },
  themePresetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 12,
  },
  themePresetTile: {
    width: '48%',
    borderRadius: 18,
    backgroundColor: '#FFF8FA',
    borderWidth: 1,
    borderColor: '#F0E1E7',
    overflow: 'hidden',
  },
  themePresetTileSelected: {
    borderColor: '#E5AFC0',
    backgroundColor: '#FFF2F6',
  },
  themePresetPreview: {
    height: 68,
    padding: 10,
    justifyContent: 'space-between',
  },
  themePresetIncomingBubble: {
    width: '58%',
    height: 14,
    borderRadius: 999,
  },
  themePresetOwnBubble: {
    width: '44%',
    height: 14,
    borderRadius: 999,
    alignSelf: 'flex-end',
  },
  themePresetFooter: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  themePresetTitle: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: TEXT_DARK,
    marginRight: 8,
  },
  themeInlineColorDot: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(46,46,46,0.12)',
  },
  themeColorPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  themeColorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(46,46,46,0.08)',
  },
  themeColorSwatchSelected: {
    borderWidth: 2,
    borderColor: '#D98CA6',
  },
  themeColorSwatchLight: {
    borderWidth: 1,
    borderColor: '#E7D7DE',
  },
  themeBackgroundGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 12,
  },
  themeBackgroundTile: {
    width: '48%',
    borderRadius: 18,
    backgroundColor: '#FFF8FA',
    borderWidth: 1,
    borderColor: '#F0E1E7',
    padding: 10,
  },
  themeBackgroundTileSelected: {
    borderColor: '#E5AFC0',
    backgroundColor: '#FFF2F6',
  },
  themeBackgroundPreview: {
    height: 54,
    borderRadius: 14,
    marginBottom: 10,
  },
  themeBackgroundTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  themeBackgroundSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: TEXT_MUTED,
  },
  settingsDividerWide: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(221, 196, 205, 0.55)',
    marginHorizontal: 18,
  },
  themeAutoSaveRow: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  themeAutoSaveText: {
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_MUTED,
  },
  themePreviewVoiceMini: {
    alignSelf: 'flex-start',
    width: 134,
    height: 38,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  themePreviewVoicePlay: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  themePreviewVoiceTrack: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  themePreviewVoiceFill: {
    height: '100%',
    borderRadius: 999,
  },
  themeCompactSegmented: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  themeCompactSegment: {
    flex: 1,
    minHeight: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF6F9',
    borderWidth: 1,
    borderColor: '#EEDFE5',
  },
  themeCompactSegmentSelected: {
    backgroundColor: '#F8E4EB',
    borderColor: '#E2AAB9',
  },
  themeCompactSegmentText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  themeCompactSegmentTextSelected: {
    color: '#8A5062',
  },
  themePresetCarousel: {
    paddingHorizontal: 2,
    paddingBottom: 8,
    gap: 12,
  },
  themeCarouselCard: {
    width: 162,
    borderRadius: 24,
    backgroundColor: '#FFFDFE',
    borderWidth: 1,
    borderColor: '#F0E1E7',
    padding: 10,
  },
  themeCarouselCardSelected: {
    borderColor: '#E0A9BA',
    backgroundColor: '#FFF4F7',
  },
  themeCarouselPreview: {
    height: 122,
    borderRadius: 18,
    padding: 12,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  themeCarouselReceived: {
    width: '62%',
    height: 18,
    borderRadius: 999,
  },
  themeCarouselSent: {
    width: '48%',
    height: 18,
    borderRadius: 999,
    alignSelf: 'flex-end',
  },
  themeCarouselAccent: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    opacity: 0.18,
  },
  themeCarouselCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 164, 174, 0.95)',
  },
  themeCarouselTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  themeEditorEntryCard: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  themeEditorEntryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeEditorEntryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  themeEditorEntrySubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_MUTED,
  },
  themeEditorBubblePreviewRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeEditorMiniBubblePartner: {
    width: '42%',
    height: 34,
    borderRadius: 18,
    borderBottomLeftRadius: 8,
    borderWidth: 1,
  },
  themeEditorMiniBubbleOwn: {
    width: '48%',
    height: 34,
    borderRadius: 18,
    borderBottomRightRadius: 8,
  },
  themeEditorBackgroundPreview: {
    height: 92,
    borderRadius: 20,
    marginTop: 14,
    padding: 12,
    justifyContent: 'space-between',
  },
  themeEditorBackgroundBubble: {
    width: '48%',
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
  },
  themeEditorBackgroundBubbleOwn: {
    width: '36%',
    height: 18,
    borderRadius: 999,
    alignSelf: 'flex-end',
  },
  themeEditorControls: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 14,
  },
  themeHexRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: 16,
    gap: 10,
  },
  themeHexInputWrap: {
    flex: 1,
  },
  themeHexLabel: {
    marginBottom: 6,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#9A7682',
  },
  themeHexInput: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8D8DF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 14,
    color: TEXT_DARK,
  },
  themeHexButton: {
    height: 44,
    minWidth: 88,
    borderRadius: 14,
    backgroundColor: '#E8B8C7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  themeHexButtonText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#7A4454',
  },
  themeGradientCarousel: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  themeGradientCard: {
    width: 138,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0E1E7',
    backgroundColor: '#FFF9FB',
    padding: 10,
  },
  themeGradientCardSelected: {
    borderColor: '#E0A9BA',
    backgroundColor: '#FFF3F7',
  },
  themeGradientPreview: {
    height: 82,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 10,
  },
  themeGradientBlob: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    top: -10,
    left: -8,
    opacity: 0.88,
  },
  themeGradientBlobSecondary: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    bottom: -22,
    right: -10,
    opacity: 0.92,
  },
  themeGradientTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  themeGalleryActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  themeGalleryButtonSecondary: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6D5DD',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeGalleryButtonSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  themeGalleryButtonPrimary: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#E8B8C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeGalleryButtonPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7A4454',
  },
  themeSliderBlock: {
    marginTop: 12,
  },
  themeSliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  themeSliderLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  themeSliderValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: TEXT_MUTED,
  },
  themeSliderTrack: {
    height: 8,
    borderRadius: 999,
    justifyContent: 'center',
    backgroundColor: '#E9E4E8',
  },
  themeSliderTrackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
  },
  themeSliderThumb: {
    position: 'absolute',
    top: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    marginLeft: -9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(220, 169, 184, 0.7)',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  themeList: {
    gap: 10,
  },
  themeOptionCard: {
    minHeight: 68,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: DIVIDER,
    backgroundColor: '#FFF7FA',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeOptionCardSelected: {
    borderColor: '#E3A8BB',
    backgroundColor: '#FFF2F6',
  },
  themePreview: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEDAE2',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 7,
  },
  themePreviewBubble: {
    width: 20,
    height: 14,
    borderRadius: 9,
  },
  themeOptionTextWrap: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },
  themeOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  optionsSectionLabel: {
    marginTop: 6,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_MUTED,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: DIVIDER,
    backgroundColor: '#FFF7FA',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  choiceChipSelected: {
    backgroundColor: '#F7DDE6',
    borderColor: '#E6A8B9',
  },
  choiceChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_DARK,
  },
  choiceChipTextSelected: {
    color: '#7A4454',
  },
  translationNote: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_MUTED,
  },
  sharedMediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sharedMediaCard: {
    width: '48%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: DIVIDER,
    backgroundColor: '#FFF7FA',
    overflow: 'hidden',
  },
  sharedMediaPreview: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F3E8ED',
  },
  sharedMediaVideoPreview: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D6A0B1',
  },
  sharedMediaCaption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  sharedDocumentsList: {
    marginTop: 14,
    gap: 10,
  },
  favoriteBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  favoriteBadgeMe: {
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  favoriteBadgePartner: {
    backgroundColor: '#FFF0F4',
    borderWidth: 1,
    borderColor: '#F2DDE4',
  },

  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(51, 29, 36, 0.18)',
  },
  sheetCard: {
    backgroundColor: SOFT_PANEL_BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderColor: DIVIDER,
    minHeight: 260,
    maxHeight: '74%',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_DARK,
    textAlign: 'center',
    marginBottom: 14,
  },
  sheetSearchInput: {
    height: 44,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: DIVIDER,
    backgroundColor: '#FFF8FA',
    paddingHorizontal: 14,
    color: TEXT_DARK,
    fontSize: 15,
    marginBottom: 12,
  },
  sheetScrollArea: {
    flexGrow: 0,
  },
  sheetScrollContent: {
    paddingBottom: 10,
    gap: 10,
  },
  sheetListItem: {
    backgroundColor: '#FFF7FA',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: DIVIDER,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  sheetListTitle: {
    color: TEXT_DARK,
    fontSize: 14,
    fontWeight: '700',
  },
  sheetListSubtitle: {
    marginTop: 4,
    color: TEXT_MUTED,
    fontSize: 12.5,
    lineHeight: 17,
  },
  sheetEmptyState: {
    flex: 1,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  sheetEmptyTitle: {
    color: TEXT_DARK,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  sheetEmptySubtitle: {
    marginTop: 8,
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  sheetPrimaryButton: {
    marginTop: 14,
    height: 46,
    borderRadius: 18,
    backgroundColor: Colors.light.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetPrimaryButtonText: {
    color: '#FFF8FB',
    fontSize: 14,
    fontWeight: '700',
  },

  attachmentLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 248, 250, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  attachmentLoadingCard: {
    minWidth: 180,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 22,
    backgroundColor: '#FFFDFE',
    borderWidth: 1,
    borderColor: DIVIDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentLoadingText: {
    marginTop: 10,
    color: TEXT_DARK,
    fontSize: 13.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  messageActionBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(39, 24, 31, 0.05)',
  },
  messageActionCard: {
    width: '100%',
    maxWidth: 280,
    borderRadius: 22,
    backgroundColor: '#FFFDFE',
    borderWidth: 1,
    borderColor: DIVIDER,
    padding: 10,
    shadowColor: '#7A5B66',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  messageActionButton: {
    minHeight: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFF6F9',
    borderWidth: 1,
    borderColor: DIVIDER,
    paddingHorizontal: 14,
  },
  messageActionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  messageActionCancel: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
  },
  messageActionCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_MUTED,
  },

  noResultsText: {
    textAlign: 'center',
    color: TEXT_MUTED,
    marginTop: 40,
    fontSize: 15,
  },

  composerPanelBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(209, 180, 191, 0.10)',
  },
  composerPanelContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  attachmentMenu: {
    backgroundColor: SOFT_PANEL_BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 12,
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderColor: DIVIDER,
    flexGrow: 0,
    flexShrink: 0,
  },
  attachmentHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#E9D8DE',
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 10,
  },
  attachmentTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_DARK,
    textAlign: 'center',
    marginBottom: 12,
  },
  attachmentOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    rowGap: 10,
    columnGap: 10,
  },
  attachmentOption: {
    width: '30.8%',
    backgroundColor: '#FFF7FA',
    aspectRatio: 1,
    minHeight: 76,
    maxHeight: 88,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DIVIDER,
  },
  attachmentIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    opacity: 0.92,
  },
  attachmentOptionText: {
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 15,
    color: TEXT_DARK,
  },

  stickerMenu: {
    backgroundColor: SOFT_PANEL_BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 12,
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderColor: DIVIDER,
    flexGrow: 0,
    flexShrink: 0,
  },
  stickerHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#E9D8DE',
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 10,
  },
  stickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_DARK,
    textAlign: 'center',
    marginBottom: 12,
  },
  stickerOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 0,
  },
  stickerOption: {
    width: 64,
    height: 64,
    backgroundColor: '#FFF7FA',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DIVIDER,
  },
  stickerEmoji: {
    fontSize: 36,
  },
});
