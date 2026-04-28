import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, X, Eye, Camera, Type, Loader2, ChevronLeft, ChevronRight, Heart, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Status {
  id: string;
  user_id: string;
  media_url: string | null;
  media_type: string | null;
  text_content: string | null;
  background_color: string;
  created_at: string;
  expires_at: string;
}

interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
}

interface GroupedStatus {
  user: Profile;
  statuses: Status[];
  hasUnseen: boolean;
}

export default function StatusTab() {
  const { user } = useAuth();
  const [grouped, setGrouped] = useState<GroupedStatus[]>([]);
  const [myStatuses, setMyStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [creatorType, setCreatorType] = useState<'text' | 'media'>('text');
  const [textContent, setTextContent] = useState('');
  const [bgColor, setBgColor] = useState('#1a1a2e');
  const [uploading, setUploading] = useState(false);
  const [viewingGroup, setViewingGroup] = useState<GroupedStatus | null>(null);
  const [viewIndex, setViewIndex] = useState(0);
  const [likesMap, setLikesMap] = useState<Map<string, number>>(new Map());
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [viewsMap, setViewsMap] = useState<Map<string, number>>(new Map());
  const fileRef = useRef<HTMLInputElement>(null);

  const bgColors = ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560', '#1b998b', '#2d6a4f', '#264653'];

  useEffect(() => {
    fetchStatuses();
    const channel = supabase
      .channel('statuses-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'statuses' }, () => fetchStatuses())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'status_likes' }, () => fetchStatuses())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchStatuses = async () => {
    if (!user) return;
    const now = new Date().toISOString();
    const { data: allStatuses } = await supabase
      .from('statuses').select('*').gt('expires_at', now).order('created_at', { ascending: true });

    if (!allStatuses) { setLoading(false); return; }

    const mine = allStatuses.filter(s => s.user_id === user.id);
    setMyStatuses(mine);

    const others = allStatuses.filter(s => s.user_id !== user.id);
    const userIds = [...new Set(others.map(s => s.user_id))];

    let profileMap = new Map<string, Profile>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', userIds);
      profiles?.forEach(p => profileMap.set(p.id, p));
    }

    const { data: views } = await supabase.from('status_views').select('status_id').eq('viewer_id', user.id);
    const viewedIds = new Set(views?.map(v => v.status_id) || []);

    // Fetch view counts for my statuses
    const allStatusIds = allStatuses.map(s => s.id);
    if (allStatusIds.length > 0) {
      const { data: allViews } = await supabase.from('status_views').select('status_id').in('status_id', allStatusIds);
      const vMap = new Map<string, number>();
      allViews?.forEach(v => { vMap.set(v.status_id, (vMap.get(v.status_id) || 0) + 1); });
      setViewsMap(vMap);

      // Fetch likes
      const { data: allLikes } = await supabase.from('status_likes').select('status_id, user_id').in('status_id', allStatusIds);
      const lMap = new Map<string, number>();
      const myL = new Set<string>();
      allLikes?.forEach(l => {
        lMap.set(l.status_id, (lMap.get(l.status_id) || 0) + 1);
        if (l.user_id === user.id) myL.add(l.status_id);
      });
      setLikesMap(lMap);
      setMyLikes(myL);
    }

    const groups: GroupedStatus[] = userIds.map(uid => ({
      user: profileMap.get(uid) || { id: uid, username: null, avatar_url: null },
      statuses: others.filter(s => s.user_id === uid),
      hasUnseen: others.filter(s => s.user_id === uid).some(s => !viewedIds.has(s.id)),
    }));

    setGrouped(groups);
    setLoading(false);
  };

  const createTextStatus = async () => {
    if (!textContent.trim() || !user) return;
    setUploading(true);
    await supabase.from('statuses').insert({ user_id: user.id, media_type: 'text', text_content: textContent.trim(), background_color: bgColor });
    setUploading(false); setTextContent(''); setShowCreator(false);
    toast.success('Status posted!'); fetchStatuses();
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/status_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('chat-files').upload(path, file);
    if (error) { toast.error('Upload failed'); setUploading(false); return; }
    const { data } = supabase.storage.from('chat-files').getPublicUrl(path);
    const type = file.type.startsWith('video') ? 'video' : 'image';
    await supabase.from('statuses').insert({ user_id: user.id, media_url: data.publicUrl, media_type: type });
    setUploading(false); setShowCreator(false);
    toast.success('Status posted!'); fetchStatuses();
  };

  const viewStatus = async (group: GroupedStatus) => {
    setViewingGroup(group); setViewIndex(0);
    if (user) {
      for (const s of group.statuses) {
        await supabase.from('status_views').upsert({ status_id: s.id, viewer_id: user.id }, { onConflict: 'status_id,viewer_id' });
      }
    }
  };

  const toggleLike = async (statusId: string) => {
    if (!user) return;
    if (myLikes.has(statusId)) {
      await supabase.from('status_likes').delete().eq('status_id', statusId).eq('user_id', user.id);
      setMyLikes(prev => { const n = new Set(prev); n.delete(statusId); return n; });
      setLikesMap(prev => { const n = new Map(prev); n.set(statusId, (n.get(statusId) || 1) - 1); return n; });
    } else {
      await supabase.from('status_likes').insert({ status_id: statusId, user_id: user.id });
      setMyLikes(prev => new Set(prev).add(statusId));
      setLikesMap(prev => { const n = new Map(prev); n.set(statusId, (n.get(statusId) || 0) + 1); return n; });
    }
  };

  const shareStatus = (status: Status) => {
    const text = status.text_content || 'Check out this status on FaceSalone!';
    if (navigator.share) {
      navigator.share({ title: 'FaceSalone Status', text, url: status.media_url || window.location.origin }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    }
  };

  const deleteStatus = async (id: string) => {
    await supabase.from('statuses').delete().eq('id', id);
    toast.success('Status deleted'); fetchStatuses();
  };

  const getInitials = (name: string | null) => name ? name.slice(0, 2).toUpperCase() : '?';
  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
    return `${h}h ago`;
  };

  // Status viewer overlay
  if (viewingGroup) {
    const status = viewingGroup.statuses[viewIndex];
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center gap-3 p-3 glass-surface border-b border-border">
          <button onClick={() => setViewingGroup(null)} className="text-muted-foreground"><X className="w-5 h-5" /></button>
          <div className="flex items-center gap-2 flex-1">
            {viewingGroup.user.avatar_url ? (
              <img src={viewingGroup.user.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {getInitials(viewingGroup.user.username)}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-foreground">{viewingGroup.user.username || 'Unknown'}</p>
              <p className="text-[10px] text-muted-foreground">{timeAgo(status.created_at)}</p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">{viewIndex + 1}/{viewingGroup.statuses.length}</span>
        </div>

        <div className="flex gap-1 px-3 pt-2">
          {viewingGroup.statuses.map((_, i) => (
            <div key={i} className={`h-0.5 flex-1 rounded-full ${i <= viewIndex ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

        <div className="flex-1 flex items-center justify-center relative" onClick={() => {
          if (viewIndex < viewingGroup.statuses.length - 1) setViewIndex(viewIndex + 1);
          else setViewingGroup(null);
        }}>
          {viewIndex > 0 && (
            <button className="absolute left-2 z-10 p-2 rounded-full bg-background/50" onClick={e => { e.stopPropagation(); setViewIndex(viewIndex - 1); }}>
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {status.media_type === 'text' ? (
            <div className="w-full h-full flex items-center justify-center p-8" style={{ backgroundColor: status.background_color }}>
              <p className="text-white text-xl font-semibold text-center leading-relaxed">{status.text_content}</p>
            </div>
          ) : status.media_type === 'video' ? (
            <video src={status.media_url!} controls autoPlay className="max-h-full max-w-full object-contain" />
          ) : (
            <img src={status.media_url!} className="max-h-full max-w-full object-contain" alt="" />
          )}
          {viewIndex < viewingGroup.statuses.length - 1 && (
            <button className="absolute right-2 z-10 p-2 rounded-full bg-background/50" onClick={e => { e.stopPropagation(); setViewIndex(viewIndex + 1); }}>
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Like, share, views bar */}
        <div className="px-4 py-3 glass-surface border-t border-border flex items-center gap-4">
          <button onClick={() => toggleLike(status.id)} className={`flex items-center gap-1.5 text-sm ${myLikes.has(status.id) ? 'text-destructive' : 'text-muted-foreground'}`}>
            <Heart className={`w-5 h-5 ${myLikes.has(status.id) ? 'fill-current' : ''}`} />
            <span>{likesMap.get(status.id) || 0}</span>
          </button>
          <button onClick={() => shareStatus(status)} className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Share2 className="w-5 h-5" /> Share
          </button>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground ml-auto">
            <Eye className="w-4 h-4" /> {viewsMap.get(status.id) || 0} views
          </div>
        </div>
      </div>
    );
  }

  // Status creator
  if (showCreator) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-border glass-surface flex items-center justify-between">
          <button onClick={() => setShowCreator(false)} className="text-muted-foreground"><X className="w-5 h-5" /></button>
          <h2 className="font-display font-semibold text-foreground">New Status</h2>
          <div className="flex gap-2">
            <button onClick={() => setCreatorType('text')} className={`p-2 rounded-lg ${creatorType === 'text' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
              <Type className="w-4 h-4" />
            </button>
            <button onClick={() => { setCreatorType('media'); fileRef.current?.click(); }} className={`p-2 rounded-lg ${creatorType === 'media' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
              <Camera className="w-4 h-4" />
            </button>
          </div>
        </div>
        {creatorType === 'text' ? (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 flex items-center justify-center p-6" style={{ backgroundColor: bgColor }}>
              <textarea value={textContent} onChange={e => setTextContent(e.target.value)} placeholder="Type a status..."
                className="bg-transparent text-white text-xl font-semibold text-center w-full resize-none focus:outline-none placeholder:text-white/50" rows={4} autoFocus />
            </div>
            <div className="p-3 border-t border-border glass-surface">
              <div className="flex gap-2 mb-3 justify-center">
                {bgColors.map(c => (
                  <button key={c} onClick={() => setBgColor(c)} className={`w-7 h-7 rounded-full border-2 ${bgColor === c ? 'border-primary' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              <Button onClick={createTextStatus} className="w-full" disabled={!textContent.trim() || uploading}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post Status'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            {uploading ? <Loader2 className="w-8 h-8 animate-spin text-primary" /> : 'Select a photo or video...'}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaUpload} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border glass-surface">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="FaceSalone" className="w-8 h-8 rounded-lg object-contain" />
          <h2 className="font-display font-semibold text-foreground">Status</h2>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <button onClick={() => setShowCreator(true)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors border-b border-border">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            {myStatuses.length > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                {myStatuses.length}
              </div>
            )}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">My Status</p>
            <p className="text-xs text-muted-foreground">
              {myStatuses.length > 0 ? `${myStatuses.length} update${myStatuses.length > 1 ? 's' : ''} • Tap to add` : 'Tap to add status update'}
            </p>
          </div>
        </button>

        {myStatuses.length > 0 && (
          <div className="px-4 py-2 space-y-1">
            {myStatuses.map(s => (
              <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/30 text-sm">
                <span className="text-muted-foreground truncate flex-1">
                  {s.media_type === 'text' ? (s.text_content?.slice(0, 30) + '...') : `📷 ${s.media_type}`} • {timeAgo(s.created_at)}
                </span>
                <div className="flex items-center gap-2 ml-2">
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="w-3 h-3" />{viewsMap.get(s.id) || 0}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Heart className="w-3 h-3" />{likesMap.get(s.id) || 0}</span>
                  <button onClick={() => deleteStatus(s.id)} className="text-destructive hover:text-destructive/80"><X className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : grouped.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">No status updates yet</div>
        ) : (
          <>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 pt-4 pb-2">Recent updates</p>
            {grouped.map(g => (
              <button key={g.user.id} onClick={() => viewStatus(g)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors">
                <div className={`w-12 h-12 rounded-full p-0.5 ${g.hasUnseen ? 'ring-2 ring-primary' : 'ring-2 ring-muted'}`}>
                  {g.user.avatar_url ? (
                    <img src={g.user.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                      {getInitials(g.user.username)}
                    </div>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">{g.user.username || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{timeAgo(g.statuses[g.statuses.length - 1].created_at)}</p>
                </div>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
