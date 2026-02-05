import { useState } from 'react';
import { Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';

export function ProductNamingTip() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-4">
      <CollapsibleTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-between text-muted-foreground hover:text-primary h-auto py-2 px-3 bg-muted/50 rounded-lg"
        >
          <span className="flex items-center gap-2 text-sm">
            <Lightbulb className="h-4 w-4 text-primary" />
            Mẹo đặt tên sản phẩm để dễ tìm kiếm
          </span>
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <div className="bg-accent/50 border border-border rounded-lg p-3 text-sm space-y-2">
          <p className="font-medium text-accent-foreground">
            Công thức: Tên sản phẩm + Đời máy + Dung lượng + Màu sắc
          </p>
          <div className="text-muted-foreground space-y-1">
            <p>• iPhone 15 Promax 256Gb Đen</p>
            <p>• iPad Pro M2 11in 256G Xám</p>
            <p>• Samsung S24 Ultra 512Gb Tím</p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
