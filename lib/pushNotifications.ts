import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export type IncomingCallPushData = {
  type: 'incoming_call';
  callRecordId: string;
  streamCallId: string | null;
  callType: 'audio' | 'video' | null;
};

type SendCallNotificationResponse = {
  sent?: boolean;
  recipientTokenCount?: number;
};

function getProjectId() {
  const easProjectId = (Constants.easConfig as { projectId?: string } | null)?.projectId;
  const expoProjectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  return easProjectId ?? expoProjectId ?? null;
}

async function ensureIncomingCallChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('incoming-calls', {
    name: 'Llamadas',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F06F8F',
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function persistExpoPushToken(userId: string, expoPushToken: string) {
  const normalizedToken = expoPushToken.trim();
  if (!userId || !normalizedToken) {
    return false;
  }

  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      expo_push_token: normalizedToken,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'expo_push_token',
    }
  );

  if (error) {
    console.log('[PushNotifications] token persistence failed', {
      message: error.message,
    });
    return false;
  }

  return true;
}

export async function registerDevicePushToken(userId: string) {
  try {
    await ensureIncomingCallChannel();

    const currentPermissions = await Notifications.getPermissionsAsync();
    let granted = currentPermissions.granted || currentPermissions.status === 'granted';

    if (!granted) {
      const requestedPermissions = await Notifications.requestPermissionsAsync();
      granted = requestedPermissions.granted || requestedPermissions.status === 'granted';
    }

    if (!granted) {
      console.log('[PushNotifications] token registration result', {
        granted: false,
        hasExpoPushToken: false,
      });
      return {
        granted: false,
        hasExpoPushToken: false,
      };
    }

    const projectId = getProjectId();
    if (!projectId) {
      console.log('[PushNotifications] token registration result', {
        granted: true,
        hasExpoPushToken: false,
      });
      return {
        granted: true,
        hasExpoPushToken: false,
      };
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoPushToken = tokenResponse.data?.trim() ?? '';

    if (!expoPushToken) {
      console.log('[PushNotifications] token registration result', {
        granted: true,
        hasExpoPushToken: false,
      });
      return {
        granted: true,
        hasExpoPushToken: false,
      };
    }

    await persistExpoPushToken(userId, expoPushToken);

    console.log('[PushNotifications] token registration result', {
      granted: true,
      hasExpoPushToken: true,
    });

    return {
      granted: true,
      hasExpoPushToken: true,
    };
  } catch (error) {
    console.log('[PushNotifications] token registration failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    console.log('[PushNotifications] token registration result', {
      granted: false,
      hasExpoPushToken: false,
    });

    return {
      granted: false,
      hasExpoPushToken: false,
    };
  }
}

export async function sendCallNotification(callRecordId: string) {
  const { data, error } = await supabase.functions.invoke('send-call-notification', {
    body: {
      callRecordId,
    },
  });

  if (error) {
    throw error;
  }

  return (data ?? {}) as SendCallNotificationResponse;
}

export function parseIncomingCallPushData(data: Record<string, unknown> | null | undefined): IncomingCallPushData | null {
  if (!data || data.type !== 'incoming_call') {
    return null;
  }

  const callRecordId = typeof data.callRecordId === 'string' ? data.callRecordId.trim() : '';
  if (!callRecordId) {
    return null;
  }

  const streamCallId = typeof data.streamCallId === 'string' ? data.streamCallId.trim() : null;
  const callType =
    data.callType === 'audio' || data.callType === 'video'
      ? data.callType
      : null;

  return {
    type: 'incoming_call',
    callRecordId,
    streamCallId,
    callType,
  };
}
