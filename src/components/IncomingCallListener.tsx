import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CallScreen from '@/components/CallScreen';
import type { CallType } from '@/hooks/useWebRTCCall';

interface IncomingCall {
  id: string;
  caller_id: string;
  call_type: CallType;
  caller_name: string;
  caller_avatar: string | null;
}

interface ActiveCall {
  id: string;
  isCaller: boolean;
  callType: CallType;
  peerId: string;
  peerName: string;
  peerAvatar: string | null;
}

export default function IncomingCallListener() {
  const { user } = useAuth();
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [active, setActive] = useState<ActiveCall | null>(null);
  const ringRef = useRef<HTMLAudioElement | null>(null);

  // Ringtone (synthesized via WebAudio so we don't need an asset file)
  useEffect(() => {
    if (!incoming) return;
    let ctx: AudioContext | null = null;
    let interval: number | null = null;
    try {
      ctx = new AudioContext();
      const ring = () => {
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 480;
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      };
      ring();
      interval = window.setInterval(ring, 1500);
    } catch {}
    return () => {
      if (interval) clearInterval(interval);
      ctx?.close();
    };
  }, [incoming]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`incoming-calls:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'calls', filter: `callee_id=eq.${user.id}` },
        async (payload) => {
          const call = payload.new as any;
          if (call.status !== 'ringing') return;
          // Fetch caller profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', call.caller_id)
            .maybeSingle();
          setIncoming({
            id: call.id,
            caller_id: call.caller_id,
            call_type: call.call_type,
            caller_name: profile?.username || 'Unknown',
            caller_avatar: profile?.avatar_url || null,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls', filter: `callee_id=eq.${user.id}` },
        (payload) => {
          const call = payload.new as any;
          if ((call.status === 'ended' || call.status === 'declined') && incoming?.id === call.id) {
            setIncoming(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, incoming?.id]);

  // Auto-mark as missed after 30s
  useEffect(() => {
    if (!incoming) return;
    const timer = setTimeout(async () => {
      if (incoming) {
        await supabase.from('calls').update({ status: 'missed', ended_at: new Date().toISOString() }).eq('id', incoming.id);
        setIncoming(null);
      }
    }, 30000);
    return () => clearTimeout(timer);
  }, [incoming]);

  const accept = async () => {
    if (!incoming) return;
    await supabase.from('calls').update({ status: 'accepted', started_at: new Date().toISOString() }).eq('id', incoming.id);
    setActive({
      id: incoming.id,
      isCaller: false,
      callType: incoming.call_type,
      peerId: incoming.caller_id,
      peerName: incoming.caller_name,
      peerAvatar: incoming.caller_avatar,
    });
    setIncoming(null);
  };

  const decline = async () => {
    if (!incoming) return;
    await supabase.from('calls').update({ status: 'declined', ended_at: new Date().toISOString() }).eq('id', incoming.id);
    setIncoming(null);
  };

  // Listen for window event to start outgoing call
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setActive(detail);
    };
    window.addEventListener('start-call', handler as EventListener);
    return () => window.removeEventListener('start-call', handler as EventListener);
  }, []);

  if (active) {
    return (
      <CallScreen
        callId={active.id}
        isCaller={active.isCaller}
        callType={active.callType}
        peerId={active.peerId}
        peerName={active.peerName}
        peerAvatar={active.peerAvatar}
        onClose={() => setActive(null)}
      />
    );
  }

  if (!incoming) return null;

  const initials = incoming.caller_name.slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-background via-background to-primary/20 flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
        {incoming.caller_avatar ? (
          <img src={incoming.caller_avatar} alt={incoming.caller_name} className="w-32 h-32 rounded-full object-cover ring-4 ring-primary animate-pulse" />
        ) : (
          <div className="w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center text-4xl font-bold text-primary ring-4 ring-primary animate-pulse">
            {initials}
          </div>
        )}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Incoming {incoming.call_type} call</p>
          <h2 className="text-2xl font-display font-bold text-foreground mt-1">{incoming.caller_name}</h2>
        </div>
      </div>

      <div className="flex items-center gap-12 mt-16">
        <Button size="icon" variant="destructive" className="h-16 w-16 rounded-full" onClick={decline}>
          <PhoneOff className="w-7 h-7" />
        </Button>
        <Button size="icon" className="h-16 w-16 rounded-full bg-online hover:bg-online/90" onClick={accept}>
          {incoming.call_type === 'video' ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
        </Button>
      </div>
    </div>
  );
}
