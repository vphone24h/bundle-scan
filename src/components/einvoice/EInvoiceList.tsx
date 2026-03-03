import { useState } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Loader2, Search, MoreHorizontal, Eye, XCircle, FileText, RefreshCw, AlertTriangle } from 'lucide-react';
import { useEInvoices, useEInvoiceConfig, useEInvoiceAPI, EInvoice, EInvoiceStatus } from '@/hooks/useEInvoice';
import { EInvoiceDetailDialog } from './EInvoiceDetailDialog';
import { EInvoiceCancelDialog } from './EInvoiceCancelDialog';
import { formatNumber } from '@/lib/formatNumber';
import { Alert, AlertDescription } from '@/components/ui/alert';

const STATUS_LABELS: Record<EInvoiceStatus, string> = {
  draft: 'Nháp',
  pending: 'Đang xử lý',
  issued: 'Đã phát hành',
  cancelled: 'Đã huỷ',
  adjusted: 'Điều chỉnh',
  error: 'Lỗi',
};

const STATUS_VARIANTS: Record<EInvoiceStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  pending: 'outline',
  issued: 'default',
  cancelled: 'destructive',
  adjusted: 'secondary',
  error: 'destructive',
};

export function EInvoiceList() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<EInvoice | null>(null);
  const [cancelInvoice, setCancelInvoice] = useState<EInvoice | null>(null);

  const { data: config, isLoading: configLoading } = useEInvoiceConfig();
  const { data: invoices, isLoading, refetch } = useEInvoices(
    statusFilter !== 'all' ? { status: statusFilter as EInvoiceStatus } : undefined
  );

  const filteredInvoices = invoices?.filter(inv => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(searchLower) ||
      inv.customer_name.toLowerCase().includes(searchLower) ||
      inv.customer_tax_code?.toLowerCase().includes(searchLower) ||
      inv.lookup_code?.toLowerCase().includes(searchLower)
    );
  });

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!config) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Bạn chưa cấu hình nhà cung cấp hoá đơn điện tử. Vui lòng vào tab "Cấu hình" để thiết lập.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Danh sách hoá đơn
            {config.sandbox_mode && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                Sandbox
              </Badge>
            )}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Làm mới
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <SearchInput
            placeholder="Tìm theo số HĐ, khách hàng, MST..."
            value={search}
            onChange={setSearch}
            containerClassName="flex-1"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !filteredInvoices?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            Chưa có hoá đơn nào
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Số hoá đơn</TableHead>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead className="text-right">Tổng tiền</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {invoice.invoice_series}/{invoice.invoice_number || '-'}
                        </div>
                        {invoice.lookup_code && (
                          <div className="text-xs text-muted-foreground">
                            Mã tra cứu: {invoice.lookup_code}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(invoice.invoice_date), 'dd/MM/yyyy', { locale: vi })}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{invoice.customer_name}</div>
                        {invoice.customer_tax_code && (
                          <div className="text-xs text-muted-foreground">
                            MST: {invoice.customer_tax_code}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(invoice.total_amount)}đ
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[invoice.status]}>
                        {STATUS_LABELS[invoice.status]}
                      </Badge>
                      {invoice.error_message && (
                        <div className="text-xs text-destructive mt-1">
                          {invoice.error_message}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedInvoice(invoice)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Xem chi tiết
                          </DropdownMenuItem>
                          {invoice.status === 'issued' && (
                            <DropdownMenuItem 
                              onClick={() => setCancelInvoice(invoice)}
                              className="text-destructive"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Huỷ hoá đơn
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Detail Dialog */}
      {selectedInvoice && (
        <EInvoiceDetailDialog
          invoice={selectedInvoice}
          open={!!selectedInvoice}
          onOpenChange={() => setSelectedInvoice(null)}
        />
      )}

      {/* Cancel Dialog */}
      {cancelInvoice && (
        <EInvoiceCancelDialog
          invoice={cancelInvoice}
          open={!!cancelInvoice}
          onOpenChange={() => setCancelInvoice(null)}
        />
      )}
    </Card>
  );
}
