import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Merge, Users, AlertTriangle } from 'lucide-react';
import { useDuplicateCustomers, useMergeCustomers, DuplicateCustomerGroup } from '@/hooks/useCustomerMerge';
import { formatNumber } from '@/lib/formatNumber';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface CustomerMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerMergeDialog({ open, onOpenChange }: CustomerMergeDialogProps) {
  const [selectedGroup, setSelectedGroup] = useState<DuplicateCustomerGroup | null>(null);
  const [primaryId, setPrimaryId] = useState<string>('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { data: duplicateGroups, isLoading } = useDuplicateCustomers();
  const mergeMutation = useMergeCustomers();

  const handleSelectGroup = (group: DuplicateCustomerGroup) => {
    setSelectedGroup(group);
    // Auto-select oldest customer as primary
    const oldestCustomer = group.customers.reduce((oldest, current) => 
      new Date(current.created_at) < new Date(oldest.created_at) ? current : oldest
    );
    setPrimaryId(oldestCustomer.id);
  };

  const handleMerge = () => {
    if (!selectedGroup || !primaryId) return;
    
    const duplicateIds = selectedGroup.customers
      .filter(c => c.id !== primaryId)
      .map(c => c.id);

    mergeMutation.mutate(
      { primaryCustomerId: primaryId, duplicateCustomerIds: duplicateIds },
      {
        onSuccess: () => {
          setShowConfirmDialog(false);
          setSelectedGroup(null);
          setPrimaryId('');
        },
      }
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Merge className="h-5 w-5" />
              Gộp khách hàng trùng lặp
            </DialogTitle>
            <DialogDescription>
              Tìm và gộp các khách hàng có cùng tên và số điện thoại. Điểm tích lũy sẽ được cộng gộp.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !duplicateGroups || duplicateGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-green-500 mb-4" />
              <p className="text-lg font-medium">Không tìm thấy khách hàng trùng lặp</p>
              <p className="text-sm text-muted-foreground">
                Tất cả khách hàng đều có tên và số điện thoại duy nhất
              </p>
            </div>
          ) : selectedGroup ? (
            // Show merge selection
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">{selectedGroup.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedGroup.phone}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelectedGroup(null)}>
                  Quay lại
                </Button>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800">Chọn khách hàng chính để giữ lại</p>
                    <p className="text-yellow-700">
                      Các khách hàng khác sẽ bị xóa, tất cả đơn hàng và điểm sẽ được chuyển sang khách hàng chính.
                    </p>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 pr-4">
                <RadioGroup value={primaryId} onValueChange={setPrimaryId} className="space-y-3">
                  {selectedGroup.customers.map((customer) => (
                    <Card 
                      key={customer.id} 
                      className={`cursor-pointer transition-colors ${
                        primaryId === customer.id ? 'border-primary ring-1 ring-primary' : 'hover:border-muted-foreground/30'
                      }`}
                      onClick={() => setPrimaryId(customer.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <RadioGroupItem value={customer.id} id={customer.id} className="mt-1" />
                          <Label htmlFor={customer.id} className="flex-1 cursor-pointer">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{customer.name}</p>
                                <p className="text-sm text-muted-foreground">{customer.phone}</p>
                                {customer.email && (
                                  <p className="text-xs text-muted-foreground">{customer.email}</p>
                                )}
                              </div>
                              {primaryId === customer.id && (
                                <Badge className="bg-primary">Giữ lại</Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                              <div>
                                <p className="text-muted-foreground">Chi tiêu</p>
                                <p className="font-medium">{formatNumber(customer.total_spent)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Điểm hiện tại</p>
                                <p className="font-medium text-primary">{formatNumber(customer.current_points)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Ngày tạo</p>
                                <p className="font-medium">
                                  {format(new Date(customer.created_at), 'dd/MM/yyyy', { locale: vi })}
                                </p>
                              </div>
                            </div>
                          </Label>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </RadioGroup>
              </ScrollArea>

              <div className="flex justify-between items-center pt-4 border-t mt-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">Tổng điểm sau gộp: </span>
                  <span className="font-bold text-primary">{formatNumber(selectedGroup.totalPoints)}</span>
                </div>
                <Button onClick={() => setShowConfirmDialog(true)} disabled={!primaryId}>
                  <Merge className="h-4 w-4 mr-2" />
                  Gộp {selectedGroup.customers.length} khách hàng
                </Button>
              </div>
            </div>
          ) : (
            // Show duplicate groups list
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-3">
                {duplicateGroups.map((group) => (
                  <Card 
                    key={group.key} 
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => handleSelectGroup(group)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{group.name}</p>
                            <Badge variant="secondary">{group.customers.length} trùng</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{group.phone}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Tổng chi tiêu</p>
                          <p className="font-medium">{formatNumber(group.totalSpent)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận gộp khách hàng</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Các khách hàng trùng lặp sẽ bị xóa và tất cả 
              dữ liệu (đơn hàng, điểm thưởng, công nợ) sẽ được chuyển sang khách hàng chính.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleMerge}
              disabled={mergeMutation.isPending}
            >
              {mergeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Xác nhận gộp
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
