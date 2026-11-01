import { User } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Gradient map for the 12 curated avatar presets (no user uploads — ADR #24). */
const GRADIENTS: Record<string, string> = {
  aurora: 'from-violet-500 via-purple-500 to-sky-400',
  nova: 'from-sky-400 via-blue-500 to-indigo-600',
  ember: 'from-orange-500 via-red-500 to-rose-600',
  frost: 'from-cyan-300 via-sky-400 to-blue-500',
  sage: 'from-emerald-400 via-teal-500 to-green-600',
  royal: 'from-purple-600 via-fuchsia-600 to-pink-500',
  dawn: 'from-amber-300 via-orange-400 to-rose-400',
  dusk: 'from-indigo-500 via-purple-600 to-slate-700',
  jade: 'from-lime-400 via-emerald-500 to-teal-600',
  coral: 'from-rose-400 via-pink-500 to-fuchsia-500',
  mono: 'from-zinc-500 via-slate-600 to-zinc-700',
  star: 'from-yellow-300 via-amber-400 to-yellow-600',
};

export function avatarGradient(avatarKey: string): string {
  return GRADIENTS[avatarKey] ?? GRADIENTS.mono!;
}

export interface AvatarCircleProps {
  avatarKey: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-20 w-20 text-lg',
  xl: 'h-28 w-28 sm:h-32 sm:w-32 text-2xl',
} as const;

/** Preset avatar circle with the initial (or a user glyph when nameless). */
export function AvatarCircle({ avatarKey, name, size = 'md', className }: AvatarCircleProps) {
  const initial = name?.trim().charAt(0).toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex select-none items-center justify-center rounded-full bg-gradient-to-br font-bold text-white/95 shadow-glow',
        avatarGradient(avatarKey),
        SIZES[size],
        className,
      )}
    >
      {initial ?? <User className="h-1/2 w-1/2" />}
    </span>
  );
}
