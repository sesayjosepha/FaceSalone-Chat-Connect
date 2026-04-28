import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type CallType = 'voice' | 'video';
export type CallStatus = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

interface SignalPayload {
  type: 'offer' | 'answer' | 'ice' | 'hangup';
  from: string;
  data?: any;
}

export function useWebRTCCall(callId: string | null, isCaller: boolean, peerId: string | null, callType: CallType) {
  const { user } = useAuth();
  const [status, setStatus] = useState<CallStatus>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<any>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteSetRef = useRef(false);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    pendingIceRef.current = [];
    remoteSetRef.current = false;
    setStatus('ended');
  }, [localStream]);

  const sendSignal = useCallback(
    async (payload: Omit<SignalPayload, 'from'>) => {
      if (!channelRef.current || !user) return;
      await channelRef.current.send({
        type: 'broadcast',
        event: 'signal',
        payload: { ...payload, from: user.id },
      });
    },
    [user]
  );

  const hangup = useCallback(async () => {
    if (callId) {
      await supabase.from('calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', callId);
    }
    sendSignal({ type: 'hangup' });
    cleanup();
  }, [callId, sendSignal, cleanup]);

  const toggleMute = useCallback(() => {
    if (!localStream) return;
    const enabled = localStream.getAudioTracks()[0]?.enabled;
    localStream.getAudioTracks().forEach((t) => (t.enabled = !enabled));
    setMuted(enabled);
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (!localStream) return;
    const enabled = localStream.getVideoTracks()[0]?.enabled;
    localStream.getVideoTracks().forEach((t) => (t.enabled = !enabled));
    setVideoOff(enabled);
  }, [localStream]);

  useEffect(() => {
    if (!callId || !user || !peerId) return;

    let active = true;
    setStatus('connecting');

    const init = async () => {
      try {
        // Get local media
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'video',
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setLocalStream(stream);

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (e) => {
          setRemoteStream(e.streams[0]);
          setStatus('connected');
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) sendSignal({ type: 'ice', data: e.candidate.toJSON() });
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            toast.error('Call disconnected');
            cleanup();
          }
        };

        // Signaling channel
        const channel = supabase.channel(`call:${callId}`, {
          config: { broadcast: { self: false } },
        });
        channelRef.current = channel;

        channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
          const sig = payload as SignalPayload;
          if (sig.from === user.id) return;
          if (!pcRef.current) return;

          if (sig.type === 'offer') {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(sig.data));
            remoteSetRef.current = true;
            for (const c of pendingIceRef.current) await pcRef.current.addIceCandidate(c);
            pendingIceRef.current = [];
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            sendSignal({ type: 'answer', data: answer });
          } else if (sig.type === 'answer') {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(sig.data));
            remoteSetRef.current = true;
            for (const c of pendingIceRef.current) await pcRef.current.addIceCandidate(c);
            pendingIceRef.current = [];
          } else if (sig.type === 'ice') {
            if (remoteSetRef.current) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(sig.data));
            } else {
              pendingIceRef.current.push(sig.data);
            }
          } else if (sig.type === 'hangup') {
            toast('Call ended');
            cleanup();
          }
        });

        await new Promise<void>((resolve) => {
          channel.subscribe((s) => {
            if (s === 'SUBSCRIBED') resolve();
          });
        });

        if (isCaller) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal({ type: 'offer', data: offer });
        }
      } catch (err: any) {
        console.error('Call init error:', err);
        toast.error(err.message || 'Failed to start call');
        cleanup();
      }
    };

    init();

    // Listen for call status updates (decline / end from other side)
    const statusChannel = supabase
      .channel(`call-status:${callId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${callId}` }, (payload) => {
        const newStatus = (payload.new as any).status;
        if (newStatus === 'declined') {
          toast('Call declined');
          cleanup();
        } else if (newStatus === 'ended' && status !== 'ended') {
          cleanup();
        }
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(statusChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, user?.id, peerId, callType, isCaller]);

  return { status, localStream, remoteStream, muted, videoOff, toggleMute, toggleVideo, hangup };
}
