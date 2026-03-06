

## Problem

The "Mua ngay" (order) button has `flex-1 min-w-0 shrink` which causes it to shrink to zero width, cutting off its text. The other buttons have `shrink-0` but the order button doesn't, so it collapses when space is tight.

## Fix

Change the order button from `flex-1 min-w-0 shrink` to `shrink-0` with a reasonable `min-w` and explicit `whitespace-nowrap`, matching the pattern of all other buttons. This ensures:
1. No button text gets cut off
2. When buttons overflow the container width, users can scroll horizontally (already working via `overflow-x-auto scrollbar-hide`)

### Changes in `src/components/landing/ProductDetailPage.tsx`

**Line 749**: Change the order button classes from `flex-1 min-w-0 shrink` to `shrink-0 whitespace-nowrap`:
```tsx
<Button key={btn.id} className="shrink-0 gap-2 h-11 text-sm font-semibold px-4 whitespace-nowrap" ...>
```

All buttons will now be `shrink-0` so none collapse. The horizontal scroll container handles overflow.

