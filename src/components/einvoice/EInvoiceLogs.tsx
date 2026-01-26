import { useState } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, RefreshCw, Eye, History } from 'lucide-react';
import { useEInvoiceLogs, EInvoiceLog } from '@/hooks/useEInvoice';

const ACTION_LABELS: Record<string, string> = {
  create: 'Tạo hoá đơn',
  cancel: 'Huỷ hoá đơn',
  lookup: 'Tra cứu',
  adjust: 'Điều chỉnh',
  'test-connection': 'Kiểm tra kết nối',
};

export function EInvoiceLogs() {
  const { data: logs, isLoading, refetch } = useEInvoiceLogs();
  const [selectedLog, setSelectedLog] = useState<EInvoiceLog | null>(null);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Nhật ký API
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Làm mới
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !logs?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            Chưa có nhật ký nào
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Hành động</TableHead>
                  <TableHead>Mã trạng thái</TableHead>
                  <TableHead>Lỗi</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: vi })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ACTION_LABELS[log.action] || log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.status_code && log.status_code >= 400 ? 'destructive' : 'default'}>
                        {log.status_code || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {log.error_message || '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedLog(log)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Log Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Chi tiết log - {selectedLog && ACTION_LABELS[selectedLog.action]}
            </DialogTitle>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">Thời gian</div>
                <div className="text-sm text-muted-foreground">
                  {format(new Date(selectedLog.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: vi })}
                </div>
              </div>

              {selectedLog.request_data && (
                <div>
                  <div className="text-sm font-medium mb-2">Request Data</div>
                  <pre className="p-4 bg-muted rounded-md overflow-x-auto text-xs">
                    {JSON.stringify(selectedLog.request_data, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.response_data && (
                <div>
                  <div className="text-sm font-medium mb-2">Response Data</div>
                  <pre className="p-4 bg-muted rounded-md overflow-x-auto text-xs">
                    {JSON.stringify(selectedLog.response_data, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.error_message && (
                <div>
                  <div className="text-sm font-medium mb-2">Error Message</div>
                  <div className="p-4 bg-destructive/10 rounded-md text-sm text-destructive">
                    {selectedLog.error_message}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
