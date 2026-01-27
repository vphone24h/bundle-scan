-- Create enum for minigame status
CREATE TYPE public.minigame_status AS ENUM ('draft', 'active', 'paused', 'expired');

-- Create enum for spin result type
CREATE TYPE public.spin_result_type AS ENUM ('prize', 'no_prize');

-- Main minigame campaigns table
CREATE TABLE public.minigame_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  
  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  status minigame_status NOT NULL DEFAULT 'draft',
  
  -- Configuration
  background_image TEXT, -- URL to background image
  wheel_border_image TEXT, -- URL to wheel border image
  wheel_background_color TEXT DEFAULT '#FFD700',
  wheel_border_color TEXT DEFAULT '#FF6B00',
  spin_button_text TEXT DEFAULT 'QUAY NGAY',
  spin_button_color TEXT DEFAULT '#FF4500',
  
  -- Rules
  max_spins_per_player INTEGER DEFAULT 1, -- Max spins per phone/email
  require_phone BOOLEAN DEFAULT true,
  require_email BOOLEAN DEFAULT false,
  require_name BOOLEAN DEFAULT true,
  password TEXT, -- Optional password protection
  
  -- No prize settings
  no_prize_message TEXT DEFAULT 'Chúc bạn may mắn lần sau!',
  no_prize_probability INTEGER DEFAULT 30, -- % chance of no prize
  
  -- Sponsor
  sponsor_name TEXT,
  sponsor_logo TEXT,
  
  -- Stats
  total_views INTEGER DEFAULT 0,
  total_participants INTEGER DEFAULT 0,
  total_spins INTEGER DEFAULT 0,
  
  -- Dates
  start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_by UUID
);

-- Prizes for each campaign
CREATE TABLE public.minigame_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.minigame_campaigns(id) ON DELETE CASCADE NOT NULL,
  
  name TEXT NOT NULL,
  description TEXT,
  image TEXT, -- Prize image URL
  color TEXT DEFAULT '#FF6B00', -- Wheel segment color
  
  -- Prize value (can be voucher, discount, product, etc.)
  prize_type TEXT DEFAULT 'custom', -- 'voucher', 'discount_percent', 'discount_amount', 'product', 'custom'
  prize_value TEXT, -- Value depends on type: voucher code, discount %, amount, product_id, or custom text
  
  -- Probability and limits
  probability INTEGER DEFAULT 10, -- % chance to win this prize
  total_quantity INTEGER, -- NULL = unlimited
  remaining_quantity INTEGER,
  max_per_player INTEGER DEFAULT 1, -- Max wins per player
  
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Track participants who played
CREATE TABLE public.minigame_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.minigame_campaigns(id) ON DELETE CASCADE NOT NULL,
  
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  
  ip_address TEXT,
  user_agent TEXT,
  
  total_spins INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  
  first_played_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  last_played_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Prevent duplicates within same campaign
  CONSTRAINT unique_participant_per_campaign UNIQUE (campaign_id, phone)
);

-- Spin history / results
CREATE TABLE public.minigame_spins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.minigame_campaigns(id) ON DELETE CASCADE NOT NULL,
  participant_id UUID REFERENCES public.minigame_participants(id) ON DELETE CASCADE NOT NULL,
  prize_id UUID REFERENCES public.minigame_prizes(id) ON DELETE SET NULL,
  
  result_type spin_result_type NOT NULL,
  prize_name TEXT, -- Store prize name at time of win
  prize_value TEXT, -- Store prize value at time of win
  
  ip_address TEXT,
  spun_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.minigame_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minigame_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minigame_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minigame_spins ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaigns
CREATE POLICY "Users can view own tenant campaigns"
  ON public.minigame_campaigns FOR SELECT
  USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can insert own tenant campaigns"
  ON public.minigame_campaigns FOR INSERT
  WITH CHECK (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can update own tenant campaigns"
  ON public.minigame_campaigns FOR UPDATE
  USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

CREATE POLICY "Users can delete own tenant campaigns"
  ON public.minigame_campaigns FOR DELETE
  USING (is_platform_admin(auth.uid()) OR tenant_id = get_user_tenant_id_secure());

-- RLS Policies for prizes
CREATE POLICY "Users can manage prizes of own campaigns"
  ON public.minigame_prizes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.minigame_campaigns c 
      WHERE c.id = campaign_id 
      AND (is_platform_admin(auth.uid()) OR c.tenant_id = get_user_tenant_id_secure())
    )
  );

-- RLS Policies for participants - allow public insert for playing
CREATE POLICY "Anyone can insert participants"
  ON public.minigame_participants FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view participants of own campaigns"
  ON public.minigame_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.minigame_campaigns c 
      WHERE c.id = campaign_id 
      AND (is_platform_admin(auth.uid()) OR c.tenant_id = get_user_tenant_id_secure())
    )
  );

-- RLS Policies for spins - allow public insert for playing
CREATE POLICY "Anyone can insert spins"
  ON public.minigame_spins FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view spins of own campaigns"
  ON public.minigame_spins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.minigame_campaigns c 
      WHERE c.id = campaign_id 
      AND (is_platform_admin(auth.uid()) OR c.tenant_id = get_user_tenant_id_secure())
    )
  );

-- Public access policy for viewing active campaigns (for players)
CREATE POLICY "Anyone can view active campaigns"
  ON public.minigame_campaigns FOR SELECT
  USING (status = 'active' AND (end_date IS NULL OR end_date > now()));

CREATE POLICY "Anyone can view prizes of active campaigns"
  ON public.minigame_prizes FOR SELECT
  USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM public.minigame_campaigns c 
      WHERE c.id = campaign_id 
      AND c.status = 'active' 
      AND (c.end_date IS NULL OR c.end_date > now())
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_minigame_campaigns_updated_at
  BEFORE UPDATE ON public.minigame_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_minigame_campaigns_tenant ON public.minigame_campaigns(tenant_id);
CREATE INDEX idx_minigame_campaigns_status ON public.minigame_campaigns(status);
CREATE INDEX idx_minigame_prizes_campaign ON public.minigame_prizes(campaign_id);
CREATE INDEX idx_minigame_participants_campaign ON public.minigame_participants(campaign_id);
CREATE INDEX idx_minigame_participants_phone ON public.minigame_participants(phone);
CREATE INDEX idx_minigame_spins_campaign ON public.minigame_spins(campaign_id);
CREATE INDEX idx_minigame_spins_participant ON public.minigame_spins(participant_id);