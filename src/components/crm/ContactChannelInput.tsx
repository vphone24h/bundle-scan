 import { useState } from 'react';
 import { Checkbox } from '@/components/ui/checkbox';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { MessageCircle } from 'lucide-react';
 
 export interface ChannelData {
   zalo?: string;
   facebook?: string;
   tiktok?: string;
 }
 
 interface ContactChannelInputProps {
   channels: ChannelData;
   onChannelsChange: (channels: ChannelData) => void;
 }
 
 const CHANNEL_CONFIG = [
   { key: 'zalo' as const, label: 'Zalo', placeholder: 'Link hoặc SĐT Zalo' },
   { key: 'facebook' as const, label: 'Facebook', placeholder: 'Link Facebook' },
   { key: 'tiktok' as const, label: 'TikTok', placeholder: 'Link TikTok' },
 ];
 
 export function ContactChannelInput({ channels, onChannelsChange }: ContactChannelInputProps) {
   const [enabledChannels, setEnabledChannels] = useState<Set<string>>(() => {
     const enabled = new Set<string>();
     if (channels.zalo) enabled.add('zalo');
     if (channels.facebook) enabled.add('facebook');
     if (channels.tiktok) enabled.add('tiktok');
     return enabled;
   });
 
   const handleToggleChannel = (key: string, checked: boolean) => {
     const newEnabled = new Set(enabledChannels);
     if (checked) {
       newEnabled.add(key);
     } else {
       newEnabled.delete(key);
       // Clear the value when unchecking
       onChannelsChange({ ...channels, [key]: undefined });
     }
     setEnabledChannels(newEnabled);
   };
 
   const handleValueChange = (key: keyof ChannelData, value: string) => {
     onChannelsChange({ ...channels, [key]: value || undefined });
   };
 
   return (
     <div className="space-y-2">
       <label className="text-sm font-medium flex items-center gap-2">
         <MessageCircle className="h-4 w-4" />
         Kênh liên hệ
       </label>
       
       <div className="space-y-3 pl-1">
         {CHANNEL_CONFIG.map(({ key, label, placeholder }) => (
           <div key={key} className="space-y-1.5">
             <div className="flex items-center space-x-2">
               <Checkbox
                 id={`channel-${key}`}
                 checked={enabledChannels.has(key)}
                 onCheckedChange={(checked) => handleToggleChannel(key, !!checked)}
               />
               <Label htmlFor={`channel-${key}`} className="text-sm font-normal cursor-pointer">
                 {label}
               </Label>
             </div>
             {enabledChannels.has(key) && (
               <Input
                 placeholder={placeholder}
                 value={channels[key] || ''}
                 onChange={(e) => handleValueChange(key, e.target.value)}
                 className="h-9"
               />
             )}
           </div>
         ))}
       </div>
     </div>
   );
 }