import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Hash, Loader2, Pencil, Trash2, Reply, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import EmojiPicker from '@/components/EmojiPicker';
import MessageSearch from '@/components/MessageSearch';
import RichInputBar from '@/components/RichInputBar';
import { formatMessageTime, formatMessageDate, shouldShowDateSeparator } from '@/lib/chatUtils';
import { useNotifications } from '@/hooks/useNotifications';

interface Profile {
  username: string | null;
  avatar_url: string | null;
}

interface Reaction {
  id: string;
  emoji: string;
  user_id: string;
}

interface Message {
  id: string;
  content: string;
  user_id: string;
  inserted_at: string | null;
  is_edited: boolean | null;
  reply_to: string | null;
  profile?: Profile;
  reactions?: Reaction[];
  replyMessage?: { content: string; profile?: Profile } | null;
}

interface ChatWindowProps {
  roomId: string;
  roomName: string;
  onlineUsers: Set<string>;
  typingUsers: Map<string, string>;
  onTyping: (isTyping: boolean, username: string) => void;
}

export default function ChatWindow({ roomId, roomName, onlineUsers, typingUsers, onTyping }: ChatWindowProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const { notifyMessage } = useNotifications();

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch own profile for typing indicator
  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('username, avatar_url').eq('id', user.id).single().then(({ data }) => {
      if (data) setMyProfile(data);
    });
  }, [user]);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setReplyTo(null);
    setEditingId(null);
    fetchMessages();

    const channel = supabase
      .channel(`room-messages:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const msg = payload.new as any;
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', msg.user_id)
            .single();
          
          let replyMessage = null;
          if (msg.reply_to) {
            const { data: reply } = await supabase.from('messages').select('content, user_id').eq('id', msg.reply_to).single();
            if (reply) {
              const { data: replyProfile } = await supabase.from('profiles').select('username, avatar_url').eq('id', reply.user_id).single();
              replyMessage = { content: reply.content, profile: replyProfile || undefined };
            }
          }

          const enriched: Message = { ...msg, profile: profile || undefined, reactions: [], replyMessage };
          setMessages((prev) => [...prev, enriched]);
          
          if (msg.user_id !== user?.id) {
            notifyMessage(profile?.username || 'Someone', msg.content, true);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const updated = payload.new as any;
          setMessages((prev) => prev.map((m) => m.id === updated.id ? { ...m, content: updated.content, is_edited: updated.is_edited } : m));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          const deleted = payload.old as any;
          setMessages((prev) => prev.filter((m) => m.id !== deleted.id));
        }
      )
      .subscribe();

    // Reactions channel
    const reactionsChannel = supabase
      .channel(`reactions:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        () => {
          // Refetch reactions for simplicity
          fetchAllReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(reactionsChannel);
    };
  }, [roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('inserted_at', { ascending: true })
      .limit(200);

    if (error) { toast.error('Failed to load messages'); setLoading(false); return; }

    const userIds = [...new Set((data || []).map((m) => m.user_id))];
    const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', userIds);
    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

    // Fetch reply messages
    const replyIds = (data || []).filter((m) => m.reply_to).map((m) => m.reply_to!);
    const replyMap = new Map<string, { content: string; profile?: Profile }>();
    if (replyIds.length > 0) {
      const { data: replies } = await supabase.from('messages').select('id, content, user_id').in('id', replyIds);
      replies?.forEach((r) => {
        replyMap.set(r.id, { content: r.content, profile: profileMap.get(r.user_id) || undefined });
      });
    }

    // Fetch reactions
    const msgIds = (data || []).map((m) => m.id);
    const reactionsMap = new Map<string, Reaction[]>();
    if (msgIds.length > 0) {
      const { data: reactions } = await supabase.from('message_reactions').select('*').in('message_id', msgIds);
      reactions?.forEach((r) => {
        const existing = reactionsMap.get(r.message_id) || [];
        existing.push(r);
        reactionsMap.set(r.message_id, existing);
      });
    }

    const enriched = (data || []).map((m) => ({
      ...m,
      profile: profileMap.get(m.user_id) || undefined,
      reactions: reactionsMap.get(m.id) || [],
      replyMessage: m.reply_to ? replyMap.get(m.reply_to) || null : null,
    }));

    setMessages(enriched);
    setLoading(false);
  };

  const fetchAllReactions = async () => {
    const msgIds = messages.map((m) => m.id);
    if (msgIds.length === 0) return;
    const { data: reactions } = await supabase.from('message_reactions').select('*').in('message_id', msgIds);
    const reactionsMap = new Map<string, Reaction[]>();
    reactions?.forEach((r) => {
      const existing = reactionsMap.get(r.message_id) || [];
      existing.push(r);
      reactionsMap.set(r.message_id, existing);
    });
    setMessages((prev) => prev.map((m) => ({ ...m, reactions: reactionsMap.get(m.id) || [] })));
  };

  const sendMessage = async (content: string, attachmentUrl?: string, attachmentType?: string) => {
    if ((!content.trim() && !attachmentUrl) || !user) return;
    setSending(true);
    const { error } = await supabase.from('messages').insert({
      room_id: roomId,
      user_id: user.id,
      content: content.trim(),
      reply_to: replyTo?.id || null,
      attachment_url: attachmentUrl || null,
      attachment_type: attachmentType || null,
    });
    setSending(false);
    if (error) { toast.error('Failed to send message'); return; }
    setNewMessage('');
    setReplyTo(null);
    onTyping(false, myProfile?.username || '');
  };

  const editMessage = async (msgId: string) => {
    if (!editContent.trim()) return;
    const { error } = await supabase.from('messages').update({ content: editContent.trim(), is_edited: true }).eq('id', msgId);
    if (error) { toast.error('Failed to edit'); return; }
    setEditingId(null);
    setEditContent('');
  };

  const deleteMessage = async (msgId: string) => {
    const { error } = await supabase.from('messages').delete().eq('id', msgId);
    if (error) toast.error('Failed to delete');
  };

  const toggleReaction = async (msgId: string, emoji: string) => {
    if (!user) return;
    const existing = messages.find((m) => m.id === msgId)?.reactions?.find((r) => r.emoji === emoji && r.user_id === user.id);
    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('message_reactions').insert({ message_id: msgId, user_id: user.id, emoji });
    }
  };

  const handleInputChange = (value: string) => {
    setNewMessage(value);
    onTyping(value.length > 0, myProfile?.username || '');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false, myProfile?.username || '');
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(newMessage);
    }
  };

  const getInitials = (username: string | null | undefined) => {
    if (!username) return '?';
    return username.slice(0, 2).toUpperCase();
  };

  const filteredMessages = searchQuery
    ? messages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  // Group reactions by emoji
  const groupReactions = (reactions: Reaction[]) => {
    const groups = new Map<string, { count: number; userReacted: boolean }>();
    reactions.forEach((r) => {
      const existing = groups.get(r.emoji) || { count: 0, userReacted: false };
      existing.count++;
      if (r.user_id === user?.id) existing.userReacted = true;
      groups.set(r.emoji, existing);
    });
    return groups;
  };

  const typingNames = [...typingUsers.entries()]
    .filter(([uid]) => uid !== user?.id)
    .map(([, name]) => name);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border glass-surface flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hash className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-display font-semibold text-foreground">{roomName}</h2>
          {onlineUsers.size > 0 && (
            <span className="text-xs text-muted-foreground">{onlineUsers.size} online</span>
          )}
        </div>
        <MessageSearch onSearch={setSearchQuery} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {searchQuery ? 'No messages found' : 'No messages yet. Start the conversation!'}
          </div>
        ) : (
          filteredMessages.map((msg, idx) => {
            const isOwn = msg.user_id === user?.id;
            const prevMsg = idx > 0 ? filteredMessages[idx - 1] : null;
            const showDate = shouldShowDateSeparator(msg.inserted_at, prevMsg?.inserted_at || null);
            const reactionGroups = groupReactions(msg.reactions || []);

            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="flex items-center gap-3 py-3">
                    <div className="flex-1 border-t border-border" />
                    <span className="text-xs text-muted-foreground font-medium">
                      {formatMessageDate(msg.inserted_at)}
                    </span>
                    <div className="flex-1 border-t border-border" />
                  </div>
                )}

                <div className={`group flex gap-3 py-1 animate-fade-in ${isOwn ? 'flex-row-reverse' : ''}`}>
                  {msg.profile?.avatar_url ? (
                    <img src={msg.profile.avatar_url} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
                  ) : (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                      {getInitials(msg.profile?.username)}
                    </div>
                  )}

                  <div className={`max-w-[75%] ${isOwn ? 'text-right' : ''}`}>
                    <div className={`flex items-baseline gap-2 mb-0.5 ${isOwn ? 'justify-end' : ''}`}>
                      {!isOwn && (
                        <span className="text-xs font-medium text-primary">
                          {msg.profile?.username || 'Unknown'}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">{formatMessageTime(msg.inserted_at)}</span>
                      {msg.is_edited && <span className="text-[10px] text-muted-foreground italic">(edited)</span>}
                    </div>

                    {/* Reply preview */}
                    {msg.replyMessage && (
                      <div className={`text-xs text-muted-foreground mb-1 pl-2 border-l-2 border-primary/40 ${isOwn ? 'ml-auto mr-0 text-right border-r-2 border-l-0 pr-2' : ''}`}>
                        <span className="text-primary/70 font-medium">{msg.replyMessage.profile?.username || 'Unknown'}</span>
                        <span className="block truncate max-w-48">{msg.replyMessage.content}</span>
                      </div>
                    )}

                    {editingId === msg.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') editMessage(msg.id); if (e.key === 'Escape') setEditingId(null); }}
                          className="flex-1 bg-secondary rounded-lg px-3 py-1.5 text-sm border border-border focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <button onClick={() => editMessage(msg.id)} className="p-1 text-online"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div className={`inline-block px-3 py-2 rounded-xl text-sm leading-relaxed ${isOwn ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'glass-panel rounded-tl-sm'}`}>
                        {msg.content}
                      </div>
                    )}

                    {/* Reactions */}
                    {reactionGroups.size > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                        {[...reactionGroups.entries()].map(([emoji, { count, userReacted }]) => (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(msg.id, emoji)}
                            className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${userReacted ? 'border-primary/50 bg-primary/10' : 'border-border bg-secondary/50 hover:bg-secondary'}`}
                          >
                            {emoji} {count > 1 && count}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className={`flex items-center gap-0.5 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isOwn ? 'justify-end' : ''}`}>
                      <EmojiPicker onSelect={(emoji) => toggleReaction(msg.id, emoji)} />
                      <button onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }} className="p-1 rounded hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors">
                        <Reply className="w-4 h-4" />
                      </button>
                      {isOwn && (
                        <>
                          <button onClick={() => { setEditingId(msg.id); setEditContent(msg.content); }} className="p-1 rounded hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteMessage(msg.id)} className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      {typingNames.length > 0 && (
        <div className="px-4 py-1 text-xs text-typing flex items-center gap-1.5">
          <span className="flex gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-typing animate-pulse-dot" style={{ animationDelay: '0s' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-typing animate-pulse-dot" style={{ animationDelay: '0.2s' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-typing animate-pulse-dot" style={{ animationDelay: '0.4s' }} />
          </span>
          {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      {/* Reply preview */}
      {replyTo && (
        <div className="px-4 py-2 border-t border-border glass-surface flex items-center gap-2">
          <Reply className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs text-primary font-medium">{replyTo.profile?.username || 'Unknown'}</span>
            <p className="text-xs text-muted-foreground truncate">{replyTo.content}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input */}
      <RichInputBar onSend={sendMessage} sending={sending} />
    </div>
  );
}
