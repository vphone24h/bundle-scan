import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import {
  Plus,
  Wallet,
  TrendingDown,
  TrendingUp,
  Search,
  Filter,
  Calendar,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useCashBook, useCashBookCategories, useCreateCashBookEntry, type CashBookEntry } from '@/hooks/useCashBook';
import { useBranches } from '@/hooks/useBranches';
import { formatCurrency } from '@/lib/mockData';

const paymentSourceLabels: Record<string, string> = {
  cash: 'Tiền mặt',
  bank_card: 'Thẻ ngân hàng',
  e_wallet: 'Ví điện tử',
};

export default function CashBookPage() {
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('_all_');

  // Form state
  const [formData, setFormData] = useState({
    type: 'expense' as 'expense' | 'income',
    category: '',
    description: '',
    amount: '',
    payment_source: 'cash',
    is_business_accounting: true,
    branch_id: '',
    note: '',
    transaction_date: format(new Date(), 'yyyy-MM-dd'),
  });

  const { data: entries, isLoading } = useCashBook({
    type: activeTab,
    branchId: branchFilter !== '_all_' ? branchFilter : undefined,
  });
  const { data: categories } = useCashBookCategories(activeTab);
  const { data: branches } = useBranches();
  const createEntry = useCreateCashBookEntry();

  // Filter entries
  const filteredEntries = entries?.filter((entry) => {
    const matchesSearch =
      entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = !dateFilter ||
      format(new Date(entry.transaction_date), 'yyyy-MM-dd') === dateFilter;

    return matchesSearch && matchesDate;
  });

  // Calculate totals
  const totalExpenses = entries?.filter(e => e.type === 'expense').reduce((sum, e) => sum + Number(e.amount), 0) || 0;
  const totalIncome = entries?.filter(e => e.type === 'income').reduce((sum, e) => sum + Number(e.amount), 0) || 0;

  const handleOpenAdd = (type: 'expense' | 'income') => {
    setFormData({
      ...formData,
      type,
      category: '',
      description: '',
      amount: '',
      note: '',
    });
    setShowAddDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.category || !formData.description || !formData.amount) {
      toast({
        title: 'Thiếu thông tin',
        description: 'Vui lòng điền đầy đủ thông tin',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createEntry.mutateAsync({
        type: formData.type,
        category: formData.category,
        description: formData.description,
        amount: parseFloat(formData.amount),
        payment_source: formData.payment_source,
        is_business_accounting: formData.is_business_accounting,
        branch_id: formData.branch_id || null,
        note: formData.note || undefined,
        transaction_date: formData.transaction_date,
      });

      setShowAddDialog(false);
      toast({
        title: 'Đã thêm',
        description: `${formData.type === 'expense' ? 'Chi phí' : 'Thu nhập'} đã được ghi nhận`,
      });
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể thêm giao dịch',
        variant: 'destructive',
      });
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title="Sổ quỹ"
        description="Quản lý chi phí và thu nhập khác"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleOpenAdd('income')}>
              <TrendingUp className="h-4 w-4 mr-2" />
              Thêm thu nhập
            </Button>
            <Button onClick={() => handleOpenAdd('expense')}>
              <TrendingDown className="h-4 w-4 mr-2" />
              Thêm chi phí
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tổng chi phí</p>
                  <p className="text-2xl font-bold text-destructive">{formatCurrency(totalExpenses)}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tổng thu nhập khác</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cân đối</p>
                  <p className={`text-2xl font-bold ${totalIncome - totalExpenses >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    {formatCurrency(totalIncome - totalExpenses)}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm theo mô tả, danh mục..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Input
                type="date"
                className="w-40"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Chi nhánh" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="_all_">Tất cả CN</SelectItem>
                  {branches?.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'expense' | 'income')}>
          <TabsList>
            <TabsTrigger value="expense" className="gap-2">
              <TrendingDown className="h-4 w-4" />
              Chi phí
            </TabsTrigger>
            <TabsTrigger value="income" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Thu nhập khác
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expense" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : filteredEntries?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Chưa có chi phí nào
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ngày</TableHead>
                        <TableHead>Danh mục</TableHead>
                        <TableHead>Mô tả</TableHead>
                        <TableHead>Nguồn tiền</TableHead>
                        <TableHead>Chi nhánh</TableHead>
                        <TableHead className="text-right">Số tiền</TableHead>
                        <TableHead>Hạch toán</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries?.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            {format(new Date(entry.transaction_date), 'dd/MM/yyyy', { locale: vi })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{entry.category}</Badge>
                          </TableCell>
                          <TableCell>{entry.description}</TableCell>
                          <TableCell>{paymentSourceLabels[entry.payment_source]}</TableCell>
                          <TableCell>{entry.branches?.name || '-'}</TableCell>
                          <TableCell className="text-right font-medium text-destructive">
                            -{formatCurrency(Number(entry.amount))}
                          </TableCell>
                          <TableCell>
                            {entry.is_business_accounting ? (
                              <Badge variant="default">KD</Badge>
                            ) : (
                              <Badge variant="outline">Không</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="income" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : filteredEntries?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Chưa có thu nhập khác
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ngày</TableHead>
                        <TableHead>Danh mục</TableHead>
                        <TableHead>Mô tả</TableHead>
                        <TableHead>Nguồn tiền</TableHead>
                        <TableHead>Chi nhánh</TableHead>
                        <TableHead className="text-right">Số tiền</TableHead>
                        <TableHead>Hạch toán</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries?.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            {format(new Date(entry.transaction_date), 'dd/MM/yyyy', { locale: vi })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{entry.category}</Badge>
                          </TableCell>
                          <TableCell>{entry.description}</TableCell>
                          <TableCell>{paymentSourceLabels[entry.payment_source]}</TableCell>
                          <TableCell>{entry.branches?.name || '-'}</TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            +{formatCurrency(Number(entry.amount))}
                          </TableCell>
                          <TableCell>
                            {entry.is_business_accounting ? (
                              <Badge variant="default">KD</Badge>
                            ) : (
                              <Badge variant="outline">Không</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {formData.type === 'expense' ? 'Thêm chi phí' : 'Thêm thu nhập'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Ngày giao dịch</Label>
              <Input
                type="date"
                value={formData.transaction_date}
                onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
              />
            </div>

            <div>
              <Label>Danh mục *</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn danh mục" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Mô tả *</Label>
              <Input
                placeholder="Mô tả chi tiết"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div>
              <Label>Số tiền *</Label>
              <Input
                type="number"
                placeholder="Nhập số tiền"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>

            <div>
              <Label>Nguồn tiền</Label>
              <Select
                value={formData.payment_source}
                onValueChange={(v) => setFormData({ ...formData, payment_source: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="cash">Tiền mặt</SelectItem>
                  <SelectItem value="bank_card">Thẻ ngân hàng</SelectItem>
                  <SelectItem value="e_wallet">Ví điện tử</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Chi nhánh</Label>
              <Select
                value={formData.branch_id}
                onValueChange={(v) => setFormData({ ...formData, branch_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn chi nhánh" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {branches?.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label>Hạch toán kinh doanh</Label>
              <Switch
                checked={formData.is_business_accounting}
                onCheckedChange={(v) => setFormData({ ...formData, is_business_accounting: v })}
              />
            </div>

            <div>
              <Label>Ghi chú</Label>
              <Textarea
                placeholder="Ghi chú thêm (tùy chọn)"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Hủy
            </Button>
            <Button onClick={handleSubmit} disabled={createEntry.isPending}>
              {createEntry.isPending ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
