import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative z-10 text-center">
        <p className="font-display text-8xl font-bold text-gold drop-shadow-[0_0_35px_rgba(214,179,106,0.35)] sm:text-9xl">
          404
        </p>
        <h1 className="mt-6 font-display text-2xl font-bold tracking-wide text-ink">
          This reel doesn&rsquo;t exist
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
          The page you were looking for has been left on the cutting room floor.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex h-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-6 text-sm font-medium text-ink backdrop-blur-sm transition-colors duration-200 hover:bg-white/10"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
