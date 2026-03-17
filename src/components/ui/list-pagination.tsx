import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ListPaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  hasMore?: boolean;
}

export function ListPagination({ currentPage, totalItems, pageSize, onPageChange, hasMore }: ListPaginationProps) {
  const hasKnownTotal = typeof hasMore !== 'boolean';
  const totalPages = hasKnownTotal ? Math.ceil(totalItems / pageSize) : Math.max(currentPage, 1);

  const canGoPrev = currentPage > 1;
  const canGoNext = hasKnownTotal ? currentPage < totalPages : !!hasMore;

  if (!canGoPrev && !canGoNext) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between pt-3">
      <p className="text-xs text-muted-foreground">
        {hasKnownTotal ? `${start}–${end} / ${totalItems}` : `${start}–${end}`}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={!canGoPrev}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground px-2">
          {hasKnownTotal ? `${currentPage}/${totalPages}` : `${currentPage}${hasMore ? '+' : ''}`}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={!canGoNext}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** Paginate an array client-side */
export function paginateArray<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
