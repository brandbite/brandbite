// -----------------------------------------------------------------------------
// @file: components/ui/inline-alert.tsx
// @purpose: Shared inline alert for error / success / warning / info messages
// -----------------------------------------------------------------------------

type InlineAlertProps = {
  variant: "error" | "success" | "warning" | "info";
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md";
  className?: string;
};

const VARIANT_CLASSES: Record<InlineAlertProps["variant"], string> = {
  error: "border-red-200 bg-red-50 text-red-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-blue-200 bg-blue-50 text-blue-700",
};

const SIZE_CLASSES: Record<NonNullable<InlineAlertProps["size"]>, string> = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-3 text-sm",
};

export function InlineAlert({
  variant,
  title,
  children,
  size = "md",
  className = "",
}: InlineAlertProps) {
  return (
    <div
      className={`rounded-xl border ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
    >
      {title && <p className="font-medium">{title}</p>}
      <div className={title ? "mt-1" : ""}>{children}</div>
    </div>
  );
}
