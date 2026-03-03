import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IntraBranchTransferTab } from './IntraBranchTransferTab';
import { InterBranchTransferTab } from './InterBranchTransferTab';
import { useTranslation } from 'react-i18next';

interface TransferFundsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentSources: { id: string; name: string }[];
  balanceBySource: Record<string, number>;
  branches?: { id: string; name: string; is_default?: boolean | null }[];
  viewMode: 'branch' | 'total';
  selectedBranchId?: string;
}

export function TransferFundsDialog({
  open,
  onOpenChange,
  paymentSources,
  balanceBySource,
  branches,
  viewMode,
  selectedBranchId,
}: TransferFundsDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('intra');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t('common.transferFunds')}</DialogTitle>
          <DialogDescription>
            {t('common.transferDesc')}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="intra">{t('common.intraBranch')}</TabsTrigger>
            <TabsTrigger value="inter">{t('common.interBranch')}</TabsTrigger>
          </TabsList>

          <TabsContent value="intra" className="flex-1 overflow-hidden flex flex-col mt-2">
            <IntraBranchTransferTab
              paymentSources={paymentSources}
              balanceBySource={balanceBySource}
              branches={branches}
              viewMode={viewMode}
              selectedBranchId={selectedBranchId}
              onClose={() => onOpenChange(false)}
            />
          </TabsContent>

          <TabsContent value="inter" className="flex-1 overflow-hidden flex flex-col mt-2">
            <InterBranchTransferTab
              paymentSources={paymentSources}
              branches={branches}
              onClose={() => onOpenChange(false)}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
