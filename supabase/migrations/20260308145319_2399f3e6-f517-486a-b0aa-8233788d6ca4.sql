
-- =============================================
-- 1. CONVERSATIONS TABLE (chat cá nhân & nhóm)
-- =============================================
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  name text, -- for group chats
  avatar_url text, -- for group chats
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 2. CONVERSATION MEMBERS
-- =============================================
CREATE TABLE public.conversation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  last_read_at timestamptz DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 3. MESSAGES TABLE
-- =============================================
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  content text,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'voice', 'location', 'product', 'order', 'warranty')),
  file_url text,
  file_name text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 4. STORIES TABLE
-- =============================================
CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text,
  media_url text,
  media_type text DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  view_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 5. STORY VIEWS TABLE
-- =============================================
CREATE TABLE public.story_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  viewer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(story_id, viewer_id)
);

ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 6. FRIEND REQUESTS TABLE
-- =============================================
CREATE TABLE public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Conversations: members can see their conversations
CREATE POLICY "Members can view conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversation_members cm 
    WHERE cm.conversation_id = id AND cm.user_id = auth.uid()
  ));

CREATE POLICY "Authenticated users can create conversations" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Conversation members: view members of conversations you belong to
CREATE POLICY "Members can view conversation members" ON public.conversation_members
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversation_members cm2 
    WHERE cm2.conversation_id = conversation_id AND cm2.user_id = auth.uid()
  ));

CREATE POLICY "Members can insert conversation members" ON public.conversation_members
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Members can update own membership" ON public.conversation_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Chat messages: members of conversation can CRUD
CREATE POLICY "Members can view messages" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversation_members cm 
    WHERE cm.conversation_id = conversation_id AND cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can send messages" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.conversation_members cm 
      WHERE cm.conversation_id = conversation_id AND cm.user_id = auth.uid()
    )
  );

-- Stories: authenticated users can view non-expired stories
CREATE POLICY "Authenticated can view stories" ON public.stories
  FOR SELECT TO authenticated
  USING (expires_at > now());

CREATE POLICY "Users can create own stories" ON public.stories
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own stories" ON public.stories
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Story views
CREATE POLICY "Authenticated can view story views" ON public.story_views
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert story views" ON public.story_views
  FOR INSERT TO authenticated
  WITH CHECK (viewer_id = auth.uid());

-- Friend requests
CREATE POLICY "Users can view own friend requests" ON public.friend_requests
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can send friend requests" ON public.friend_requests
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update received requests" ON public.friend_requests
  FOR UPDATE TO authenticated
  USING (receiver_id = auth.uid() OR sender_id = auth.uid());

CREATE POLICY "Users can delete own requests" ON public.friend_requests
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- =============================================
-- REALTIME
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;

-- =============================================
-- FUNCTION: Update conversation updated_at on new message
-- =============================================
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.conversations 
  SET updated_at = now() 
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_conversation_timestamp
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_timestamp();

-- =============================================
-- FUNCTION: Get or create direct conversation
-- =============================================
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(p_user_id uuid, p_other_user_id uuid)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _conv_id uuid;
BEGIN
  -- Find existing direct conversation between the two users
  SELECT cm1.conversation_id INTO _conv_id
  FROM public.conversation_members cm1
  JOIN public.conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
  JOIN public.conversations c ON c.id = cm1.conversation_id
  WHERE cm1.user_id = p_user_id 
    AND cm2.user_id = p_other_user_id
    AND c.type = 'direct'
  LIMIT 1;

  IF _conv_id IS NOT NULL THEN
    RETURN _conv_id;
  END IF;

  -- Create new conversation
  INSERT INTO public.conversations (type, created_by)
  VALUES ('direct', p_user_id)
  RETURNING id INTO _conv_id;

  -- Add both members
  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES (_conv_id, p_user_id, 'admin'), (_conv_id, p_other_user_id, 'member');

  RETURN _conv_id;
END;
$$;
