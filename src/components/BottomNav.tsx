import { MessageCircle, Hash, Settings, CircleDot, Users } from 'lucide-react';

type Tab = 'chats' | 'contacts' | 'status' | 'rooms' | 'settings';

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  unreadChats?: number;
}

export default function BottomNav({ activeTab, onTabChange, unreadChats = 0 }: BottomNavProps) {
  const tabs: { id: Tab; label: string; icon: typeof MessageCircle }[] = [
    { id: 'chats', label: 'Chats', icon: MessageCircle },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'status', label: 'Status', icon: CircleDot },
    { id: 'rooms', label: 'Rooms', icon: Hash },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="border-t border-border glass-surface flex items-center justify-around py-1 safe-area-bottom">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg transition-colors relative ${
            activeTab === id
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon className="w-5 h-5" />
          <span className="text-[10px] font-medium">{label}</span>
          {id === 'chats' && unreadChats > 0 && (
            <span className="absolute top-1 right-0 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center font-bold">
              {unreadChats > 9 ? '9+' : unreadChats}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
