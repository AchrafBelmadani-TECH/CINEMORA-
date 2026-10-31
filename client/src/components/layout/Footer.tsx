import { Clapperboard } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-surface/40">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-gold/30 bg-card text-gold">
              <Clapperboard className="h-4 w-4" aria-hidden />
            </span>
            <span className="font-display text-sm font-bold tracking-[0.18em] text-ink">
              CINEM<span className="text-gold">ORA</span>
            </span>
          </div>

          <p className="max-w-md text-center text-xs leading-relaxed text-muted md:text-right">
            CINEMORA streams only content it is authorized to distribute — public domain,
            licensed and approved uploads. Movie metadata and artwork arrive with the TMDB
            catalog integration.
          </p>
        </div>

        <div className="mt-8 border-t border-white/5 pt-6 text-center text-xs text-muted">
          © 2026 CINEMORA — premium cinema at home.
        </div>

        {/* Required TMDB attribution (docs/ARCHITECTURE.md §12) */}
        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted/70">
          This product uses the TMDB API but is not endorsed or certified by{' '}
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-gold/40 underline-offset-2 transition-colors hover:text-gold"
          >
            TMDB
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
