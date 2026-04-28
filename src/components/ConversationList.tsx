import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Plus, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { formatMessageTime, canViewLastSeen, canViewProfilePhoto } from '@/lib/chatUtils';

interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  last_seen: string | null;
}

interface Conversation {
  id: string;
  user_one: string;
  user_two: string;
  last_message_at: string | null;
  otherUser?: Profile;
  lastMessage?: string;
  unreadCount?: number;
}

interface ConversationListProps {
  onSelectConversation: (conv: Conversation) => void;
  selectedId: string | null;
  onNavigateToSettings?: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export default function ConversationList({ onSelectConversation, selectedId, onNavigateToSettings, onUnreadCountChange }: ConversationListProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [contactUsers, setContactUsers] = useState<Profile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [privacyMap, setPrivacyMap] = useState<Map<string, { last_seen: string; profile_photo: string }>>(new Map());
  const [myContactIds, setMyContactIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchConversations();

    const channel = supabase
      .channel('conversations-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        fetchConversations();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchConversations = async () => {
    if (!user) return;
    const { data: convs, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`user_one.eq.${user.id},user_two.eq.${user.id}`)
      .order('last_message_at', { ascending: false });

    if (error) { setLoading(false); return; }

    const otherIds = (convs || []).map(c => c.user_one === user.id ? c.user_two : c.user_one);
    let profileMap = new Map<string, Profile>();
    if (otherIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url, last_seen').in('id', otherIds);
      profiles?.forEach(p => profileMap.set(p.id, p));
    }

    // Fetch read statuses
    const convIds = (convs || []).map(c => c.id);
    let readMap = new Map<string, string>();
    if (convIds.length > 0) {
      const { data: reads } = await supabase
        .from('conversation_reads')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id)
        .in('conversation_id', convIds);
      reads?.forEach(r => readMap.set(r.conversation_id, r.last_read_at || ''));
    }

    // Fetch privacy settings for other users
    if (otherIds.length > 0) {
      const { data: privs } = await supabase
        .from('profiles')
        .select('id, privacy_last_seen, privacy_profile_photo')
        .in('id', otherIds);
      const pMap = new Map<string, { last_seen: string; profile_photo: string }>();
      privs?.forEach(p => pMap.set(p.id, { last_seen: p.privacy_last_seen || 'everyone', profile_photo: p.privacy_profile_photo || 'everyone' }));
      setPrivacyMap(pMap);
    }

    // Fetch which of these users have ME in their contacts
    if (otherIds.length > 0) {
      const { data: contactsBack } = await supabase
        .from('user_contacts')
        .select('user_id')
        .in('user_id', otherIds)
        .eq('contact_user_id', user.id);
      setMyContactIds(new Set(contactsBack?.map(c => c.user_id) || []));
    }

    const enriched = await Promise.all((convs || []).map(async (c) => {
      const otherId = c.user_one === user.id ? c.user_two : c.user_one;
      const { data: lastMsg } = await supabase
        .from('direct_messages')
        .select('content, attachment_type')
        .eq('conversation_id', c.id)
        .order('inserted_at', { ascending: false })
        .limit(1)
        .single();

      // Count unread messages
      const lastRead = readMap.get(c.id);
      let unreadCount = 0;
      if (lastRead) {
        const { count } = await supabase
          .from('direct_messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', c.id)
          .neq('sender_id', user.id)
          .gt('inserted_at', lastRead);
        unreadCount = count || 0;
      } else {
        const { count } = await supabase
          .from('direct_messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', c.id)
          .neq('sender_id', user.id);
        unreadCount = count || 0;
      }

      return {
        ...c,
        otherUser: profileMap.get(otherId),
        lastMessage: lastMsg?.attachment_type
          ? `📎 ${lastMsg.attachment_type}`
          : lastMsg?.content || '',
        unreadCount,
      };
    }));

    setConversations(enriched);
    const totalUnread = enriched.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    onUnreadCountChange?.(totalUnread);
    setLoading(false);
  };

  const startNewChat = async (otherUser: Profile) => {
    if (!user) return;
    const [u1, u2] = [user.id, otherUser.id].sort();
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_one', u1)
      .eq('user_two', u2)
      .single();

    if (existing) {
      onSelectConversation({ ...existing, otherUser });
      setShowNewChat(false);
      return;
    }

    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_one: u1, user_two: u2 })
      .select()
      .single();

