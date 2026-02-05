 import { useState } from 'react';
 import { MainLayout } from '@/components/layout/MainLayout';
 import { PageHeader } from '@/components/layout/PageHeader';
 import { Card, CardContent } from '@/components/ui/card';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { Users, Calendar, History, BarChart3, FileText, ShoppingCart, Wallet } from 'lucide-react';
 import { CustomerListTab } from '@/components/customers/CustomerListTab';
 import { CareScheduleTab } from '@/components/customers/CareScheduleTab';
 import { CareTimelineTab } from '@/components/customers/CareTimelineTab';
 import { CRMDashboardTab } from '@/components/customers/CRMDashboardTab';
 import { CRMReportsTab } from '@/components/customers/CRMReportsTab';
 import { useCustomerDetail } from '@/hooks/useCustomerPoints';
 import { useCustomersWithPoints, MEMBERSHIP_TIER_NAMES, MEMBERSHIP_TIER_COLORS } from '@/hooks/useCustomerPoints';
 import { formatNumber } from '@/lib/formatNumber';
 import { Badge } from '@/components/ui/badge';
 import { useSearchParams } from 'react-router-dom';
 
 export default function CustomersPage() {
   const [searchParams, setSearchParams] = useSearchParams();
   const tabFromUrl = searchParams.get('tab') || 'list';
   const customerIdFromUrl = searchParams.get('customerId');
   
   const [activeTab, setActiveTab] = useState(tabFromUrl);
   const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(customerIdFromUrl);
   
   const { data: selectedCustomer } = useCustomerDetail(selectedCustomerId);
   const { data: customers } = useCustomersWithPoints();
 
   const handleTabChange = (value: string) => {
     setActiveTab(value);
     const newParams = new URLSearchParams(searchParams);
     newParams.set('tab', value);
     setSearchParams(newParams);
   };
 
   const handleViewCare = (customerId: string) => {
     setSelectedCustomerId(customerId);
     setActiveTab('care');
     const newParams = new URLSearchParams(searchParams);
     newParams.set('tab', 'care');
     newParams.set('customerId', customerId);
     setSearchParams(newParams);
   };
 
   const handleViewTimeline = (customerId: string) => {
     setSelectedCustomerId(customerId);
     setActiveTab('timeline');
     const newParams = new URLSearchParams(searchParams);
     newParams.set('tab', 'timeline');
     newParams.set('customerId', customerId);
     setSearchParams(newParams);
   };
 
   // Summary stats
   const totalCustomers = customers?.length || 0;
   const customersWithPoints = customers?.filter(c => c.current_points > 0).length || 0;
   const vipCustomers = customers?.filter(c => c.membership_tier === 'vip').length || 0;
   const customersWithPurchase = customers?.filter(c => c.total_spent > 0).length || 0;
 
   return (
     <MainLayout>
       <PageHeader title="Khách hàng & CRM" />
 
       {/* Summary Cards */}
       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
         <Card>
           <CardContent className="pt-4">
             <div className="flex items-center gap-3">
               <div className="p-2 bg-primary/10 rounded-lg">
                 <Users className="h-5 w-5 text-primary" />
               </div>
               <div>
                 <p className="text-2xl font-bold">{totalCustomers}</p>
                 <p className="text-xs text-muted-foreground">Tổng khách hàng</p>
               </div>
             </div>
           </CardContent>
         </Card>
         <Card>
           <CardContent className="pt-4">
             <div className="flex items-center gap-3">
               <div className="p-2 bg-amber-500/10 rounded-lg">
                 <Wallet className="h-5 w-5 text-amber-600" />
               </div>
               <div>
                 <p className="text-2xl font-bold">{customersWithPoints}</p>
                 <p className="text-xs text-muted-foreground">Khách có điểm</p>
               </div>
             </div>
           </CardContent>
         </Card>
         <Card>
           <CardContent className="pt-4">
             <div className="flex items-center gap-3">
               <div className="p-2 bg-purple-500/10 rounded-lg">
                 <Users className="h-5 w-5 text-purple-600" />
               </div>
               <div>
                 <p className="text-2xl font-bold">{vipCustomers}</p>
                 <p className="text-xs text-muted-foreground">Khách VIP</p>
               </div>
             </div>
           </CardContent>
         </Card>
         <Card>
           <CardContent className="pt-4">
             <div className="flex items-center gap-3">
               <div className="p-2 bg-emerald-500/10 rounded-lg">
                 <ShoppingCart className="h-5 w-5 text-emerald-600" />
               </div>
               <div>
                 <p className="text-2xl font-bold">{customersWithPurchase}</p>
                 <p className="text-xs text-muted-foreground">Đã mua hàng</p>
               </div>
             </div>
           </CardContent>
         </Card>
       </div>
 
       {/* Tabs */}
       <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
         <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
           <TabsTrigger value="list" className="gap-2">
             <Users className="h-4 w-4 hidden sm:block" />
             <span>Danh sách</span>
           </TabsTrigger>
           <TabsTrigger value="care" className="gap-2">
             <Calendar className="h-4 w-4 hidden sm:block" />
             <span>Chăm sóc</span>
           </TabsTrigger>
           <TabsTrigger value="timeline" className="gap-2">
             <History className="h-4 w-4 hidden sm:block" />
             <span>Nhật ký</span>
           </TabsTrigger>
           <TabsTrigger value="dashboard" className="gap-2">
             <BarChart3 className="h-4 w-4 hidden sm:block" />
             <span>Hiệu suất</span>
           </TabsTrigger>
           <TabsTrigger value="reports" className="gap-2">
             <FileText className="h-4 w-4 hidden sm:block" />
             <span>Báo cáo</span>
           </TabsTrigger>
         </TabsList>
 
         <TabsContent value="list">
           <CustomerListTab 
             onViewCare={handleViewCare} 
             onViewTimeline={handleViewTimeline} 
           />
         </TabsContent>
 
         <TabsContent value="care">
           <CareScheduleTab 
             customerId={selectedCustomerId} 
             customerName={selectedCustomer?.name}
           />
         </TabsContent>
 
         <TabsContent value="timeline">
           <CareTimelineTab 
             customerId={selectedCustomerId}
             customerName={selectedCustomer?.name}
             customerPhone={selectedCustomer?.phone}
             customerEmail={selectedCustomer?.email}
           />
         </TabsContent>
 
         <TabsContent value="dashboard">
           <CRMDashboardTab />
         </TabsContent>
 
         <TabsContent value="reports">
           <CRMReportsTab />
         </TabsContent>
       </Tabs>
     </MainLayout>
   );
 }