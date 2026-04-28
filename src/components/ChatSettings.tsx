import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Bell, Lock, Eye, EyeOff, Clock, MessageSquare, Volume2, Vibrate, Shield, Trash2, Info, Loader2, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useNotifications } from '@/hooks/useNotifications';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ChatSettingsProps {
  onBack: () => void;
  section?: 'notifications' | 'privacy' | 'account' | null;
}

export default function ChatSettings({ onBack, section: initialSection }: ChatSettingsProps) {
  const { user, signOut } = useAuth();
  const { requestPermission, browserPermission } = useNotifications();
  const [section, setSection] = useState<string | null>(initialSection || null);

  // Notification settings
  const [msgNotif, setMsgNotif] = useState(true);
  const [groupNotif, setGroupNotif] = useState(true);
  const [statusNotif, setStatusNotif] = useState(true);
  const [sound, setSound] = useState(true);
  const [vibration, setVibration] = useState(true);
  const [preview, setPreview] = useState(true);

  // Privacy settings
  const [lastSeenPrivacy, setLastSeenPrivacy] = useState('everyone');
  const [profilePhotoPrivacy, setProfilePhotoPrivacy] = useState('everyone');
  const [aboutPrivacy, setAboutPrivacy] = useState('everyone');
  const [readReceipts, setReadReceipts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Load notification settings
    supabase.from('notification_settings').select('*').eq('user_id', user.id).single().then(({ data }) => {
      if (data) {
        setMsgNotif(data.message_notifications ?? true);
        setGroupNotif(data.group_notifications ?? true);
        setStatusNotif(data.status_notifications ?? true);
        setSound(data.sound_enabled ?? true);
        setVibration(data.vibration_enabled ?? true);
        setPreview(data.show_preview ?? true);
      }
    });
    // Load privacy settings
    supabase.from('profiles').select('privacy_last_seen, privacy_profile_photo, privacy_about, privacy_read_receipts').eq('id', user.id).single().then(({ data }) => {
      if (data) {
        setLastSeenPrivacy(data.privacy_last_seen || 'everyone');
        setProfilePhotoPrivacy(data.privacy_profile_photo || 'everyone');
        setAboutPrivacy(data.privacy_about || 'everyone');
        setReadReceipts(data.privacy_read_receipts ?? true);
      }
    });
  }, [user]);

  const saveNotifications = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from('notification_settings').upsert({
      user_id: user.id,
      message_notifications: msgNotif,
      group_notifications: groupNotif,
      status_notifications: statusNotif,
      sound_enabled: sound,
      vibration_enabled: vibration,
      show_preview: preview,
    }, { onConflict: 'user_id' });
    setSaving(false);
    toast.success('Notification settings saved');
  };

  const savePrivacy = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from('profiles').update({
      privacy_last_seen: lastSeenPrivacy,
      privacy_profile_photo: profilePhotoPrivacy,
      privacy_about: aboutPrivacy,
      privacy_read_receipts: readReceipts,
    }).eq('id', user.id);
    setSaving(false);
    toast.success('Privacy settings saved');
  };

  const deleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    // Delete user data
    await supabase.from('statuses').delete().eq('user_id', user.id);
    await supabase.from('direct_messages').delete().eq('sender_id', user.id);
    await supabase.from('messages').delete().eq('user_id', user.id);
    await supabase.from('notification_settings').delete().eq('user_id', user.id);
    await supabase.from('user_contacts').delete().eq('user_id', user.id);
    await supabase.from('profiles').delete().eq('id', user.id);
    await signOut();
    setDeleting(false);
    toast.success('Account data deleted. Your auth account will be removed.');
  };

  if (section === 'notifications') {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-border glass-surface flex items-center gap-2">
          <button onClick={() => setSection(null)} className="p-1 rounded-lg hover:bg-secondary/50 text-muted-foreground"><ArrowLeft className="w-5 h-5" /></button>
          <h2 className="font-display font-semibold text-foreground">Notifications</h2>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-muted-foreground" /><Label>Message notifications</Label></div>
            <Switch checked={msgNotif} onCheckedChange={setMsgNotif} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-muted-foreground" /><Label>Group notifications</Label></div>
            <Switch checked={groupNotif} onCheckedChange={setGroupNotif} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-muted-foreground" /><Label>Status notifications</Label></div>
            <Switch checked={statusNotif} onCheckedChange={setStatusNotif} />
          </div>
          <div className="border-t border-border pt-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Volume2 className="w-4 h-4 text-muted-foreground" /><Label>Sound</Label></div>
            <Switch checked={sound} onCheckedChange={setSound} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Vibrate className="w-4 h-4 text-muted-foreground" /><Label>Vibration</Label></div>
            <Switch checked={vibration} onCheckedChange={setVibration} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-muted-foreground" /><Label>Show preview</Label></div>
            <Switch checked={preview} onCheckedChange={setPreview} />
          </div>
          <div className="border-t border-border pt-4" />
          <div className="space-y-2">
            <div className="flex items-center gap-2"><BellRing className="w-4 h-4 text-muted-foreground" /><Label>Browser notifications</Label></div>
            <p className="text-xs text-muted-foreground">
              {browserPermission === 'granted' 
                ? '✅ Browser notifications are enabled' 
                : browserPermission === 'denied'
                ? '❌ Notifications blocked — enable in browser settings'
                : 'Allow browser notifications to get alerts when the app is in the background'}
            </p>
            {browserPermission === 'default' && (
              <Button variant="outline" size="sm" onClick={async () => {
                const perm = await requestPermission();
                if (perm === 'granted') toast.success('Notifications enabled!');
                else if (perm === 'denied') toast.error('Notifications blocked by browser');
              }}>
                <BellRing className="w-4 h-4 mr-2" /> Enable Notifications
              </Button>
            )}
          </div>
          <Button onClick={saveNotifications} className="w-full" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </div>
    );
  }

  if (section === 'privacy') {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-border glass-surface flex items-center gap-2">
          <button onClick={() => setSection(null)} className="p-1 rounded-lg hover:bg-secondary/50 text-muted-foreground"><ArrowLeft className="w-5 h-5" /></button>
          <h2 className="font-display font-semibold text-foreground">Privacy</h2>
        </div>
        <div className="p-4 space-y-5 overflow-y-auto flex-1">
          <div className="space-y-2">
            <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-muted-foreground" /><Label>Last seen</Label></div>
            <Select value={lastSeenPrivacy} onValueChange={setLastSeenPrivacy}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="everyone">Everyone</SelectItem>
                <SelectItem value="contacts">My contacts</SelectItem>
                <SelectItem value="nobody">Nobody</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-muted-foreground" /><Label>Profile photo</Label></div>
            <Select value={profilePhotoPrivacy} onValueChange={setProfilePhotoPrivacy}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="everyone">Everyone</SelectItem>
                <SelectItem value="contacts">My contacts</SelectItem>
                <SelectItem value="nobody">Nobody</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2"><Info className="w-4 h-4 text-muted-foreground" /><Label>About</Label></div>
            <Select value={aboutPrivacy} onValueChange={setAboutPrivacy}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="everyone">Everyone</SelectItem>
                <SelectItem value="contacts">My contacts</SelectItem>
                <SelectItem value="nobody">Nobody</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><EyeOff className="w-4 h-4 text-muted-foreground" /><Label>Read receipts</Label></div>
            <Switch checked={readReceipts} onCheckedChange={setReadReceipts} />
          </div>
          <Button onClick={savePrivacy} className="w-full" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </div>
    );
  }

  if (section === 'account') {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-border glass-surface flex items-center gap-2">
          <button onClick={() => setSection(null)} className="p-1 rounded-lg hover:bg-secondary/50 text-muted-foreground"><ArrowLeft className="w-5 h-5" /></button>
          <h2 className="font-display font-semibold text-foreground">Account</h2>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <p className="text-sm text-muted-foreground">Manage your account settings and data.</p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <Trash2 className="w-4 h-4 mr-2" /> Delete My Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="glass-panel border-glass-border">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Account</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all your messages, statuses, contacts, and profile data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleting}>
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Forever'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  }

  // Main settings menu
  const items = [
    { id: 'notifications', icon: Bell, label: 'Notifications', desc: 'Message, group & status alerts' },
    { id: 'privacy', icon: Lock, label: 'Privacy', desc: 'Last seen, profile photo, read receipts' },
    { id: 'account', icon: Shield, label: 'Account', desc: 'Delete account, security' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border glass-surface flex items-center gap-2">
        <button onClick={onBack} className="p-1 rounded-lg hover:bg-secondary/50 text-muted-foreground"><ArrowLeft className="w-5 h-5" /></button>
        <h2 className="font-display font-semibold text-foreground">Chat Settings</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.map(item => (
          <button key={item.id} onClick={() => setSection(item.id)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <item.icon className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
