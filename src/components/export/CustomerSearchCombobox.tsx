import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Phone, User, Search, Check, Crown, Award, Medal, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatNumber } from '@/lib/formatNumber';

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  email: string | null;
  source: string | null;
  current_points: number;
  pending_points: number;
  total_spent: number;
  membership_tier: 'regular' | 'silver' | 'gold' | 'vip';
  status: 'active' | 'inactive';
  birthday: string | null;
}

interface CustomerSearchComboboxProps {
  selectedCustomer: Customer | null;
  onSelect: (customer: Customer | null) => void;
  onCustomerInfoChange: (info: { name: string; phone: string; address: string; email: string }) => void;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerEmail: string;
  customerSource?: string;
  setCustomerName: (v: string) => void;
  setCustomerPhone: (v: string) => void;
  setCustomerAddress: (v: string) => void;
  setCustomerEmail: (v: string) => void;
  setCustomerSource?: (v: string) => void;
}

const TIER_CONFIG = {
  regular: { icon: Star, label: 'Thường', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  silver: { icon: Medal, label: 'Bạc', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  gold: { icon: Award, label: 'Vàng', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  vip: { icon: Crown, label: 'VIP', color: 'bg-purple-100 text-purple-700 border-purple-300' },
};

export function CustomerSearchCombobox({
  selectedCustomer,
  onSelect,
  customerName,
  customerPhone,
  customerAddress,
  customerEmail,
  customerSource,
  setCustomerName,
  setCustomerPhone,
  setCustomerAddress,
  setCustomerEmail,
  setCustomerSource,
}: CustomerSearchComboboxProps) {
  const [phoneSuggestions, setPhoneSuggestions] = useState<Customer[]>([]);
  const [nameSuggestions, setNameSuggestions] = useState<Customer[]>([]);
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);
  const [isSearchingName, setIsSearchingName] = useState(false);
  
  const phoneRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (phoneRef.current && !phoneRef.current.contains(e.target as Node)) {
        setShowPhoneDropdown(false);
      }
      if (nameRef.current && !nameRef.current.contains(e.target as Node)) {
        setShowNameDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search by phone (≥3 chars) - auto-select if exact match
  useEffect(() => {
    if (customerPhone.length >= 3 && !selectedCustomer) {
      setIsSearchingPhone(true);
      const timer = setTimeout(async () => {
        const { data } = await supabase
          .from('customers')
          .select('*')
          .ilike('phone', `%${customerPhone}%`)
          .limit(5);
        
        const customers = (data as Customer[]) || [];
        
        // Auto-select if exact phone match found
        const exactMatch = customers.find(c => c.phone === customerPhone);
        if (exactMatch) {
          // Auto-fill all customer info from existing record
          setCustomerName(exactMatch.name);
          setCustomerAddress(exactMatch.address || '');
          setCustomerEmail(exactMatch.email || '');
          setCustomerSource?.(exactMatch.source || '');
          onSelect(exactMatch);
          setShowPhoneDropdown(false);
          setIsSearchingPhone(false);
          return;
        }
        
        setPhoneSuggestions(customers);
        setShowPhoneDropdown(true);
        setIsSearchingPhone(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setPhoneSuggestions([]);
      setShowPhoneDropdown(false);
    }
  }, [customerPhone, selectedCustomer]);

  // Search by name (≥3 chars)
  useEffect(() => {
    if (customerName.length >= 3 && !selectedCustomer) {
      setIsSearchingName(true);
      const timer = setTimeout(async () => {
        const { data } = await supabase
          .from('customers')
          .select('*')
          .ilike('name', `%${customerName}%`)
          .limit(5);
        setNameSuggestions((data as Customer[]) || []);
        setShowNameDropdown(true);
        setIsSearchingName(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setNameSuggestions([]);
      setShowNameDropdown(false);
    }
  }, [customerName, selectedCustomer]);

  const handleSelectCustomer = (customer: Customer) => {
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setCustomerAddress(customer.address || '');
    setCustomerEmail(customer.email || '');
    setCustomerSource?.(customer.source || '');
    onSelect(customer);
    setShowPhoneDropdown(false);
    setShowNameDropdown(false);
  };

  const handleClearCustomer = () => {
    onSelect(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setCustomerEmail('');
    setCustomerSource?.('');
  };

  const isNewCustomer = !selectedCustomer && (customerPhone.length >= 3 || customerName.length >= 1);
  const TierIcon = selectedCustomer ? TIER_CONFIG[selectedCustomer.membership_tier].icon : null;

  return (
    <div className="space-y-4">
      {/* Phone Input */}
      <div className="relative" ref={phoneRef}>
        <Label className="flex items-center gap-1">
          <Phone className="h-3 w-3" />
          Số điện thoại <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Input
            placeholder="Nhập số điện thoại"
            value={customerPhone}
            onChange={(e) => {
              setCustomerPhone(e.target.value);
              if (selectedCustomer) onSelect(null);
            }}
            className={cn(
              selectedCustomer && 'border-primary ring-1 ring-primary'
            )}
          />
          {isSearchingPhone && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Nếu là khách cũ, nhập SĐT sẽ tự hiện thông tin. Nếu là khách mới, vui lòng nhập đầy đủ thông tin.
        </p>
        
        {/* Phone Suggestions Dropdown */}
        {showPhoneDropdown && phoneSuggestions.length > 0 && (
          <div className="absolute z-20 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-60 overflow-auto">
            {phoneSuggestions.map((customer) => {
              const config = TIER_CONFIG[customer.membership_tier];
              const Icon = config.icon;
              return (
                <button
                  key={customer.id}
                  className="w-full px-4 py-3 text-left hover:bg-accent flex items-center justify-between gap-2 border-b last:border-b-0"
                  onClick={() => handleSelectCustomer(customer)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{customer.name}</div>
                    <div className="text-muted-foreground text-xs">{customer.phone}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={cn('text-xs', config.color)}>
                      <Icon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatNumber(customer.current_points)} điểm
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Name Input */}
      <div className="relative" ref={nameRef}>
        <Label className="flex items-center gap-1">
          <User className="h-3 w-3" />
          Tên khách hàng <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Input
            placeholder="Nhập tên khách mới hoặc tìm tên khách cũ"
            value={customerName}
            onChange={(e) => {
              setCustomerName(e.target.value);
              if (selectedCustomer) onSelect(null);
            }}
            className={cn(
              selectedCustomer && 'border-primary ring-1 ring-primary'
            )}
          />
          {isSearchingName && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        
        {/* Name Suggestions Dropdown */}
        {showNameDropdown && nameSuggestions.length > 0 && (
          <div className="absolute z-20 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-60 overflow-auto">
            {nameSuggestions.map((customer) => {
              const config = TIER_CONFIG[customer.membership_tier];
              const Icon = config.icon;
              return (
                <button
                  key={customer.id}
                  className="w-full px-4 py-3 text-left hover:bg-accent flex items-center justify-between gap-2 border-b last:border-b-0"
                  onClick={() => handleSelectCustomer(customer)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{customer.name}</div>
                    <div className="text-muted-foreground text-xs">{customer.phone}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={cn('text-xs', config.color)}>
                      <Icon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatNumber(customer.current_points)} điểm
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Customer - Membership Info Card */}
      {selectedCustomer && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border-2 border-primary/30 relative">
          <button
            onClick={handleClearCustomer}
            className="absolute top-2 right-2 text-xs text-muted-foreground hover:text-destructive"
          >
            ✕ Bỏ chọn
          </button>
          
          {/* Customer header */}
          <div className="flex items-start gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              {TierIcon && <TierIcon className="h-5 w-5 text-primary" />}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-lg">{selectedCustomer.name}</div>
              <div className="text-sm text-muted-foreground">{selectedCustomer.phone}</div>
            </div>
          </div>
          
          {/* Membership Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background/80 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Hạng thành viên</div>
              <div className="mt-1">
                <Badge variant="outline" className={cn('text-sm', TIER_CONFIG[selectedCustomer.membership_tier].color)}>
                  {TierIcon && <TierIcon className="h-3 w-3 mr-1" />}
                  {TIER_CONFIG[selectedCustomer.membership_tier].label}
                </Badge>
              </div>
            </div>
            <div className="bg-background/80 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Điểm tích lũy</div>
              <div className="mt-1 font-bold text-lg text-primary">
                {formatNumber(selectedCustomer.current_points)}
              </div>
              {selectedCustomer.pending_points > 0 && (
                <div className="text-xs text-yellow-600">
                  +{formatNumber(selectedCustomer.pending_points)} đang treo
                </div>
              )}
            </div>
            <div className="bg-background/80 rounded-lg p-3 col-span-2">
              <div className="text-xs text-muted-foreground">Tổng chi tiêu</div>
              <div className="mt-1 font-semibold">
                {formatNumber(selectedCustomer.total_spent)}đ
              </div>
            </div>
          </div>
          
          {/* Status */}
          <div className="mt-3 flex items-center gap-2 text-sm">
            {selectedCustomer.status === 'active' ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-green-600">Tài khoản đang hoạt động</span>
              </>
            ) : (
              <span className="text-yellow-600">Tài khoản tạm ngưng</span>
            )}
          </div>
        </div>
      )}

      {/* New Customer Notice */}
      {isNewCustomer && (
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <User className="h-4 w-4" />
            <span className="text-sm font-medium">Khách hàng mới</span>
          </div>
          <p className="mt-1 text-xs text-blue-600 dark:text-blue-500">
            Thông tin sẽ được lưu lại sau khi hoàn tất thanh toán. Điểm thưởng sẽ tự động tích lũy.
          </p>
        </div>
      )}
    </div>
  );
}
