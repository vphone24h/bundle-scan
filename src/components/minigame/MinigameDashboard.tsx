import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMinigameStats, useMinigameCampaigns } from '@/hooks/useMinigame';
import { Loader2, Target, Users, RotateCw, TrendingUp, Plus, Eye } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export function MinigameDashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useMinigameStats();
  const { data: campaigns, isLoading: campaignsLoading } = useMinigameCampaigns();

  const recentCampaigns = campaigns?.slice(0, 5) || [];

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng dự án</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.totalCampaigns || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeCampaigns || 0} đang hoạt động
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng người chơi</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.totalParticipants || 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng lượt quay</CardTitle>
            <RotateCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.totalSpins || 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lượt quay hôm nay</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.todaySpins || 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Campaigns */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Dự án gần đây</CardTitle>
          <Button onClick={() => navigate('/minigame/create')} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Tạo mới
          </Button>
        </CardHeader>
        <CardContent>
          {campaignsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : recentCampaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Chưa có dự án nào</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate('/minigame/create')}>
                Tạo dự án đầu tiên
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/minigame/${campaign.id}`)}
                >
                  <div className="flex-1">
                    <h4 className="font-medium">{campaign.name}</h4>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {formatNumber(campaign.total_participants)}
                      </span>
                      <span className="flex items-center gap-1">
                        <RotateCw className="h-3 w-3" />
                        {formatNumber(campaign.total_spins)}
                      </span>
                      <span>
                        {format(new Date(campaign.created_at), 'dd/MM/yyyy', { locale: vi })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        campaign.status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : campaign.status === 'draft'
                          ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                          : campaign.status === 'paused'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}
                    >
                      {campaign.status === 'active'
                        ? 'Hoạt động'
                        : campaign.status === 'draft'
                        ? 'Bản nháp'
                        : campaign.status === 'paused'
                        ? 'Tạm dừng'
                        : 'Đã hết hạn'}
                    </span>
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
