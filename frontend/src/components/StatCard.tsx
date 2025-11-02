"use client";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  gradient: string;
}

export function StatCard({ title, value, icon, trend, gradient }: StatCardProps) {
  return (
    <div 
      className={`relative overflow-hidden rounded-xl p-6 text-white transition-all duration-200 hover:scale-105 hover:shadow-lg ${gradient}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-white/80 mb-1">{title}</p>
          <p className="text-3xl font-bold mb-2">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 text-sm">
              <span className={trend.isPositive ? "text-green-200" : "text-red-200"}>
                {trend.isPositive ? "↗" : "↘"}
              </span>
              <span className="text-white/90">{trend.value}</span>
            </div>
          )}
        </div>
        <div className="text-white/20 scale-150 -mr-4 -mt-2">
          {icon}
        </div>
      </div>
    </div>
  );
}

