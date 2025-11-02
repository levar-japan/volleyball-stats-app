"use client";
import Link from 'next/link';

interface ActionCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  colorClass: string;
}

export function ActionCard({ title, description, href, icon, colorClass }: ActionCardProps) {
  return (
    <Link href={href}>
      <div className="group relative overflow-hidden rounded-xl bg-white p-6 shadow-md transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border border-gray-200">
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 w-12 h-12 rounded-lg ${colorClass} flex items-center justify-center text-white group-hover:opacity-90 transition-opacity`}>
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-gray-700 transition-colors">
              {title}
            </h3>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
          <div className="flex-shrink-0 text-gray-400 group-hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}

