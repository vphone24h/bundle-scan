import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="border-b bg-card px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="pl-12 sm:pl-10 lg:pl-0">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">{title}</h1>
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
