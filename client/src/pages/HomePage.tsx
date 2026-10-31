import { motion, useReducedMotion } from 'framer-motion';
import { Bookmark, Clapperboard, Play } from 'lucide-react';

const pillars = [
  {
    icon: Clapperboard,
    title: 'Discover',
    text: 'Trending films and series, curated collections and deep search — one cinematic home for everything worth watching.',
  },
  {
    icon: Bookmark,
    title: 'Your library',
    text: 'Watchlists, favorites and viewing history, kept in your own personal profile and ready on every visit.',
  },
  {
    icon: Play,
    title: 'Watch',
    text: 'A beautiful player for legally available content — with subtitles, resume-where-you-left-off and next episode.',
  },
] as const;

function AuroraBlob({
  className,
  drift,
  reduceMotion,
}: {
  className: string;
  drift: { x: number[]; y: number[] };
  reduceMotion: boolean | null;
}) {
  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-3xl ${className}`}
      animate={reduceMotion ? undefined : { x: drift.x, y: drift.y }}
      transition={
        reduceMotion
          ? undefined
          : { duration: 22, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
      }
    />
  );
}

/**
 * Phase 1 landing: the brand shell. Real catalog content (hero backdrops,
 * poster rows) arrives with the TMDB integration in Phase 2 — nothing here
 * pretends otherwise.
 */
export function HomePage() {
  const reduceMotion = useReducedMotion();

  return (
    <div>
      {/* Brand hero */}
      <section className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden">
        <AuroraBlob
          className="left-[-10%] top-[-15%] h-[34rem] w-[34rem] bg-primary/20"
          drift={{ x: [0, 60, 0], y: [0, 40, 0] }}
          reduceMotion={reduceMotion}
        />
        <AuroraBlob
          className="right-[-12%] top-[10%] h-[30rem] w-[30rem] bg-accent/15"
          drift={{ x: [0, -50, 0], y: [0, 60, 0] }}
          reduceMotion={reduceMotion}
        />
        <AuroraBlob
          className="bottom-[-25%] left-[30%] h-[26rem] w-[26rem] bg-gold/10"
          drift={{ x: [0, 30, 0], y: [0, -40, 0] }}
          reduceMotion={reduceMotion}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-base"
        />

        <div className="relative z-10 mx-auto max-w-3xl px-6 py-24 text-center">
          <motion.p
            initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="text-xs font-medium tracking-[0.4em] text-gold"
          >
            THE PREMIUM HOME OF CINEMA
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
            className="mt-6 bg-gradient-to-b from-ink via-ink to-gold/80 bg-clip-text font-display text-6xl font-bold tracking-[0.08em] text-transparent sm:text-7xl md:text-8xl"
          >
            CINEMORA
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mx-auto mt-8 h-px w-24 bg-gradient-to-r from-transparent via-gold to-transparent"
          />

          <motion.p
            initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
            className="mx-auto mt-8 max-w-xl text-balance text-base leading-relaxed text-muted sm:text-lg"
          >
            Discover films and series. Build your library. Watch what is yours — beautifully,
            legally, without compromise.
          </motion.p>
        </div>
      </section>

      {/* Pillars */}
      <section aria-label="What CINEMORA offers" className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {pillars.map((pillar, index) => (
            <motion.article
              key={pillar.title}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: index * 0.08, ease: 'easeOut' }}
              className="rounded-xl border border-white/5 bg-card/70 p-7 backdrop-blur-sm transition-colors duration-300 hover:border-gold/20"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-gold/25 bg-surface text-gold shadow-gold">
                <pillar.icon className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-5 font-display text-lg font-bold tracking-wide text-ink">
                {pillar.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{pillar.text}</p>
            </motion.article>
          ))}
        </div>

        <p className="mt-14 text-center text-xs tracking-wide text-muted/70">
          Phase 1 of 8 — foundation laid. The curtain rises with the live movie catalog in Phase 2.
        </p>
      </section>
    </div>
  );
}
