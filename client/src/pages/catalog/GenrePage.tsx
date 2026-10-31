import { useParams, useSearchParams } from 'react-router-dom';
import { CatalogBrowser } from './CatalogBrowser';
import { parsePageParam } from '@/lib/url';
import { useCatalogGenre, useGenres } from '@/hooks/useCatalog';
import type { MediaType } from '@/types/catalog';

/** /genre/:genreId?type=movie|tv — a genre's catalog, paginated in the URL. */
export function GenrePage() {
  const { genreId } = useParams<{ genreId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePageParam(searchParams.get('page'));
  const mediaType: MediaType = searchParams.get('type') === 'tv' ? 'tv' : 'movie';
  const id = Number.parseInt(genreId ?? '', 10);

  const genres = useGenres(mediaType);
  const query = useCatalogGenre(mediaType, Number.isNaN(id) ? 0 : id, page);
  const genreName = genres.data?.find((g) => g.id === id)?.name;

  return (
    <CatalogBrowser
      title={genreName ? `${genreName} ${mediaType === 'tv' ? 'Series' : 'Movies'}` : 'Browse by genre'}
      query={query}
      page={page}
      onPageChange={(p) => setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (p > 1) next.set('page', String(p));
        else next.delete('page');
        return next;
      })}
    />
  );
}
