import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Phone, MapPin, Mail, Calendar, Edit2, ShoppingCart, Wallet, Star, Eye } from 'lucide-react';
import { UserCircle } from 'lucide-react';
import {
  useCustomerDetail,
  usePointTransactions,
  useCustomerPurchaseHistory,
  MEMBERSHIP_TIER_NAMES,
  MEMBERSHIP_TIER_COLORS,
  POINT_TRANSACTION_TYPE_NAMES,
} from '@/hooks/useCustomerPoints';
import { useDebtDetail, useDebtPaymentHistory } from '@/hooks/useDebt';
import { formatNumber } from '@/lib/formatNumber';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CustomerFormDialog } from './CustomerFormDialog';
import { PointAdjustDialog } from './PointAdjustDialog';
import { CustomerPurchaseDetailDialog } from './CustomerPurchaseDetailDialog';
import { StaffAssignSelect } from '@/components/crm/StaffAssignSelect';
import { useAssignStaffToCustomer, useStaffList, CRM_STATUS_LABELS, CRM_STATUS_COLORS, CRMStatus, useUpdateCustomerCRMStatus } from '@/hooks/useCRM';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface CustomerDetailDialogProps {
  customerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerDetailDialog({ customerId, open, onOpenChange }: CustomerDetailDialogProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [showPurchaseDetail, setShowPurchaseDetail] = useState(false);
  const { mutate: assignStaff, isPending: isAssigning } = useAssignStaffToCustomer();
  const { mutate: updateCRMStatus, isPending: isUpdatingStatus } = useUpdateCustomerCRMStatus();
  const { data: staffList } = useStaffList();

  const { data: customer, isLoading } = useCustomerDetail(customerId);
  const { data: pointTransactions } = usePointTransactions(customerId);
  const { data: purchaseHistory } = useCustomerPurchaseHistory(customerId);
  const { data: debtDetail } = useDebtDetail('customer', customerId);
  const { data: debtPayments } = useDebtPaymentHistory('customer', customerId);


  const handleAssignStaff = (staffId: string | null) => {
    if (!customerId) return;
    assignStaff(
      { customerId, staffId },
      {
        onSuccess: () => {
          toast.success('Đã cập nhật nhân viên phụ trách');
        },
        onError: () => {
          toast.error('Lỗi khi cập nhật nhân viên');
        },
      }
    );
  };

  const handleUpdateCRMStatus = (status: CRMStatus) => {
    if (!customerId) return;
    updateCRMStatus(
      { customerId, status },
      {
        onSuccess: () => {
          toast.success('Đã cập nhật trạng thái CRM');
        },
        onError: () => {
          toast.error('Lỗi khi cập nhật trạng thái');
        },
      }
    );
  };

  if (!customer && !isLoading) return null;

  // Calculate debt from export receipts
  const totalDebt = purchaseHistory?.reduce((sum, r) => sum + (r.debt_amount || 0), 0) || 0;
  const paidDebt = debtPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const remainingDebt = totalDebt - paidDebt;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết khách hàng</DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="py-8 text-center">Đang tải...</div>
          ) : customer ? (
            <div className="space-y-4">
              {/* Header - Customer Overview */}
              <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg sm:text-2xl font-bold truncate">{customer.name}</h2>
                          <Badge className={`${MEMBERSHIP_TIER_COLORS[customer.membership_tier]} text-xs`}>
                          <Star className="h-3 w-3 mr-1" />
                          {MEMBERSHIP_TIER_NAMES[customer.membership_tier]}
                        </Badge>
                      </div>
                        <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
                          {customer.phone}
                        </span>
                        {customer.email && (
                            <span className="flex items-center gap-1 truncate max-w-[150px] sm:max-w-none">
                              <Mail className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                              <span className="truncate">{customer.email}</span>
                          </span>
                        )}
                      </div>
                    </div>
                      <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)} className="flex-shrink-0">
                        <Edit2 className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Sửa</span>
                      </Button>
                  </div>

                    <Separator />

                    {/* Key Metrics - 2x2 grid on mobile */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <div className="text-center p-2 sm:p-3 bg-background rounded-lg">
                        <p className="text-lg sm:text-2xl font-bold text-primary break-all">
                        {formatNumber(customer.current_points)}
                      </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Điểm hiện tại</p>
                      {customer.pending_points > 0 && (
                          <p className="text-[10px] sm:text-xs text-yellow-600">+{formatNumber(customer.pending_points)} treo</p>
                      )}
                    </div>
                      <div className="text-center p-2 sm:p-3 bg-background rounded-lg">
                        <p className="text-lg sm:text-2xl font-bold break-all">{formatNumber(customer.total_spent)}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Tổng chi tiêu</p>
                    </div>
                      <div className="text-center p-2 sm:p-3 bg-background rounded-lg">
                        <p className="text-lg sm:text-2xl font-bold text-green-600 break-all">
                        {formatNumber(customer.total_points_earned)}
                      </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Tổng điểm tích</p>
                    </div>
                      <div className="text-center p-2 sm:p-3 bg-background rounded-lg">
                        <p className={`text-lg sm:text-2xl font-bold break-all ${remainingDebt > 0 ? 'text-red-600' : ''}`}>
                        {formatNumber(remainingDebt)}
                      </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Công nợ</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CRM Assignment Section - Outside tabs, below points */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 sm:p-4 bg-muted/50 rounded-lg border">
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-medium flex items-center gap-2">
                    <UserCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Nhân viên phụ trách
                  </label>
                  <Select
                    value={customer.assigned_staff_id || '_none_'}
                    onValueChange={(v) => handleAssignStaff(v === '_none_' ? null : v)}
                    disabled={isAssigning}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Chọn nhân viên..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">Chưa phân công</SelectItem>
                      {staffList?.map((staff) => (
                        <SelectItem key={staff.user_id} value={staff.user_id}>
                          {staff.display_name || 'Nhân viên'}
                          {staff.user_role === 'super_admin' && ' (Admin)'}
                          {staff.user_role === 'branch_admin' && ' (QL)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-medium">Trạng thái CRM</label>
                  <Select
                    value={customer.crm_status || 'new'}
                    onValueChange={(v) => handleUpdateCRMStatus(v as CRMStatus)}
                    disabled={isUpdatingStatus}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CRM_STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="purchases" className="w-full">
                <TabsList className="grid w-full grid-cols-4 h-auto">
                  <TabsTrigger value="purchases" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
                    <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Mua hàng</span>
                  </TabsTrigger>
                  <TabsTrigger value="points" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
                    <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Điểm</span>
                  </TabsTrigger>
                  <TabsTrigger value="debt" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
                    <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Công nợ</span>
                  </TabsTrigger>
                  <TabsTrigger value="info" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
                    <span className="sm:hidden">Info</span>
                    <span className="hidden sm:inline">Thông tin</span>
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Purchase History */}
                <TabsContent value="purchases" className="mt-3">
                  <Card>
                    <CardContent className="p-0">
                      {/* Mobile: Card view */}
                      <div className="sm:hidden divide-y">
                        {purchaseHistory?.length === 0 ? (
                          <p className="text-center py-8 text-muted-foreground text-sm">
                            Chưa có lịch sử mua hàng
                          </p>
                        ) : (
                          purchaseHistory?.map((receipt) => (
                            <div
                              key={receipt.id}
                              className="p-3 active:bg-muted/50"
                              onClick={() => {
                                setSelectedReceipt(receipt);
                                setShowPurchaseDetail(true);
                              }}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <div>
                                  <p className="font-mono text-xs text-muted-foreground">{receipt.code}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(receipt.export_date), 'dd/MM/yyyy', { locale: vi })}
                                  </p>
                                </div>
                                <Badge variant={receipt.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                                  {receipt.status === 'completed' ? 'Hoàn tất' : 'Đã hủy'}
                                </Badge>
                              </div>
                              <div className="flex justify-between items-end">
                                <p className="font-semibold">{formatNumber(receipt.total_amount)}</p>
                                <div className="text-xs">
                                  {receipt.points_earned > 0 && (
                                    <span className="text-green-600">+{receipt.points_earned}</span>
                                  )}
                                  {receipt.points_redeemed > 0 && (
                                    <span className="text-red-600 ml-1">-{receipt.points_redeemed}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      {/* Desktop: Table view */}
                      <Table className="hidden sm:table">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ngày</TableHead>
                            <TableHead>Mã đơn</TableHead>
                            <TableHead className="hidden md:table-cell">Sản phẩm</TableHead>
                            <TableHead className="text-right">Giá trị</TableHead>
                            <TableHead className="text-right hidden sm:table-cell">Điểm</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead className="w-[60px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {purchaseHistory?.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                Chưa có lịch sử mua hàng
                              </TableCell>
                            </TableRow>
                          ) : (
                            purchaseHistory?.map((receipt) => (
                              <TableRow 
                                key={receipt.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => {
                                  setSelectedReceipt(receipt);
                                  setShowPurchaseDetail(true);
                                }}
                              >
                                <TableCell>
                                  {format(new Date(receipt.export_date), 'dd/MM/yyyy', { locale: vi })}
                                </TableCell>
                                <TableCell className="font-mono text-sm">{receipt.code}</TableCell>
                                <TableCell className="hidden md:table-cell">
                                  <div className="max-w-[200px]">
                                    {receipt.export_receipt_items?.slice(0, 2).map((item, idx) => (
                                      <div key={idx} className="text-sm truncate">
                                        {item.product_name}
                                        {item.imei && <span className="text-muted-foreground"> ({item.imei})</span>}
                                      </div>
                                    ))}
                                    {(receipt.export_receipt_items?.length || 0) > 2 && (
                                      <span className="text-xs text-muted-foreground">
                                        +{(receipt.export_receipt_items?.length || 0) - 2} sản phẩm
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatNumber(receipt.total_amount)}
                                </TableCell>
                                <TableCell className="text-right hidden sm:table-cell">
                                  {receipt.points_earned > 0 && (
                                    <span className="text-green-600">+{receipt.points_earned}</span>
                                  )}
                                  {receipt.points_redeemed > 0 && (
                                    <span className="text-red-600 ml-1">-{receipt.points_redeemed}</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={receipt.status === 'completed' ? 'default' : 'secondary'}>
                                    {receipt.status === 'completed' ? 'Hoàn tất' : 'Đã hủy'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedReceipt(receipt);
                                      setShowPurchaseDetail(true);
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab 2: Points History */}
                <TabsContent value="points" className="mt-3 space-y-3">
                  {/* Points Summary */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    <Card>
                      <CardContent className="pt-3 sm:pt-4 text-center px-2">
                        <p className="text-base sm:text-xl font-bold text-green-600 break-all">
                          {formatNumber(customer.total_points_earned)}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Tổng tích</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-3 sm:pt-4 text-center px-2">
                        <p className="text-base sm:text-xl font-bold text-red-600 break-all">
                          {formatNumber(customer.total_points_used)}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Đã dùng</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-3 sm:pt-4 text-center px-2">
                        <p className="text-base sm:text-xl font-bold text-primary break-all">
                          {formatNumber(customer.current_points)}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Còn lại</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => setShowAdjustDialog(true)}>
                      Điều chỉnh điểm
                    </Button>
                  </div>

                  {/* Points Transactions */}
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Thời gian</TableHead>
                            <TableHead>Loại</TableHead>
                            <TableHead className="text-right">Điểm</TableHead>
                            <TableHead className="text-right hidden sm:table-cell">Số dư</TableHead>
                            <TableHead className="hidden md:table-cell">Mô tả</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pointTransactions?.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                Chưa có lịch sử điểm
                              </TableCell>
                            </TableRow>
                          ) : (
                            pointTransactions?.map((tx) => (
                              <TableRow key={tx.id}>
                                <TableCell>
                                  {format(new Date(tx.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      tx.transaction_type === 'earn'
                                        ? 'default'
                                        : tx.transaction_type === 'redeem' || tx.transaction_type === 'refund'
                                        ? 'destructive'
                                        : 'secondary'
                                    }
                                  >
                                    {POINT_TRANSACTION_TYPE_NAMES[tx.transaction_type]}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  <span className={tx.points > 0 ? 'text-green-600' : 'text-red-600'}>
                                    {tx.points > 0 ? '+' : ''}{formatNumber(tx.points)}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right hidden sm:table-cell">
                                  {formatNumber(tx.balance_after)}
                                </TableCell>
                                <TableCell className="hidden md:table-cell max-w-[200px] truncate">
                                  {tx.description}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab 3: Debt */}
                <TabsContent value="debt" className="mt-4 space-y-4">
                  {/* Debt Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <p className="text-xl font-bold">{formatNumber(totalDebt)}</p>
                        <p className="text-xs text-muted-foreground">Tổng nợ</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <p className="text-xl font-bold text-green-600">{formatNumber(paidDebt)}</p>
                        <p className="text-xs text-muted-foreground">Đã trả</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <p className={`text-xl font-bold ${remainingDebt > 0 ? 'text-red-600' : ''}`}>
                          {formatNumber(remainingDebt)}
                        </p>
                        <p className="text-xs text-muted-foreground">Còn lại</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Debt Orders */}
                  <Card>
                    <CardContent className="pt-4">
                      <h4 className="font-semibold mb-3">Đơn hàng có công nợ</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ngày</TableHead>
                            <TableHead>Mã đơn</TableHead>
                            <TableHead className="text-right">Giá trị</TableHead>
                            <TableHead className="text-right">Nợ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {purchaseHistory?.filter(r => r.debt_amount > 0).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                                Không có công nợ
                              </TableCell>
                            </TableRow>
                          ) : (
                            purchaseHistory?.filter(r => r.debt_amount > 0).map((receipt) => (
                              <TableRow key={receipt.id}>
                                <TableCell>
                                  {format(new Date(receipt.export_date), 'dd/MM/yyyy', { locale: vi })}
                                </TableCell>
                                <TableCell className="font-mono text-sm">{receipt.code}</TableCell>
                                <TableCell className="text-right">{formatNumber(receipt.total_amount)}</TableCell>
                                <TableCell className="text-right text-red-600 font-medium">
                                  {formatNumber(receipt.debt_amount)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* Payment History */}
                  {debtPayments && debtPayments.length > 0 && (
                    <Card>
                      <CardContent className="pt-4">
                        <h4 className="font-semibold mb-3">Lịch sử trả nợ</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Ngày</TableHead>
                              <TableHead className="text-right">Số tiền</TableHead>
                              <TableHead>Nguồn tiền</TableHead>
                              <TableHead className="hidden md:table-cell">Nội dung</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {debtPayments.map((payment) => (
                              <TableRow key={payment.id}>
                                <TableCell>
                                  {format(new Date(payment.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                                </TableCell>
                                <TableCell className="text-right text-green-600 font-medium">
                                  +{formatNumber(payment.amount)}
                                </TableCell>
                                <TableCell>{payment.payment_source}</TableCell>
                                <TableCell className="hidden md:table-cell">{payment.description}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Tab 4: Other Info */}
                <TabsContent value="info" className="mt-3">
                  <Card>
                    <CardContent className="pt-4 sm:pt-6 space-y-4 px-3 sm:px-6">
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <label className="text-xs sm:text-sm text-muted-foreground">Ngày sinh</label>
                          <p className="font-medium text-sm sm:text-base">
                            {customer.birthday
                              ? format(new Date(customer.birthday), 'dd/MM/yyyy')
                              : 'Chưa cập nhật'}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs sm:text-sm text-muted-foreground">Email</label>
                          <p className="font-medium text-sm sm:text-base truncate">{customer.email || 'Chưa cập nhật'}</p>
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs sm:text-sm text-muted-foreground">Địa chỉ</label>
                          <p className="font-medium text-sm sm:text-base">{customer.address || 'Chưa cập nhật'}</p>
                        </div>
                        <div>
                          <label className="text-xs sm:text-sm text-muted-foreground">Trạng thái</label>
                          <p className="font-medium text-sm sm:text-base">
                            {customer.status === 'active' ? 'Hoạt động' : 'Ngừng theo dõi'}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs sm:text-sm text-muted-foreground">Nguồn</label>
                          <p className="font-medium text-sm sm:text-base">{customer.source || 'Không xác định'}</p>
                        </div>
                      </div>
                      {customer.note && (
                        <div>
                          <label className="text-xs sm:text-sm text-muted-foreground">Ghi chú</label>
                          <p className="font-medium text-sm sm:text-base">{customer.note}</p>
                        </div>
                      )}
                      <div className="text-xs sm:text-sm text-muted-foreground pt-2 border-t">
                        Khách hàng từ: {format(new Date(customer.created_at), 'dd/MM/yyyy', { locale: vi })}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      {customer && (
        <>
          <CustomerFormDialog
            open={showEditDialog}
            onOpenChange={setShowEditDialog}
            customer={customer}
          />
          <PointAdjustDialog
            open={showAdjustDialog}
            onOpenChange={setShowAdjustDialog}
            customerId={customer.id}
            customerName={customer.name}
            currentPoints={customer.current_points}
          />
        </>
      )}

      {/* Purchase Detail Dialog */}
      <CustomerPurchaseDetailDialog
        receipt={selectedReceipt as any}
        open={showPurchaseDetail}
        onOpenChange={setShowPurchaseDetail}
      />
    </>
  );
}
