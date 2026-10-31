import { cn } from '@/lib/cn';

/** Circular TMDB rating gauge (0–10) with a gold-to-red severity hue. */
export function RatingRing({ value, size = 56, className }: { value: number; size?: number; className?: string }) {
  const clamped = Math.max(0, Math.min(10, value));
  const pct = clamped / 10;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = clamped >= 7.5 ? '#d6b36a' : clamped >= 5.5 ? '#38bdf8' : clamped > 0 ? '#a1a1aa' : '#3f3f46';

  return (
    <span
      role="img"
      aria-label={`Rating ${clamped.toFixed(1)} out of 10`}
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        {clamped > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
          />
        )}
      </svg>
      <span className="absolute text-xs font-bold text-ink" style={{ fontSize: size / 4.2 }}>
        {clamped > 0 ? clamped.toFixed(1) : '–'}
      </span>
    </span>
  );
}
