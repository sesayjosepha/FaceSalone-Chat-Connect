import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/BottomNav';
import ConversationList from '@/components/ConversationList';
import DirectChatWindow from '@/components/DirectChatWindow';
import ContactsTab from '@/components/ContactsTab';
import RoomsTab from '@/components/RoomsTab';
import SettingsPage from '@/components/SettingsPage';
import StatusTab from '@/components/StatusTab';
import { toast } from 'sonner';

type Tab = 'chats' | 'contacts' | 'status' | 'rooms' | 'settings';

interface Conversation {
  id: string;
  user_one: string;
  user_two: string;
  last_message_at: string | null;
  otherUser?: {
    id: string;
    username: string | null;
    avatar_url: string | null;
    last_seen: string | null;
  };
}

export default function ChatLayout() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('chats');
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [unreadChats, setUnreadChats] = useState(0);

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConv(conv);
  };

  // Global presence heartbeat
  useEffect(() => {
    if (!user) return;
    const heartbeat = setInterval(() => {
      supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then(() => {});
    }, 30000);
    return () => clearInterval(heartbeat);
  }, [user]);

  // Deep link handler (?user=xxx)
  useEffect(() => {
    const handler = async (e: Event) => {
      const { userId } = (e as CustomEvent).detail;
      if (!user) return;
      // Check if already a contact
      const { data: existingContact } = await supabase
        .from('user_contacts')
        .select('*')
        .eq('user_id', user.id)
        .eq('contact_user_id', userId)
        .single();
      if (existingContact) {
        toast.info('This user is already in your contacts');
        return;
      }
      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, phone')
        .eq('id', userId)
        .single();
      if (!profile) {
        toast.error('User not found');
        return;
      }
      // Add as contact
      await supabase.from('user_contacts').insert({
        user_id: user.id,
        contact_name: profile.username || 'Unknown',
        phone_number: profile.phone || '',
        contact_user_id: profile.id,
      });
      toast.success(`Added ${profile.username || 'user'} to your contacts!`);
    };
    window.addEventListener('deep-link-user', handler);
    return () => window.removeEventListener('deep-link-user', handler);
  }, [user]);

  if (activeTab === 'chats' && selectedConv && selectedConv.otherUser) {
    return (
      <div className="h-screen flex flex-col">
        <div className="flex-1 min-h-0">
          <DirectChatWindow
            conversationId={selectedConv.id}
            otherUser={selectedConv.otherUser}
            onBack={() => setSelectedConv(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 min-h-0">
        {activeTab === 'chats' && (
          <ConversationList
            onSelectConversation={handleSelectConversation}
            selectedId={selectedConv?.id || null}
            onNavigateToSettings={() => setActiveTab('settings')}
            onUnreadCountChange={setUnreadChats}
          />
        )}
        {activeTab === 'contacts' && <ContactsTab />}
        {activeTab === 'status' && <StatusTab />}
        {activeTab === 'rooms' && <RoomsTab />}
        {activeTab === 'settings' && <SettingsPage />}
      </div>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} unreadChats={unreadChats} />
    </div>
  );
}
