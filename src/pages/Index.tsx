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
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: receipts, isLoading: receiptsLoading } = useImportReceipts();
  const userGuideUrl = useUserGuideUrl();

  const recentProducts = products?.slice(0, 5) || [];
  const recentReceipts = receipts?.slice(0, 3) || [];

  if (statsLoading) {
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
          userGuideUrl && (
            <Button variant="secondary" size="sm" asChild>
              <a href={userGuideUrl} target="_blank" rel="noopener noreferrer">
                <BookOpen className="mr-2 h-4 w-4" />
                Hướng dẫn sử dụng
              </a>
            </Button>
          )
        }
      />

      <div className="p-6 lg:p-8 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Tổng sản phẩm"
            value={stats?.totalProducts || 0}
            icon={<Package className="h-6 w-6" />}
          />
          <StatCard
            title="Tồn kho"
            value={stats?.inStockProducts || 0}
            icon={<TrendingUp className="h-6 w-6" />}
          />
          <StatCard
            title="Tổng giá trị nhập"
            value={formatCurrency(stats?.totalImportValue || 0)}
            icon={<Wallet className="h-6 w-6" />}
          />
          <StatCard
            title="Công nợ"
            value={formatCurrency(stats?.pendingDebt || 0)}
            icon={<AlertCircle className="h-6 w-6" />}
            className={(stats?.pendingDebt || 0) > 0 ? 'border-warning/50' : ''}
          />
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-card border rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{stats?.totalSuppliers || 0}</p>
            <p className="text-sm text-muted-foreground mt-1">Nhà cung cấp</p>
          </div>
          <div className="bg-card border rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{stats?.totalCategories || 0}</p>
            <p className="text-sm text-muted-foreground mt-1">Danh mục</p>
          </div>
          <div className="bg-card border rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{stats?.soldProducts || 0}</p>
            <p className="text-sm text-muted-foreground mt-1">Đã bán</p>
          </div>
          <div className="bg-card border rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{stats?.recentImports || 0}</p>
            <p className="text-sm text-muted-foreground mt-1">Nhập 7 ngày qua</p>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Products */}
          <div className="bg-card border rounded-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Sản phẩm mới nhập</h3>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/products">Xem tất cả</Link>
              </Button>
            </div>
            <div className="divide-y">
              {recentProducts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Chưa có sản phẩm nào
                </div>
              ) : (
                recentProducts.map((product) => (
                  <div key={product.id} className="flex items-center gap-4 p-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.categories?.name || 'Không có danh mục'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">{formatCurrency(Number(product.import_price))}</p>
                      <Badge
                        variant="outline"
                        className={product.status === 'in_stock' ? 'status-in-stock' : 'status-sold'}
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
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Phiếu nhập gần đây</h3>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/import/history">Xem tất cả</Link>
              </Button>
            </div>
            <div className="divide-y">
              {recentReceipts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Chưa có phiếu nhập nào
                </div>
              ) : (
                recentReceipts.map((receipt) => (
                  <div key={receipt.id} className="flex items-center gap-4 p-4">
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <FileDown className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm font-mono">{receipt.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {receipt.suppliers?.name || 'Không rõ NCC'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">{formatCurrency(Number(receipt.total_amount))}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(new Date(receipt.import_date))}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/import/new">
              <FileDown className="mr-2 h-4 w-4" />
              Tạo phiếu nhập mới
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/products">
              <Package className="mr-2 h-4 w-4" />
              Quản lý sản phẩm
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/categories">
              <FolderTree className="mr-2 h-4 w-4" />
              Quản lý danh mục
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/suppliers">
              <Users className="mr-2 h-4 w-4" />
              Nhà cung cấp
            </Link>
          </Button>
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;
