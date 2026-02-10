import { ReactNode } from 'react';
import { HelpTip } from '@/components/ui/help-tip';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  helpText?: string;
}

export function PageHeader({ title, description, actions, helpText }: PageHeaderProps) {
  return (
    <div className="border-b bg-card px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="pl-12 sm:pl-10 lg:pl-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">{title}</h1>
            {helpText && <HelpTip content={helpText} />}
          </div>
          {description && (
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 sm:gap-3 pl-12 sm:pl-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
