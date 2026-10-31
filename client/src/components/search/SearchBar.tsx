import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Search, Tv, User, X } from 'lucide-react';
import { useSearch } from '@/hooks/useCatalog';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { posterUrl, profileUrl } from '@/lib/tmdbImage';
import { formatYear } from '@/lib/formatters';
import { isPerson, type PersonSearchItem, type SearchResultItem } from '@/types/catalog';
import { cn } from '@/lib/cn';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

function SuggestionRow({ item, onPick }: { item: SearchResultItem; onPick: () => void }) {
  if (isPerson(item)) {
    return <PersonSuggestion item={item} onPick={onPick} />;
  }
  const poster = posterUrl(item.posterPath, 'w185');
  return (
    <button
      type="button"
      role="option"
      aria-selected={false}
      onClick={onPick}
      className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-white/5"
    >
      <span className="flex h-12 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-surface text-muted/50">
        {poster ? (
          <img src={poster} alt="" width={92} height={138} className="h-full w-full object-cover" />
        ) : (
          item.mediaType === 'tv' ? <Tv className="h-4 w-4" aria-hidden /> : <Film className="h-4 w-4" aria-hidden />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
        <span className="block text-xs text-muted">
          {[item.mediaType === 'tv' ? 'Series' : 'Movie', formatYear(item.releaseDate)].filter(Boolean).join(' · ')}
        </span>
      </span>
    </button>
  );
}

function PersonSuggestion({ item, onPick }: { item: PersonSearchItem; onPick: () => void }) {
  const profile = profileUrl(item.profilePath, 'w185');
  return (
    <button
      type="button"
      role="option"
      aria-selected={false}
      onClick={onPick}
      className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-white/5"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface text-muted/50">
        {profile ? (
          <img src={profile} alt="" width={92} height={92} className="h-full w-full object-cover" />
        ) : (
          <User className="h-4 w-4" aria-hidden />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-ink">{item.name}</span>
        <span className="block text-xs text-muted">{item.knownForDepartment ?? 'Person'}</span>
      </span>
    </button>
  );
}

/**
 * Navbar search with 300 ms debounced suggestions and Enter-to-results.
 * Renders a compact icon on small screens.
 */
export function SearchBar() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const navigate = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);

  const enabled = open && debounced.length >= MIN_QUERY_LENGTH;
  const { data, isFetching } = useSearch(enabled ? debounced : undefined);
  const suggestions = data?.items.slice(0, 6) ?? [];

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  function submit(raw: string) {
    const q = raw.trim();
    if (q.length === 0) return;
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  function pick(item: SearchResultItem) {
    setOpen(false);
    setQuery('');
    if (isPerson(item)) {
      navigate(`/person/${item.personId}`);
    } else {
      navigate(`/${item.mediaType}/${item.tmdbId}`);
    }
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-72">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls="search-suggestions"
          aria-label="Search movies, series and people"
          placeholder="Search CINEMORA"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit(query);
            if (e.key === 'Escape') setOpen(false);
          }}
          className={cn(
            'h-10 w-full rounded-lg border border-white/10 bg-card/80 pl-9 pr-8 text-sm text-ink placeholder:text-muted/60',
            'transition-colors focus:border-gold/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60',
          )}
        />
        {query.length > 0 && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery('');
              setOpen(false);
            }}
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-ink"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>

      {open && debounced.length >= MIN_QUERY_LENGTH && (
        <div
          id="search-suggestions"
          role="listbox"
          aria-label="Search suggestions"
          className="absolute right-0 top-12 z-50 w-full min-w-72 overflow-hidden rounded-xl border border-white/10 bg-surface/95 shadow-glow backdrop-blur-md"
        >
          {isFetching && suggestions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted" role="status">
              Searching…
            </p>
          ) : suggestions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">No matches for “{debounced}”.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {suggestions.map((item) => (
                <li key={item.mediaType === 'person' ? `p-${item.personId}` : `${item.mediaType}-${item.tmdbId}`}>
                  <SuggestionRow item={item} onPick={() => pick(item)} />
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => submit(debounced)}
                  className="w-full px-4 py-2.5 text-left text-xs font-medium text-gold hover:bg-white/5"
                >
                  View all results for “{debounced}”
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
