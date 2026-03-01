import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSocialProfile, useUpsertSocialProfile, useSocialFeed, SocialPost } from '@/hooks/useSocial';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Edit, Save, X, CheckCircle, MapPin, Phone, Users } from 'lucide-react';
import { toast } from 'sonner';
import { SocialPostCard } from './SocialPostCard';

interface Props {
  userId?: string;
  onViewProfile: (userId: string) => void;
}

export function SocialProfileTab({ userId, onViewProfile }: Props) {
  const { user } = useAuth();
  const isOwnProfile = !userId || userId === user?.id;
  const { data: profile, isLoading } = useSocialProfile(isOwnProfile ? undefined : userId);
  const { data: feedData } = useSocialFeed(isOwnProfile ? user?.id : userId);
  const upsert = useUpsertSocialProfile();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    zalo_number: '',
    facebook_url: '',
    tiktok_url: '',
    bio: '',
    store_address: '',
    show_zalo_button: true,
    show_facebook_button: true,
  });

  const startEdit = () => {
    if (profile) {
      setForm({
        zalo_number: profile.zalo_number || '',
        facebook_url: profile.facebook_url || '',
        tiktok_url: profile.tiktok_url || '',
        bio: profile.bio || '',
        store_address: profile.store_address || '',
        show_zalo_button: profile.show_zalo_button,
        show_facebook_button: profile.show_facebook_button,
      });
    }
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      await upsert.mutateAsync(form as any);
      setEditing(false);
      toast.success('Đã cập nhật trang cá nhân');
    } catch {
      toast.error('Lỗi khi lưu');
    }
  };

  const posts = feedData?.pages?.flatMap(p => p.posts) || [];

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Đang tải...</div>;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Profile Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="text-lg">{(profile?.display_name || 'U')[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold">{profile?.display_name || 'Người dùng'}</h2>
                {profile?.is_verified && (
                  <CheckCircle className="h-5 w-5 text-blue-500 fill-blue-500" />
                )}
              </div>
              {profile?.bio && <p className="text-muted-foreground text-sm mt-1">{profile.bio}</p>}
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {profile?.follower_count || 0} follower</span>
                <span>{profile?.following_count || 0} đang theo dõi</span>
              </div>
              {profile?.store_address && (
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {profile.store_address}
                </p>
              )}
              {profile?.phone && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {profile.phone}
                </p>
              )}
              {/* Social links */}
              <div className="flex gap-2 mt-2">
                {profile?.zalo_number && profile.show_zalo_button && (
                  <a href={`https://zalo.me/${profile.zalo_number}`} target="_blank" rel="noopener noreferrer">
                    <Badge variant="secondary" className="cursor-pointer hover:bg-blue-100">Zalo</Badge>
                  </a>
                )}
                {profile?.facebook_url && profile.show_facebook_button && (
                  <a href={profile.facebook_url.startsWith('http') ? profile.facebook_url : `https://facebook.com/${profile.facebook_url}`} target="_blank" rel="noopener noreferrer">
                    <Badge variant="secondary" className="cursor-pointer hover:bg-blue-100">Facebook</Badge>
                  </a>
                )}
                {profile?.tiktok_url && (
                  <a href={profile.tiktok_url.startsWith('http') ? profile.tiktok_url : `https://tiktok.com/@${profile.tiktok_url}`} target="_blank" rel="noopener noreferrer">
                    <Badge variant="secondary" className="cursor-pointer hover:bg-blue-100">TikTok</Badge>
                  </a>
                )}
              </div>
            </div>
            {isOwnProfile && !editing && (
              <Button variant="outline" size="sm" onClick={startEdit}><Edit className="h-4 w-4 mr-1" /> Sửa</Button>
            )}
          </div>

          {/* Edit form */}
          {editing && (
            <div className="mt-4 space-y-3 border-t pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Số Zalo</Label>
                  <Input value={form.zalo_number} onChange={e => setForm({ ...form, zalo_number: e.target.value })} placeholder="0901234567" />
                </div>
                <div>
                  <Label className="text-xs">Link Facebook</Label>
                  <Input value={form.facebook_url} onChange={e => setForm({ ...form, facebook_url: e.target.value })} placeholder="https://fb.com/..." />
                </div>
                <div>
                  <Label className="text-xs">Link TikTok</Label>
                  <Input value={form.tiktok_url} onChange={e => setForm({ ...form, tiktok_url: e.target.value })} placeholder="@username" />
                </div>
                <div>
                  <Label className="text-xs">Địa chỉ cửa hàng</Label>
                  <Input value={form.store_address} onChange={e => setForm({ ...form, store_address: e.target.value })} placeholder="123 Đường ABC, Q1, HCM" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Mô tả cá nhân</Label>
                <Textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="Giới thiệu bản thân..." rows={2} />
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={form.show_zalo_button} onCheckedChange={v => setForm({ ...form, show_zalo_button: v })} />
                  <Label className="text-xs">Hiện nút Zalo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.show_facebook_button} onCheckedChange={v => setForm({ ...form, show_facebook_button: v })} />
                  <Label className="text-xs">Hiện nút Facebook</Label>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="h-4 w-4 mr-1" /> Huỷ</Button>
                <Button size="sm" onClick={handleSave} disabled={upsert.isPending}><Save className="h-4 w-4 mr-1" /> Lưu</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Posts */}
      <h3 className="font-semibold text-lg">Bài viết</h3>
      {posts.length === 0 ? (
        <p className="text-center text-muted-foreground py-4">Chưa có bài viết nào</p>
      ) : (
        posts.map(post => (
          <SocialPostCard key={post.id} post={post} onViewProfile={onViewProfile} />
        ))
      )}
    </div>
  );
}
