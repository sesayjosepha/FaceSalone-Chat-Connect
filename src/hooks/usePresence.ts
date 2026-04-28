import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PresenceState {
  onlineUsers: Set<string>;
  typingUsers: Map<string, string>; // userId -> username
}

export function usePresence(roomId: string | null) {
  const { user } = useAuth();
  const [presence, setPresence] = useState<PresenceState>({
    onlineUsers: new Set(),
    typingUsers: new Map(),
  });

  useEffect(() => {
    if (!roomId || !user) return;

    // Update last_seen
    supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then(() => {});

    const channel = supabase.channel(`presence:${roomId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const online = new Set<string>();
        const typing = new Map<string, string>();
        Object.entries(state).forEach(([userId, presences]) => {
          online.add(userId);
          const p = presences as any[];
          if (p.length > 0 && p[0].typing) {
            typing.set(userId, p[0].username || 'Someone');
          }
        });
        setPresence({ onlineUsers: online, typingUsers: typing });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online: true, typing: false, username: '' });
        }
      });

    // Heartbeat for last_seen
    const heartbeat = setInterval(() => {
      supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then(() => {});
    }, 30000);

    return () => {
      clearInterval(heartbeat);
      supabase.removeChannel(channel);
    };
  }, [roomId, user]);

  const setTyping = useCallback(
    async (isTyping: boolean, username: string) => {
      if (!roomId || !user) return;
      const channel = supabase.channel(`presence:${roomId}`);
      // We need to get the existing channel
      try {
        await supabase.channel(`presence:${roomId}`).track({
          online: true,
          typing: isTyping,
          username,
        });
      } catch {
        // Channel may not be ready
      }
    },
    [roomId, user]
  );

  return { ...presence, setTyping };
}

export function useOnlineStatus(userIds: string[]) {
  const [onlineMap, setOnlineMap] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (userIds.length === 0) return;

    const fetchOnlineStatus = async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('profiles')
        .select('id, last_seen')
        .in('id', userIds);

      const map = new Map<string, boolean>();
      data?.forEach((p) => {
        map.set(p.id, p.last_seen ? p.last_seen > fiveMinutesAgo : false);
      });
      setOnlineMap(map);
    };

    fetchOnlineStatus();
    const interval = setInterval(fetchOnlineStatus, 30000);
    return () => clearInterval(interval);
  }, [userIds.join(',')]);

  return onlineMap;
}
