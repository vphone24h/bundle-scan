import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Check, ChevronDown, ChevronUp, Rocket, X, Package, Users, ShoppingCart, FileDown, FolderTree, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface ChecklistStep {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  link: string;
  linkLabel: string;
  highlight?: boolean;
}

const STEPS: ChecklistStep[] = [
  {
    key: 'category',
    label: 'Tạo danh mục sản phẩm',
    description: 'Phân loại sản phẩm để dễ quản lý (VD: iPhone, Samsung, Phụ kiện...)',
    icon: <FolderTree className="h-4 w-4" />,
    link: '/categories',
    linkLabel: 'Tạo danh mục',
  },
  {
    key: 'import',
    label: 'Tạo phiếu nhập hàng đầu tiên',
    description: 'Nhập hàng vào kho để bắt đầu quản lý tồn kho',
    icon: <FileDown className="h-4 w-4" />,
    link: '/import/new',
    linkLabel: '📦 Nhập hàng',
    highlight: true,
  },
  {
    key: 'export',
    label: 'Tạo phiếu xuất (bán hàng)',
    description: 'Bán hàng cho khách và in phiếu xuất kho',
    icon: <ShoppingCart className="h-4 w-4" />,
    link: '/export/new',
    linkLabel: '🛒 Bán hàng',
    highlight: true,
  },
  {
    key: 'customer',
    label: 'Thêm khách hàng',
    description: 'Lưu thông tin khách hàng để theo dõi lịch sử mua hàng',
    icon: <Users className="h-4 w-4" />,
    link: '/customers',
    linkLabel: 'Thêm KH',
  },
  {
    key: 'product',
    label: 'Kiểm tra sản phẩm trong kho',
    description: 'Xem danh sách sản phẩm đã nhập, chỉnh sửa giá bán',
    icon: <Package className="h-4 w-4" />,
    link: '/products',
    linkLabel: 'Xem kho',
  },
  {
    key: 'supplier',
    label: 'Thêm nhà cung cấp',
    description: 'Thêm thông tin nhà cung cấp để theo dõi nguồn hàng và công nợ',
    icon: <Users className="h-4 w-4" />,
    link: '/suppliers',
    linkLabel: 'Thêm NCC',
  },
  {
    key: 'landing',
    label: 'Thiết lập website bán hàng',
    description: 'Tạo trang web riêng cho cửa hàng, tra cứu bảo hành miễn phí',
    icon: <Globe className="h-4 w-4" />,
    link: '/landing-settings',
    linkLabel: 'Thiết lập',
  },
];

const DISMISSED_KEY = 'vkho_checklist_dismissed';

function useChecklistStatus() {
  return useQuery({
    queryKey: ['getting-started-checklist'],
    queryFn: async () => {
      // Single RPC call instead of 7 separate requests
      const { data, error } = await supabase.rpc('check_getting_started_status');
      if (error) throw error;
      return (data || {}) as Record<string, boolean>;
    },
    staleTime: 10 * 60 * 1000, // cache 10 min
    refetchOnWindowFocus: false,
  });
}

export function GettingStartedChecklist() {
  const { data: status } = useChecklistStatus();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem(DISMISSED_KEY) === 'true';
  });

  const completedCount = status ? STEPS.filter(s => status[s.key]).length : 0;
  const totalSteps = STEPS.length;
  const progress = Math.round((completedCount / totalSteps) * 100);
  const allDone = completedCount === totalSteps;

  // Auto-dismiss when all done, auto-show when not all done
  if (!status) return null;
  if (allDone) {
    if (!isDismissed) {
      localStorage.setItem(DISMISSED_KEY, 'true');
      setIsDismissed(true);
    }
    return null;
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setIsDismissed(true);
  };

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 p-3 sm:p-4 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Rocket className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm sm:text-base">
              {allDone ? '🎉 Hoàn thành thiết lập!' : 'Bắt đầu sử dụng'}
            </h3>
            <span className="text-xs text-muted-foreground">{completedCount}/{totalSteps}</span>
          </div>
          <Progress value={progress} className="h-1.5 mt-1.5" />
        </div>
        <div className="flex items-center gap-1">
          {(allDone || completedCount >= 3) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
              title="Ẩn checklist"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Steps */}
      {isExpanded && (
        <div className="border-t divide-y">
          {STEPS.map((step) => {
            const done = status[step.key];
            return (
              <div
                key={step.key}
                className={cn(
                  'flex items-start gap-3 p-3 sm:p-4 transition-colors',
                  done && 'bg-muted/30'
                )}
              >
                <div className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 border-2 transition-colors',
                  done
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-muted-foreground/30 text-muted-foreground'
                )}>
                  {done ? <Check className="h-3.5 w-3.5" /> : step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm font-medium',
                    done && 'line-through text-muted-foreground'
                  )}>
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                </div>
                {!done && step.highlight ? (
                  <Button asChild className="shrink-0 h-9 px-4 text-sm font-bold bg-green-600 hover:bg-green-700 text-white shadow-md">
                    <Link to={step.link}>{step.linkLabel}</Link>
                  </Button>
                ) : !done ? (
                  <Button variant="outline" size="sm" asChild className="shrink-0 h-7 text-xs">
                    <Link to={step.link}>{step.linkLabel}</Link>
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
