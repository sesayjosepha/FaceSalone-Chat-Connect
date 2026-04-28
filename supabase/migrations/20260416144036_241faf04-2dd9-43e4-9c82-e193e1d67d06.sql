
-- Room members table for room privacy
CREATE TABLE public.room_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view room members for their rooms"
ON public.room_members FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = room_members.room_id AND rm.user_id = auth.uid())
);

CREATE POLICY "Users can join rooms"
ON public.room_members FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave rooms"
ON public.room_members FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Auto-add room creator as member via trigger
CREATE OR REPLACE FUNCTION public.auto_join_room_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.room_members (room_id, user_id) VALUES (NEW.id, NEW.created_by)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_room_created
AFTER INSERT ON public.rooms
FOR EACH ROW
EXECUTE FUNCTION public.auto_join_room_creator();

-- Status likes table
CREATE TABLE public.status_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(status_id, user_id)
);

ALTER TABLE public.status_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view likes"
ON public.status_likes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can like statuses"
ON public.status_likes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike statuses"
ON public.status_likes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Enable realtime for status_likes
ALTER PUBLICATION supabase_realtime ADD TABLE public.status_likes;
