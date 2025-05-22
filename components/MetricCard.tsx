"use client";

interface MetricCardProps {
  title: string;
  value: string | number | null | undefined;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label?: string;
    isPositive?: boolean;
  };
  variant?: "default" | "primary" | "success" | "warning" | "danger";
}

export default function MetricCard({
  title,
  value,
  description,
  icon,
  trend,
  variant = "default",
}: MetricCardProps) {
  // Determine background and text colors based on variant
  const getVariantClasses = () => {
    switch (variant) {
      case "primary":
        return "bg-blue-50 border-blue-200";
      case "success":
        return "bg-green-50 border-green-200";
      case "warning":
        return "bg-amber-50 border-amber-200";
      case "danger":
        return "bg-red-50 border-red-200";
      default:
        return "bg-white border-gray-200";
    }
  };

  const getIconClasses = () => {
    switch (variant) {
      case "primary":
        return "bg-blue-100 text-blue-600";
      case "success":
        return "bg-green-100 text-green-600";
      case "warning":
        return "bg-amber-100 text-amber-600";
      case "danger":
        return "bg-red-100 text-red-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className={`rounded-xl border shadow-sm p-6 ${getVariantClasses()}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <div className="mt-2 flex items-baseline">
            <p className="text-2xl font-semibold">{value ?? "-"}</p>
            {trend && (
              <span
                className={`ml-2 text-sm font-medium ${
                  trend.isPositive !== false ? "text-green-600" : "text-red-600"
                }`}
              >
                {trend.isPositive !== false ? "↑" : "↓"}{" "}
                {Math.abs(trend.value).toFixed(1)}%
                {trend.label && (
                  <span className="text-gray-500 ml-1">{trend.label}</span>
                )}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1 text-xs text-gray-500">{description}</p>
          )}
        </div>

        {icon && (
          <div
            className={`flex h-12 w-12 rounded-full ${getIconClasses()} items-center justify-center`}
          >
            <span className="text-xl">{icon}</span>
          </div>
        )}
      </div>
    </div>
  );
}
