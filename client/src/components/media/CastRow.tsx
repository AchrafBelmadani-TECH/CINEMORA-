import { Link } from 'react-router-dom';
import { User } from 'lucide-react';
import { profileUrl } from '@/lib/tmdbImage';
import type { CastMember } from '@/types/catalog';

export interface CastRowProps {
  cast: CastMember[];
}

/** Horizontal cast strip; each member links to their person page. */
export function CastRow({ cast }: CastRowProps) {
  if (cast.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Top cast — use arrow keys to scroll"
      tabIndex={0}
      className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {cast.slice(0, 16).map((member) => {
        const url = profileUrl(member.profilePath, 'w185');
        return (
          <Link
            key={member.personId}
            to={`/person/${member.personId}`}
            className="group w-24 shrink-0 text-center sm:w-28"
          >
            <span className="block overflow-hidden rounded-full border border-white/10 bg-card transition-all duration-300 group-hover:border-gold/40 group-hover:shadow-gold">
              {url ? (
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width={185}
                  height={185}
                  className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <span className="flex aspect-square w-full items-center justify-center bg-surface text-muted/50">
                  <User className="h-8 w-8" aria-hidden />
                </span>
              )}
            </span>
            <span className="mt-2 block truncate text-xs font-semibold text-ink" title={member.name}>
              {member.name}
            </span>
            {member.character && (
              <span className="block truncate text-[11px] text-muted" title={member.character}>
                {member.character}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
