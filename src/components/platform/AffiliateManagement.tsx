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
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="settings" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Cấu hình</span>
        </TabsTrigger>
        <TabsTrigger value="rates" className="flex items-center gap-2">
          <Percent className="h-4 w-4" />
          <span className="hidden sm:inline">Hoa hồng</span>
        </TabsTrigger>
        <TabsTrigger value="affiliates" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Affiliate</span>
        </TabsTrigger>
        <TabsTrigger value="commissions" className="flex items-center gap-2">
          <Coins className="h-4 w-4" />
          <span className="hidden sm:inline">Lịch sử HH</span>
        </TabsTrigger>
        <TabsTrigger value="withdrawals" className="flex items-center gap-2">
          <Banknote className="h-4 w-4" />
          <span className="hidden sm:inline">Rút tiền</span>
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
