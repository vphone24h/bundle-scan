import { useState } from 'react';
import { StockCountList } from './StockCountList';
import { CreateStockCountDialog } from './CreateStockCountDialog';
import { StockCountDetail } from './StockCountDetail';
import { StockCount } from '@/hooks/useStockCounts';

type ViewMode = 'list' | 'detail';

export function StockCountTab() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedStockCountId, setSelectedStockCountId] = useState<string | null>(null);

  const handleCreateNew = () => {
    setShowCreateDialog(true);
  };

  const handleCreated = (id: string) => {
    setSelectedStockCountId(id);
    setViewMode('detail');
  };

  const handleView = (stockCount: StockCount) => {
    setSelectedStockCountId(stockCount.id);
    setViewMode('detail');
  };

  const handleEdit = (stockCount: StockCount) => {
    setSelectedStockCountId(stockCount.id);
    setViewMode('detail');
  };

  const handleBack = () => {
    setViewMode('list');
    setSelectedStockCountId(null);
  };

  return (
    <div>
      {viewMode === 'list' ? (
        <StockCountList
          onCreateNew={handleCreateNew}
          onView={handleView}
          onEdit={handleEdit}
        />
      ) : (
        selectedStockCountId && (
          <StockCountDetail
            stockCountId={selectedStockCountId}
            onBack={handleBack}
          />
        )
      )}

      <CreateStockCountDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={handleCreated}
      />
    </div>
  );
}
