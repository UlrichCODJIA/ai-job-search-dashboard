import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  action?: ToastAction;
  closing?: boolean;
}

interface ToastContextValue {
  push: (toast: Omit<ToastItem, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, { card: string; icon: string }> = {
  success: {
    card: "border-emerald-500/30 bg-emerald-500/[0.08]",
    icon: "text-emerald-500",
  },
  error: { card: "border-red-500/30 bg-red-500/[0.08]", icon: "text-red-500" },
  warning: {
    card: "border-amber-500/30 bg-amber-500/[0.08]",
    icon: "text-amber-700 dark:text-amber-500",
  },
  info: { card: "border-signal/30 bg-signal/[0.08]", icon: "text-signal" },
};

const TONE_ICONS: Record<ToastTone, string> = {
  success: "✓",
  error: "✗",
  warning: "⏸",
  info: "●",
};

const AUTO_DISMISS_MS = 7000;
const TOAST_EXIT_MS = 180;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => {
      const target = prev.find((t) => t.id === id);
      if (!target || target.closing) return prev;
      return prev.map((t) => (t.id === id ? { ...t, closing: true } : t));
    });
    const removalTimer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, TOAST_EXIT_MS);
    timers.current.set(id, removalTimer);
  }, []);

  const push = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = `${toasts.length}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { ...toast, id }]);
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timers.current.set(id, timer);
    },
    [dismiss, toasts.length],
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => {
          const tone = TONE_STYLES[t.tone];
          return (
            <div
              key={t.id}
              className={`${t.closing ? "animate-toast-out" : "animate-toast-in"} pointer-events-auto rounded-2xl border p-3 shadow-lg backdrop-blur-sm ${tone.card}`}
            >
              <div className="flex items-start gap-2">
                <span aria-hidden className={`mt-0.5 ${tone.icon}`}>
                  {TONE_ICONS[t.tone]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{t.title}</p>
                  {t.description && (
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {t.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  className="shrink-0 text-muted transition-colors hover:text-ink"
                  aria-label="Dismiss notification"
                >
                  ✕
                </button>
              </div>
              {t.action && (
                <button
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                  className="mt-2 rounded-full bg-signal px-3 py-1 text-xs font-medium text-signal-ink transition-transform hover:bg-signal/90 active:scale-[0.97]"
                >
                  {t.action.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
