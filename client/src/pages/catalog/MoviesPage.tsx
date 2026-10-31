import { useSearchParams } from 'react-router-dom';
import { CatalogBrowser } from './CatalogBrowser';
import { parsePageParam } from '@/lib/url';
import { useCatalogList, useGenres } from '@/hooks/useCatalog';

/** /movies — the popular-movies catalog, paginated in the URL. */
export function MoviesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePageParam(searchParams.get('page'));
  const query = useCatalogList({ mediaType: 'movie', kind: 'popular', page });
  const genres = useGenres('movie');

  return (
    <CatalogBrowser
      title="Movies"
      query={query}
      page={page}
      onPageChange={(p) => setSearchParams(p > 1 ? { page: String(p) } : {})}
      genreNameFor={(id) => genres.data?.find((g) => g.id === id)?.name}
    />
  );
}
