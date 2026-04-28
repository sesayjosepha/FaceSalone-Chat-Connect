import { useState, useEffect } from 'react';

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setFadeOut(true), 1800);
    const timer2 = setTimeout(() => onFinish(), 2300);
    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, [onFinish]);

  return (
    <div className={`fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}>
      <img src="/logo.png" alt="FaceSalone" className="w-24 h-24 rounded-2xl object-contain animate-pulse mb-4" />
      <h1 className="font-display text-2xl font-bold text-primary">FaceSalone</h1>
      <p className="text-xs text-muted-foreground mt-1">Connect. Chat. Share.</p>
    </div>
  );
}
