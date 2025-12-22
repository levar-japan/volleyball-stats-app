import { z } from 'zod';

// 選手名のバリデーション
export const playerNameSchema = z
  .string()
  .min(1, '選手名は必須です')
  .max(50, '選手名は50文字以内で入力してください')
  .trim();

// 試合情報のバリデーション
export const matchSchema = z.object({
  opponent: z
    .string()
    .min(1, '対戦相手は必須です')
    .max(100, '対戦相手名は100文字以内で入力してください')
    .trim(),
  venue: z
    .string()
    .max(200, '会場名は200文字以内で入力してください')
    .trim()
    .optional()
    .nullable(),
  matchDate: z.string().min(1, '試合日は必須です').transform((str) => new Date(str)),
  seasonId: z.string().optional().nullable(),
});

// シーズン情報のバリデーション
export const seasonSchema = z.object({
  name: z
    .string()
    .min(1, 'シーズン名は必須です')
    .max(100, 'シーズン名は100文字以内で入力してください')
    .trim(),
  startDate: z.string().min(1, '開始日は必須です').transform((str) => new Date(str)),
  endDate: z.string().min(1, '終了日は必須です').transform((str) => new Date(str)),
  description: z
    .string()
    .max(500, '説明は500文字以内で入力してください')
    .trim()
    .optional()
    .nullable(),
}).refine((data) => data.startDate <= data.endDate, {
  message: '開始日は終了日より前である必要があります',
  path: ['startDate'],
});

// チームコードのバリデーション
export const teamCodeSchema = z
  .string()
  .length(4, 'チームコードは4桁である必要があります')
  .regex(/^\d{4}$/, 'チームコードは数字4桁である必要があります');

