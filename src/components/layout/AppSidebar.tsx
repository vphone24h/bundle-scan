import { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { usePendingTransferCount } from '@/hooks/useStockTransfers';
import { usePendingOrderCount } from '@/hooks/useLandingOrders';
import { useUnreadReviewCount } from '@/hooks/useUnreadReviews';
import { useUnreadSocialNotifCount } from '@/hooks/useSocial';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  FileDown,
  FileUp,
  Users,
  Menu,
  X,
  LogOut,
  User,
  BarChart3,
  Wallet,
  Building2,
  RotateCcw,
  Boxes,
  Shield,
  History,
  Receipt,
  UserCheck,
  Crown,
  CreditCard,
  Share2,
  FileText,
  AppWindow,
  Megaphone,
  Globe,
  Download,
  HeartHandshake,
  Bell,
  Percent,
  Star,
  MessageCircleMore,
} from 'lucide-react';
import vkhoLogo from '@/assets/vkho-logo.png';
import { cn } from '@/lib/utils';
import { prefetchRoute } from '@/lib/routePrefetch';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePermissions, UserRole } from '@/hooks/usePermissions';
import { usePlatformUser, useCurrentTenant } from '@/hooks/useTenant';
import { Badge } from '@/components/ui/badge';
import { NotificationBell } from '@/components/crm/NotificationBell';
import { SystemNotificationBell } from '@/components/notifications/SystemNotificationBell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { title: string; href: string; permission?: string; badgeKey?: string; hideInSecretMode?: boolean }[];
  permission?: string; // Tên permission cần để hiển thị menu này
}

const getRoleName = (role: UserRole | undefined): string => {
  switch (role) {
    case 'super_admin': return 'Admin Tổng';
    case 'branch_admin': return 'Admin CN';
    case 'cashier': return 'Kế Toán';
    case 'staff': return 'Nhân viên';
    default: return 'Nhân viên';
  }
};

// Menu cho Platform Admin
const platformAdminNavItems: NavItem[] = [
  { title: 'Quản trị nền tảng', href: '/platform-admin', icon: Crown },
];

