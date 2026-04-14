import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { DYNAMIC_FIELDS, TABLE_FIELD_OPTIONS } from './types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (key: string, label: string) => void;
}

export function KeywordPickerDialog({ open, onClose, onSelect }: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return DYNAMIC_FIELDS;
    return DYNAMIC_FIELDS.map(g => ({
      ...g,
      fields: g.fields.filter(f => f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q)),
    })).filter(g => g.fields.length > 0);
  }, [search]);

  const filteredTable = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return TABLE_FIELD_OPTIONS;
    return TABLE_FIELD_OPTIONS.filter(f => f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q));
  }, [search]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Danh sách từ khóa</DialogTitle>
          <p className="text-xs text-muted-foreground">Từ khóa được chọn sẽ được thêm vào mẫu in</p>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm từ khóa..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {filtered.map((group) => (
            <div key={group.group}>
              <h3 className="text-sm font-semibold text-foreground mb-2">{group.group}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {group.fields.map((f) => (
                  <div key={f.key} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm">{f.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">{`{${f.key}}`}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs shrink-0"
                      onClick={() => { onSelect(f.key, f.label); onClose(); }}
                    >
                      Chọn
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {filteredTable.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Cột bảng sản phẩm</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {filteredTable.map((f) => (
                  <div key={f.key} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm">{f.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">{`{${f.key}}`}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs shrink-0"
                      onClick={() => { onSelect(f.key, f.label); onClose(); }}
                    >
                      Chọn
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && filteredTable.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Không tìm thấy từ khóa phù hợp</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
