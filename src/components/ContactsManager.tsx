import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Plus, Trash2, Search, Loader2, Phone, Mail, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Contact {
  id: string;
  contact_name: string;
  phone_number: string;
  email: string | null;
  contact_user_id: string | null;
}

interface ContactsManagerProps {
  onBack: () => void;
}

export default function ContactsManager({ onBack }: ContactsManagerProps) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, [user]);

  const fetchContacts = async () => {
    if (!user) return;
    const { data } = await supabase.from('user_contacts').select('*').eq('user_id', user.id).order('contact_name');
    setContacts(data || []);
    setLoading(false);
  };

  const addContact = async () => {
    if (!name.trim() || !phone.trim() || !user) return;
    setAdding(true);

    // Try to find matching user by phone
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

  const filtered = contacts.filter(c =>
    !search || c.contact_name.toLowerCase().includes(search.toLowerCase()) || c.phone_number.includes(search)
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border glass-surface flex items-center gap-2">
        <button onClick={onBack} className="p-1 rounded-lg hover:bg-secondary/50 text-muted-foreground"><ArrowLeft className="w-5 h-5" /></button>
        <h2 className="font-display font-semibold text-foreground flex-1">Contacts</h2>
        <button onClick={() => setShowAdd(true)} className="p-2 rounded-lg hover:bg-secondary/50 text-primary"><UserPlus className="w-5 h-5" /></button>
      </div>

      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary border-border text-sm" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            {contacts.length === 0 ? 'No contacts yet. Add one!' : 'No matches found'}
          </div>
        ) : (
          filtered.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors group">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                {c.contact_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{c.contact_name}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <a href={`tel:${c.phone_number}`} className="flex items-center gap-1 hover:text-primary">
                    <Phone className="w-3 h-3" /> {c.phone_number}
                  </a>
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-primary">
                      <Mail className="w-3 h-3" /> {c.email}
                    </a>
                  )}
                </div>
                {c.contact_user_id && <span className="text-[10px] text-primary">On FaceSalone</span>}
              </div>
              <button onClick={() => deleteContact(c.id)} className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

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
}
