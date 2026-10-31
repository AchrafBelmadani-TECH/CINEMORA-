import { NavLink } from 'react-router-dom';
import { Clapperboard } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Navigation links render only when their destination exists (governing rule:
 * no broken navigation). The search box arrives with Phase 3; profile menus
 * with Phase 4.
 */
const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/movies', label: 'Movies', end: false },
  { to: '/series', label: 'Series', end: false },
  { to: '/genres', label: 'Genres', end: false },
] as const;

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-base/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <NavLink to="/" aria-label="CINEMORA — home" className="group flex shrink-0 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-gold/30 bg-card text-gold shadow-gold transition-shadow duration-300 group-hover:shadow-glow">
            <Clapperboard className="h-5 w-5" aria-hidden />
          </span>
          <span className="font-display text-lg font-bold tracking-[0.18em] text-ink">
            CINEM<span className="text-gold">ORA</span>
          </span>
        </NavLink>

        <nav aria-label="Primary" className="flex items-center gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  'rounded-md border-b-2 px-2 py-2 text-sm font-medium transition-colors duration-200 sm:px-3',
                  isActive
                    ? 'border-gold text-ink'
                    : 'border-transparent text-muted hover:text-ink',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
