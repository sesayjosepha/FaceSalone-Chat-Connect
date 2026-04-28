import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Send, Mic, Paperclip, Image, X, Square, Loader2, Contact, FileText, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import CameraWithFilters from '@/components/CameraWithFilters';

interface RichInputBarProps {
  onSend: (content: string, attachmentUrl?: string, attachmentType?: string) => Promise<void>;
  sending: boolean;
}

export default function RichInputBar({ onSend, sending }: RichInputBarProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File | Blob, type: string, ext?: string): Promise<{ url: string; type: string } | null> => {
    if (!user) return null;
    setUploading(true);
    const extension = ext || (file instanceof File ? file.name.split('.').pop() || 'bin' : 'jpg');
    const path = `${user.id}/${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from('chat-files').upload(path, file);
    if (error) { toast.error('Upload failed'); setUploading(false); return null; }
    const { data } = supabase.storage.from('chat-files').getPublicUrl(path);
    setUploading(false);
    return { url: data.publicUrl, type };
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, defaultType?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = defaultType || file.type || 'file';
    const result = await uploadFile(file, type);
    if (result) {
      await onSend('', result.url, result.type);
    }
    e.target.value = '';
  };

  const handleCameraCapture = async (blob: Blob) => {
    setShowCamera(false);
    const result = await uploadFile(blob, 'image/jpeg', 'jpg');
    if (result) {
      await onSend('📸 Photo', result.url, result.type);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        const result = await uploadFile(file, 'voice');
        if (result) {
          await onSend('🎤 Voice note', result.url, result.type);
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      toast.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sending) return;
    const msg = message;
    setMessage('');
    await onSend(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const sendContact = async () => {
    if (!contactName.trim()) { toast.error('Name is required'); return; }
    const contactContent = `👤 Contact: ${contactName}${contactPhone ? `\n📞 ${contactPhone}` : ''}${contactEmail ? `\n✉️ ${contactEmail}` : ''}`;
    await onSend(contactContent, undefined, 'contact');
    setShowContact(false);
    setContactName('');
    setContactPhone('');
    setContactEmail('');
  };

  if (showCamera) {
    return <CameraWithFilters onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />;
  }

  return (
    <>
      <div className="p-2 border-t border-border glass-surface">
        <div className="flex gap-1.5 items-end">
          {/* Attachment menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors shrink-0" disabled={uploading}>
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="glass-panel border-glass-border">
              <DropdownMenuItem onClick={() => setShowCamera(true)}>
                <Camera className="w-4 h-4 mr-2" /> Camera
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Image className="w-4 h-4 mr-2" /> Photo / Video
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => docInputRef.current?.click()}>
                <FileText className="w-4 h-4 mr-2" /> Document
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowContact(true)}>
                <Contact className="w-4 h-4 mr-2" /> Contact
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Text input */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />

          {/* Voice or Send */}
          {message.trim() ? (
            <Button type="button" size="icon" onClick={handleSend} disabled={sending} className="rounded-xl shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          ) : recording ? (
            <button onClick={stopRecording} className="p-2 rounded-xl bg-destructive text-destructive-foreground animate-pulse shrink-0">
              <Square className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={startRecording} className="p-2 rounded-xl hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleFileSelect(e)} />
      <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" className="hidden" onChange={(e) => handleFileSelect(e, 'document')} />

      {/* Contact sharing dialog */}
      <Dialog open={showContact} onOpenChange={setShowContact}>
        <DialogContent className="glass-panel border-glass-border">
          <DialogHeader>
            <DialogTitle className="font-display">Share Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>Name *</Label><Input value={contactName} onChange={e => setContactName(e.target.value)} className="bg-secondary border-border" placeholder="Contact name" /></div>
            <div><Label>Phone</Label><Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="bg-secondary border-border" placeholder="Phone number" /></div>
            <div><Label>Email</Label><Input value={contactEmail} onChange={e => setContactEmail(e.target.value)} className="bg-secondary border-border" placeholder="Email address" /></div>
            <Button onClick={sendContact} className="w-full">Send Contact</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
