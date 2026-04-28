import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Loader2, Pencil, Trash2, Reply, X, Check, CheckCheck, Phone, Mail, Video } from 'lucide-react';
import { toast } from 'sonner';
import EmojiPicker from '@/components/EmojiPicker';
import MessageSearch from '@/components/MessageSearch';
import RichInputBar from '@/components/RichInputBar';
import { formatMessageTime, formatMessageDate, shouldShowDateSeparator, canViewLastSeen, canViewProfilePhoto } from '@/lib/chatUtils';
import { useNotifications } from '@/hooks/useNotifications';

interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  last_seen: string | null;
}

interface Reaction {
  id: string;
  emoji: string;
  user_id: string;
}

interface DirectMessage {
  id: string;
  content: string;
  sender_id: string;
  inserted_at: string;
  is_edited: boolean | null;
  attachment_url: string | null;
  attachment_type: string | null;
  is_read: boolean | null;
  reply_to: string | null;
  reactions?: Reaction[];
  replyMessage?: { content: string; sender_id: string; profile?: Profile } | null;
}

interface DirectChatWindowProps {
  conversationId: string;
  otherUser: Profile;
  onBack: () => void;
}

// Parse contact message and make phone/email clickable
function renderContactMessage(content: string) {
  const lines = content.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const phoneMatch = line.match(/📞\s*(.+)/);
        const emailMatch = line.match(/✉️\s*(.+)/);
        if (phoneMatch) {
          return (
            <a key={i} href={`tel:${phoneMatch[1].trim()}`} className="flex items-center gap-1 text-primary hover:underline">
              <Phone className="w-3 h-3" /> {phoneMatch[1].trim()}
            </a>
          );
        }
        if (emailMatch) {
          return (
            <a key={i} href={`mailto:${emailMatch[1].trim()}`} className="flex items-center gap-1 text-primary hover:underline">
              <Mail className="w-3 h-3" /> {emailMatch[1].trim()}
            </a>
          );
        }
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

export default function DirectChatWindow({ conversationId, otherUser, onBack }: DirectChatWindowProps) {
  const { user } = useAuth();
  const { notifyMessage } = useNotifications();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyTo, setReplyTo] = useState<DirectMessage | null>(null);
  const [typing, setTyping] = useState(false);
  const [privacy, setPrivacy] = useState({
    lastSeen: 'everyone' as string,
    profilePhoto: 'everyone' as string,
    readReceipts: true,
  });
  const [isContact, setIsContact] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch privacy settings and contact relationship
  useEffect(() => {
    if (!user || !otherUser.id) return;
    const fetchPrivacy = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('privacy_last_seen, privacy_profile_photo, privacy_read_receipts')
        .eq('id', otherUser.id)
        .single();
      if (profile) {
        setPrivacy({
          lastSeen: profile.privacy_last_seen || 'everyone',
          profilePhoto: profile.privacy_profile_photo || 'everyone',
          readReceipts: profile.privacy_read_receipts ?? true,
        });
      }
      const { data: contact } = await supabase
        .from('user_contacts')
        .select('id')
        .eq('user_id', otherUser.id)
        .eq('contact_user_id', user.id)
        .maybeSingle();
      setIsContact(!!contact);
    };
    fetchPrivacy();
  }, [otherUser.id, user]);

  // Update conversation read status
  useEffect(() => {
    if (!user || !conversationId) return;
    const markRead = async () => {
      await supabase.from('conversation_reads').upsert({
        conversation_id: conversationId,
        user_id: user.id,
        last_read_at: new Date().toISOString(),
      }, { onConflict: 'conversation_id,user_id' });
      // Mark other user's messages as read
      await supabase.from('direct_messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .eq('is_read', false);
    };
    markRead();
  }, [conversationId, user]);

  // Fetch messages and subscribe
  useEffect(() => {
    setMessages([]);
    setLoading(true);
    fetchMessages();

    const channel = supabase
      .channel(`dm:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'direct_messages',
        filter: `conversation_id=eq.${conversationId}`
      }, async (payload) => {
        const msg = payload.new as DirectMessage;
        const enriched = await enrichMessage(msg);
        setMessages(prev => [...prev, enriched]);
        if (msg.sender_id !== user?.id) {
          notifyMessage(otherUser?.username || 'Someone', msg.content);
          // Auto-mark as read if viewing
          if (user) {
            await supabase.from('direct_messages').update({ is_read: true }).eq('id', msg.id);
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'direct_messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        const updated = payload.new as DirectMessage;
        setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, content: updated.content, is_edited: updated.is_edited, is_read: updated.is_read } : m));
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'direct_messages'
      }, (payload) => {
        const deleted = payload.old as any;
        setMessages(prev => prev.filter(m => m.id !== deleted.id));
      })
      .subscribe();

    // Reactions channel
    const reactionsChannel = supabase
      .channel(`dm-reactions:${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_message_reactions' }, () => {
        fetchAllReactions();
      })
      .subscribe();

    // Typing broadcast channel
    const typingChannel = supabase.channel(`dm-typing:${conversationId}`);
    typingChannel.on('broadcast', { event: 'typing' }, (payload) => {
      const data = payload.payload as { user_id: string; typing: boolean };
      if (data.user_id !== user?.id) {
        setTyping(data.typing);
      }
    }).subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(reactionsChannel);
      supabase.removeChannel(typingChannel);
    };
  }, [conversationId]);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('inserted_at', { ascending: true })
      .limit(200);

    if (error) { toast.error('Failed to load messages'); setLoading(false); return; }

    const enriched = await Promise.all((data || []).map(enrichMessage));
    setMessages(enriched);
    setLoading(false);
  };

  const enrichMessage = async (msg: DirectMessage): Promise<DirectMessage> => {
    // Fetch reactions
    const { data: reactions } = await supabase
      .from('direct_message_reactions')
      .select('*')
      .eq('message_id', msg.id);

    // Fetch reply message
    let replyMessage = null;
    if (msg.reply_to) {
      const { data: reply } = await supabase
        .from('direct_messages')
        .select('content, sender_id')
        .eq('id', msg.reply_to)
        .single();
      if (reply) {
        const { data: replyProfile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', reply.sender_id)
          .single();
        replyMessage = {
          content: reply.content,
          sender_id: reply.sender_id,
          profile: replyProfile || undefined,
        };
      }
    }

    return { ...msg, reactions: reactions || [], replyMessage };
  };

  const fetchAllReactions = async () => {
    const msgIds = messages.map((m) => m.id);
    if (msgIds.length === 0) return;
    const { data: reactions } = await supabase.from('direct_message_reactions').select('*').in('message_id', msgIds);
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
    const { error } = await supabase.from('direct_messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
      reply_to: replyTo?.id || null,
      attachment_url: attachmentUrl || null,
      attachment_type: attachmentType || null,
    });
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId);
    // Send typing stop
    await supabase.channel(`dm-typing:${conversationId}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: user.id, typing: false },
    });
    setSending(false);
    if (error) toast.error('Failed to send message');
    setReplyTo(null);
  };

  const editMessage = async (msgId: string) => {
    if (!editContent.trim()) return;
    await supabase.from('direct_messages').update({ content: editContent.trim(), is_edited: true }).eq('id', msgId);
    setEditingId(null);
    setEditContent('');
  };

  const deleteMessage = async (msgId: string) => {
    await supabase.from('direct_messages').delete().eq('id', msgId);
  };

  const toggleReaction = async (msgId: string, emoji: string) => {
    if (!user) return;
    const existing = messages.find((m) => m.id === msgId)?.reactions?.find((r) => r.emoji === emoji && r.user_id === user.id);
    if (existing) {
      await supabase.from('direct_message_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('direct_message_reactions').insert({ message_id: msgId, user_id: user.id, emoji });
    }
  };

  const handleTyping = async (value: string) => {
    if (!user) return;
    const isTyping = value.length > 0;
    await supabase.channel(`dm-typing:${conversationId}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: user.id, typing: isTyping },
    });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(async () => {
        await supabase.channel(`dm-typing:${conversationId}`).send({
          type: 'broadcast',
          event: 'typing',
          payload: { user_id: user.id, typing: false },
        });
      }, 2000);
    }
  };

  const rawOnline = otherUser.last_seen ? new Date(otherUser.last_seen) > new Date(Date.now() - 5 * 60 * 1000) : false;
  const isOnline = canViewLastSeen(privacy.lastSeen as any, isContact) ? rawOnline : false;
  const showAvatar = canViewProfilePhoto(privacy.profilePhoto as any, isContact);
  const getInitials = (name: string | null) => name ? name.slice(0, 2).toUpperCase() : '?';

  const startCall = async (callType: 'voice' | 'video') => {
    if (!user) return;
    const { data, error } = await supabase
      .from('calls')
      .insert({ caller_id: user.id, callee_id: otherUser.id, call_type: callType, status: 'ringing' })
      .select()
      .single();
    if (error || !data) {
      toast.error('Failed to start call');
      return;
    }
    window.dispatchEvent(
      new CustomEvent('start-call', {
        detail: {
          id: data.id,
          isCaller: true,
          callType,
          peerId: otherUser.id,
          peerName: otherUser.username || 'Unknown',
          peerAvatar: otherUser.avatar_url,
        },
      })
    );
  };

  const isContactMessage = (msg: DirectMessage) => msg.attachment_type === 'contact' || msg.content.startsWith('👤 Contact:');

  const renderAttachment = (msg: DirectMessage) => {
    if (!msg.attachment_url) return null;
    const type = msg.attachment_type || '';
    if (type.startsWith('image')) {
      return <img src={msg.attachment_url} alt="shared" className="max-w-[240px] rounded-lg mt-1 cursor-pointer" onClick={() => window.open(msg.attachment_url!, '_blank')} />;
    }
    if (type.startsWith('video')) {
      return <video src={msg.attachment_url} controls className="max-w-[280px] rounded-lg mt-1" />;
    }
    if (type.startsWith('audio') || type === 'voice') {
      return <audio src={msg.attachment_url} controls className="mt-1 max-w-[240px]" />;
    }
    return (
      <a href={msg.attachment_url} target="_blank" rel="noopener" className="flex items-center gap-2 mt-1 text-xs text-primary hover:underline bg-secondary/50 rounded-lg px-3 py-2">
        📎 {type || 'File'}
      </a>
    );
  };

  const filteredMessages = searchQuery
    ? messages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border glass-surface flex items-center gap-3">
        <button onClick={onBack} className="p-1 rounded-lg hover:bg-secondary/50 text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="relative">
          {showAvatar && otherUser.avatar_url ? (
            <img src={otherUser.avatar_url} className="w-9 h-9 rounded-full object-cover" alt="" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
              {getInitials(showAvatar ? otherUser.username : '?')}
            </div>
          )}
          {isOnline && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-online border-2 border-background" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{otherUser.username || 'Unknown'}</p>
          <p className="text-[10px] text-muted-foreground">
            {typing ? 'Typing...' : isOnline ? 'Online' : 'Offline'}
          </p>
        </div>
        <MessageSearch onSearch={setSearchQuery} />
        <button
          onClick={() => startCall('voice')}
          className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Voice call"
        >
          <Phone className="w-5 h-5" />
        </button>
        <button
          onClick={() => startCall('video')}
          className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Video call"
        >
          <Video className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {searchQuery ? 'No messages found' : 'Send a message to start chatting!'}
          </div>
        ) : (
          filteredMessages.map((msg, idx) => {
            const isOwn = msg.sender_id === user?.id;
            const prevMsg = idx > 0 ? filteredMessages[idx - 1] : null;
            const showDate = shouldShowDateSeparator(msg.inserted_at, prevMsg?.inserted_at || null);
            const reactionGroups = groupReactions(msg.reactions || []);

            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="flex items-center gap-3 py-3">
                    <div className="flex-1 border-t border-border" />
                    <span className="text-xs text-muted-foreground font-medium">{formatMessageDate(msg.inserted_at)}</span>
                    <div className="flex-1 border-t border-border" />
                  </div>
                )}
                <div className={`group flex gap-2 py-0.5 animate-fade-in ${isOwn ? 'flex-row-reverse' : ''}`}>
                  <div className={`max-w-[75%] ${isOwn ? 'text-right' : ''}`}>
                    <div className={`flex items-baseline gap-2 mb-0.5 ${isOwn ? 'justify-end' : ''}`}>
                      <span className="text-[10px] text-muted-foreground">{formatMessageTime(msg.inserted_at)}</span>
                      {msg.is_edited && <span className="text-[10px] text-muted-foreground italic">(edited)</span>}
                      {isOwn && (
                        msg.is_read && privacy.readReceipts ? (
                          <CheckCheck className="w-3 h-3 text-primary" />
                        ) : (
                          <Check className="w-3 h-3 text-muted-foreground" />
                        )
                      )}
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
                        <input autoFocus value={editContent} onChange={e => setEditContent(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') editMessage(msg.id); if (e.key === 'Escape') setEditingId(null); }}
                          className="flex-1 bg-secondary rounded-lg px-3 py-1.5 text-sm border border-border focus:outline-none focus:ring-1 focus:ring-ring" />
                        <button onClick={() => editMessage(msg.id)} className="p-1 text-online"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <>
                        {msg.content && (
                          <div className={`inline-block px-3 py-2 rounded-xl text-sm leading-relaxed ${isOwn ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'glass-panel rounded-tl-sm'}`}>
                            {isContactMessage(msg) ? renderContactMessage(msg.content) : msg.content}
                          </div>
                        )}
                        {renderAttachment(msg)}
                      </>
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
                          <button onClick={() => { setEditingId(msg.id); setEditContent(msg.content); }} className="p-1 rounded hover:bg-secondary/80 text-muted-foreground">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteMessage(msg.id)} className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
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
      {typing && (
        <div className="px-4 py-1 text-xs text-typing flex items-center gap-1.5">
          <span className="flex gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-typing animate-pulse-dot" style={{ animationDelay: '0s' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-typing animate-pulse-dot" style={{ animationDelay: '0.2s' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-typing animate-pulse-dot" style={{ animationDelay: '0.4s' }} />
          </span>
          {otherUser.username || 'Someone'} is typing...
        </div>
      )}

      {/* Reply preview */}
      {replyTo && (
        <div className="px-4 py-2 border-t border-border glass-surface flex items-center gap-2">
          <Reply className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs text-primary font-medium">{replyTo.sender_id === user?.id ? 'You' : otherUser.username || 'Unknown'}</span>
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

