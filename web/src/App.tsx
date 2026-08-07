import { lazy, Suspense, useState } from "react";
import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useSetupStatus } from "./api/queries";
import { AttentionNotifier } from "./components/AttentionNotifier";
import { GlobalRunWatcher } from "./components/GlobalRunWatcher";
import { IconRail } from "./components/layout/IconRail";
import { MobileNavDrawer } from "./components/layout/MobileNavDrawer";
import { TopNav } from "./components/layout/TopNav";
import { ToastProvider } from "./components/Toast";
import { Spinner } from "./components/Spinner";

const Discovery = lazy(() => import("./pages/Discovery"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Overview = lazy(() => import("./pages/Overview"));
const Pipeline = lazy(() => import("./pages/Pipeline"));
const Profile = lazy(() => import("./pages/Profile"));
const Runs = lazy(() => import("./pages/Runs"));
const Salary = lazy(() => import("./pages/Salary"));
const Settings = lazy(() => import("./pages/Settings"));
const Upskill = lazy(() => import("./pages/Upskill"));

function RouteFallback() {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
      <Spinner size={16} className="text-signal" />
      Loading...
    </div>
  );
}

function FullScreenState({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen items-center justify-center px-4 text-center text-sm text-muted">
      {children}
    </div>
  );
}

export default function App() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const topSegment =
    location.pathname === "/" ? "/" : `/${location.pathname.split("/")[1]}`;
  const setupQuery = useSetupStatus();

  if (setupQuery.isLoading) {
    return (
      <FullScreenState>
        <Spinner size={20} className="text-signal" />
      </FullScreenState>
    );
  }

  if (setupQuery.isError) {
    return (
      <FullScreenState>Couldn't reach the dashboard server. Make sure it's running.</FullScreenState>
    );
  }

  if (!setupQuery.data?.configured) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Onboarding />
      </Suspense>
    );
  }

  return (
    <ToastProvider>
      <GlobalRunWatcher />
      <AttentionNotifier />
      <div className="flex h-screen items-stretch gap-4 overflow-hidden p-3 sm:p-4 lg:p-6">
        <IconRail />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-border/10 bg-surface shadow-xl">
          <TopNav onMenuClick={() => setMobileNavOpen(true)} />
          <main className="thin-scrollbar flex-1 overflow-y-auto px-6 py-6">
            <div key={topSegment} className="animate-page-in">
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Overview />} />
                  <Route path="/discovery" element={<Discovery />} />
                  <Route path="/pipeline" element={<Pipeline />} />
                  <Route path="/upskill" element={<Upskill />} />
                  <Route path="/salary" element={<Salary />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/runs" element={<Runs />} />
                  <Route path="/runs/:runId" element={<Runs />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </div>
          </main>
        </div>
      </div>
      <MobileNavDrawer open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
    </ToastProvider>
  );
}
