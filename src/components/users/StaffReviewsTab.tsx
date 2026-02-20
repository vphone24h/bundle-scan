import { useState, useMemo } from 'react';
import { useStaffReviews } from '@/hooks/useStaffReviews';
import { useCurrentTenant } from '@/hooks/useTenant';
import { usePermissions } from '@/hooks/usePermissions';
import { useBranches } from '@/hooks/useBranches';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Star, Search, Loader2, MessageSquare } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className="h-3.5 w-3.5"
          fill={i <= rating ? '#f59e0b' : 'none'}
          stroke={i <= rating ? '#f59e0b' : '#d1d5db'}
        />
      ))}
    </div>
  );
}

export function StaffReviewsTab() {
  const { data: currentTenant } = useCurrentTenant();
  const { data: permissions } = usePermissions();
  const { data: branches } = useBranches();
  const { user } = useAuth();

  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [filterRating, setFilterRating] = useState<string>('all');
  const [filterStaff, setFilterStaff] = useState<string>('all');
  const [searchStaffName, setSearchStaffName] = useState('');

  const isSuperAdmin = permissions?.role === 'super_admin';
  const isBranchAdmin = permissions?.role === 'branch_admin';

  // Default branch filter for branch admin
  const effectiveBranchId = isBranchAdmin
    ? permissions?.branchId || null
    : filterBranch !== 'all' ? filterBranch : null;

  // Fetch staff list for filter dropdown
  const { data: staffList } = useQuery({
    queryKey: ['staff-list-for-reviews', currentTenant?.id, user?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data } = await supabase
        .from('user_roles')
        .select('user_id, user_role, branch_id')
        .eq('tenant_id', currentTenant.id);

      if (!data || data.length === 0) return [];

      const userIds = data.map(d => d.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      return (profiles || []).map(p => ({
        user_id: p.user_id,
        display_name: p.display_name,
        branch_id: data.find(d => d.user_id === p.user_id)?.branch_id || null,
      }));
    },
    enabled: !!currentTenant?.id && !!user,
  });

  // Filter staff list by branch if branch admin
  const filteredStaffList = useMemo(() => {
    if (!staffList) return [];
    if (isBranchAdmin && permissions?.branchId) {
      return staffList.filter(s => s.branch_id === permissions.branchId);
    }
    return staffList;
  }, [staffList, isBranchAdmin, permissions?.branchId]);

  const { data: reviews, isLoading } = useStaffReviews({
    tenantId: currentTenant?.id || null,
    branchId: effectiveBranchId,
    staffUserId: filterStaff !== 'all' ? filterStaff : null,
    rating: filterRating !== 'all' ? parseInt(filterRating) : null,
    searchStaffName: searchStaffName.trim() || undefined,
  });

  // Stats
  const avgRating = reviews && reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '0';

  const ratingCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews?.forEach(r => { counts[r.rating as keyof typeof counts]++; });
    return counts;
  }, [reviews]);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{avgRating}</p>
            <StarDisplay rating={Math.round(parseFloat(avgRating))} />
            <p className="text-xs text-muted-foreground mt-1">Trung bình</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{reviews?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Tổng đánh giá</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{ratingCounts[5] + ratingCounts[4]}</p>
            <p className="text-xs text-muted-foreground">4-5 sao</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{ratingCounts[1] + ratingCounts[2]}</p>
            <p className="text-xs text-muted-foreground">1-2 sao</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-5 w-5" />
            Đánh giá nhân viên
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Branch filter - only for super admin */}
            {isSuperAdmin && (
              <Select value={filterBranch} onValueChange={setFilterBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Chi nhánh" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả chi nhánh</SelectItem>
                  {branches?.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Staff filter */}
            <Select value={filterStaff} onValueChange={setFilterStaff}>
              <SelectTrigger>
                <SelectValue placeholder="Nhân viên" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả nhân viên</SelectItem>
                {filteredStaffList.map(s => (
                  <SelectItem key={s.user_id} value={s.user_id}>
                    {s.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Rating filter */}
            <Select value={filterRating} onValueChange={setFilterRating}>
              <SelectTrigger>
                <SelectValue placeholder="Mức sao" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả mức sao</SelectItem>
                <SelectItem value="5">⭐⭐⭐⭐⭐ 5 sao</SelectItem>
                <SelectItem value="4">⭐⭐⭐⭐ 4 sao</SelectItem>
                <SelectItem value="3">⭐⭐⭐ 3 sao</SelectItem>
                <SelectItem value="2">⭐⭐ 2 sao</SelectItem>
                <SelectItem value="1">⭐ 1 sao</SelectItem>
              </SelectContent>
            </Select>

            {/* Staff name search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm tên nhân viên..."
                value={searchStaffName}
                onChange={e => setSearchStaffName(e.target.value)}
                className="pl-9 search-input-highlight"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !reviews || reviews.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Chưa có đánh giá nào</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">STT</TableHead>
                      <TableHead>Tên KH</TableHead>
                      <TableHead>SĐT</TableHead>
                      <TableHead>Mức sao</TableHead>
                      <TableHead>Nội dung</TableHead>
                      <TableHead>NV tư vấn</TableHead>
                      <TableHead>Chi nhánh</TableHead>
                      <TableHead>Ngày</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviews.map((review, index) => (
                      <TableRow key={review.id}>
                        <TableCell className="font-mono text-xs">{index + 1}</TableCell>
                        <TableCell className="font-medium">
                          {review.customer_name || <span className="text-muted-foreground italic">Ẩn danh</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {review.customer_phone || '-'}
                        </TableCell>
                        <TableCell>
                          <StarDisplay rating={review.rating} />
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <p className="text-sm truncate" title={review.content || ''}>
                            {review.content || '-'}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {review.staff_name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {review.branch_name || '-'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(review.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {reviews.map((review, index) => (
                  <div key={review.id} className="border rounded-lg p-3 space-y-2 bg-card">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
                        <p className="font-medium text-sm">
                          {review.customer_name || 'Ẩn danh'}
                        </p>
                      </div>
                      <StarDisplay rating={review.rating} />
                    </div>
                    {review.customer_phone && (
                      <p className="text-xs text-muted-foreground">{review.customer_phone}</p>
                    )}
                    {review.content && (
                      <p className="text-sm text-foreground">{review.content}</p>
                    )}
                    <div className="flex items-center justify-between text-xs">
                      <Badge variant="outline" className="text-xs">
                        NV: {review.staff_name}
                      </Badge>
                      <span className="text-muted-foreground">
                        {format(new Date(review.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                      </span>
                    </div>
                    {review.branch_name && (
                      <p className="text-xs text-muted-foreground">CN: {review.branch_name}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
