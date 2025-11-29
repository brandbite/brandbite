// -----------------------------------------------------------------------------
// @file: components/ui/toast-provider.tsx
// @purpose: Global toast provider and hook for app-wide feedback messages
// @version: v1.0.1
// @status: active
// @lastUpdate: 2025-11-29
// -----------------------------------------------------------------------------

"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type ToastType = "success" | "error" | "info" | "warning";

export type ToastInput = {
  type?: ToastType;
  title: string;
  description?: string;
  durationMs?: number;
};

export type Toast = Omit<ToastInput, "type"> & {
  id: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => string;
  hideToast: (id: string) => void;
  clearToasts: () => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let idCounter = 0;
const generateToastId = () => `toast_${Date.now()}_${idCounter++}`;

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider.");
  }
  return ctx;
}

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

type ToastProviderProps = {
  children: React.ReactNode;
};

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const showToast = useCallback(
    (input: ToastInput) => {
      const id = generateToastId();
      const toast: Toast = {
        id,
        type: input.type ?? "info",
        title: input.title,
        description: input.description,
        durationMs: input.durationMs ?? 4500,
      };

      setToasts((prev) => [...prev, toast]);

      if (toast.durationMs && toast.durationMs > 0) {
        window.setTimeout(() => {
          hideToast(id);
        }, toast.durationMs);
      }

      return id;
    },
    [hideToast],
  );

  const value: ToastContextValue = {
    showToast,
    hideToast,
    clearToasts,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <ToastViewport toasts={toasts} onClose={hideToast} />,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

// -----------------------------------------------------------------------------
// Viewport & Toast UI
// -----------------------------------------------------------------------------

type ToastViewportProps = {
  toasts: Toast[];
  onClose: (id: string) => void;
};

function ToastViewport({ toasts, onClose }: ToastViewportProps) {
  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-end px-4 sm:top-4 sm:px-6">
      <div className="flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={onClose} />
        ))}
      </div>
    </div>
  );
}

type ToastItemProps = {
  toast: Toast;
  onClose: (id: string) => void;
};

function ToastItem({ toast, onClose }: ToastItemProps) {
  const { id, type, title, description } = toast;

  const { bgClass, borderClass, titleClass, iconChar } = getToastStyle(type);

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-3 py-3 text-xs shadow-lg backdrop-blur-sm ${bgClass} ${borderClass}`}
    >
      <div
        className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${titleClass} bg-black/10`}
        aria-hidden="true"
      >
        {iconChar}
      </div>
      <div className="flex-1">
        <div className={`text-[11px] font-semibold ${titleClass}`}>{title}</div>
        {description && (
          <p className="mt-1 text-[11px] text-slate-200 opacity-90">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onClose(id)}
        className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-[11px] text-slate-200 hover:bg-black/20 focus:outline-none focus:ring-1 focus:ring-slate-400"
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}

function getToastStyle(type: ToastType) {
  switch (type) {
    case "success":
      return {
        bgClass: "bg-emerald-900/80",
        borderClass: "border-emerald-500/40",
        titleClass: "text-emerald-100",
        iconChar: "✓",
      };
    case "error":
      return {
        bgClass: "bg-red-900/80",
        borderClass: "border-red-500/50",
        titleClass: "text-red-100",
        iconChar: "!",
      };
    case "warning":
      return {
        bgClass: "bg-amber-900/80",
        borderClass: "border-amber-500/50",
        titleClass: "text-amber-100",
        iconChar: "!",
      };
    case "info":
    default:
      return {
        bgClass: "bg-slate-900/80",
        borderClass: "border-slate-600/60",
        titleClass: "text-slate-100",
        iconChar: "i",
      };
  }
}
