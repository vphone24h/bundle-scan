import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { mockDashboardStats, mockProducts, mockImportReceipts, formatCurrency, formatDate } from '@/lib/mockData';
import { Package, TrendingUp, Wallet, Users, FolderTree, FileDown, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

const Index = () => {
  const stats = mockDashboardStats;
  const recentProducts = mockProducts.slice(0, 5);
  const recentReceipts = mockImportReceipts.slice(0, 3);

  return (
    <MainLayout>
      <PageHeader
        title="Tổng quan kho hàng"
        description="Theo dõi tình trạng kho và hoạt động nhập hàng"
      />

      <div className="p-6 lg:p-8 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Tổng sản phẩm"
            value={stats.totalProducts}
            icon={<Package className="h-6 w-6" />}
          />
          <StatCard
            title="Tồn kho"
            value={stats.inStockProducts}
            icon={<TrendingUp className="h-6 w-6" />}
          />
          <StatCard
            title="Tổng giá trị nhập"
            value={formatCurrency(stats.totalImportValue)}
            icon={<Wallet className="h-6 w-6" />}
          />
          <StatCard
            title="Công nợ"
            value={formatCurrency(stats.pendingDebt)}
            icon={<AlertCircle className="h-6 w-6" />}
            className={stats.pendingDebt > 0 ? 'border-warning/50' : ''}
          />
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-card border rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{stats.totalSuppliers}</p>
            <p className="text-sm text-muted-foreground mt-1">Nhà cung cấp</p>
          </div>
          <div className="bg-card border rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{stats.totalCategories}</p>
            <p className="text-sm text-muted-foreground mt-1">Danh mục</p>
          </div>
          <div className="bg-card border rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{stats.soldProducts}</p>
            <p className="text-sm text-muted-foreground mt-1">Đã bán</p>
          </div>
          <div className="bg-card border rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{stats.recentImports}</p>
            <p className="text-sm text-muted-foreground mt-1">Phiếu nhập gần đây</p>
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
              {recentProducts.map((product) => (
                <div key={product.id} className="flex items-center gap-4 p-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.categoryName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">{formatCurrency(product.importPrice)}</p>
                    <Badge
                      variant="outline"
                      className={product.status === 'in_stock' ? 'status-in-stock' : 'status-sold'}
                    >
                      {product.status === 'in_stock' ? 'Tồn kho' : 'Đã bán'}
                    </Badge>
                  </div>
                </div>
              ))}
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
              {recentReceipts.map((receipt) => (
                <div key={receipt.id} className="flex items-center gap-4 p-4">
                  <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <FileDown className="h-5 w-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm font-mono">{receipt.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {receipt.supplierName} • {receipt.items.length} SP
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">{formatCurrency(receipt.totalAmount)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(receipt.importDate)}</p>
                  </div>
                </div>
              ))}
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
