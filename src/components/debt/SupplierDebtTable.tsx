import { useState } from 'react';
import { useSupplierDebts, DebtSummary } from '@/hooks/useDebt';
import { formatNumber } from '@/lib/formatNumber';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Eye, Wallet, Plus, Printer, MoreHorizontal, UserPlus } from 'lucide-react';
import { DebtDetailDialog } from './DebtDetailDialog';
import { DebtPaymentDialog } from './DebtPaymentDialog';
import { DebtAdditionDialog } from './DebtAdditionDialog';
import { CreateDebtDialog } from './CreateDebtDialog';

interface SupplierDebtTableProps {
  showSettled: boolean;
}

export function SupplierDebtTable({ showSettled }: SupplierDebtTableProps) {
  const { data: debts, isLoading } = useSupplierDebts(showSettled);
  const [selectedDebt, setSelectedDebt] = useState<DebtSummary | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showAddition, setShowAddition] = useState(false);
  const [showCreateDebt, setShowCreateDebt] = useState(false);

  // Pagination
  const pagination = usePagination(debts || [], { storageKey: 'supplier-debt' });

  const handleViewDetail = (debt: DebtSummary) => {
    setSelectedDebt(debt);
    setShowDetail(true);
  };

  const handlePayDebt = (debt: DebtSummary) => {
    setSelectedDebt(debt);
    setShowPayment(true);
  };

  const handleAddDebt = (debt: DebtSummary) => {
    setSelectedDebt(debt);
    setShowAddition(true);
  };

  const handlePrint = (debt: DebtSummary) => {
    // TODO: Implement print functionality
    console.log('Print debt statement for', debt.entity_name);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!debts || debts.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => setShowCreateDebt(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Thêm công nợ
          </Button>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          Không có công nợ nhà cung cấp
        </div>
        <CreateDebtDialog
          open={showCreateDebt}
          onOpenChange={setShowCreateDebt}
          entityType="supplier"
        />
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setShowCreateDebt(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Thêm công nợ
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên / SĐT</TableHead>
              <TableHead className="hidden md:table-cell">Chi nhánh</TableHead>
              <TableHead className="text-right">Tổng nhập</TableHead>
              <TableHead className="text-right hidden sm:table-cell">Đã trả</TableHead>
              <TableHead className="text-right">Còn nợ</TableHead>
              <TableHead className="hidden lg:table-cell text-center">Số ngày</TableHead>
              <TableHead className="hidden sm:table-cell">Trạng thái</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedData.map((debt) => (
              <TableRow key={debt.entity_id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{debt.entity_name}</p>
                    {debt.entity_phone && (
                      <p className="text-sm text-muted-foreground">{debt.entity_phone}</p>
                    )}
                    {/* Mobile: show branch */}
                    <p className="text-xs text-muted-foreground md:hidden">
                      {debt.branch_name || 'Chưa phân chi nhánh'}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {debt.branch_name || '-'}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatNumber(debt.total_amount)}
                </TableCell>
                <TableCell className="text-right hidden sm:table-cell text-green-600">
                  {formatNumber(debt.paid_amount)}
                </TableCell>
                <TableCell className="text-right font-semibold text-destructive">
                  {formatNumber(debt.remaining_amount)}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-center">
                  <span className={debt.days_overdue > 30 ? 'text-destructive font-semibold' : ''}>
                    {debt.days_overdue} ngày
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {debt.remaining_amount > 0 ? (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                      Đang nợ
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Đã tất toán
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      <DropdownMenuItem onClick={() => handleViewDetail(debt)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Xem chi tiết
                      </DropdownMenuItem>
                      {debt.remaining_amount > 0 && (
                        <DropdownMenuItem onClick={() => handlePayDebt(debt)}>
                          <Wallet className="mr-2 h-4 w-4" />
                          Trả nợ
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleAddDebt(debt)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Cộng thêm nợ
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handlePrint(debt)}>
                        <Printer className="mr-2 h-4 w-4" />
                        In công nợ
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {(debts?.length || 0) > 0 && (
        <TablePagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      )}

      {/* Dialogs */}
      {selectedDebt && (
        <>
          <DebtDetailDialog
            open={showDetail}
            onOpenChange={setShowDetail}
            entityType="supplier"
            entityId={selectedDebt.entity_id}
            entityName={selectedDebt.entity_name}
            entityPhone={selectedDebt.entity_phone}
            branchName={selectedDebt.branch_name}
            totalAmount={selectedDebt.total_amount}
            paidAmount={selectedDebt.paid_amount}
            remainingAmount={selectedDebt.remaining_amount}
          />
          <DebtPaymentDialog
            open={showPayment}
            onOpenChange={setShowPayment}
            entityType="supplier"
            entityId={selectedDebt.entity_id}
            entityName={selectedDebt.entity_name}
            remainingAmount={selectedDebt.remaining_amount}
            branchId={selectedDebt.branch_id}
          />
          <DebtAdditionDialog
            open={showAddition}
            onOpenChange={setShowAddition}
            entityType="supplier"
            entityId={selectedDebt.entity_id}
            entityName={selectedDebt.entity_name}
            remainingAmount={selectedDebt.remaining_amount}
            branchId={selectedDebt.branch_id}
          />
        </>
      )}
      <CreateDebtDialog
        open={showCreateDebt}
        onOpenChange={setShowCreateDebt}
        entityType="supplier"
      />
    </>
  );
}
