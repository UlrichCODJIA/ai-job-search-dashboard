import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { GlobalRunWatcher } from "./components/GlobalRunWatcher";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ToastProvider>
      <GlobalRunWatcher />
      <div className="flex h-screen overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar onMenuClick={() => setSidebarOpen(true)} />
          <main className="thin-scrollbar flex-1 overflow-y-auto px-6 py-6">
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
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
