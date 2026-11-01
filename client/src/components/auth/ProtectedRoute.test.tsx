import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { GuestOnlyRoute, ProtectedRoute } from './ProtectedRoute';
import { testProviders } from '@/test/testProviders';

// The store is mocked outright: the gate components only read `status`,
// and this keeps the test free of the real store/api chain.
const authState = vi.hoisted(() => ({
  status: 'unauthenticated' as 'loading' | 'authenticated' | 'unauthenticated',
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { status: typeof authState.status }) => unknown) =>
    selector({ status: authState.status }),
}));

/**
 * Mirrors the real app's route map: /login renders the LOGIN PAGE (not the
 * gate itself) — otherwise a redirect to /login would re-render the gate and
 * loop forever.
 */
function renderGates(gateUi: React.ReactElement) {
  return render(
    testProviders(
      <Routes>
        <Route path="/login" element={<div>Sign in page</div>} />
        <Route path="/protected" element={gateUi} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>,
      { route: '/protected' },
    ),
  );
}

function renderGuestPage(guestUi: React.ReactElement) {
  return render(
    testProviders(
      <Routes>
        <Route path="/login" element={guestUi} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>,
      { route: '/login' },
    ),
  );
}

function setStatus(status: 'loading' | 'authenticated' | 'unauthenticated') {
  authState.status = status;
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    setStatus('unauthenticated');
  });

  it('shows a loading state while the session is being restored', () => {
    setStatus('loading');
    renderGates(
      <ProtectedRoute>
        <div>Secret</div>
      </ProtectedRoute>,
    );
    expect(screen.queryByText('Secret')).toBeNull();
  });

  it('redirects unauthenticated users to the sign-in page', () => {
    setStatus('unauthenticated');
    renderGates(
      <ProtectedRoute>
        <div>Secret</div>
      </ProtectedRoute>,
    );
    expect(screen.queryByText('Secret')).toBeNull();
    expect(screen.getByText('Sign in page')).toBeInTheDocument();
  });

  it('renders children for authenticated users', () => {
    setStatus('authenticated');
    renderGates(
      <ProtectedRoute>
        <div>Secret</div>
      </ProtectedRoute>,
    );
    expect(screen.getByText('Secret')).toBeInTheDocument();
  });
});

describe('GuestOnlyRoute', () => {
  beforeEach(() => {
    setStatus('unauthenticated');
  });

  it('renders the form for guests', () => {
    setStatus('unauthenticated');
    renderGuestPage(
      <GuestOnlyRoute>
        <div>Sign in form</div>
      </GuestOnlyRoute>,
    );
    expect(screen.getByText('Sign in form')).toBeInTheDocument();
  });

  it('redirects authenticated users away from guest pages', () => {
    setStatus('authenticated');
    renderGuestPage(
      <GuestOnlyRoute>
        <div>Sign in form</div>
      </GuestOnlyRoute>,
    );
    expect(screen.queryByText('Sign in form')).toBeNull();
    expect(screen.getByText('Home')).toBeInTheDocument();
  });
});
