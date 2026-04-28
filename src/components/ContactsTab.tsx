import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Plus, Loader2, UserPlus, Phone, Mail, Trash2, SortAsc, SortDesc, Share2, QrCode } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import QRCodeProfile from '@/components/QRCodeProfile';
import QRScanner from '@/components/QRScanner';

interface Contact {
  id: string;
  contact_name: string;
  phone_number: string;
  email: string | null;
  contact_user_id: string | null;
}

interface ContactProfile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  last_seen: string | null;
}

export default function ContactsTab() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ContactProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    fetchContacts();
  }, [user]);

  const fetchContacts = async () => {
    if (!user) return;
    const { data } = await supabase.from('user_contacts').select('*').eq('user_id', user.id).order('contact_name');
    const contactList = data || [];
    setContacts(contactList);

    // Fetch profiles for contacts with user IDs
    const userIds = contactList.map(c => c.contact_user_id).filter(Boolean) as string[];
    if (userIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, username, avatar_url, last_seen').in('id', userIds);
      const map = new Map<string, ContactProfile>();
      profs?.forEach(p => map.set(p.id, p));
      setProfiles(map);
    }
    setLoading(false);
  };

  const addContact = async () => {
    if (!name.trim() || !phone.trim() || !user) return;
    setAdding(true);
    const { data: matchedProfile } = await supabase.from('profiles').select('id').eq('phone', phone.trim()).single();
    await supabase.from('user_contacts').insert({
      user_id: user.id,
      contact_name: name.trim(),
      phone_number: phone.trim(),
      email: email.trim() || null,
      contact_user_id: matchedProfile?.id || null,
    });
    setAdding(false);
    setShowAdd(false);
    setName(''); setPhone(''); setEmail('');
    toast.success('Contact added!');
    fetchContacts();
  };

  const deleteContact = async (id: string) => {
    await supabase.from('user_contacts').delete().eq('id', id);
    toast.success('Contact removed');
    fetchContacts();
  };

  const inviteFriend = (contact: Contact) => {
    const text = `Hey ${contact.contact_name}! Join me on FaceSalone - the best chat app! Download it here: ${window.location.origin}`;
    if (navigator.share) {
      navigator.share({ title: 'Join FaceSalone', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Invite link copied!');
    }
  };

  const isOnline = (userId: string | null) => {
    if (!userId) return false;
    const profile = profiles.get(userId);
    if (!profile?.last_seen) return false;
    return new Date(profile.last_seen) > new Date(Date.now() - 5 * 60 * 1000);
  };

  const getInitials = (name: string) => name.slice(0, 2).toUpperCase();

  const filtered = contacts
    .filter(c => !search || c.contact_name.toLowerCase().includes(search.toLowerCase()) || c.phone_number.includes(search))
    .sort((a, b) => {
      const nameA = a.contact_name.toLowerCase();
      const nameB = b.contact_name.toLowerCase();
      return sortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

  const onlineContacts = filtered.filter(c => isOnline(c.contact_user_id));
  const offlineContacts = filtered.filter(c => !isOnline(c.contact_user_id));

  if (showQR) {
    return <QRCodeProfile onBack={() => setShowQR(false)} />;
  }

  if (showScanner) {
    return <QRScanner onClose={() => setShowScanner(false)} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border glass-surface">
        <div className="flex items-center gap-2 mb-2">
          <img src="/logo.png" alt="FaceSalone" className="w-8 h-8 rounded-lg object-contain" />
          <h2 className="font-display font-semibold text-foreground flex-1">Contacts</h2>
          <button onClick={() => setShowScanner(true)} className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground" title="Scan QR">
            <QrCode className="w-5 h-5" />
          </button>
          <button onClick={() => setShowQR(true)} className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground" title="My QR">
            <Share2 className="w-5 h-5" />
          </button>
          <button onClick={() => setSortAsc(!sortAsc)} className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground">
            {sortAsc ? <SortAsc className="w-5 h-5" /> : <SortDesc className="w-5 h-5" />}
          </button>
          <button onClick={() => setShowAdd(true)} className="p-2 rounded-lg hover:bg-secondary/50 text-primary">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary border-border text-sm" />
        </div>
      </div>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            {contacts.length === 0 ? (
              <div className="space-y-3">
                <UserPlus className="w-12 h-12 mx-auto text-muted-foreground/50" />
                <p>No contacts yet</p>
                <Button size="sm" onClick={() => setShowAdd(true)}>Add your first contact</Button>
              </div>
            ) : 'No matches found'}
          </div>
        ) : (
          <>
            {onlineContacts.length > 0 && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 pt-3 pb-1">
                  Online — {onlineContacts.length}
                </p>
                {onlineContacts.map(c => renderContact(c))}
              </>
            )}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 pt-3 pb-1">
              {onlineContacts.length > 0 ? `All contacts — ${offlineContacts.length}` : `Contacts — ${filtered.length}`}
            </p>
            {(onlineContacts.length > 0 ? offlineContacts : filtered).map(c => renderContact(c))}
          </>
        )}
      </div>

      {/* Add Contact Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="glass-panel border-glass-border">
          <DialogHeader><DialogTitle className="font-display">Add Contact</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>Name *</Label><Input value={name} onChange={e => setName(e.target.value)} className="bg-secondary border-border" placeholder="Contact name" /></div>
            <div><Label>Phone *</Label><Input value={phone} onChange={e => setPhone(e.target.value)} className="bg-secondary border-border" placeholder="+1234567890" /></div>
            <div><Label>Email</Label><Input value={email} onChange={e => setEmail(e.target.value)} className="bg-secondary border-border" placeholder="email@example.com" /></div>
            <Button onClick={addContact} className="w-full" disabled={adding || !name.trim() || !phone.trim()}>
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Contact'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  function renderContact(c: Contact) {
    const online = isOnline(c.contact_user_id);
    const profile = c.contact_user_id ? profiles.get(c.contact_user_id) : null;
    const avatar = profile?.avatar_url;

    return (
      <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/50 transition-colors group">
        <div className="relative">
          {avatar ? (
            <img src={avatar} className="w-10 h-10 rounded-full object-cover" alt="" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
              {getInitials(c.contact_name)}
            </div>
          )}
          {online && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-online border-2 border-background" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground truncate">{c.contact_name}</p>
            {c.contact_user_id && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">FaceSalone</span>}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {online ? 'Online' : c.phone_number}
          </p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!c.contact_user_id && (
            <button onClick={() => inviteFriend(c)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground" title="Invite">
              <Share2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => deleteContact(c.id)} className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive" title="Remove">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }
}
