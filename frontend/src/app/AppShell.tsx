import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { TopNav } from '@/components/layout/Topbar';
import { PipelineStepper } from '@/components/layout/PipelineStepper';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { DemoTour } from '@/components/layout/DemoTour';
import { GlobalEffects } from '@/components/layout/GlobalEffects';
import { PageSkeleton } from '@/components/common/misc';
import { useUi } from '@/store';
import { RouteErrorBoundary } from './ErrorBoundary';
import { QuantumField } from '@/components/fx/QuantumField';
import { RouteProgress, useCardGlow } from '@/components/fx/Effects';

const PIPELINE = /^\/(data|preprocess|architecture|models)|^\/experiments\/[^/]+\/train/;

export function AppShell() {
  const { pathname } = useLocation();
  const theme = useUi((s) => s.theme);
  useCardGlow();
  return (
    <div className="min-h-screen bg-bg">
      <a href="#main" className="sr-only z-[300] rounded-lg bg-classical px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <GlobalEffects />
      <RouteProgress />
      <QuantumField enabled={pathname !== '/'} />
      <div className="relative z-10 flex min-h-screen flex-col">
        <TopNav />
        {PIPELINE.test(pathname) && <PipelineStepper />}
        <main id="main" className="flex-1 px-4 py-6 lg:px-8">
          <div className="mx-auto max-w-[1480px]">
            {/* CSS-only route transition: it can never get stuck at opacity 0. */}
            <div key={pathname} className="page-enter">
              <RouteErrorBoundary key={pathname}>
                <Suspense fallback={<PageSkeleton />}>
                  <Outlet />
                </Suspense>
              </RouteErrorBoundary>
            </div>
          </div>
        </main>
      </div>
      <CommandPalette />
      <DemoTour />
      <Toaster position="bottom-right" theme={theme} richColors closeButton />
    </div>
  );
}
