import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { persistExpoPushToken } from './pushNotifications';
import { supabase } from './supabase';

const ENABLE_PUSH_REGISTRATION = false;

type ExpoConstantsWithManifest2 = typeof Constants & {
  manifest2?: {
    extra?: {
      eas?: {
        projectId?: string;
      };
    };
  };
};

function getProjectId() {
  const constantsWithManifest2 = Constants as ExpoConstantsWithManifest2;
  return (
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    constantsWithManifest2.manifest2?.extra?.eas?.projectId ??
    null
  );
}

export async function registerPushNotifications() {
  if (!ENABLE_PUSH_REGISTRATION) {
    console.log('[Push] registration skipped during voice debugging');
    return null;
  }

  if (!Device.isDevice) {
    console.log('[Push] physical device required');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('calls', {
      name: 'Llamadas',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F06F8F',
      sound: 'default',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;

  if (existing.status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  console.log('[Push] permission status', finalStatus);

  if (finalStatus !== 'granted') {
    console.log('[Push] permission not granted', finalStatus);
    return null;
  }

  const projectId = getProjectId();
  console.log('[Push] projectId exists', Boolean(projectId));

  if (!projectId) {
    console.log('[Push] missing EAS projectId');
    return null;
  }

  const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenResult.data?.trim() ?? '';

  console.log('[Push] token received', Boolean(token));

  if (!token) {
    return null;
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? null;

  if (authError) {
    console.log('[Push] auth user lookup failed', authError.message);
    return null;
  }

  if (!currentUserId) {
    console.log('[Push] no current user');
    return null;
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('profiles')
    .update({
      expo_push_token: token,
      push_token_updated_at: now,
    })
    .eq('id', currentUserId);

  if (error) {
    console.log('[Push] token save error', error.message);
    return null;
  }

  // Keep the existing push token table in sync for the current call notification flow.
  const mirroredToPushTokens = await persistExpoPushToken(currentUserId, token);
  if (!mirroredToPushTokens) {
    console.log('[Push] push_tokens mirror failed', { currentUserId });
  }

  console.log('[Push] token saved for current user', {
    currentUserId,
    hasToken: Boolean(token),
  });
  console.log('[Push] token saved', Boolean(token));

  return token;
}
