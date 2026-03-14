import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Phone, User, Search, Check, Crown, Award, Medal, Star, Plus, MapPin, Mail, Cake, ChevronDown, ChevronUp, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatNumber } from '@/lib/formatNumber';
import { CustomerSourceSelect } from '@/components/customers/CustomerSourceSelect';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

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
  customerBirthday?: Date | undefined;
  setCustomerName: (v: string) => void;
  setCustomerPhone: (v: string) => void;
  setCustomerAddress: (v: string) => void;
  setCustomerEmail: (v: string) => void;
  setCustomerSource?: (v: string) => void;
  setCustomerBirthday?: (v: Date | undefined) => void;
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
  customerBirthday,
  setCustomerName,
  setCustomerPhone,
  setCustomerAddress,
  setCustomerEmail,
  setCustomerSource,
  setCustomerBirthday,
}: CustomerSearchComboboxProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const searchCacheRef = useRef<Map<string, Customer[]>>(new Map());
  const latestSearchTokenRef = useRef(0);

  const normalizePhone = (value: string) => value.replace(/\D/g, '');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Unified search by phone or name using optimized RPC + cache + stale-request guard
  useEffect(() => {
    const raw = searchQuery.trim();
    const isPhoneSearch = /^\d+$/.test(raw);
    const minChars = isPhoneSearch ? 4 : 2;

    if (raw.length < minChars || selectedCustomer) {
      latestSearchTokenRef.current += 1;
      setSuggestions([]);
      setShowDropdown(false);
      setIsSearching(false);
      return;
    }

    const cacheKey = raw.toLowerCase();
    const cached = searchCacheRef.current.get(cacheKey);
    if (cached) {
      setSuggestions(cached);
      setShowDropdown(cached.length > 0);
      setIsSearching(false);
      return;
    }

    const rawNormalized = normalizePhone(raw);
    const debounceMs = isPhoneSearch ? 90 : 180;

    setIsSearching(true);
    const requestToken = ++latestSearchTokenRef.current;

    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc('get_customers_paginated', {
        _search: raw,
        _branch_id: null,
        _tier: null,
        _crm_status: null,
        _staff_id: null,
        _tag_id: null,
        _page: 1,
        _page_size: 5,
      });

      if (requestToken !== latestSearchTokenRef.current) return;

      if (error) {
        setSuggestions([]);
        setShowDropdown(false);
        setIsSearching(false);
        return;
      }

      const payload = (data as { items?: Customer[] } | null) ?? null;
      const customers = (payload?.items || []).slice(0, 5);
      searchCacheRef.current.set(cacheKey, customers);

      if (isPhoneSearch) {
        const exactMatch = customers.find(c => normalizePhone(c.phone) === rawNormalized);
        if (exactMatch) {
          handleSelectCustomer(exactMatch);
          setIsSearching(false);
          return;
        }
      }

      setSuggestions(customers);
      setShowDropdown(customers.length > 0);
      setIsSearching(false);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCustomer]);

  const handleSelectCustomer = (customer: Customer) => {
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setCustomerAddress(customer.address || '');
    setCustomerEmail(customer.email || '');
    setCustomerSource?.(customer.source || '');
    if (customer.birthday && setCustomerBirthday) {
      setCustomerBirthday(new Date(customer.birthday));
    }
    onSelect(customer);
    setShowDropdown(false);
    setSearchQuery('');
    setIsAddingNew(false);
  };

  const handleClearCustomer = () => {
    onSelect(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setCustomerEmail('');
    setCustomerSource?.('');
    setCustomerBirthday?.(undefined);
    setSearchQuery('');
    setIsAddingNew(false);
  };

  const handleAddNew = () => {
    setIsAddingNew(true);
    setShowDropdown(false);
    // Pre-fill phone if search was a number
    if (/^\d+$/.test(searchQuery)) {
      setCustomerPhone(searchQuery);
    } else if (searchQuery.length > 0) {
      setCustomerName(searchQuery);
    }
    setSearchQuery('');
  };

  const TierIcon = selectedCustomer ? TIER_CONFIG[selectedCustomer.membership_tier].icon : null;

  // === SELECTED CUSTOMER VIEW ===
  if (selectedCustomer) {
    return (
      <div className="space-y-3">
        <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border-2 border-primary/30 relative">
          <button
            onClick={handleClearCustomer}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          
          <div className="flex items-start gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              {TierIcon && <TierIcon className="h-5 w-5 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-lg truncate">{selectedCustomer.name}</div>
              <div className="text-sm text-muted-foreground">{selectedCustomer.phone}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-background/80 rounded-lg p-2.5">
              <div className="text-xs text-muted-foreground">Hạng</div>
              <Badge variant="outline" className={cn('text-xs mt-1', TIER_CONFIG[selectedCustomer.membership_tier].color)}>
                {TierIcon && <TierIcon className="h-3 w-3 mr-1" />}
                {TIER_CONFIG[selectedCustomer.membership_tier].label}
              </Badge>
            </div>
            <div className="bg-background/80 rounded-lg p-2.5">
              <div className="text-xs text-muted-foreground">Điểm tích lũy</div>
              <div className="font-bold text-primary">
                {formatNumber(selectedCustomer.current_points)}
              </div>
              {selectedCustomer.pending_points > 0 && (
                <div className="text-xs text-yellow-600">
                  +{formatNumber(selectedCustomer.pending_points)} treo
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-2 bg-background/80 rounded-lg p-2.5">
            <div className="text-xs text-muted-foreground">Tổng chi tiêu</div>
            <div className="font-semibold">{formatNumber(selectedCustomer.total_spent)}đ</div>
          </div>
          
          <div className="mt-2 flex items-center gap-2 text-sm">
            {selectedCustomer.status === 'active' ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-500" />
                <span className="text-green-600 text-xs">Đang hoạt động</span>
              </>
            ) : (
              <span className="text-yellow-600 text-xs">Tạm ngưng</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // === ADDING NEW CUSTOMER FORM ===
  if (isAddingNew) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Plus className="h-4 w-4" />
            Thêm khách hàng mới
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAddingNew(false)}
            className="h-7 text-xs"
          >
            ← Quay lại tìm kiếm
          </Button>
        </div>
        
        <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
          <div>
            <Label className="flex items-center gap-1 text-xs mb-1">
              <User className="h-3 w-3" />
              Tên khách hàng <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Nhập tên khách hàng"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="h-9"
            />
          </div>
          
          <div>
            <Label className="flex items-center gap-1 text-xs mb-1">
              <Phone className="h-3 w-3" />
              Số điện thoại <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Nhập số điện thoại"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="h-9"
            />
          </div>
          
          <div>
            <Label className="flex items-center gap-1 text-xs mb-1">
              <MapPin className="h-3 w-3" />
              Địa chỉ
            </Label>
            <Input
              placeholder="Địa chỉ (tùy chọn)"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              className="h-9"
            />
          </div>
          
          <div>
            <Label className="flex items-center gap-1 text-xs mb-1">
              <Mail className="h-3 w-3" />
              Email
            </Label>
            <Input
              type="email"
              placeholder="Email (tùy chọn)"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="h-9"
            />
          </div>
          
          <CustomerSourceSelect
            value={customerSource || ''}
            onChange={(v) => setCustomerSource?.(v)}
          />
          
          {setCustomerBirthday && (
            <div>
              <Label className="flex items-center gap-1 text-xs mb-1">
                <Cake className="h-3 w-3" />
                Ngày sinh
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-9",
                      !customerBirthday && "text-muted-foreground"
                    )}
                  >
                    <Cake className="mr-2 h-3.5 w-3.5" />
                    {customerBirthday ? (
                      format(customerBirthday, "dd/MM/yyyy", { locale: vi })
                    ) : (
                      <span className="text-sm">Chọn ngày sinh (tùy chọn)</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customerBirthday}
                    onSelect={setCustomerBirthday}
                    disabled={(date) =>
                      date > new Date() || date < new Date("1900-01-01")
                    }
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    captionLayout="dropdown-buttons"
                    fromYear={1920}
                    toYear={new Date().getFullYear()}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
        
        <p className="text-xs text-muted-foreground">
          Thông tin sẽ được lưu lại sau khi hoàn tất thanh toán. Điểm thưởng sẽ tự động tích lũy.
        </p>
      </div>
    );
  }

  // === DEFAULT: SEARCH VIEW ===
  return (
    <div className="space-y-3 relative" ref={searchRef}>
      <div>
        <Label className="flex items-center gap-1 mb-1.5">
          <Search className="h-3.5 w-3.5" />
          Khách hàng
        </Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nhập SĐT hoặc tên khách hàng..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 search-input-highlight"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Nếu là khách cũ, nhập SĐT sẽ tự hiện thông tin. Nếu là khách mới, bấm "Thêm mới".
        </p>
      </div>

      {/* Suggestions Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-20 left-0 right-0 bg-popover border rounded-lg shadow-lg max-h-60 overflow-auto">
          {suggestions.map((customer) => {
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

      {/* Add New Customer Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleAddNew}
        className="w-full border-dashed gap-2"
      >
        <Plus className="h-4 w-4" />
        Thêm khách hàng mới
      </Button>
    </div>
  );
}
