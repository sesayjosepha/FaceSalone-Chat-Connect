import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface QRCodeProfileProps {
  onBack: () => void;
}

export default function QRCodeProfile({ onBack }: QRCodeProfileProps) {
  const { user } = useAuth();
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('username, avatar_url').eq('id', user.id).single().then(({ data }) => {
      if (data) {
        setUsername(data.username || 'User');
        setAvatarUrl(data.avatar_url);
      }
    });
  }, [user]);

  const profileUrl = `${window.location.origin}?user=${user?.id}`;

  const shareQR = () => {
    if (navigator.share) {
      navigator.share({
        title: `${username} on FaceSalone`,
        text: `Add me on FaceSalone!`,
        url: profileUrl,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(profileUrl);
      toast.success('Profile link copied!');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border glass-surface flex items-center gap-2">
        <button onClick={onBack} className="p-1 rounded-lg hover:bg-secondary/50 text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="font-display font-semibold text-foreground">My QR Code</h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-lg">
          <QRCodeSVG
            value={profileUrl}
            size={200}
            level="H"
            imageSettings={{
              src: '/logo.png',
              height: 40,
              width: 40,
              excavate: true,
            }}
          />
        </div>

        <div className="text-center space-y-1">
          {avatarUrl && (
            <img src={avatarUrl} className="w-16 h-16 rounded-full object-cover mx-auto mb-2 border-2 border-primary" alt="" />
          )}
          <p className="text-lg font-display font-semibold text-foreground">{username}</p>
          <p className="text-xs text-muted-foreground">Scan this QR code to add me on FaceSalone</p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={shareQR}>
            <Share2 className="w-4 h-4 mr-2" /> Share
          </Button>
        </div>
      </div>
    </div>
  );
}
