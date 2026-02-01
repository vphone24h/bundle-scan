import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useProducts } from '@/hooks/useProducts';
import { useImportReceipts } from '@/hooks/useImportReceipts';
import { useUserGuideUrl } from '@/hooks/useAppConfig';
import { formatCurrency, formatDate } from '@/lib/mockData';
import { Package, TrendingUp, Wallet, AlertCircle, FileDown, Loader2, BookOpen, FolderTree, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

const Index = () => {
  const { data: stats, isLoading: statsLoading, isFetching: statsFetching } = useDashboardStats();
  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: receipts, isLoading: receiptsLoading } = useImportReceipts();
  const userGuideUrl = useUserGuideUrl();

  const recentProducts = products?.slice(0, 5) || [];
  const recentReceipts = receipts?.slice(0, 3) || [];

  // Only show full-screen loader on first load (no cached data yet)
  if (statsLoading && !stats) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        title="Tổng quan kho hàng"
        description="Theo dõi tình trạng kho và hoạt động nhập hàng"
        actions={
          <div className="flex items-center gap-2">
            {statsFetching && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Đang cập nhật…
              </div>
            )}
            {userGuideUrl && (
              <Button variant="secondary" size="sm" asChild>
                <a href={userGuideUrl} target="_blank" rel="noopener noreferrer">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Hướng dẫn sử dụng
                </a>
              </Button>
            )}
          </div>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            title="Tổng sản phẩm"
            value={stats?.totalProducts || 0}
            icon={<Package className="h-5 w-5 sm:h-6 sm:w-6" />}
          />
          <StatCard
            title="Tồn kho"
            value={stats?.inStockProducts || 0}
            icon={<TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />}
          />
          <StatCard
            title="Tổng giá trị nhập"
            value={formatCurrency(stats?.totalImportValue || 0)}
            icon={<Wallet className="h-5 w-5 sm:h-6 sm:w-6" />}
          />
          <StatCard
            title="Công nợ"
            value={formatCurrency(stats?.pendingDebt || 0)}
            icon={<AlertCircle className="h-5 w-5 sm:h-6 sm:w-6" />}
            className={(stats?.pendingDebt || 0) > 0 ? 'border-warning/50' : ''}
          />
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-card border rounded-lg p-3 sm:p-4 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(stats?.todayProfit || 0)}</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">Lợi nhuận hôm nay</p>
          </div>
          <div className="bg-card border rounded-lg p-3 sm:p-4 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-primary">{formatCurrency(stats?.todayRevenue || 0)}</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">Doanh thu hôm nay</p>
          </div>
          <div className="bg-card border rounded-lg p-3 sm:p-4 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-foreground">{stats?.todaySold || 0}</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">Đã bán hôm nay</p>
          </div>
          <div className="bg-card border rounded-lg p-3 sm:p-4 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-foreground">{stats?.todayImports || 0}</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">Nhập hôm nay</p>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Recent Products */}
          <div className="bg-card border rounded-xl">
            <div className="flex items-center justify-between p-3 sm:p-4 border-b">
              <h3 className="text-sm sm:text-base font-semibold">Sản phẩm mới nhập</h3>
              <Button variant="ghost" size="sm" asChild className="h-8 text-xs sm:text-sm">
                <Link to="/products">Xem tất cả</Link>
              </Button>
            </div>
            <div className="divide-y">
              {recentProducts.length === 0 ? (
                <div className="p-6 sm:p-8 text-center text-muted-foreground text-sm">
                  Chưa có sản phẩm nào
                </div>
              ) : (
                recentProducts.map((product) => (
                  <div key={product.id} className="flex items-center gap-3 p-3 sm:p-4">
                    <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs sm:text-sm truncate">{product.name}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{product.categories?.name || 'Không có danh mục'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-medium text-xs sm:text-sm">{formatCurrency(Number(product.import_price))}</p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] sm:text-xs ${product.status === 'in_stock' ? 'status-in-stock' : 'status-sold'}`}
                      >
                        {product.status === 'in_stock' ? 'Tồn kho' : 'Đã bán'}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Imports */}
          <div className="bg-card border rounded-xl">
            <div className="flex items-center justify-between p-3 sm:p-4 border-b">
              <h3 className="text-sm sm:text-base font-semibold">Phiếu nhập gần đây</h3>
              <Button variant="ghost" size="sm" asChild className="h-8 text-xs sm:text-sm">
                <Link to="/import/history">Xem tất cả</Link>
              </Button>
            </div>
            <div className="divide-y">
              {recentReceipts.length === 0 ? (
                <div className="p-6 sm:p-8 text-center text-muted-foreground text-sm">
                  Chưa có phiếu nhập nào
                </div>
              ) : (
                recentReceipts.map((receipt) => (
                  <div key={receipt.id} className="flex items-center gap-3 p-3 sm:p-4">
                    <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <FileDown className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs sm:text-sm font-mono">{receipt.code}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                        {receipt.suppliers?.name || 'Không rõ NCC'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-medium text-xs sm:text-sm">{formatCurrency(Number(receipt.total_amount))}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{formatDate(new Date(receipt.import_date))}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Button asChild size="sm" className="flex-1 sm:flex-none">
            <Link to="/import/new">
              <FileDown className="mr-1.5 sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Tạo phiếu nhập mới</span>
              <span className="sm:hidden">Phiếu nhập</span>
            </Link>
          </Button>
          <Button variant="outline" asChild size="sm" className="flex-1 sm:flex-none">
            <Link to="/products">
              <Package className="mr-1.5 sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Quản lý sản phẩm</span>
              <span className="sm:hidden">Sản phẩm</span>
            </Link>
          </Button>
          <Button variant="outline" asChild size="sm" className="flex-1 sm:flex-none">
            <Link to="/categories">
              <FolderTree className="mr-1.5 sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Quản lý danh mục</span>
              <span className="sm:hidden">Danh mục</span>
            </Link>
          </Button>
          <Button variant="outline" asChild size="sm" className="flex-1 sm:flex-none">
            <Link to="/suppliers">
              <Users className="mr-1.5 sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Nhà cung cấp</span>
              <span className="sm:hidden">NCC</span>
            </Link>
          </Button>
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;
