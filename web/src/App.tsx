import { useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { GlobalRunWatcher } from "./components/GlobalRunWatcher";
import { IconRail } from "./components/layout/IconRail";
import { MobileNavDrawer } from "./components/layout/MobileNavDrawer";
import { TopNav } from "./components/layout/TopNav";
import { ToastProvider } from "./components/Toast";
import Discovery from "./pages/Discovery";
import Overview from "./pages/Overview";
import Pipeline from "./pages/Pipeline";
import Profile from "./pages/Profile";
import Runs from "./pages/Runs";
import Salary from "./pages/Salary";
import Settings from "./pages/Settings";
import Upskill from "./pages/Upskill";

export default function App() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const topSegment =
    location.pathname === "/" ? "/" : `/${location.pathname.split("/")[1]}`;

  return (
    <ToastProvider>
      <GlobalRunWatcher />
      <div className="flex h-screen items-stretch gap-4 overflow-hidden p-3 sm:p-4 lg:p-6">
        <IconRail />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-border/10 bg-surface shadow-xl">
          <TopNav onMenuClick={() => setMobileNavOpen(true)} />
          <main className="thin-scrollbar flex-1 overflow-y-auto px-6 py-6">
            <div key={topSegment} className="animate-page-in">
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
            </div>
          </main>
        </div>
      </div>
      <MobileNavDrawer open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
    </ToastProvider>
  );
}