    if (error) { toast.error('Failed to start conversation'); return; }
    onSelectConversation({ ...data, otherUser });
    setShowNewChat(false);
    fetchConversations();
  };

  const fetchContactUsers = async () => {
    if (!user) return;
    // Only fetch users that are in the current user's contacts
    const { data: contacts } = await supabase
      .from('user_contacts')
      .select('contact_user_id')
      .eq('user_id', user.id)
      .not('contact_user_id', 'is', null);

    const contactIds = (contacts || []).map(c => c.contact_user_id).filter(Boolean) as string[];
    
    if (contactIds.length === 0) {
      setContactUsers([]);
      setShowNewChat(true);
      toast.info('No contacts on FaceSalone yet. Add contacts in Settings → Contacts.');
      return;
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, last_seen')
      .in('id', contactIds);
    
    setContactUsers(profiles || []);
    setShowNewChat(true);
  };

  const isOnline = (lastSeen: string | null, otherId?: string) => {
    if (!lastSeen) return false;
    const raw = new Date(lastSeen) > new Date(Date.now() - 5 * 60 * 1000);
    if (!otherId) return raw;
    const priv = privacyMap.get(otherId);
    const amContact = myContactIds.has(otherId);
    return canViewLastSeen(priv?.last_seen as any, amContact) ? raw : false;
  };

  const showAvatar = (otherId?: string) => {
    if (!otherId) return true;
    const priv = privacyMap.get(otherId);
    const amContact = myContactIds.has(otherId);
    return canViewProfilePhoto(priv?.profile_photo as any, amContact);
  };

  const getInitials = (name: string | null) => name ? name.slice(0, 2).toUpperCase() : '?';

  const filtered = conversations.filter(c =>
    !search || c.otherUser?.username?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredUsers = contactUsers.filter(u =>
    !userSearch || u.username?.toLowerCase().includes(userSearch.toLowerCase())
  );

  if (showNewChat) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-border glass-surface">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display font-semibold text-foreground">New Chat</h2>
            <button onClick={() => setShowNewChat(false)} className="text-sm text-primary">Cancel</button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="pl-9 bg-secondary border-border text-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2 px-4 text-center">
              <p>No contacts found on FaceSalone</p>
              <p className="text-xs">Add friends via Settings → Contacts. They'll appear here once they join FaceSalone.</p>
            </div>
          ) : (
            filteredUsers.map(u => (
              <button
                key={u.id}
                onClick={() => startNewChat(u)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
              >
                <div className="relative">
                  {showAvatar(u.id) && u.avatar_url ? (
                    <img src={u.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
                      {getInitials(showAvatar(u.id) ? u.username : '?')}
                    </div>
                  )}
                  {isOnline(u.last_seen, u.id) && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-online border-2 border-background" />
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">{u.username || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{isOnline(u.last_seen, u.id) ? 'Online' : 'Offline'}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border glass-surface">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button onClick={onNavigateToSettings} className="shrink-0">
              <img src="/logo.png" alt="FaceSalone" className="w-8 h-8 rounded-lg object-contain hover:ring-2 hover:ring-primary transition-all" />
            </button>
            <h2 className="font-display font-semibold text-foreground">Chats</h2>
          </div>
          <button onClick={fetchContactUsers} className="p-2 rounded-lg hover:bg-secondary/50 text-primary">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-border text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
            <p>No conversations yet</p>
            <button onClick={fetchContactUsers} className="text-primary text-xs hover:underline">Start a new chat</button>
          </div>
        ) : (
          filtered.map(conv => (
            <button
              key={conv.id}
              onClick={() => onSelectConversation(conv)}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                selectedId === conv.id ? 'bg-secondary' : 'hover:bg-secondary/50'
              }`}
            >
              <div className="relative">
                {showAvatar(conv.otherUser?.id) && conv.otherUser?.avatar_url ? (
                  <img src={conv.otherUser.avatar_url} className="w-12 h-12 rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
                    {getInitials(showAvatar(conv.otherUser?.id) ? conv.otherUser?.username || null : null)}
                  </div>
                )}
                {isOnline(conv.otherUser?.last_seen || null, conv.otherUser?.id) && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-online border-2 border-background" />
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex justify-between items-baseline">
                  <p className="text-sm font-medium text-foreground truncate">{conv.otherUser?.username || 'Unknown'}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground shrink-0">{formatMessageTime(conv.last_message_at)}</span>
                    {(conv.unreadCount || 0) > 0 && (
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                        {conv.unreadCount! > 9 ? '9+' : conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
                <p className={`text-xs truncate ${(conv.unreadCount || 0) > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  {conv.lastMessage || 'Start chatting...'}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}