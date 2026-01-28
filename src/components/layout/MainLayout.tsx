import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background safe-x">
      <AppSidebar />
      <main className="lg:pl-64 pt-14 sm:pt-16 lg:pt-0 safe-bottom">
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}
