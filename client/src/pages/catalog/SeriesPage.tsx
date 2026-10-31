import { useSearchParams } from 'react-router-dom';
import { CatalogBrowser } from './CatalogBrowser';
import { parsePageParam } from '@/lib/url';
import { useCatalogList, useGenres } from '@/hooks/useCatalog';

/** /series — the popular-TV catalog, paginated in the URL. */
export function SeriesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePageParam(searchParams.get('page'));
  const query = useCatalogList({ mediaType: 'tv', kind: 'popular', page });
  const genres = useGenres('tv');

  return (
    <CatalogBrowser
      title="TV Series"
      query={query}
      page={page}
      onPageChange={(p) => setSearchParams(p > 1 ? { page: String(p) } : {})}
      genreNameFor={(id) => genres.data?.find((g) => g.id === id)?.name}
    />
  );
}
