
-- Statuses / Stories table
CREATE TABLE public.statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  media_url TEXT,
  media_type TEXT, -- 'image', 'video', 'text'
  text_content TEXT,
  background_color TEXT DEFAULT '#1a1a2e',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '48 hours')
);

ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view statuses" ON public.statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create their own statuses" ON public.statuses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own statuses" ON public.statuses FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Status views tracking
CREATE TABLE public.status_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status_id UUID NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(status_id, viewer_id)
);

ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view status views" ON public.status_views FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can mark statuses as viewed" ON public.status_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = viewer_id);

-- User contacts table
CREATE TABLE public.user_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT,
  contact_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contacts" ON public.user_contacts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can add contacts" ON public.user_contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their contacts" ON public.user_contacts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their contacts" ON public.user_contacts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Notification settings
CREATE TABLE public.notification_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  message_notifications BOOLEAN DEFAULT true,
  group_notifications BOOLEAN DEFAULT true,
  status_notifications BOOLEAN DEFAULT true,
  sound_enabled BOOLEAN DEFAULT true,
  vibration_enabled BOOLEAN DEFAULT true,
  show_preview BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings" ON public.notification_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own settings" ON public.notification_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own settings" ON public.notification_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Add phone to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_last_seen TEXT DEFAULT 'everyone';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_profile_photo TEXT DEFAULT 'everyone';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_about TEXT DEFAULT 'everyone';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_read_receipts BOOLEAN DEFAULT true;

-- Enable realtime on statuses
ALTER PUBLICATION supabase_realtime ADD TABLE public.statuses;