// Menu cho Tenant users
const allNavItems: NavItem[] = [
  { title: 'Tổng quan', href: '/', icon: LayoutDashboard },
  { title: 'Sản phẩm', href: '/products', icon: Package, permission: 'canViewProducts' },
  { title: 'Tồn kho', href: '/inventory', icon: Boxes, permission: 'canViewInventory' },
  { title: 'Danh mục', href: '/categories', icon: FolderTree, permission: 'canManageCategories' },
  {
    title: 'Nhập hàng',
    href: '/import',
    icon: FileDown,
    permission: 'canImportProducts',
    children: [
      { title: 'Tạo phiếu nhập', href: '/import/new', permission: 'canCreateImportReceipt' },
      { title: 'Lịch sử nhập', href: '/import/history' },
      { title: 'Chuyển hàng', href: '/import/transfer', badgeKey: 'pendingTransfer', permission: 'canCreateImportReceipt' },
    ],
  },
  {
    title: 'Xuất hàng / Bán hàng',
    href: '/export',
    icon: FileUp,
    permission: 'canExportProducts',
    children: [
      { title: 'Bán Hàng', href: '/export/new', permission: 'canCreateExportReceipt' },
      { title: 'Lịch sử Bán hàng', href: '/export/history' },
      { title: 'Mẫu in hóa đơn', href: '/export/template', permission: 'canManageInvoiceTemplates' },
      { title: 'Hoá đơn điện tử', href: '/einvoice', permission: 'canManageInvoiceTemplates', hideInSecretMode: true },
       { title: 'Mức Thuế 2026', href: '/export/tax-policy', hideInSecretMode: true },
    ],
  },
  { title: 'Trả hàng', href: '/returns', icon: RotateCcw, permission: 'canImportProducts' },
  { title: 'Nhà cung cấp', href: '/suppliers', icon: Users, permission: 'canManageSuppliers' },
   { title: 'Khách hàng & CRM', href: '/customers', icon: HeartHandshake, permission: 'canViewProducts' },
  { title: 'Công nợ', href: '/debt', icon: Receipt, permission: 'canViewCashBook' },
  { title: 'Báo cáo', href: '/reports', icon: BarChart3, permission: 'canViewReports' },
  { title: 'Sổ quỹ', href: '/cash-book', icon: Wallet, permission: 'canViewCashBook' },
  { title: 'Quản lý chi nhánh', href: '/branches', icon: Building2, permission: 'canManageBranches' },
  { title: 'Quản lý người dùng', href: '/users', icon: Shield, permission: 'canManageBranchStaff' },
  { title: 'Đánh giá nhân viên', href: '/users', icon: Star, permission: 'canViewStaffReviews' },
  { title: 'Lịch sử thao tác', href: '/audit-logs', icon: History, permission: 'canViewAuditLogs' },
  { title: 'Website bán hàng', href: '/landing-settings', icon: Globe, permission: 'canViewProducts' },
  { title: 'Mạng xã hội', href: '/social', icon: MessageCircleMore, permission: 'canManageBranches' },
  { title: 'Ứng dụng', href: '/applications', icon: AppWindow },
  { title: 'Affiliate', href: '/affiliate', icon: Share2, permission: 'canManageBranches' },
  { title: 'Tải ứng dụng', href: '/install-app', icon: Download },
  { title: 'Gói dịch vụ', href: '/subscription', icon: CreditCard, permission: 'canManageBranches' },
  { title: 'Hướng dẫn & Thông tin', href: '/guides', icon: FileText },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { data: profile } = useProfile();
  const { data: permissions, isLoading: permissionsLoading } = usePermissions();
  const { data: platformUser } = usePlatformUser();
  const { data: currentTenant } = useCurrentTenant();
  const [expandedItems, setExpandedItems] = useState<string[]>(['Nhập hàng', 'Xuất hàng / Bán hàng']);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const { data: pendingTransferCount } = usePendingTransferCount();
  const { data: pendingOrderCount } = usePendingOrderCount();
  const { data: unreadReviewCount } = useUnreadReviewCount();
  const { data: unreadSocialCount } = useUnreadSocialNotifCount();

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
    }
  }, []);

  const isPlatformAdmin = platformUser?.platform_role === 'platform_admin';
  const hasTenant = !!platformUser?.tenant_id;
  const isSecretMode = currentTenant?.business_mode === 'secret';

  // Lọc menu theo quyền và loại user
  const navItems = useMemo(() => {
    // Platform Admin không có tenant -> chỉ hiện menu quản trị nền tảng
    if (isPlatformAdmin && !hasTenant) {
      return platformAdminNavItems;
    }

    // Tenant users -> hiện menu kho hàng
    if (!permissions) return allNavItems.filter(item => !item.permission && !(isStandalone && item.href === '/install-app'));
    
    return allNavItems.filter(item => {
      if (isStandalone && item.href === '/install-app') return false;
      if (!item.permission) return true;
      return permissions[item.permission as keyof typeof permissions] === true;
    }).map(item => {
      if (item.children) {
        return {
          ...item,
          children: item.children.filter(child => {
            if (isSecretMode && child.hideInSecretMode) return false;
            if (!child.permission) return true;
            return permissions[child.permission as keyof typeof permissions] === true;
          }),
        };
      }
      return item;
    });
  }, [permissions, isPlatformAdmin, hasTenant, isStandalone, isSecretMode]);

  const toggleExpand = useCallback((title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  }, []);

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate('/auth');
  }, [signOut, navigate]);

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-6 border-b border-sidebar-border">
        <img src={vkhoLogo} alt="vkho.vn" className="h-10 w-10 object-contain rounded-lg" />
        <div className="flex flex-col">
          <span className="text-lg font-bold text-sidebar-foreground">{currentTenant?.name || 'vkho.vn'}</span>
          <span className="text-xs text-sidebar-muted">{currentTenant?.subdomain ? `${currentTenant.subdomain}.vkho.vn` : 'Quản lý thông minh'}</span>
        </div>
        <div className="ml-auto hidden lg:flex items-center gap-0 shrink-0 [&_button]:text-sidebar-foreground [&_button]:hover:bg-sidebar-accent [&_button]:opacity-100 [&_button]:h-8 [&_button]:w-8 [&_.h-5]:h-4 [&_.w-5]:w-4">
          <SystemNotificationBell />
          <NotificationBell />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <div key={item.title}>
            {item.children ? (
              <>
                <button
                  onClick={() => toggleExpand(item.title)}
                  data-tour={`sidebar-${item.href.replace(/\//g, '').replace(/-/g, '')}`}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="flex-1 text-left">{item.title}</span>
                  <svg
                    className={cn('h-4 w-4 transition-transform', expandedItems.includes(item.title) && 'rotate-180')}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedItems.includes(item.title) && (
                  <div className="ml-4 mt-1 space-y-1 animate-fade-in">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        to={child.href}
                          onMouseEnter={() => prefetchRoute(child.href)}
                          onTouchStart={() => prefetchRoute(child.href)}
                        onClick={() => setIsMobileOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                          location.pathname === child.href
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                            : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                        )}
                      >
                        <span className="w-5 h-5 flex items-center justify-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        </span>
                        <span className="flex-1">{child.title}</span>
                        {child.badgeKey === 'pendingTransfer' && (pendingTransferCount || 0) > 0 && (
                          <span className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                            +{pendingTransferCount}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <Link
                to={item.href}
                  onMouseEnter={() => prefetchRoute(item.href)}
                  onTouchStart={() => prefetchRoute(item.href)}
                onClick={() => setIsMobileOpen(false)}
                data-tour={`sidebar-${item.href.replace(/\//g, '').replace(/-/g, '') || 'home'}`}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="flex-1">{item.title}</span>
                {item.href === '/landing-settings' && (pendingOrderCount || 0) > 0 && (
                  <span className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                    {pendingOrderCount}
                  </span>
                )}
                {item.title === 'Đánh giá nhân viên' && (unreadReviewCount || 0) > 0 && (
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
                )}
                {item.href === '/social' && (unreadSocialCount || 0) > 0 && (
                  <span className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                    {unreadSocialCount}
                  </span>
                )}
              </Link>
            )}
          </div>
        ))}
      </nav>

      {/* Footer - User info */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors">
              <div className="h-9 w-9 rounded-full bg-sidebar-accent flex items-center justify-center">
                <User className="h-4 w-4 text-sidebar-foreground" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {profile?.display_name || user?.email?.split('@')[0]}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-sidebar-muted text-sidebar-muted">
                    {getRoleName(permissions?.role)}
                  </Badge>
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-popover">
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar - menu button */}
      <div
        className="fixed z-50 lg:hidden flex items-center gap-1"
        style={{
          top: 'max(0.75rem, calc(env(safe-area-inset-top) + 0.5rem))',
          left: 'max(1rem, calc(env(safe-area-inset-left) + 0.5rem))',
        }}
      >
        <Button
          variant="outline"
          size="icon"
          data-tour="mobile-menu-btn"
          className="h-12 w-12 bg-card shadow-lg border-2 touch-target"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
        >
          {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
        {!isMobileOpen && (
          <div className="bg-card shadow-lg border-2 rounded-md flex items-center">
            <SystemNotificationBell />
          </div>
        )}
      </div>

      {/* Mobile notification bell - float outside sidebar when open */}
      {isMobileOpen && (
        <div
          className="fixed z-50 lg:hidden flex items-center gap-1 animate-fade-in"
          style={{
            top: 'max(0.75rem, calc(env(safe-area-inset-top) + 0.5rem))',
            left: '17rem',
          }}
        >
          <div className="bg-card shadow-lg border-2 rounded-md flex items-center">
            <SystemNotificationBell />
          </div>
        </div>
      )}

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar - Mobile */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-sidebar transform transition-transform duration-300 lg:hidden flex flex-col',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <NavContent />
      </aside>

      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-sidebar border-r border-sidebar-border">
        <NavContent />
      </aside>
    </>
  );
}
