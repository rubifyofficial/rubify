import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export type IncomingCallPushData = {
  type: 'incoming_call';
  callRecordId: string;
  streamCallId: string | null;
  callKind: 'audio' | 'video' | null;
  coupleId: string | null;
  callerId: string | null;
  recipientId: string | null;
};

type SendCallNotificationResponse = {
  ok?: boolean;
  sent?: boolean;
  hasToken?: boolean;
  reason?: string | null;
  expoStatus?: string | null;
  recipientTokenCount?: number;
  details?: unknown;
};

type SendTestPushResponse = {
  ok?: boolean;
  sent?: boolean;
  hasToken?: boolean;
  reason?: string | null;
  expoStatus?: string | null;
  details?: unknown;
};

function maskToken(token: string | null | undefined) {
  const normalizedToken = token?.trim() ?? '';
  if (!normalizedToken) return null;
  if (normalizedToken.length <= 10) return normalizedToken;
  return `${normalizedToken.slice(0, 8)}...${normalizedToken.slice(-6)}`;
}

function getProjectId() {
  const easProjectId = (Constants.easConfig as { projectId?: string } | null)?.projectId;
  const expoProjectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  const manifest2ProjectId =
    (
      Constants as typeof Constants & {
        manifest2?: {
          extra?: {
            eas?: {
              projectId?: string;
            };
          };
        };
      }
    ).manifest2?.extra?.eas?.projectId ?? null;
  return easProjectId ?? expoProjectId ?? manifest2ProjectId ?? null;
}

async function ensureIncomingCallChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('calls', {
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
      userId,
      tokenPreview: maskToken(normalizedToken),
    });
    return false;
  }

  console.log('[Push] token saved for current user', true);
  return true;
}

export async function registerDevicePushToken(userId: string) {
  try {
    await ensureIncomingCallChannel();

    const currentPermissions = await Notifications.getPermissionsAsync();
    let granted = currentPermissions.granted || currentPermissions.status === 'granted';
    console.log('[Push] permission status', currentPermissions.status);

    if (!granted) {
      const requestedPermissions = await Notifications.requestPermissionsAsync();
      granted = requestedPermissions.granted || requestedPermissions.status === 'granted';
      console.log('[Push] permission status', requestedPermissions.status);
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
    console.log('[PushNotifications] project id resolved', {
      hasProjectId: Boolean(projectId),
      projectIdPreview: projectId ? `${projectId.slice(0, 8)}...` : null,
    });
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
    console.log('[Push] token received', Boolean(expoPushToken));
    console.log('[PushNotifications] token preview', {
      tokenPreview: maskToken(expoPushToken),
    });

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

    const saved = await persistExpoPushToken(userId, expoPushToken);
    console.log('[Push] token saved for current user', saved);

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

  console.log('[CallPush] invoke result', {
    hasData: Boolean(data),
    error: error?.message ?? null,
    data,
  });

  if (error) {
    throw error;
  }

  return (data ?? {}) as SendCallNotificationResponse;
}

export async function sendTestPushToSelf() {
  const { data, error } = await supabase.functions.invoke('send-test-push', {
    body: {},
  });

  console.log('[PushTest] invoke result', {
    hasData: Boolean(data),
    error: error?.message ?? null,
    data,
  });

  if (error) {
    throw error;
  }

  return (data ?? {}) as SendTestPushResponse;
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
  const callKind =
    data.callKind === 'audio' || data.callKind === 'video'
      ? data.callKind
      : data.callType === 'audio' || data.callType === 'video'
        ? data.callType
      : null;
  const coupleId = typeof data.coupleId === 'string' ? data.coupleId.trim() : null;
  const callerId = typeof data.callerId === 'string' ? data.callerId.trim() : null;
  const recipientId = typeof data.recipientId === 'string' ? data.recipientId.trim() : null;

  return {
    type: 'incoming_call',
    callRecordId,
    streamCallId,
    callKind,
    coupleId,
    callerId,
    recipientId,
  };
}
