import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
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
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { exportToExcel, formatDateForExcel } from '@/lib/exportExcel';
import {
  Plus,
  Wallet,
  TrendingDown,
  TrendingUp,
  Search,
  Filter,
  Loader2,
  X,
  MoreHorizontal,
  Pencil,
  Trash2,
  Download,
  Building2,
  Check,
  Banknote,
  CreditCard,
  Settings,
  BookOpen,
  ArrowLeftRight,
  Landmark,
} from 'lucide-react';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isToday } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useCashBook, useCashBookCategories, useCreateCashBookEntry, useUpdateCashBookEntry, useDeleteCashBookEntry, useCreateCashBookCategory, type CashBookEntry } from '@/hooks/useCashBook';
import { useBranches } from '@/hooks/useBranches';
import { useCashBookGuideUrl } from '@/hooks/useAppConfig';
import { formatCurrency } from '@/lib/mockData';
import { formatNumberWithSpaces, parseFormattedNumber } from '@/lib/formatNumber';
import { cn } from '@/lib/utils';
import { TransferFundsDialog } from '@/components/cashbook/TransferFundsDialog';
import { CashBookDetailDialog } from '@/components/cashbook/CashBookDetailDialog';
import { OpeningBalanceDialog } from '@/components/cashbook/OpeningBalanceDialog';
import { useLatestOpeningBalances } from '@/hooks/useOpeningBalance';
import { useIsMobile } from '@/hooks/use-mobile';

const defaultPaymentSourceLabels: Record<string, string> = {
  cash: 'Tiền mặt',
  bank_card: 'Thẻ ngân hàng',
  e_wallet: 'Ví điện tử',
};

const builtInPaymentSources = [
  { id: 'cash', name: 'Tiền mặt', icon: 'banknote', color: 'green' },
  { id: 'bank_card', name: 'Thẻ ngân hàng', icon: 'credit-card', color: 'blue' },
  { id: 'e_wallet', name: 'Ví điện tử', icon: 'wallet', color: 'purple' },
];

