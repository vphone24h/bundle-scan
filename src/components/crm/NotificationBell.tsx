 import { useState } from 'react';
 import { Bell, Check, CheckCheck, Clock, AlertTriangle, UserPlus, BarChart3, Settings } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import {
   Popover,
   PopoverContent,
   PopoverTrigger,
 } from '@/components/ui/popover';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Separator } from '@/components/ui/separator';
 import {
   useCRMNotifications,
   useUnreadNotificationCount,
   useMarkNotificationRead,
   useMarkAllNotificationsRead,
   NOTIFICATION_TYPE_LABELS,
   NOTIFICATION_TYPE_COLORS,
   type CRMNotification,
 } from '@/hooks/useCRMNotifications';
 import { formatDistanceToNow } from 'date-fns';
 import { vi } from 'date-fns/locale';
 import { cn } from '@/lib/utils';
 
 const notificationIcons: Record<CRMNotification['notification_type'], React.ReactNode> = {
   care_reminder: <Clock className="h-4 w-4" />,
   overdue_care: <AlertTriangle className="h-4 w-4" />,
   new_customer: <UserPlus className="h-4 w-4" />,
   kpi_update: <BarChart3 className="h-4 w-4" />,
   system: <Settings className="h-4 w-4" />,
 };
 
 export function NotificationBell() {
   const [open, setOpen] = useState(false);
   const { data: notifications = [], isLoading } = useCRMNotifications(20);
   const { data: unreadCount = 0 } = useUnreadNotificationCount();
   const markRead = useMarkNotificationRead();
   const markAllRead = useMarkAllNotificationsRead();
 
   const handleMarkRead = (id: string) => {
     markRead.mutate(id);
   };
 
   const handleMarkAllRead = () => {
     markAllRead.mutate();
   };
 
   return (
     <Popover open={open} onOpenChange={setOpen}>
       <PopoverTrigger asChild>
         <Button variant="ghost" size="icon" className="relative">
           <Bell className="h-5 w-5" />
           {unreadCount > 0 && (
             <Badge 
               variant="destructive" 
               className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
             >
               {unreadCount > 9 ? '9+' : unreadCount}
             </Badge>
           )}
         </Button>
       </PopoverTrigger>
       <PopoverContent className="w-80 p-0" align="end">
         <div className="flex items-center justify-between p-3 border-b">
           <h4 className="font-semibold text-sm">Thông báo</h4>
           {unreadCount > 0 && (
             <Button 
               variant="ghost" 
               size="sm" 
               className="h-7 text-xs"
               onClick={handleMarkAllRead}
               disabled={markAllRead.isPending}
             >
               <CheckCheck className="h-3.5 w-3.5 mr-1" />
               Đánh dấu tất cả
             </Button>
           )}
         </div>
 
         <ScrollArea className="h-[300px]">
           {isLoading ? (
             <div className="p-4 text-center text-muted-foreground text-sm">
               Đang tải...
             </div>
           ) : notifications.length === 0 ? (
             <div className="p-8 text-center text-muted-foreground">
               <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
               <p className="text-sm">Chưa có thông báo</p>
             </div>
           ) : (
             <div className="divide-y">
               {notifications.map((notification) => (
                 <div
                   key={notification.id}
                   className={cn(
                     'p-3 hover:bg-muted/50 cursor-pointer transition-colors',
                     !notification.is_read && 'bg-primary/5'
                   )}
                   onClick={() => !notification.is_read && handleMarkRead(notification.id)}
                 >
                   <div className="flex items-start gap-3">
                     <div className={cn(
                       'mt-0.5 p-1.5 rounded-full',
                       NOTIFICATION_TYPE_COLORS[notification.notification_type]
                     )}>
                       {notificationIcons[notification.notification_type]}
                     </div>
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center justify-between gap-2">
                         <p className={cn(
                           'text-sm truncate',
                           !notification.is_read && 'font-medium'
                         )}>
                           {notification.title}
                         </p>
                         {!notification.is_read && (
                           <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                         )}
                       </div>
                       <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                         {notification.message}
                       </p>
                       <p className="text-[10px] text-muted-foreground mt-1">
                         {formatDistanceToNow(new Date(notification.created_at), { 
                           addSuffix: true,
                           locale: vi,
                         })}
                       </p>
                     </div>
                   </div>
                 </div>
               ))}
             </div>
           )}
         </ScrollArea>
       </PopoverContent>
     </Popover>
   );
 }