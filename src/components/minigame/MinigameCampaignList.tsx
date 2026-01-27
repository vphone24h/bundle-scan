import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useMinigameCampaigns, useDeleteMinigameCampaign, MinigameCampaign } from '@/hooks/useMinigame';
import { 
  Plus, Search, Loader2, Eye, Share2, Settings, BarChart3, 
  Copy, Trash2, Users, RotateCw, Calendar, Gift
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { formatNumber } from '@/lib/formatNumber';
import { useToast } from '@/hooks/use-toast';
import { MinigameShareDialog } from './MinigameShareDialog';

export function MinigameCampaignList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: campaigns, isLoading } = useMinigameCampaigns();
  const deleteMutation = useDeleteMinigameCampaign();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<MinigameCampaign | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const filteredCampaigns = campaigns?.filter((campaign) => {
    const matchesSearch = campaign.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const handleDelete = () => {
    if (selectedCampaign) {
      deleteMutation.mutate(selectedCampaign.id, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setSelectedCampaign(null);
        },
      });
    }
  };

  const handleShare = (campaign: MinigameCampaign) => {
    setSelectedCampaign(campaign);
    setShareDialogOpen(true);
  };

  const handleCopy = (campaign: MinigameCampaign) => {
    // TODO: Implement copy campaign
    toast({
      title: 'Chức năng đang phát triển',
      description: 'Tính năng sao chép dự án sẽ sớm được hoàn thiện',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên dự án..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="active">Hoạt động</SelectItem>
            <SelectItem value="draft">Bản nháp</SelectItem>
            <SelectItem value="paused">Tạm dừng</SelectItem>
            <SelectItem value="expired">Đã hết hạn</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => navigate('/minigame/create')}>
          <Plus className="h-4 w-4 mr-1" />
          Tạo dự án
        </Button>
      </div>

      {/* Campaign Grid */}
      {filteredCampaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Gift className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Không có dự án nào</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCampaigns.map((campaign) => (
            <Card key={campaign.id} className="overflow-hidden">
              {/* Campaign Image/Placeholder */}
              <div className="h-32 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full border-4 border-primary/30 flex items-center justify-center bg-background">
                  <Gift className="h-10 w-10 text-primary" />
                </div>
              </div>

              <CardContent className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-lg line-clamp-1">{campaign.name}</h3>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {formatNumber(campaign.total_views)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {formatNumber(campaign.total_participants)}
                    </span>
                    <span className="flex items-center gap-1">
                      <RotateCw className="h-3 w-3" />
                      {formatNumber(campaign.total_spins)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>
                    Tạo lúc: {format(new Date(campaign.created_at), 'HH:mm dd/MM/yyyy', { locale: vi })}
                  </span>
                </div>

                <div className="flex items-center justify-between">
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
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(`/minigame/${campaign.id}`)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Xem
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => handleShare(campaign)}
                  >
                    <Share2 className="h-3 w-3 mr-1" />
                    Chia sẻ
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(`/minigame/${campaign.id}/settings`)}
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Cài đặt
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(`/minigame/${campaign.id}/stats`)}
                  >
                    <BarChart3 className="h-3 w-3 mr-1" />
                    Thống kê
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleCopy(campaign)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setSelectedCampaign(campaign);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Xóa
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa dự án</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa dự án "{selectedCampaign?.name}"? 
              Hành động này không thể hoàn tác và sẽ xóa toàn bộ dữ liệu liên quan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Xóa dự án
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share Dialog */}
      <MinigameShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        campaign={selectedCampaign}
      />
    </div>
  );
}
