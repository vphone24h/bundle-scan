
-- Fix overly permissive RLS policies

-- 1. Fix conversation_members INSERT - only allow if user is part of conversation or creating
DROP POLICY "Members can insert conversation members" ON public.conversation_members;
CREATE POLICY "Members can add to own conversations" ON public.conversation_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.conversation_members cm 
      WHERE cm.conversation_id = conversation_id 
      AND cm.user_id = auth.uid() 
      AND cm.role = 'admin'
    )
  );

-- 2. Fix story_views SELECT - only story owner or viewer can see
DROP POLICY "Authenticated can view story views" ON public.story_views;
CREATE POLICY "Story owners and viewers can see views" ON public.story_views
  FOR SELECT TO authenticated
  USING (
    viewer_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid())
  );

-- 3. Fix story_views INSERT
DROP POLICY "Authenticated can insert story views" ON public.story_views;
CREATE POLICY "Users can mark stories as viewed" ON public.story_views
  FOR INSERT TO authenticated
  WITH CHECK (viewer_id = auth.uid());
