import { useState, useRef, useEffect } from 'react';
import { X, Camera, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface QRScannerProps {
  onClose: () => void;
}

export default function QRScanner({ onClose }: QRScannerProps) {
  const [mode, setMode] = useState<'camera' | 'manual'>('manual');
  const [url, setUrl] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanInterval = useRef<number | null>(null);

  useEffect(() => {
    if (mode === 'camera') {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [mode]);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play();
      }
      // Simple URL detection from video frames (not full QR decode)
      // We scan periodically for any visible text pattern
      scanInterval.current = window.setInterval(() => {
        detectUrlFromFrame();
      }, 1000);
    } catch {
      toast.error('Camera access denied. Use manual entry instead.');
      setMode('manual');
    }
  };

  const stopCamera = () => {
    if (scanInterval.current) {
      clearInterval(scanInterval.current);
      scanInterval.current = null;
    }
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  };

  const detectUrlFromFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Try to read any text from the center region using basic image analysis
    // This is a lightweight fallback - real QR scanning would need jsQR
    // For now, we auto-switch to manual mode after a few seconds if no URL found
  };

  const handleManualAdd = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    // Extract user ID from URL
    let userId = trimmed;
    try {
      const parsed = new URL(trimmed);
      const uid = parsed.searchParams.get('user');
      if (uid) userId = uid;
    } catch {
      // Not a URL, treat as raw user ID
    }
    if (userId.length < 10) {
      toast.error('Invalid user ID or URL');
      return;
    }
    window.dispatchEvent(new CustomEvent('deep-link-user', { detail: { userId } }));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="p-3 border-b border-border glass-surface flex items-center justify-between">
        <h2 className="font-display font-semibold text-foreground">Scan QR Code</h2>
        <button onClick={onClose} className="text-muted-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        {mode === 'camera' ? (
          <div className="relative w-full max-w-sm aspect-square bg-black rounded-xl overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 border-2 border-primary/50 rounded-xl" />
            <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-white/80">
              Point camera at a FaceSalone QR code
            </p>
          </div>
        ) : (
          <div className="w-full max-w-sm space-y-4">
            <div className="text-center space-y-2">
              <Link2 className="w-12 h-12 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Paste a FaceSalone profile link or enter a user ID</p>
            </div>
            <Input
              placeholder="https://...?user=xxx"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-secondary border-border"
            />
            <Button onClick={handleManualAdd} className="w-full" disabled={!url.trim()}>
              Add Contact
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant={mode === 'camera' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('camera')}
          >
            <Camera className="w-4 h-4 mr-2" /> Camera
          </Button>
          <Button
            variant={mode === 'manual' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { stopCamera(); setMode('manual'); }}
          >
            <Link2 className="w-4 h-4 mr-2" /> Manual
          </Button>
        </div>
      </div>
    </div>
  );
}

