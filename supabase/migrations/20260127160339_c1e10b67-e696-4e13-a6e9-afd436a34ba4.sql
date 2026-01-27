
-- Add more fields to minigame_campaigns for advanced configuration
ALTER TABLE public.minigame_campaigns
ADD COLUMN IF NOT EXISTS background_image_url text,
ADD COLUMN IF NOT EXISTS wheel_frame_url text,
ADD COLUMN IF NOT EXISTS prize_font_size integer DEFAULT 13,
ADD COLUMN IF NOT EXISTS prize_text_color text DEFAULT '#FFFFFF',
ADD COLUMN IF NOT EXISTS prize_use_image boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS prize_image_size integer DEFAULT 55,
ADD COLUMN IF NOT EXISTS no_prize_title text DEFAULT 'Chúc bạn may mắn lần sau!',
ADD COLUMN IF NOT EXISTS no_prize_image_url text,
ADD COLUMN IF NOT EXISTS sponsor_content text,
ADD COLUMN IF NOT EXISTS allow_duplicate_prize boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS allow_multiple_prizes boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_generate_prize_code boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS send_winner_notification boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS continue_button_text text DEFAULT 'Tiếp tục',
ADD COLUMN IF NOT EXISTS win_title text DEFAULT 'Bạn đã trúng thưởng:',
ADD COLUMN IF NOT EXISTS info_guide_text text DEFAULT 'Vui lòng điền chính xác thông tin bên dưới để nhận giải thưởng',
ADD COLUMN IF NOT EXISTS reset_spins_daily boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS require_info_each_spin boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS prize_code_prefix text,
ADD COLUMN IF NOT EXISTS show_prize_code_suffix boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS verification_method text DEFAULT 'name_phone',
ADD COLUMN IF NOT EXISTS require_prize_info boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS claim_method text DEFAULT 'email',
ADD COLUMN IF NOT EXISTS expire_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS project_title text,
ADD COLUMN IF NOT EXISTS project_description text,
ADD COLUMN IF NOT EXISTS project_avatar_url text,
ADD COLUMN IF NOT EXISTS share_image_url text,
ADD COLUMN IF NOT EXISTS share_quote text,
ADD COLUMN IF NOT EXISTS share_hashtag text,
ADD COLUMN IF NOT EXISTS rules_content text,
ADD COLUMN IF NOT EXISTS winner_email_template text DEFAULT 'Chào {Nguoi_Choi}!
- Bạn vừa trúng giải {Giai_Thuong} của game {Ten_Game} tại Mini Game: {Link_Game}
- Mã nhận thưởng của bạn là: {Ma_Nhan_Thuong}',
ADD COLUMN IF NOT EXISTS enable_facebook_comments boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS create_virtual_winners boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS webhook_url text,
ADD COLUMN IF NOT EXISTS custom_link_template text;

-- Add more fields to minigame_prizes for enhanced prize config
ALTER TABLE public.minigame_prizes
ADD COLUMN IF NOT EXISTS prize_type text DEFAULT 'gift',
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS claim_link text,
ADD COLUMN IF NOT EXISTS description text;

-- Add prize_code to minigame_spins
ALTER TABLE public.minigame_spins
ADD COLUMN IF NOT EXISTS prize_code text,
ADD COLUMN IF NOT EXISTS is_virtual boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS claimed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS claim_info jsonb;
