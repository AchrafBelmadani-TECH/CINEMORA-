import { AnimatePresence } from 'framer-motion';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { PageTransition } from '@/components/layout/PageTransition';
import { HomePage } from '@/pages/HomePage';
import { MoviesPage } from '@/pages/catalog/MoviesPage';
import { SeriesPage } from '@/pages/catalog/SeriesPage';
import { GenresPage } from '@/pages/catalog/GenresPage';
import { GenrePage } from '@/pages/catalog/GenrePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/**
 * Application shell. Routes appear as their phase lands (ROADMAP.md) —
 * Phase 2 adds the live catalog pages. Detail pages arrive in Phase 3.
 */
export default function App() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-base pt-16">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:text-ink"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main-content" className="flex-1">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route
              path="/"
              element={
                <PageTransition>
                  <HomePage />
                </PageTransition>
              }
            />
            <Route
              path="/movies"
              element={
                <PageTransition>
                  <MoviesPage />
                </PageTransition>
              }
            />
            <Route
              path="/series"
              element={
                <PageTransition>
                  <SeriesPage />
                </PageTransition>
              }
            />
            <Route
              path="/genres"
              element={
                <PageTransition>
                  <GenresPage />
                </PageTransition>
              }
            />
            <Route
              path="/genre/:genreId"
              element={
                <PageTransition>
                  <GenrePage />
                </PageTransition>
              }
            />
            <Route
              path="*"
              element={
                <PageTransition>
                  <NotFoundPage />
                </PageTransition>
              }
            />
          </Routes>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}
