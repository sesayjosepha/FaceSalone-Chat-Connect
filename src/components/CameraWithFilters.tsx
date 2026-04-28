import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Camera, RotateCcw, Download, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CameraWithFiltersProps {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}

const FILTERS = [
  { name: 'None', css: 'none' },
  { name: 'Warm', css: 'sepia(0.3) saturate(1.4) brightness(1.05)' },
  { name: 'Cool', css: 'saturate(0.8) hue-rotate(20deg) brightness(1.1)' },
  { name: 'B&W', css: 'grayscale(1) contrast(1.1)' },
  { name: 'Vintage', css: 'sepia(0.5) contrast(0.9) brightness(1.1) saturate(0.8)' },
  { name: 'Vivid', css: 'saturate(1.8) contrast(1.1) brightness(1.05)' },
  { name: 'Fade', css: 'contrast(0.85) brightness(1.15) saturate(0.7)' },
  { name: 'Drama', css: 'contrast(1.4) saturate(1.2) brightness(0.95)' },
  { name: 'Neon', css: 'saturate(2.5) brightness(1.1) hue-rotate(-10deg)' },
  { name: 'Cinema', css: 'contrast(1.2) sepia(0.15) saturate(1.3) brightness(0.95)' },
];

export default function CameraWithFilters({ onCapture, onClose }: CameraWithFiltersProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [activeFilter, setActiveFilter] = useState(0);
  const [captured, setCaptured] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const startCamera = useCallback(async () => {
    try {
      if (stream) stream.getTracks().forEach(t => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch {
      // Camera not available
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [facingMode]);

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.filter = FILTERS[activeFilter].css;
    ctx.drawImage(video, 0, 0);
    setCaptured(canvas.toDataURL('image/jpeg', 0.9));
  };

  const sendPhoto = () => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(blob => {
      if (blob) onCapture(blob);
    }, 'image/jpeg', 0.9);
  };

  const retake = () => setCaptured(null);

  const flipCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between p-3 glass-surface border-b border-border">
        <button onClick={onClose} className="text-muted-foreground"><X className="w-5 h-5" /></button>
        <div className="flex items-center gap-1"><Sparkles className="w-4 h-4 text-primary" /><span className="text-sm font-display font-semibold text-foreground">Camera</span></div>
        <button onClick={flipCamera} className="text-muted-foreground"><RotateCcw className="w-5 h-5" /></button>
      </div>

      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {captured ? (
          <img src={captured} className="max-h-full max-w-full object-contain" alt="Captured" />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="max-h-full max-w-full object-contain"
            style={{ filter: FILTERS[activeFilter].css }}
          />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Filter strip */}
      {!captured && (
        <div className="px-2 py-3 glass-surface border-t border-border">
          <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
            {FILTERS.map((f, i) => (
              <button
                key={f.name}
                onClick={() => setActiveFilter(i)}
                className={`shrink-0 flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  activeFilter === i ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-muted border border-border" style={{ filter: f.css === 'none' ? undefined : f.css }} />
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="p-4 glass-surface border-t border-border flex items-center justify-center gap-6">
        {captured ? (
          <>
            <Button variant="outline" onClick={retake} className="border-glass-border">
              <RotateCcw className="w-4 h-4 mr-2" /> Retake
            </Button>
            <Button onClick={sendPhoto}>
              <Send className="w-4 h-4 mr-2" /> Send
            </Button>
          </>
        ) : (
          <button onClick={takePhoto} className="w-16 h-16 rounded-full border-4 border-primary flex items-center justify-center hover:bg-primary/10 transition-colors">
            <div className="w-12 h-12 rounded-full bg-primary/20" />
          </button>
        )}
      </div>
    </div>
  );
}
