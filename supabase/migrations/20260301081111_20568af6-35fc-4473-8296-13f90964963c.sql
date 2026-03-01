
-- Social profiles (extended info for social features)
CREATE TABLE public.social_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  zalo_number text,
  facebook_url text,
  tiktok_url text,
  bio text,
  store_address text,
  is_verified boolean NOT NULL DEFAULT false,
  verified_until timestamptz,
  show_zalo_button boolean NOT NULL DEFAULT true,
  show_facebook_button boolean NOT NULL DEFAULT true,
  follower_count integer NOT NULL DEFAULT 0,
  following_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.social_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view social profiles"
  ON public.social_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own social profile"
  ON public.social_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own social profile"
  ON public.social_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Social posts
CREATE TABLE public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  image_urls text[] DEFAULT '{}',
  like_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  message_click_count integer NOT NULL DEFAULT 0,
  engagement_score numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all posts"
  ON public.social_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create own posts"
  ON public.social_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts"
  ON public.social_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts"
  ON public.social_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Social comments
CREATE TABLE public.social_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.social_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.social_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all comments"
  ON public.social_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create comments"
  ON public.social_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments"
  ON public.social_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments"
  ON public.social_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Social likes
CREATE TABLE public.social_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

ALTER TABLE public.social_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view likes"
  ON public.social_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create own likes"
  ON public.social_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own likes"
  ON public.social_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Social follows
CREATE TABLE public.social_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id != following_id)
);

ALTER TABLE public.social_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view follows"
  ON public.social_follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can follow others"
  ON public.social_follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow"
  ON public.social_follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- Social notifications
CREATE TABLE public.social_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'like', 'comment', 'reply', 'follow', 'new_post'
  post_id uuid REFERENCES public.social_posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.social_comments(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.social_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.social_notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications"
  ON public.social_notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own notifications"
  ON public.social_notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_social_posts_user ON public.social_posts(user_id);
CREATE INDEX idx_social_posts_engagement ON public.social_posts(engagement_score DESC, created_at DESC);
CREATE INDEX idx_social_comments_post ON public.social_comments(post_id);
CREATE INDEX idx_social_likes_post ON public.social_likes(post_id);
CREATE INDEX idx_social_likes_user ON public.social_likes(user_id);
CREATE INDEX idx_social_follows_follower ON public.social_follows(follower_id);
CREATE INDEX idx_social_follows_following ON public.social_follows(following_id);
CREATE INDEX idx_social_notifications_user ON public.social_notifications(user_id, is_read, created_at DESC);

-- Triggers for updated_at
CREATE TRIGGER update_social_profiles_updated_at BEFORE UPDATE ON public.social_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_social_posts_updated_at BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_social_comments_updated_at BEFORE UPDATE ON public.social_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update like count and engagement score
CREATE OR REPLACE FUNCTION public.update_post_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE social_posts SET 
      like_count = like_count + 1,
      engagement_score = (like_count + 1) * 2 + comment_count * 3 + message_click_count
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE social_posts SET 
      like_count = GREATEST(like_count - 1, 0),
      engagement_score = GREATEST(like_count - 1, 0) * 2 + comment_count * 3 + message_click_count
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER trg_update_post_like_count
  AFTER INSERT OR DELETE ON public.social_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_post_like_count();

-- Function to update comment count
CREATE OR REPLACE FUNCTION public.update_post_comment_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE social_posts SET 
      comment_count = comment_count + 1,
      engagement_score = like_count * 2 + (comment_count + 1) * 3 + message_click_count
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE social_posts SET 
      comment_count = GREATEST(comment_count - 1, 0),
      engagement_score = like_count * 2 + GREATEST(comment_count - 1, 0) * 3 + message_click_count
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER trg_update_post_comment_count
  AFTER INSERT OR DELETE ON public.social_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_post_comment_count();

-- Function to update follow counts
CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE social_profiles SET follower_count = follower_count + 1 WHERE user_id = NEW.following_id;
    UPDATE social_profiles SET following_count = following_count + 1 WHERE user_id = NEW.follower_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE social_profiles SET follower_count = GREATEST(follower_count - 1, 0) WHERE user_id = OLD.following_id;
    UPDATE social_profiles SET following_count = GREATEST(following_count - 1, 0) WHERE user_id = OLD.follower_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER trg_update_follow_counts
  AFTER INSERT OR DELETE ON public.social_follows
  FOR EACH ROW EXECUTE FUNCTION public.update_follow_counts();

-- Enable realtime for posts and notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_notifications;
