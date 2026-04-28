import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Hash, Plus, LogOut, MessageSquare, X, Menu, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import ProfileEditor from '@/components/ProfileEditor';

interface Room {
  id: string;
  name: string;
  created_by: string | null;
  is_private: boolean | null;
}

interface Profile {
  username: string | null;
  avatar_url: string | null;
}

interface RoomSidebarProps {
  currentRoom: Room | null;
  onSelectRoom: (room: Room) => void;
  isOpen: boolean;
  onClose: () => void;
  onlineCount: number;
}

export default function RoomSidebar({ currentRoom, onSelectRoom, isOpen, onClose, onlineCount }: RoomSidebarProps) {
  const { user, signOut } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [creating, setCreating] = useState(false);
  const [profile, setProfile] = useState<Profile>({ username: null, avatar_url: null });

  useEffect(() => {
    fetchRooms();
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('username, avatar_url').eq('id', user.id).single();
    if (data) setProfile(data);
  };

  const fetchRooms = async () => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) { toast.error('Failed to load rooms'); return; }
    setRooms(data || []);
    if (data && data.length > 0 && !currentRoom) {
      onSelectRoom(data[0]);
    }
  };

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim() || !user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('rooms')
      .insert({ name: newRoomName.trim(), created_by: user.id })
      .select()
      .single();
    setCreating(false);
    if (error) { toast.error('Failed to create room'); return; }
    setNewRoomName('');
    setRooms((prev) => [...prev, data]);
    onSelectRoom(data);
  };

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-30 md:hidden" onClick={onClose} />}
      <aside className={`fixed md:relative z-40 top-0 left-0 h-full w-72 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary" />
            </div>
            <h1 className="font-display font-bold text-foreground">FaceSalone</h1>
          </div>
          <button onClick={onClose} className="md:hidden text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Online count */}
        <div className="px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-online" />
          <span>{onlineCount} online</span>
        </div>

        <div className="p-3 pt-0">
          <form onSubmit={createRoom} className="flex gap-2">
            <Input
              placeholder="New room..."
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              className="text-sm bg-sidebar-accent border-sidebar-border"
            />
            <Button type="submit" size="icon" variant="ghost" disabled={creating || !newRoomName.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </form>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-0.5">
          {rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => { onSelectRoom(room); onClose(); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${currentRoom?.id === room.id ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`}
            >
              <Hash className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="truncate">{room.name}</span>
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-1">
          <ProfileEditor profile={profile} onUpdate={fetchProfile} />
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-muted-foreground hover:text-destructive">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>
    </>
  );
}

export function SidebarToggle({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="md:hidden p-2 text-muted-foreground hover:text-foreground">
      <Menu className="w-5 h-5" />
    </button>
  );
}
