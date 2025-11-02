// volleyball-stats-app/frontend/tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: '#111827',
        card: '#1F2937',
        border: '#374151',
        foreground: '#E5E7EB',
        'foreground-muted': '#9CA3AF',
        primary: { DEFAULT: '#06B6D4', hover: '#0891B2', foreground: '#FFFFFF' },
        success: { DEFAULT: '#10B981', hover: '#059669', foreground: '#FFFFFF' },
        danger: { DEFAULT: '#EF4444', hover: '#DC2626', foreground: '#FFFFFF' },
        warning: { DEFAULT: '#F59E0B', hover: '#D97706', foreground: '#111827' },
        muted: { DEFAULT: '#4B5563', hover: '#6B7280', foreground: '#E5E7EB' },
      },
    },
  },
  plugins: [],
};
export default config;