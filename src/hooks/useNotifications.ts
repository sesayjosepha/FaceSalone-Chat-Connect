import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { playNotificationSound } from '@/lib/chatUtils';
import { toast } from 'sonner';

interface NotificationSettings {
  message_notifications: boolean;
  group_notifications: boolean;
  status_notifications: boolean;
  sound_enabled: boolean;
  vibration_enabled: boolean;
  show_preview: boolean;
}

const defaultSettings: NotificationSettings = {
  message_notifications: true,
  group_notifications: true,
  status_notifications: true,
  sound_enabled: true,
  vibration_enabled: true,
  show_preview: true,
};

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useNotifications() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);
  const settingsRef = useRef(defaultSettings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Load settings from DB
  useEffect(() => {
    if (!user) return;
    supabase.from('notification_settings').select('*').eq('user_id', user.id).single().then(({ data }) => {
      if (data) {
        setSettings({
          message_notifications: data.message_notifications ?? true,
          group_notifications: data.group_notifications ?? true,
          status_notifications: data.status_notifications ?? true,
          sound_enabled: data.sound_enabled ?? true,
          vibration_enabled: data.vibration_enabled ?? true,
          show_preview: data.show_preview ?? true,
        });
      }
    });
  }, [user]);

  // Check browser notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission);
    }
    // Check existing push subscription
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          if (sub) setPushSubscription(sub);
        });
      });
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'denied' as NotificationPermission;
    const perm = await Notification.requestPermission();
    setBrowserPermission(perm);
    return perm;
  }, []);

  const notifyMessage = useCallback((senderName: string, content: string, isGroup = false) => {
    const s = settingsRef.current;
    
    // Check if notifications are enabled for this type
    if (isGroup && !s.group_notifications) return;
    if (!isGroup && !s.message_notifications) return;

    // Play sound
    if (s.sound_enabled) {
      playNotificationSound();
    }

    // Vibrate
    if (s.vibration_enabled && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }

    // In-app toast notification
    const message = s.show_preview ? content : 'New message';
    toast(senderName, {
      description: message.length > 80 ? message.slice(0, 80) + '…' : message,
      duration: 4000,
    });

    // Browser notification (when tab is not focused)
    if (document.hidden && browserPermission === 'granted') {
      try {
        new Notification(senderName, {
          body: s.show_preview ? content : 'New message',
          icon: '/logo.png',
          tag: `msg-${Date.now()}`,
        });
      } catch {
        // SW notifications not supported
      }
    }
  }, [browserPermission]);

  const notifyStatus = useCallback((username: string) => {
    const s = settingsRef.current;
    if (!s.status_notifications) return;
    if (s.sound_enabled) playNotificationSound();
    toast(`${username} posted a status`, { duration: 3000 });
  }, []);

  const subscribePush = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast.error('Push notifications not supported');
      return null;
    }
    const perm = await requestPermission();
    if (perm !== 'granted') {
      toast.error('Notification permission required');
      return null;
    }
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!vapidKey) {
      toast.error('VAPID public key not configured');
      return null;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      setPushSubscription(sub);
      toast.success('Push notifications enabled');
      return sub;
    } catch {
      toast.error('Failed to subscribe to push');
      return null;
    }
  }, [requestPermission]);

  const unsubscribePush = useCallback(async () => {
    if (!pushSubscription) return;
    await pushSubscription.unsubscribe();
    setPushSubscription(null);
    toast.success('Push notifications disabled');
  }, [pushSubscription]);

  return { settings, requestPermission, browserPermission, pushSubscription, subscribePush, unsubscribePush, notifyMessage, notifyStatus };
}
