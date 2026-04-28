-- Direct message reactions table
CREATE TABLE public.direct_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.direct_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DM reactions viewable by authenticated"
  ON public.direct_message_reactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can add DM reactions"
  ON public.direct_message_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their DM reactions"
  ON public.direct_message_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime for DM reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_message_reactions;

-- Read receipts for direct messages
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Conversation read tracking (for unread counts)
CREATE TABLE public.conversation_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversation reads"
  ON public.conversation_reads FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert their own conversation reads"
  ON public.conversation_reads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversation reads"
  ON public.conversation_reads FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Enable realtime for conversation_reads
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_reads;

