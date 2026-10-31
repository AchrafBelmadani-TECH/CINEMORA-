import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Play, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface TrailerModalProps {
  videoKey: string | null;
  videoName?: string;
  onClose: () => void;
  className?: string;
}

/**
 * YouTube trailer modal — the only "video" CINEMORA plays from TMDB.
 * Keys are metadata-indexed official trailers; nothing is streamed from TMDB.
 */
export function TrailerModal({ videoKey, videoName, onClose, className }: TrailerModalProps) {
  const reduceMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!videoKey) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [videoKey, onClose]);

  return (
    <AnimatePresence>
      {videoKey && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          className={cn('fixed inset-0 z-[70] flex items-center justify-center bg-base/90 p-4 backdrop-blur-sm', className)}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={videoName ? `Trailer — ${videoName}` : 'Trailer'}
        >
          <motion.div
            initial={reduceMotion ? false : { scale: 0.94, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={reduceMotion ? undefined : { scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="truncate pr-4 text-sm font-medium text-ink">
                <Play className="mr-2 inline h-4 w-4 text-gold" aria-hidden />
                {videoName ?? 'Official trailer'}
              </p>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close trailer"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-card text-ink transition-colors hover:bg-white/10"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-white/10 shadow-glow">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1&rel=0`}
                title={videoName ?? 'Trailer'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
