import { useState } from 'react';
import { WEBSITE_TEMPLATES, TEMPLATE_CATEGORIES, WebsiteTemplate } from '@/lib/websiteTemplates';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TemplatePreviewDialog } from './TemplatePreviewDialog';

interface TemplateSelectorProps {
  selectedTemplate: string;
  onSelect: (templateId: string) => void;
}

const tierColors: Record<string, string> = {
  basic: 'bg-muted text-muted-foreground',
  premium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  pro: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
};

const tierLabels: Record<string, string> = {
  basic: 'Cơ bản',
  premium: 'Cao cấp',
  pro: 'Premium',
};

export function TemplateSelector({ selectedTemplate, onSelect }: TemplateSelectorProps) {
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<WebsiteTemplate | null>(null);

  const filtered = filterCategory
    ? WEBSITE_TEMPLATES.filter(t => t.category === filterCategory)
    : WEBSITE_TEMPLATES;

  return (
    <div className="space-y-4">
      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterCategory(null)}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
            !filterCategory
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
          )}
        >
          Tất cả
        </button>
        {TEMPLATE_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
              filterCategory === cat
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            isSelected={selectedTemplate === template.id}
            onPreview={() => setPreviewTemplate(template)}
          />
        ))}
      </div>

      {/* Preview Dialog */}
      <TemplatePreviewDialog
        template={previewTemplate}
        open={!!previewTemplate}
        onOpenChange={(open) => !open && setPreviewTemplate(null)}
        onSelect={onSelect}
        isSelected={previewTemplate ? selectedTemplate === previewTemplate.id : false}
      />
    </div>
  );
}

function TemplateCard({
  template,
  isSelected,
  onPreview,
}: {
  template: WebsiteTemplate;
  isSelected: boolean;
  onPreview: () => void;
}) {
  const isDisabled = !template.available;

  return (
    <button
      type="button"
      onClick={() => !isDisabled && onPreview()}
      disabled={isDisabled}
      className={cn(
        'relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all',
        isSelected
          ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
          : isDisabled
          ? 'border-border/50 bg-muted/30 opacity-60 cursor-not-allowed'
          : 'border-border hover:border-primary/40 hover:shadow-sm cursor-pointer'
      )}
    >
      {/* Icon */}
      <span className="text-3xl">{template.icon}</span>

      {/* Name */}
      <span className="text-xs font-semibold leading-tight">{template.name}</span>

      {/* Tier badge */}
      <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', tierColors[template.tier])}>
        {tierLabels[template.tier]}
      </Badge>

      {/* Coming soon */}
      {isDisabled && (
        <span className="text-[10px] text-muted-foreground">Sắp ra mắt</span>
      )}

      {/* Selected check */}
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
}
