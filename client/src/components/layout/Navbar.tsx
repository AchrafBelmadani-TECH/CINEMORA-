import { NavLink, Link } from 'react-router-dom';
import { Clapperboard, LogOut, UsersRound } from 'lucide-react';
import { SearchBar } from '@/components/search/SearchBar';
import { AvatarCircle } from '@/components/auth/AvatarCircle';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/cn';

/**
 * Navigation links render only when their destination exists (governing rule:
 * no broken navigation).
 */
const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/movies', label: 'Movies', end: false },
  { to: '/series', label: 'Series', end: false },
  { to: '/genres', label: 'Genres', end: false },
  { to: '/discover', label: 'Discover', end: false },
] as const;

export function Navbar() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const logout = useAuthStore((s) => s.logout);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-base/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6">
        <NavLink to="/" aria-label="CINEMORA — home" className="group flex shrink-0 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-gold/30 bg-card text-gold shadow-gold transition-shadow duration-300 group-hover:shadow-glow">
            <Clapperboard className="h-5 w-5" aria-hidden />
          </span>
          <span className="hidden font-display text-lg font-bold tracking-[0.18em] text-ink min-[420px]:inline">
            CINEM<span className="text-gold">ORA</span>
          </span>
        </NavLink>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  'shrink-0 rounded-md border-b-2 px-2 py-2 text-sm font-medium transition-colors duration-200 sm:px-3',
                  isActive ? 'border-gold text-ink' : 'border-transparent text-muted hover:text-ink',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden w-56 shrink-0 lg:block xl:w-72">
          <SearchBar />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {status === 'authenticated' && user ? (
            <>
              <Link
                to="/profiles"
                aria-label="Switch profile"
                title={`Active profile: ${profile?.name ?? user.displayName}`}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-card px-2 py-1.5 transition-colors hover:border-gold/30"
              >
                <AvatarCircle avatarKey={profile?.avatarKey ?? 'aurora'} name={profile?.name ?? user.displayName} size="sm" />
                <span className="hidden max-w-24 truncate text-sm font-medium text-ink sm:inline">
                  {profile?.name ?? user.displayName}
                </span>
                <UsersRound className="h-4 w-4 text-muted" aria-hidden />
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                aria-label="Sign out"
                title="Sign out"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-card text-muted transition-colors hover:text-ink"
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="flex h-9 items-center rounded-lg px-3 text-sm font-medium text-ink transition-colors hover:text-gold"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="flex h-9 items-center rounded-lg bg-gradient-to-r from-primary to-accent px-3 text-sm font-semibold text-white shadow-glow transition-all hover:brightness-110"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* mobile nav row */}
      <nav aria-label="Primary mobile" className="flex items-center gap-1 overflow-x-auto border-t border-white/5 px-4 py-1.5 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              cn(
                'shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                isActive ? 'bg-white/5 text-ink' : 'text-muted',
              )
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
