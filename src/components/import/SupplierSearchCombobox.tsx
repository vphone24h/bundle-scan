import { useState, useRef, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
}

interface SupplierSearchComboboxProps {
  suppliers: Supplier[];
  value: string;
  onChange: (supplierId: string) => void;
  placeholder?: string;
  className?: string;
  hasError?: boolean;
}

export function SupplierSearchCombobox({
  suppliers,
  value,
  onChange,
  placeholder = 'Tìm NCC theo tên hoặc SĐT...',
  className,
  hasError,
}: SupplierSearchComboboxProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Selected supplier display
  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === value),
    [suppliers, value]
  );

  // Filter suggestions: min 2 chars, match name or phone
  const suggestions = useMemo(() => {
    if (search.length < 2) return [];
    const q = search.toLowerCase().trim();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.phone && s.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')))
    );
  }, [search, suppliers]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showDropdown = open && search.length >= 2 && suggestions.length > 0;

  const handleSelect = (supplierId: string) => {
    onChange(supplierId);
    const sup = suppliers.find((s) => s.id === supplierId);
    setSearch(sup?.name || '');
    setOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setSearch('');
    inputRef.current?.focus();
  };

  // Sync display when value changes externally (e.g. after creating new supplier)
  useEffect(() => {
    if (selectedSupplier && !focused) {
      setSearch(selectedSupplier.name);
    } else if (!value && !focused) {
      setSearch('');
    }
  }, [selectedSupplier, value, focused]);

  return (
    <div ref={containerRef} className={cn('relative flex-1', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
      <Input
        ref={inputRef}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
          // Clear selection if user edits
          if (value) onChange('');
        }}
        onFocus={() => {
          setFocused(true);
          if (search.length >= 2) setOpen(true);
        }}
        onBlur={() => {
          setFocused(false);
        }}
        placeholder={placeholder}
        className={cn(
          'pl-9 pr-8',
          hasError && 'border-destructive ring-destructive/30 ring-2'
        )}
      />
      {(search || value) && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-10"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((sup) => (
            <button
              key={sup.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(sup.id);
              }}
              className={cn(
                'w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors flex flex-col',
                sup.id === value && 'bg-primary/10 text-primary font-medium'
              )}
            >
              <span>{sup.name}</span>
              {sup.phone && (
                <span className="text-xs text-muted-foreground">{sup.phone}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {open && search.length >= 2 && suggestions.length === 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-lg p-3 text-sm text-muted-foreground text-center">
          Không tìm thấy NCC
        </div>
      )}
    </div>
  );
}
