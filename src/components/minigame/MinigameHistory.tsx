import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useMinigameCampaigns, useMinigameSpins } from '@/hooks/useMinigame';
import { Search, Loader2, Gift, RotateCw, Phone, Mail, Calendar, Download } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';

export function MinigameHistory() {
  const isMobile = useIsMobile();
  const { data: campaigns, isLoading: campaignsLoading } = useMinigameCampaigns();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState<string>('all');

  // Get spins for selected campaign
  const campaignIdForQuery = selectedCampaignId === 'all' ? undefined : selectedCampaignId;
  const { data: spins, isLoading: spinsLoading } = useMinigameSpins(campaignIdForQuery);

  // Filter spins
  const filteredSpins = spins?.filter((spin) => {
    const matchesSearch =
      spin.participant?.name?.toLowerCase().includes(search.toLowerCase()) ||
      spin.participant?.phone?.includes(search) ||
      spin.participant?.email?.toLowerCase().includes(search.toLowerCase());
    const matchesResult = resultFilter === 'all' || spin.result_type === resultFilter;
    return matchesSearch && matchesResult;
  }) || [];

  const isLoading = campaignsLoading || spinsLoading;

  if (isLoading && !campaigns) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
              <SelectTrigger className="w-full sm:w-[250px]">
                <SelectValue placeholder="Chọn dự án" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả dự án</SelectItem>
                {campaigns?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên, SĐT, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Kết quả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="prize">Trúng thưởng</SelectItem>
                <SelectItem value="no_prize">Không trúng</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline">
              <Download className="h-4 w-4 mr-1" />
              Xuất Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <RotateCw className="h-5 w-5" />
            Lịch sử quay ({filteredSpins.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedCampaignId === 'all' ? (
            <div className="text-center py-12 text-muted-foreground">
              <RotateCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Vui lòng chọn một dự án để xem lịch sử quay</p>
            </div>
          ) : spinsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSpins.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Chưa có lượt quay nào</p>
            </div>
          ) : isMobile ? (
            // Mobile Card View
            <div className="space-y-3">
              {filteredSpins.map((spin) => (
                <div key={spin.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{spin.participant?.name || 'N/A'}</span>
                    <Badge variant={spin.result_type === 'prize' ? 'default' : 'secondary'}>
                      {spin.result_type === 'prize' ? 'Trúng thưởng' : 'Không trúng'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{spin.participant?.phone || 'N/A'}</span>
                  </div>
                  {spin.participant?.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span>{spin.participant.email}</span>
                    </div>
                  )}
                  {spin.result_type === 'prize' && spin.prize_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <Gift className="h-3 w-3 text-primary" />
                      <span className="text-primary font-medium">{spin.prize_name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{format(new Date(spin.spun_at), 'HH:mm dd/MM/yyyy', { locale: vi })}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Desktop Table View
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Họ tên</TableHead>
                    <TableHead>Số điện thoại</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Kết quả</TableHead>
                    <TableHead>Giải thưởng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSpins.map((spin) => (
                    <TableRow key={spin.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(spin.spun_at), 'HH:mm dd/MM/yyyy', { locale: vi })}
                      </TableCell>
                      <TableCell className="font-medium">{spin.participant?.name || 'N/A'}</TableCell>
                      <TableCell>{spin.participant?.phone || 'N/A'}</TableCell>
                      <TableCell>{spin.participant?.email || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={spin.result_type === 'prize' ? 'default' : 'secondary'}>
                          {spin.result_type === 'prize' ? 'Trúng' : 'Không trúng'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {spin.result_type === 'prize' && spin.prize_name ? (
                          <span className="text-primary font-medium">{spin.prize_name}</span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
