import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Hash, Search, ArrowLeft, Loader2, Plus, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ChatWindow from '@/components/ChatWindow';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Room {
  id: string;
  name: string;
  created_by: string | null;
  is_private: boolean | null;
  lastMessage?: string;
  memberCount?: number;
}

export default function RoomsTab() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [search, setSearch] = useState('');
  const [searchAll, setSearchAll] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());

  useEffect(() => { fetchMyRooms(); }, [user]);

  useEffect(() => {
    if (!currentRoom || !user) return;
    supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id);
    const channel = supabase.channel(`presence:${currentRoom.id}`, {
      config: { presence: { key: user.id } },
    });
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const online = new Set<string>();
        const typing = new Map<string, string>();
        Object.entries(state).forEach(([userId, presences]) => {
          online.add(userId);
          const p = presences as any[];
          if (p.length > 0 && p[0].typing) typing.set(userId, p[0].username || 'Someone');
        });
        setOnlineUsers(online);
        setTypingUsers(typing);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online: true, typing: false, username: '' });
        }
      });

    const heartbeat = setInterval(() => {
      supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id);
    }, 30000);

    return () => { clearInterval(heartbeat); supabase.removeChannel(channel); };
  }, [currentRoom?.id, user]);

  const handleTyping = useCallback(async (isTyping: boolean, username: string) => {
    if (!currentRoom || !user) return;
    const channels = supabase.getChannels();
    const ch = channels.find(c => c.topic === `realtime:presence:${currentRoom.id}`);
    if (ch) try { await (ch as any).track({ online: true, typing: isTyping, username }); } catch {}
  }, [currentRoom?.id, user]);

  const fetchMyRooms = async () => {
    if (!user) return;
    // Fetch rooms where user is a member
    const { data: memberships } = await supabase
      .from('room_members')
      .select('room_id')
      .eq('user_id', user.id);

    const roomIds = memberships?.map(m => m.room_id) || [];

    if (roomIds.length === 0) {
      setRooms([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.from('rooms').select('*').in('id', roomIds).order('created_at', { ascending: true });
    if (error) { toast.error('Failed to load rooms'); setLoading(false); return; }

    const enriched = await Promise.all((data || []).map(async (room) => {
      // Last message
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('content, attachment_type')
        .eq('room_id', room.id)
        .order('inserted_at', { ascending: false })
        .limit(1)
        .single();

      // Member count
      const { count: memberCount } = await supabase
        .from('room_members')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', room.id);

      return {
        ...room,
        lastMessage: lastMsg?.attachment_type
          ? `📎 ${lastMsg.attachment_type}`
          : lastMsg?.content || '',
        memberCount: memberCount || 0,
      };
    }));

    setRooms(enriched);
    setLoading(false);
  };

  const searchRooms = async () => {
    if (!searchAll.trim()) return;
    setSearchLoading(true);
    const { data } = await supabase.from('rooms').select('*').ilike('name', `%${searchAll.trim()}%`).limit(20);
    setAllRooms(data || []);
    setSearchLoading(false);
  };

  const joinRoom = async (room: Room) => {
    if (!user) return;
    await supabase.from('room_members').insert({ room_id: room.id, user_id: user.id });
    toast.success(`Joined ${room.name}!`);
    setShowSearch(false);
    setSearchAll('');
    setAllRooms([]);
    fetchMyRooms();
  };

  const myRoomIds = new Set(rooms.map(r => r.id));
  const filtered = rooms.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()));

  if (currentRoom) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-border glass-surface flex items-center gap-2">
          <button onClick={() => setCurrentRoom(null)} className="p-1 rounded-lg hover:bg-secondary/50 text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Hash className="w-4 h-4 text-muted-foreground" />
          <span className="font-display font-semibold text-foreground text-sm">{currentRoom.name}</span>
        </div>
        <div className="flex-1 min-h-0">
          <ChatWindow roomId={currentRoom.id} roomName={currentRoom.name} onlineUsers={onlineUsers} typingUsers={typingUsers} onTyping={handleTyping} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border glass-surface">
        <div className="flex items-center gap-2 mb-2">
          <img src="/logo.png" alt="FaceSalone" className="w-8 h-8 rounded-lg object-contain" />
          <h2 className="font-display font-semibold text-foreground flex-1">Rooms</h2>
          <button onClick={() => setShowSearch(true)} className="p-2 rounded-lg hover:bg-secondary/50 text-primary" title="Find & join rooms">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search my rooms..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary border-border text-sm" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8 space-y-3">
            <Hash className="w-12 h-12 mx-auto text-muted-foreground/50" />
            <p>No rooms yet</p>
            <Button size="sm" onClick={() => setShowSearch(true)}>Find rooms to join</Button>
          </div>
        ) : (
          filtered.map(room => (
            <button key={room.id} onClick={() => setCurrentRoom(room)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Hash className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{room.name}</p>
                <p className="text-xs text-muted-foreground truncate">{room.lastMessage || `${room.memberCount || 0} members`}</p>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{room.memberCount || 0} members</span>
            </button>
          ))
        )}
      </div>

      {/* Search & Join Dialog */}
      <Dialog open={showSearch} onOpenChange={setShowSearch}>
        <DialogContent className="glass-panel border-glass-border">
          <DialogHeader><DialogTitle className="font-display">Find Rooms</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="flex gap-2">
              <Input value={searchAll} onChange={e => setSearchAll(e.target.value)} placeholder="Search room name..." className="bg-secondary border-border"
                onKeyDown={e => e.key === 'Enter' && searchRooms()} />
              <Button onClick={searchRooms} disabled={searchLoading}>
                {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {allRooms.map(room => (
                <div key={room.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-primary" />
                    <span className="text-sm text-foreground">{room.name}</span>
                  </div>
                  {myRoomIds.has(room.id) ? (
                    <span className="text-xs text-muted-foreground">Joined</span>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => joinRoom(room)}>
                      <UserPlus className="w-3 h-3 mr-1" /> Join
                    </Button>
                  )}
                </div>
              ))}
              {allRooms.length === 0 && searchAll && !searchLoading && (
                <p className="text-sm text-muted-foreground text-center py-4">No rooms found. Try a different search.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
