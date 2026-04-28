import { useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone } from 'lucide-react';
import { useWebRTCCall, CallType } from '@/hooks/useWebRTCCall';
import { Button } from '@/components/ui/button';

interface CallScreenProps {
  callId: string;
  isCaller: boolean;
  callType: CallType;
  peerId: string;
  peerName: string;
  peerAvatar: string | null;
  onClose: () => void;
}

export default function CallScreen({ callId, isCaller, callType, peerId, peerName, peerAvatar, onClose }: CallScreenProps) {
  const { status, localStream, remoteStream, muted, videoOff, toggleMute, toggleVideo, hangup } = useWebRTCCall(
    callId,
    isCaller,
    peerId,
    callType
  );
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localRef.current && localStream) localRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current && remoteStream) remoteRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    if (status === 'ended') {
      const t = setTimeout(onClose, 800);
      return () => clearTimeout(t);
    }
  }, [status, onClose]);

  const handleHangup = async () => {
    await hangup();
    onClose();
  };

  const initials = peerName.slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-background via-background to-primary/10 flex flex-col">
      {/* Remote video / avatar */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {callType === 'video' && remoteStream ? (
          <video ref={remoteRef} autoPlay playsInline className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-6">
            {peerAvatar ? (
              <img src={peerAvatar} alt={peerName} className="w-32 h-32 rounded-full object-cover ring-4 ring-primary/30" />
            ) : (
              <div className="w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center text-4xl font-bold text-primary">
                {initials}
              </div>
            )}
            <div className="text-center">
              <h2 className="text-2xl font-display font-bold text-foreground">{peerName}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {status === 'connecting' && (isCaller ? 'Calling…' : 'Connecting…')}
                {status === 'connected' && (callType === 'video' ? 'Video call' : 'Voice call')}
                {status === 'ended' && 'Call ended'}
              </p>
            </div>
          </div>
        )}

        {/* Local video preview */}
        {callType === 'video' && localStream && (
          <div className="absolute top-4 right-4 w-28 h-40 sm:w-32 sm:h-44 rounded-xl overflow-hidden border-2 border-primary/40 bg-black shadow-2xl">
            <video ref={localRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-6 pb-10 flex items-center justify-center gap-4 glass-surface border-t border-border">
        <Button
          size="icon"
          variant={muted ? 'destructive' : 'secondary'}
          className="h-14 w-14 rounded-full"
          onClick={toggleMute}
        >
          {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </Button>

        {callType === 'video' && (
          <Button
            size="icon"
            variant={videoOff ? 'destructive' : 'secondary'}
            className="h-14 w-14 rounded-full"
            onClick={toggleVideo}
          >
            {videoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </Button>
        )}

        <Button
          size="icon"
          variant="destructive"
          className="h-16 w-16 rounded-full"
          onClick={handleHangup}
        >
          <PhoneOff className="w-7 h-7" />
        </Button>
      </div>
    </div>
  );
}
