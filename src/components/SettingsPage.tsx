import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import { Camera, Loader2, LogOut, Plus, Hash, Bell, Lock, Shield, Users, Settings as SettingsIcon, Phone, Info, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import ChatSettings from '@/components/ChatSettings';
import ContactsManager from '@/components/ContactsManager';

interface Room {
  id: string;
  name: string;
  created_by: string | null;
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [creating, setCreating] = useState(false);
  const [myRooms, setMyRooms] = useState<Room[]>([]);
  const [subPage, setSubPage] = useState<'chatSettings' | 'contacts' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('username, avatar_url, phone, bio').eq('id', user.id).single().then(({ data }) => {
      if (data) {
        setUsername(data.username || '');
        setAvatarUrl(data.avatar_url || '');
        setPhone((data as any).phone || '');
        setBio((data as any).bio || '');
      }
    });
    supabase.from('rooms').select('id, name, created_by').eq('created_by', user.id).then(({ data }) => {
      setMyRooms(data || []);
    });
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;
    setUploading(true);
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) { toast.error('Upload failed'); setUploading(false); return; }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    setAvatarUrl(data.publicUrl + '?t=' + Date.now());
    setUploading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      username: username.trim() || null,
      avatar_url: avatarUrl || null,
      phone: phone.trim() || null,
      bio: bio.trim() || null,
    }).eq('id', user.id);
    setSaving(false);
    if (error) { toast.error('Failed to save'); return; }
    toast.success('Profile updated!');
  };

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim() || !user) return;
    setCreating(true);
    const { data, error } = await supabase.from('rooms').insert({ name: newRoomName.trim(), created_by: user.id }).select().single();
    setCreating(false);
    if (error) { toast.error('Failed to create room'); return; }
    setNewRoomName('');
    setMyRooms(prev => [...prev, data]);
    toast.success('Room created!');
  };

  const getInitials = (name: string) => name ? name.slice(0, 2).toUpperCase() : '?';

  if (subPage === 'chatSettings') return <ChatSettings onBack={() => setSubPage(null)} />;
  if (subPage === 'contacts') return <ContactsManager onBack={() => setSubPage(null)} />;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-border glass-surface flex items-center gap-2">
        <img src="/logo.png" alt="FaceSalone" className="w-8 h-8 rounded-lg object-contain" />
        <h2 className="font-display font-semibold text-foreground">Settings</h2>
      </div>

      <div className="p-4 space-y-6">
        {/* Profile Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Profile</h3>
          <div className="flex justify-center">
            <button onClick={() => fileInputRef.current?.click()} className="relative group" disabled={uploading}>
              {avatarUrl ? (
                <img src={avatarUrl} className="w-20 h-20 rounded-full object-cover" alt="" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center text-2xl font-bold text-muted-foreground">
                  {getInitials(username)}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
              </div>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={username} onChange={e => setUsername(e.target.value)} className="bg-secondary border-border" placeholder="Your username" />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} className="bg-secondary border-border" placeholder="+1234567890" />
          </div>
          <div className="space-y-2">
            <Label>Bio</Label>
            <Input value={bio} onChange={e => setBio(e.target.value)} className="bg-secondary border-border" placeholder="About you..." />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email || ''} disabled className="bg-secondary/50 border-border text-muted-foreground" />
          </div>
          <Button onClick={handleSave} className="w-full" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Profile'}
          </Button>
        </section>

        {/* Quick links */}
        <section className="space-y-1">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Settings</h3>
          <button onClick={() => setSubPage('chatSettings')} className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-secondary/50 transition-colors">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center"><Bell className="w-4 h-4 text-primary" /></div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Chat Settings</p>
              <p className="text-xs text-muted-foreground">Notifications, privacy, account</p>
            </div>
          </button>
          <button onClick={() => setSubPage('contacts')} className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-secondary/50 transition-colors">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center"><Users className="w-4 h-4 text-primary" /></div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Contacts</p>
              <p className="text-xs text-muted-foreground">Manage your phone contacts</p>
            </div>
          </button>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              {theme === 'dark' ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-primary" />}
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Appearance</p>
              <p className="text-xs text-muted-foreground">{theme === 'dark' ? 'Dark mode active' : 'Light mode active'}</p>
            </div>
          </button>
        </section>

        {/* Create Room Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Create Room</h3>
          <form onSubmit={createRoom} className="flex gap-2">
            <Input placeholder="Room name..." value={newRoomName} onChange={e => setNewRoomName(e.target.value)} className="bg-secondary border-border" />
            <Button type="submit" size="icon" disabled={creating || !newRoomName.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </form>
          {myRooms.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Your rooms:</p>
              {myRooms.map(r => (
                <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/30 text-sm">
                  <Hash className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">{r.name}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sign Out */}
        <section>
          <Button variant="ghost" onClick={signOut} className="w-full justify-start text-muted-foreground hover:text-destructive">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </section>

        {/* Developer Credits */}
        <section className="py-4 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">Developed by</p>
          <p className="text-sm font-semibold text-foreground mt-1">Joseph Abu Sesay</p>
          <p className="text-xs text-primary">FaceSalone IT Specialist</p>
        </section>
      </div>
    </div>
  );
}