// Load custom payment sources from localStorage
const getCustomPaymentSources = (): { id: string; name: string }[] => {
  try {
    const stored = localStorage.getItem('customPaymentSources');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveCustomPaymentSources = (sources: { id: string; name: string }[]) => {
  localStorage.setItem('customPaymentSources', JSON.stringify(sources));
};

export default function CashBookPage() {
  // Main view tabs: by branch or total
  const [viewMode, setViewMode] = useState<'branch' | 'total'>('total');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  
  // Transaction type filter
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income' | 'transfer'>('all');
  
  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAdjustBalanceDialog, setShowAdjustBalanceDialog] = useState(false);
  const [showAddSourceDialog, setShowAddSourceDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showOpeningBalanceDialog, setShowOpeningBalanceDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CashBookEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<CashBookEntry | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [newSourceName, setNewSourceName] = useState('');
  
  // Custom payment sources state
  const [customPaymentSources, setCustomPaymentSources] = useState<{ id: string; name: string }[]>(getCustomPaymentSources());
  
  // All payment sources (built-in + custom)
  const allPaymentSources = useMemo(() => {
    return [...builtInPaymentSources, ...customPaymentSources.map(s => ({ ...s, icon: 'wallet', color: 'gray' }))];
  }, [customPaymentSources]);
  
  // Payment source labels
  const paymentSourceLabels = useMemo(() => {
    const labels: Record<string, string> = { ...defaultPaymentSourceLabels };
    customPaymentSources.forEach(s => {
      labels[s.id] = s.name;
    });
    return labels;
  }, [customPaymentSources]);
  
  // Balance adjustment form
  const [adjustBalanceData, setAdjustBalanceData] = useState({
    source: 'cash' as string,
    currentBalance: 0,
    newBalance: '',
    reason: '',
    includeInAccounting: false,
    branchId: '' as string,
  });
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentSourceFilter, setPaymentSourceFilter] = useState('_all_');
  const [accountingFilter, setAccountingFilter] = useState('_all_');
  const [categoryFilter, setCategoryFilter] = useState('_all_');
  const [showFilters, setShowFilters] = useState(false);
  
  // Add category dialog
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    type: 'expense' as 'expense' | 'income',
    category: '',
    description: '',
    payments: [{ source: 'cash', amount: '' }] as { source: string; amount: string }[],
    is_business_accounting: true,
    branch_id: '',
    note: '',
    transaction_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  });

  // Data hooks
  const { data: allEntries, isLoading } = useCashBook({
    branchId: viewMode === 'branch' && selectedBranchId ? selectedBranchId : undefined,
  });
  const { data: expenseCategories } = useCashBookCategories('expense');
  const { data: incomeCategories } = useCashBookCategories('income');
  const { data: branches } = useBranches();
  const cashBookGuideUrl = useCashBookGuideUrl();
  const createEntry = useCreateCashBookEntry();
  const updateEntry = useUpdateCashBookEntry();
  const deleteEntry = useDeleteCashBookEntry();
  const createCategory = useCreateCashBookCategory();
  const isMobile = useIsMobile();
  const { data: latestOpeningBalances } = useLatestOpeningBalances();
  
  // All categories for filter (both income and expense)
  const { data: allCategories } = useCashBookCategories();

  // Get current categories based on form type
  const currentCategories = formData.type === 'expense' ? expenseCategories : incomeCategories;

  // Filter entries
  const filteredEntries = useMemo(() => {
    if (!allEntries) return [];
    
    return allEntries.filter((entry) => {
      // Check if entry is a transfer (category is "Chuyển tiền nội bộ")
      const isTransfer = entry.category === 'Chuyển tiền nội bộ';
      
      // Type filter
      let matchesType = true;
      if (typeFilter === 'transfer') {
        matchesType = isTransfer;
      } else if (typeFilter === 'expense') {
        matchesType = entry.type === 'expense' && !isTransfer;
      } else if (typeFilter === 'income') {
        matchesType = entry.type === 'income' && !isTransfer;
      }
      // typeFilter === 'all' matches everything
      
      // Search filter
      const matchesSearch =
        entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Date filter
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const entryDate = startOfDay(new Date(entry.transaction_date));
        if (dateFrom && dateTo) {
          matchesDate = isWithinInterval(entryDate, {
            start: startOfDay(parseISO(dateFrom)),
            end: endOfDay(parseISO(dateTo))
          });
        } else if (dateFrom) {
          matchesDate = entryDate >= startOfDay(parseISO(dateFrom));
        } else if (dateTo) {
          matchesDate = entryDate <= endOfDay(parseISO(dateTo));
        }
      }
      
      // Payment source filter
      const matchesPaymentSource = paymentSourceFilter === '_all_' || entry.payment_source === paymentSourceFilter;
      
      // Accounting filter
      const matchesAccounting = accountingFilter === '_all_' || 
        (accountingFilter === 'yes' && entry.is_business_accounting) ||
        (accountingFilter === 'no' && !entry.is_business_accounting);
      
      // Category filter
      const matchesCategory = categoryFilter === '_all_' || entry.category === categoryFilter;

      return matchesType && matchesSearch && matchesDate && matchesPaymentSource && matchesAccounting && matchesCategory;
    });
  }, [allEntries, typeFilter, searchTerm, dateFrom, dateTo, paymentSourceFilter, accountingFilter, categoryFilter]);

  // Pagination for transactions
  const pagination = usePagination(filteredEntries, { 
    storageKey: 'cashbook-entries'
  });

  // Calculate totals
  const totalBalance = useMemo(() => {
    if (!allEntries) return 0;
    const income = allEntries.filter(e => e.type === 'income').reduce((sum, e) => sum + Number(e.amount), 0);
    const expense = allEntries.filter(e => e.type === 'expense').reduce((sum, e) => sum + Number(e.amount), 0);
    // Cộng thêm tổng số dư đầu kỳ từ tất cả nguồn tiền
    const openingTotal = latestOpeningBalances 
      ? Object.values(latestOpeningBalances).reduce((sum, ob) => sum + Number(ob.amount), 0) 
      : 0;
    return openingTotal + income - expense;
  }, [allEntries, latestOpeningBalances]);

  // Calculate balance by payment source (including custom sources)
  const balanceBySource = useMemo(() => {
    if (!allEntries) return {};
    
    // Initialize with all sources (built-in + custom)
    const result: Record<string, number> = {};
    allPaymentSources.forEach(src => {
      // Bắt đầu từ số dư đầu kỳ (nếu có)
      const openingBalance = latestOpeningBalances?.[src.id];
      result[src.id] = openingBalance ? Number(openingBalance.amount) : 0;
    });
    
    allEntries.forEach((entry) => {
      const source = entry.payment_source;
      const amount = Number(entry.amount);
      if (result[source] === undefined) {
        const openingBalance = latestOpeningBalances?.[source];
        result[source] = openingBalance ? Number(openingBalance.amount) : 0;
      }
      if (entry.type === 'income') {
        result[source] += amount;
      } else {
        result[source] -= amount;
      }
    });
    
    return result;
  }, [allEntries, allPaymentSources, latestOpeningBalances]);

  const todayStats = useMemo(() => {
    if (!allEntries) return { income: 0, expense: 0 };
    const todayEntries = allEntries.filter(e => isToday(new Date(e.transaction_date)));
    return {
      income: todayEntries.filter(e => e.type === 'income').reduce((sum, e) => sum + Number(e.amount), 0),
      expense: todayEntries.filter(e => e.type === 'expense').reduce((sum, e) => sum + Number(e.amount), 0),
    };
  }, [allEntries]);

  const hasActiveFilters = dateFrom || dateTo || paymentSourceFilter !== '_all_' || accountingFilter !== '_all_' || categoryFilter !== '_all_' || searchTerm;

  const clearFilters = () => {
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setPaymentSourceFilter('_all_');
    setAccountingFilter('_all_');
    setCategoryFilter('_all_');
  };
  
  // Handle add category
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({
        title: 'Thiếu thông tin',
        description: 'Vui lòng nhập tên danh mục',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      await createCategory.mutateAsync({
        name: newCategoryName.trim(),
        type: formData.type,
      });
      
      // Auto-select the new category
      setFormData({ ...formData, category: newCategoryName.trim() });
      setNewCategoryName('');
      setShowAddCategoryDialog(false);
      
      toast({
        title: 'Đã thêm danh mục',
        description: `Danh mục "${newCategoryName.trim()}" đã được thêm`,
      });
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể thêm danh mục',
        variant: 'destructive',
      });
    }
  };

  const handleOpenAdd = (type: 'expense' | 'income') => {
    setFormData({
      type,
      category: '',
      description: '',
      payments: [{ source: 'cash', amount: '' }],
      is_business_accounting: true,
      branch_id: viewMode === 'branch' && selectedBranchId ? selectedBranchId : '',
      note: '',
      transaction_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    });
    setShowAddDialog(true);
  };

  const handleOpenEdit = (entry: CashBookEntry) => {
    setEditingEntry(entry);
    setFormData({
      type: entry.type,
      category: entry.category,
      description: entry.description,
      payments: [{ source: entry.payment_source, amount: formatNumberWithSpaces(entry.amount) }],
      is_business_accounting: entry.is_business_accounting ?? true,
      branch_id: entry.branch_id || '',
      note: entry.note || '',
      transaction_date: format(new Date(entry.transaction_date), "yyyy-MM-dd'T'HH:mm"),
    });
    setShowEditDialog(true);
  };

  const handleOpenDelete = (entry: CashBookEntry) => {
    setEditingEntry(entry);
    setDeleteReason('');
    setShowDeleteDialog(true);
  };

  const handleOpenAdjustBalance = (source: string) => {
    const defaultBranch = branches?.find(b => b.is_default) || branches?.[0];
    setAdjustBalanceData({
      source,
      currentBalance: balanceBySource[source] || 0,
      newBalance: '',
      reason: '',
      includeInAccounting: false,
      branchId: defaultBranch?.id || '',
    });
    setShowAdjustBalanceDialog(true);
  };

  const handleAdjustBalance = async () => {
    const newBalance = parseFloat(adjustBalanceData.newBalance);
    if (isNaN(newBalance) || !adjustBalanceData.reason.trim()) {
      toast({
        title: 'Thiếu thông tin',
        description: 'Vui lòng nhập số dư mới và lý do điều chỉnh',
        variant: 'destructive',
      });
      return;
    }

    // Require branch selection in total view
    if (viewMode === 'total' && !adjustBalanceData.branchId) {
      toast({
        title: 'Thiếu chi nhánh',
        description: 'Vui lòng chọn chi nhánh để ghi nhận điều chỉnh',
        variant: 'destructive',
      });
      return;
    }

    const difference = newBalance - adjustBalanceData.currentBalance;
    if (difference === 0) {
      toast({
        title: 'Không có thay đổi',
        description: 'Số dư mới trùng với số dư hiện tại',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Use selected branch or the branch from branch view
      const branchId = viewMode === 'total' ? adjustBalanceData.branchId : selectedBranchId;
      const branchName = branches?.find(b => b.id === branchId)?.name || '';

      await createEntry.mutateAsync({
        type: difference > 0 ? 'income' : 'expense',
        category: 'Điều chỉnh số dư',
        description: `Điều chỉnh ${paymentSourceLabels[adjustBalanceData.source]}: ${adjustBalanceData.reason}`,
        amount: Math.abs(difference),
        payment_source: adjustBalanceData.source,
        is_business_accounting: adjustBalanceData.includeInAccounting,
        branch_id: branchId || null,
        note: `Số dư trước: ${formatCurrency(adjustBalanceData.currentBalance)} → Số dư sau: ${formatCurrency(newBalance)}${branchName ? ` (Chi nhánh: ${branchName})` : ''}`,
      });

      setShowAdjustBalanceDialog(false);
      toast({
        title: 'Đã điều chỉnh số dư',
        description: `${paymentSourceLabels[adjustBalanceData.source]}: ${formatCurrency(adjustBalanceData.currentBalance)} → ${formatCurrency(newBalance)}`,
      });
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể điều chỉnh số dư',
        variant: 'destructive',
      });
    }
  };

  const addPaymentSource = () => {
    setFormData({
      ...formData,
      payments: [...formData.payments, { source: 'cash', amount: '' }],
    });
  };

  const removePaymentSource = (index: number) => {
    setFormData({
      ...formData,
      payments: formData.payments.filter((_, i) => i !== index),
    });
  };

  const updatePayment = (index: number, field: 'source' | 'amount', value: string) => {
    const newPayments = [...formData.payments];
    if (field === 'amount') {
      // Parse the input and format with spaces
      const numValue = parseFormattedNumber(value);
      newPayments[index][field] = numValue > 0 ? formatNumberWithSpaces(numValue) : '';
    } else {
      newPayments[index][field] = value;
    }
    setFormData({ ...formData, payments: newPayments });
  };

  const totalPaymentAmount = formData.payments.reduce((sum, p) => sum + parseFormattedNumber(p.amount), 0);

  const handleSubmit = async () => {
    if (!formData.category || !formData.description || totalPaymentAmount <= 0) {
      toast({
        title: 'Thiếu thông tin',
        description: 'Vui lòng điền đầy đủ thông tin và số tiền',
        variant: 'destructive',
      });
      return;
    }

    if (viewMode === 'total' && !formData.branch_id) {
      toast({
        title: 'Thiếu chi nhánh',
        description: 'Vui lòng chọn chi nhánh khi thêm giao dịch ở tab Tổng sổ quỹ',
        variant: 'destructive',
      });
      return;
    }

    try {
      // For now, we'll create one entry with the main payment source and total amount
      // In a more complex implementation, you could create multiple entries
      const mainPayment = formData.payments[0];
      
      await createEntry.mutateAsync({
        type: formData.type,
        category: formData.category,
        description: formData.description,
        amount: totalPaymentAmount,
        payment_source: mainPayment.source,
        is_business_accounting: formData.is_business_accounting,
        branch_id: formData.branch_id || null,
        note: formData.note || undefined,
        transaction_date: formData.transaction_date,
      });

      setShowAddDialog(false);
      toast({
        title: 'Đã thêm',
        description: `${formData.type === 'expense' ? 'Phiếu chi' : 'Phiếu thu'} đã được ghi nhận`,
      });
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể thêm giao dịch',
        variant: 'destructive',
      });
    }
  };

  const handleUpdate = async () => {
    if (!editingEntry) return;
    
    if (!formData.category || !formData.description || totalPaymentAmount <= 0) {
      toast({
        title: 'Thiếu thông tin',
        description: 'Vui lòng điền đầy đủ thông tin và số tiền',
        variant: 'destructive',
      });
      return;
    }

    try {
      const mainPayment = formData.payments[0];
      
      await updateEntry.mutateAsync({
        id: editingEntry.id,
        oldData: editingEntry, // Truyền dữ liệu cũ để ghi audit log
        category: formData.category,
        description: formData.description,
        amount: totalPaymentAmount,
        payment_source: mainPayment.source,
        is_business_accounting: formData.is_business_accounting,
        branch_id: formData.branch_id || null,
        note: formData.note || undefined,
      });

      setShowEditDialog(false);
      setEditingEntry(null);
      toast({
        title: 'Đã cập nhật',
        description: 'Giao dịch đã được cập nhật và ghi nhận vào lịch sử',
      });
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể cập nhật giao dịch',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!editingEntry || !deleteReason.trim()) return;

    try {
      await deleteEntry.mutateAsync({
        entry: editingEntry,
        reason: deleteReason,
      });

      setShowDeleteDialog(false);
      setEditingEntry(null);
      setDeleteReason('');
      toast({
        title: 'Đã xóa',
        description: 'Giao dịch đã được xóa và ghi nhận vào lịch sử',
      });
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể xóa giao dịch',
        variant: 'destructive',
      });
    }
  };

  const handleExport = () => {
    if (filteredEntries.length === 0) {
      toast({ title: 'Không có dữ liệu', description: 'Không có giao dịch nào để xuất', variant: 'destructive' });
      return;
    }

    exportToExcel({
      filename: `So_quy_${format(new Date(), 'ddMMyyyy')}`,
      sheetName: 'Sổ quỹ',
      columns: [
        { header: 'STT', key: 'stt', width: 6, isNumeric: true },
        { header: 'Ngày', key: 'transaction_date', width: 18, format: (v) => formatDateForExcel(v, 'dd/MM/yyyy HH:mm') },
        { header: 'Loại', key: 'type', width: 8, format: (v) => v === 'expense' ? 'Chi' : 'Thu' },
        { header: 'Danh mục', key: 'category', width: 20 },
        { header: 'Mô tả', key: 'description', width: 35 },
        { header: 'Số tiền', key: 'signed_amount', width: 15, isNumeric: true },
        { header: 'Nguồn tiền', key: 'payment_source', width: 15, format: (v) => paymentSourceLabels[v] || v },
        { header: 'Chi nhánh', key: 'branch_name', width: 20 },
        { header: 'Hạch toán KD', key: 'is_business_accounting', width: 12, format: (v) => v ? 'Có' : 'Không' },
        { header: 'Ghi chú', key: 'note', width: 30 },
      ],
      data: filteredEntries.map((e, index) => ({
        stt: index + 1,
        transaction_date: e.transaction_date,
        type: e.type,
        category: e.category,
        description: e.description,
        signed_amount: e.type === 'expense' ? -Number(e.amount) : Number(e.amount),
        payment_source: e.payment_source,
        branch_name: e.branches?.name || '',
        is_business_accounting: e.is_business_accounting,
        note: e.note || '',
      })),
    });

    toast({ title: 'Xuất Excel thành công', description: `Đã xuất ${filteredEntries.length} giao dịch` });
  };

  return (
    <MainLayout>
      <PageHeader
        title="Sổ quỹ"
        description="Quản lý dòng tiền thu chi"
        actions={
           <div className="flex flex-wrap gap-1.5 sm:gap-2">
             {cashBookGuideUrl && (
               <Button variant="secondary" size="sm" asChild className="hidden sm:inline-flex">
                 <a href={cashBookGuideUrl} target="_blank" rel="noopener noreferrer">
                   <BookOpen className="mr-2 h-4 w-4" />
                   Hướng dẫn
                 </a>
               </Button>
             )}
             <Button variant="outline" size="sm" onClick={() => setShowOpeningBalanceDialog(true)} className="text-xs sm:text-sm px-2 sm:px-3">
               <Landmark className="h-4 w-4 mr-1 sm:mr-2" />
               <span className="hidden sm:inline">Quỹ kỳ đầu</span>
               <span className="sm:hidden">Kỳ đầu</span>
             </Button>
             <Button variant="outline" size="sm" onClick={() => handleOpenAdd('income')} className="text-green-600 border-green-600 hover:bg-green-50 text-xs sm:text-sm px-2 sm:px-3">
               <TrendingUp className="h-4 w-4 mr-1 sm:mr-2" />
               Thu
             </Button>
             <Button size="sm" onClick={() => handleOpenAdd('expense')} className="bg-destructive hover:bg-destructive/90 text-xs sm:text-sm px-2 sm:px-3">
               <TrendingDown className="h-4 w-4 mr-1 sm:mr-2" />
               Chi
             </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowTransferDialog(true)} className="text-xs sm:text-sm px-2 sm:px-3">
              <ArrowLeftRight className="h-4 w-4 mr-1 sm:mr-2" />
              Chuyển
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* View Mode Tabs */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'branch' | 'total')}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="total" className="gap-2">
                <Wallet className="h-4 w-4" />
                Tổng sổ quỹ
              </TabsTrigger>
              <TabsTrigger value="branch" className="gap-2">
                <Building2 className="h-4 w-4" />
                Theo chi nhánh
              </TabsTrigger>
            </TabsList>
            
            {viewMode === 'branch' && (
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger className="w-48">
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
            )}
          </div>
        </Tabs>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tổng số dư</p>
                  <p className={cn("text-2xl font-bold", totalBalance >= 0 ? 'text-green-600' : 'text-destructive')}>
                    {formatCurrency(totalBalance)}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tiền vào hôm nay</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(todayStats.income)}</p>
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
                  <p className="text-sm font-medium text-muted-foreground">Tiền ra hôm nay</p>
                  <p className="text-2xl font-bold text-destructive">{formatCurrency(todayStats.expense)}</p>
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
                  <p className="text-sm font-medium text-muted-foreground">Chênh lệch hôm nay</p>
                  <p className={cn("text-2xl font-bold", todayStats.income - todayStats.expense >= 0 ? 'text-green-600' : 'text-destructive')}>
                    {formatCurrency(todayStats.income - todayStats.expense)}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Balance by Payment Source */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Số dư theo nguồn tiền
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowAddSourceDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Thêm nguồn tiền
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {allPaymentSources.map((source) => {
                const balance = balanceBySource[source.id] || 0;
                const isBuiltIn = builtInPaymentSources.some(s => s.id === source.id);
                const openingBal = latestOpeningBalances?.[source.id];
                const colorClass = source.color === 'green' ? 'bg-green-100' : 
                                   source.color === 'blue' ? 'bg-blue-100' : 
                                   source.color === 'purple' ? 'bg-purple-100' : 'bg-muted';
                const iconColorClass = source.color === 'green' ? 'text-green-600' : 
                                        source.color === 'blue' ? 'text-blue-600' : 
                                        source.color === 'purple' ? 'text-purple-600' : 'text-muted-foreground';
                
                return (
                  <div key={source.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", colorClass)}>
                        {source.icon === 'banknote' ? (
                          <Banknote className={cn("h-5 w-5", iconColorClass)} />
                        ) : source.icon === 'credit-card' ? (
                          <CreditCard className={cn("h-5 w-5", iconColorClass)} />
                        ) : (
                          <Wallet className={cn("h-5 w-5", iconColorClass)} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{source.name}</p>
                        <p className={cn("text-lg font-bold", balance >= 0 ? 'text-green-600' : 'text-destructive')}>
                          {formatCurrency(balance)}
                        </p>
                        {openingBal && (
                          <p className="text-xs text-muted-foreground">
                            Đầu kỳ: {formatCurrency(openingBal.amount)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleOpenAdjustBalance(source.id)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      {!isBuiltIn && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            const updated = customPaymentSources.filter(s => s.id !== source.id);
                            setCustomPaymentSources(updated);
                            saveCustomPaymentSources(updated);
                            toast({ title: 'Đã xóa nguồn tiền', description: source.name });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
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
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as 'all' | 'expense' | 'income' | 'transfer')}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="expense">Phiếu chi</SelectItem>
                    <SelectItem value="income">Phiếu thu</SelectItem>
                    <SelectItem value="transfer">Chuyển tiền</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant={showFilters ? 'secondary' : 'outline'}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Bộ lọc
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
                      !
                    </Badge>
                  )}
                </Button>
                <Button variant="outline" onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" />
                  Xuất Excel
                </Button>
              </div>

              {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label className="text-xs">Từ ngày</Label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Đến ngày</Label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Danh mục</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">Tất cả danh mục</SelectItem>
                        {allCategories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Nguồn tiền</Label>
                    <Select value={paymentSourceFilter} onValueChange={setPaymentSourceFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">Tất cả nguồn</SelectItem>
                        {allPaymentSources.map((src) => (
                          <SelectItem key={src.id} value={src.id}>{src.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Hạch toán KD</Label>
                    <Select value={accountingFilter} onValueChange={setAccountingFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="_all_">Tất cả</SelectItem>
                        <SelectItem value="yes">Có hạch toán</SelectItem>
                        <SelectItem value="no">Không hạch toán</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full">
                      <X className="h-4 w-4 mr-1" />
                      Xóa lọc
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lịch sử giao dịch ({filteredEntries.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {hasActiveFilters ? 'Không tìm thấy giao dịch phù hợp' : 'Chưa có giao dịch nào'}
              </div>
            ) : isMobile ? (
              /* Mobile Card View */
              <div className="space-y-3">
                {pagination.paginatedData.map((entry) => (
                  <div 
                    key={entry.id} 
                    className="p-3 rounded-lg border bg-card cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      setSelectedEntry(entry);
                      setShowDetailDialog(true);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {(() => {
                            const isTransfer = entry.category === 'Chuyển tiền nội bộ';
                            if (isTransfer) {
                              return (
                                <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-200">
                                  Chuyển
                                </Badge>
                              );
                            }
                            return (
                              <Badge className={cn(
                                "text-[10px] px-1.5 py-0",
                                entry.type === 'expense' 
                                  ? 'bg-destructive/10 text-destructive border-destructive/20' 
                                  : 'bg-green-100 text-green-700 border-green-200'
                              )}>
                                {entry.type === 'expense' ? 'Chi' : 'Thu'}
                              </Badge>
                            );
                          })()}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(entry.transaction_date), 'dd/MM HH:mm', { locale: vi })}
                          </span>
                        </div>
                        <p className="font-medium text-sm line-clamp-2">{entry.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {entry.category} • {paymentSourceLabels[entry.payment_source] || entry.payment_source}
                          {entry.branches?.name && ` • ${entry.branches.name}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn(
                          "font-bold text-sm",
                          entry.type === 'expense' ? 'text-destructive' : 'text-green-600'
                        )}>
                          {entry.type === 'expense' ? '-' : '+'}{formatCurrency(Number(entry.amount))}
                        </p>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7 mt-1">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenEdit(entry); }}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Chỉnh sửa
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => { e.stopPropagation(); handleOpenDelete(entry); }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Xóa
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Desktop Table View */
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ngày / Giờ</TableHead>
                      <TableHead>Loại</TableHead>
                      <TableHead>Danh mục</TableHead>
                      <TableHead>Mô tả</TableHead>
                      <TableHead className="text-right">Số tiền</TableHead>
                      <TableHead>Nguồn tiền</TableHead>
                      <TableHead>Chi nhánh</TableHead>
                      <TableHead>Hạch toán</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.paginatedData.map((entry) => (
                      <TableRow 
                        key={entry.id} 
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => {
                          setSelectedEntry(entry);
                          setShowDetailDialog(true);
                        }}
                      >
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(entry.transaction_date), 'dd/MM/yyyy HH:mm', { locale: vi })}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const isTransfer = entry.category === 'Chuyển tiền nội bộ';
                            if (isTransfer) {
                              return (
                                <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                                  Chuyển
                                </Badge>
                              );
                            }
                            return (
                              <Badge className={cn(
                                entry.type === 'expense' 
                                  ? 'bg-destructive/10 text-destructive border-destructive/20' 
                                  : 'bg-green-100 text-green-700 border-green-200'
                              )}>
                                {entry.type === 'expense' ? 'Chi' : 'Thu'}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{entry.category}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{entry.description}</TableCell>
                        <TableCell className={cn(
                          "text-right font-medium whitespace-nowrap",
                          entry.type === 'expense' ? 'text-destructive' : 'text-green-600'
                        )}>
                          {entry.type === 'expense' ? '-' : '+'}{formatCurrency(Number(entry.amount))}
                        </TableCell>
                        <TableCell>{paymentSourceLabels[entry.payment_source] || entry.payment_source}</TableCell>
                        <TableCell>{entry.branches?.name || '-'}</TableCell>
                        <TableCell>
                          {entry.is_business_accounting ? (
                            <Badge variant="default" className="gap-1">
                              <Check className="h-3 w-3" /> KD
                            </Badge>
                          ) : (
                            <Badge variant="outline">Không</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenEdit(entry); }}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Chỉnh sửa
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => { e.stopPropagation(); handleOpenDelete(entry); }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Xóa
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {filteredEntries.length > 0 && (
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
          </CardContent>
        </Card>
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className={formData.type === 'expense' ? 'text-destructive' : 'text-green-600'}>
              {formData.type === 'expense' ? '➖ Thêm phiếu chi' : '➕ Thêm phiếu thu'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Transaction Type Toggle */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={formData.type === 'expense' ? 'default' : 'outline'}
                className={formData.type === 'expense' ? 'bg-destructive hover:bg-destructive/90 flex-1' : 'flex-1'}
                onClick={() => setFormData({ ...formData, type: 'expense', category: '' })}
              >
                <TrendingDown className="h-4 w-4 mr-2" />
                Phiếu chi
              </Button>
              <Button
                type="button"
                variant={formData.type === 'income' ? 'default' : 'outline'}
                className={formData.type === 'income' ? 'bg-green-600 hover:bg-green-700 flex-1' : 'flex-1'}
                onClick={() => setFormData({ ...formData, type: 'income', category: '' })}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Phiếu thu
              </Button>
            </div>

            <div>
              <Label>Ngày / Giờ giao dịch</Label>
              <Input
                type="datetime-local"
                value={formData.transaction_date}
                onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Danh mục *</Label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    setNewCategoryName('');
                    setShowAddCategoryDialog(true);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Thêm
                </Button>
              </div>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn danh mục" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {currentCategories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Mô tả giao dịch *</Label>
              <Input
                placeholder="Ví dụ: Trả lương nhân viên, Tiếp khách..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Payment Sources */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Nguồn tiền & Số tiền *</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addPaymentSource}>
                  <Plus className="h-4 w-4 mr-1" /> Thêm nguồn
                </Button>
              </div>
              {formData.payments.map((payment, index) => (
                <div key={index} className="flex gap-2">
                  <Select
                    value={payment.source}
                    onValueChange={(v) => updatePayment(index, 'source', v)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {allPaymentSources.map((src) => (
                        <SelectItem key={src.id} value={src.id}>{src.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Số tiền"
                    value={payment.amount}
                    onChange={(e) => updatePayment(index, 'amount', e.target.value)}
                    className="flex-1 text-right"
                  />
                  {formData.payments.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removePaymentSource(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {formData.payments.length > 1 && (
                <div className="text-right text-sm font-medium">
                  Tổng: {formatCurrency(totalPaymentAmount)}
                </div>
              )}
            </div>

            <div>
              <Label>Chi nhánh {viewMode === 'total' && '*'}</Label>
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

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <Label className="font-medium">Hạch toán kinh doanh</Label>
                <p className="text-xs text-muted-foreground">
                  {formData.type === 'expense' 
                    ? 'Tính vào Chi phí trong báo cáo lợi nhuận'
                    : 'Tính vào Thu nhập khác trong báo cáo lợi nhuận'}
                </p>
              </div>
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
            <Button 
              onClick={handleSubmit} 
              disabled={createEntry.isPending}
              className={formData.type === 'expense' ? 'bg-destructive hover:bg-destructive/90' : 'bg-green-600 hover:bg-green-700'}
            >
              {createEntry.isPending ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa giao dịch</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <Label>Danh mục *</Label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    setNewCategoryName('');
                    setShowAddCategoryDialog(true);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Thêm
                </Button>
              </div>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn danh mục" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {currentCategories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Mô tả giao dịch *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="flex gap-2">
              <Select
                value={formData.payments[0]?.source || 'cash'}
                onValueChange={(v) => updatePayment(0, 'source', v)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {allPaymentSources.map((src) => (
                    <SelectItem key={src.id} value={src.id}>{src.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Số tiền"
                value={formData.payments[0]?.amount || ''}
                onChange={(e) => updatePayment(0, 'amount', e.target.value)}
                className="flex-1 text-right"
              />
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

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <Label className="font-medium">Hạch toán kinh doanh</Label>
              <Switch
                checked={formData.is_business_accounting}
                onCheckedChange={(v) => setFormData({ ...formData, is_business_accounting: v })}
              />
            </div>

            <div>
              <Label>Ghi chú</Label>
              <Textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Hủy
            </Button>
            <Button onClick={handleUpdate} disabled={updateEntry.isPending}>
              {updateEntry.isPending ? 'Đang lưu...' : 'Cập nhật'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Xóa giao dịch</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa giao dịch này? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{editingEntry?.description}</p>
              <p className="text-sm text-muted-foreground">
                {editingEntry && formatCurrency(Number(editingEntry.amount))} - {editingEntry?.category}
              </p>
            </div>

            <div>
              <Label>Lý do xóa *</Label>
              <Textarea
                placeholder="Nhập lý do xóa giao dịch..."
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Hủy
            </Button>
            <Button 
              variant="destructive" 
              disabled={!deleteReason.trim() || deleteEntry.isPending}
              onClick={handleDelete}
            >
              {deleteEntry.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang xóa...
                </>
              ) : (
                'Xóa'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Balance Dialog */}
      <Dialog open={showAdjustBalanceDialog} onOpenChange={setShowAdjustBalanceDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Điều chỉnh số dư - {paymentSourceLabels[adjustBalanceData.source]}
            </DialogTitle>
            <DialogDescription>
              Điều chỉnh số dư thực tế của nguồn tiền này. Hệ thống sẽ tự động tạo phiếu thu/chi để cân bằng.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Số dư hiện tại (hệ thống):</span>
                <span className={cn("font-bold text-lg", adjustBalanceData.currentBalance >= 0 ? 'text-green-600' : 'text-destructive')}>
                  {formatCurrency(adjustBalanceData.currentBalance)}
                </span>
              </div>
            </div>

            <div>
              <Label>Số dư thực tế *</Label>
              <Input
                type="number"
                placeholder="Nhập số dư thực tế"
                value={adjustBalanceData.newBalance}
                onChange={(e) => setAdjustBalanceData({ ...adjustBalanceData, newBalance: e.target.value })}
              />
              {adjustBalanceData.newBalance && (
                <div className="mt-2 text-sm">
                  {(() => {
                    const newBalance = parseFloat(adjustBalanceData.newBalance) || 0;
                    const diff = newBalance - adjustBalanceData.currentBalance;
                    if (diff === 0) return <span className="text-muted-foreground">Không có thay đổi</span>;
                    return (
                      <span className={diff > 0 ? 'text-green-600' : 'text-destructive'}>
                        {diff > 0 ? 'Tăng' : 'Giảm'} {formatCurrency(Math.abs(diff))}
                        {diff > 0 ? ' → Tạo phiếu thu' : ' → Tạo phiếu chi'}
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>

            <div>
              <Label>Lý do điều chỉnh *</Label>
              <Textarea
                placeholder="Ví dụ: Cân đối tiền mặt cuối ngày, Tiền thừa/thiếu khi kiểm kê..."
                value={adjustBalanceData.reason}
                onChange={(e) => setAdjustBalanceData({ ...adjustBalanceData, reason: e.target.value })}
              />
            </div>

            {/* Branch Selection - Show only in total view */}
            {viewMode === 'total' && (
              <div>
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Chi nhánh ghi nhận *
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Chọn chi nhánh để ghi nhận khoản điều chỉnh này
                </p>
                <Select
                  value={adjustBalanceData.branchId}
                  onValueChange={(v) => setAdjustBalanceData({ ...adjustBalanceData, branchId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn chi nhánh" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name} {branch.is_default && '(Mặc định)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <Label className="font-medium">Tính vào hạch toán kinh doanh</Label>
                <p className="text-xs text-muted-foreground">
                  Nếu bật, khoản điều chỉnh sẽ ảnh hưởng đến báo cáo lợi nhuận
                </p>
              </div>
              <Switch
                checked={adjustBalanceData.includeInAccounting}
                onCheckedChange={(v) => setAdjustBalanceData({ ...adjustBalanceData, includeInAccounting: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustBalanceDialog(false)}>
              Hủy
            </Button>
            <Button 
              onClick={handleAdjustBalance} 
              disabled={createEntry.isPending || !adjustBalanceData.newBalance || !adjustBalanceData.reason.trim()}
            >
              {createEntry.isPending ? 'Đang xử lý...' : 'Xác nhận điều chỉnh'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Payment Source Dialog */}
      <Dialog open={showAddSourceDialog} onOpenChange={setShowAddSourceDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Thêm nguồn tiền mới
            </DialogTitle>
            <DialogDescription>
              Tạo nguồn tiền tùy chỉnh để quản lý các quỹ khác như: Quỹ marketing, Tiền mặt 2, Chuyển khoản...
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Tên nguồn tiền *</Label>
              <Input
                placeholder="Ví dụ: Quỹ marketing, Tiền mặt tại quầy 2..."
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddSourceDialog(false);
              setNewSourceName('');
            }}>
              Hủy
            </Button>
            <Button 
              onClick={() => {
                if (!newSourceName.trim()) {
                  toast({ title: 'Lỗi', description: 'Vui lòng nhập tên nguồn tiền', variant: 'destructive' });
                  return;
                }
                
                // Create unique ID
                const id = newSourceName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now();
                const newSource = { id, name: newSourceName.trim() };
                
                const updated = [...customPaymentSources, newSource];
                setCustomPaymentSources(updated);
                saveCustomPaymentSources(updated);
                
                setShowAddSourceDialog(false);
                setNewSourceName('');
                toast({ title: 'Đã thêm nguồn tiền', description: newSourceName.trim() });
              }}
              disabled={!newSourceName.trim()}
            >
              Thêm nguồn tiền
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Funds Dialog */}
      <TransferFundsDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        paymentSources={allPaymentSources.map(s => ({ id: s.id, name: s.name }))}
        balanceBySource={balanceBySource}
        branches={branches}
        viewMode={viewMode}
        selectedBranchId={selectedBranchId}
      />

      {/* Cash Book Detail Dialog */}
      <CashBookDetailDialog
        entry={selectedEntry}
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        paymentSourceLabels={paymentSourceLabels}
      />

      {/* Opening Balance Dialog */}
      <OpeningBalanceDialog
        open={showOpeningBalanceDialog}
        onOpenChange={setShowOpeningBalanceDialog}
        paymentSources={allPaymentSources.map(s => ({ id: s.id, name: s.name }))}
        hasTransactions={(source) => allEntries?.some(e => e.payment_source === source) || false}
      />

      {/* Add Category Dialog */}
      <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Thêm danh mục {formData.type === 'expense' ? 'chi' : 'thu'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tên danh mục *</Label>
              <Input
                placeholder="Nhập tên danh mục mới"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCategoryDialog(false)}>
              Hủy
            </Button>
            <Button 
              onClick={handleAddCategory} 
              disabled={createCategory.isPending || !newCategoryName.trim()}
            >
              {createCategory.isPending ? 'Đang thêm...' : 'Thêm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
