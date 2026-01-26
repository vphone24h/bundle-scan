import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Percent, Users, Coins, Banknote } from 'lucide-react';
import { AffiliateSettingsManagement } from './AffiliateSettingsManagement';
import { AffiliateCommissionRatesManagement } from './AffiliateCommissionRatesManagement';
import { AffiliatesManagement } from './AffiliatesManagement';
import { AffiliateCommissionsManagement } from './AffiliateCommissionsManagement';
import { AffiliateWithdrawalsManagement } from './AffiliateWithdrawalsManagement';

export function AffiliateManagement() {
  return (
    <Tabs defaultValue="settings" className="space-y-6">
      <TabsList className="flex flex-wrap h-auto gap-1 p-1 w-full">
        <TabsTrigger value="settings" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
          <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden xs:inline">Cấu hình</span>
        </TabsTrigger>
        <TabsTrigger value="rates" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
          <Percent className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden xs:inline">Hoa hồng</span>
        </TabsTrigger>
        <TabsTrigger value="affiliates" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
          <Users className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden xs:inline">Affiliate</span>
        </TabsTrigger>
        <TabsTrigger value="commissions" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
          <Coins className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden xs:inline">LS HH</span>
        </TabsTrigger>
        <TabsTrigger value="withdrawals" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3">
          <Banknote className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden xs:inline">Rút tiền</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="settings">
        <AffiliateSettingsManagement />
      </TabsContent>

      <TabsContent value="rates">
        <AffiliateCommissionRatesManagement />
      </TabsContent>

      <TabsContent value="affiliates">
        <AffiliatesManagement />
      </TabsContent>

      <TabsContent value="commissions">
        <AffiliateCommissionsManagement />
      </TabsContent>

      <TabsContent value="withdrawals">
        <AffiliateWithdrawalsManagement />
      </TabsContent>
    </Tabs>
  );
}
