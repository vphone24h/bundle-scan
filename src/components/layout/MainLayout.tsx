import { ReactNode, memo } from 'react';
import { AppSidebar } from './AppSidebar';

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout = memo(function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background safe-x">
      <AppSidebar />
      {/* Main content - add extra top padding for PWA standalone mode to avoid menu button overlap */}
      <main 
        className="lg:pl-64 lg:pt-0 safe-bottom"
        style={{
          paddingTop: 'max(3.5rem, calc(env(safe-area-inset-top) + 4rem))',
        }}
      >
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
});
