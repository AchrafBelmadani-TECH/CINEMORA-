import { Link, useParams } from 'react-router-dom';
import { Cake, MapPin } from 'lucide-react';
import { usePerson } from '@/hooks/useCatalog';
import { profileUrl } from '@/lib/tmdbImage';
import { formatDate } from '@/lib/formatters';
import { MediaCard } from '@/components/media/MediaCard';
import { DetailSkeleton } from '@/components/media/skeletons';
import { ErrorState } from '@/components/ui/ErrorState';
import { User } from 'lucide-react';

/** Person page: profile, bio, personal facts, known-for grid and filmography. */
export function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const personId = id ? Number.parseInt(id, 10) : undefined;
  const { data, isPending, isError, refetch } = usePerson(personId);

  if (isPending) return <DetailSkeleton />;

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <ErrorState
          title="We couldn't find this person"
          message="They may not exist, or the catalog service is unreachable right now."
          onRetry={refetch}
        />
        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-gold hover:underline">Back to home</Link>
        </div>
      </div>
    );
  }

  const profile = profileUrl(data.profilePath, 'w185');
  const lifespan =
    data.birthday && data.deathday
      ? `${formatDate(data.birthday)} — ${formatDate(data.deathday)}`
      : data.birthday
        ? `Born ${formatDate(data.birthday)}`
        : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-8 sm:flex-row">
        <div className="w-40 shrink-0 sm:w-52">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-card shadow-glow">
            {profile ? (
              <img src={profile} alt={`${data.name} profile`} width={185} height={278} className="w-full" />
            ) : (
              <div aria-hidden className="flex aspect-2/3 items-center justify-center bg-surface text-muted/40">
                <User className="h-12 w-12" />
              </div>
            )}
          </div>

          <dl className="mt-5 space-y-3 text-xs text-muted">
            {data.knownForDepartment && (
              <div>
                <dt className="font-semibold uppercase tracking-wider text-ink/70">Known for</dt>
                <dd className="mt-0.5">{data.knownForDepartment}</dd>
              </div>
            )}
            {lifespan && (
              <div className="flex items-start gap-1.5">
                <Cake className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <dd>{lifespan}</dd>
              </div>
            )}
            {data.placeOfBirth && (
              <div className="flex items-start gap-1.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <dd>{data.placeOfBirth}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-bold tracking-wide text-ink sm:text-4xl">{data.name}</h1>
          {data.biography && (
            <section aria-label="Biography" className="mt-5">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink/70">Biography</h2>
              <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-muted">{data.biography}</p>
            </section>
          )}

          {data.knownFor.length > 0 && (
            <section aria-label="Known for" className="mt-10">
              <h2 className="mb-4 font-display text-lg font-bold tracking-wide text-ink">Known for</h2>
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                {data.knownFor.slice(0, 12).map((item) => (
                  <MediaCard key={`${item.mediaType}-${item.tmdbId}`} item={item} fluid />
                ))}
              </div>
            </section>
          )}

          {data.filmography.length > 0 && (
            <section aria-label="Filmography" className="mt-10">
              <h2 className="mb-4 font-display text-lg font-bold tracking-wide text-ink">
                Filmography <span className="text-sm font-normal text-muted">({data.filmography.length})</span>
              </h2>
              <ol className="max-w-3xl space-y-1.5">
                {data.filmography.slice(0, 40).map((credit) => (
                  <li key={`${credit.mediaType}-${credit.tmdbId}`} className="flex items-baseline gap-3 border-b border-white/5 pb-1.5 text-sm">
                    <span className="w-12 shrink-0 text-muted">{credit.releaseDate?.slice(0, 4) ?? '—'}</span>
                    <Link to={`/${credit.mediaType}/${credit.tmdbId}`} className="truncate text-ink transition-colors hover:text-gold">
                      {credit.title}
                    </Link>
                    <span className="ml-auto shrink-0 text-xs capitalize text-muted">{credit.mediaType === 'tv' ? 'Series' : 'Movie'}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
