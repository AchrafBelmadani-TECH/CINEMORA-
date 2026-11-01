import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { ApiError } from '@/services/apiClient';
import userEvent from '@testing-library/user-event';
import { LoginPage, RegisterPage } from './LoginPage';
import { useAuthStore } from '@/stores/authStore';
import { testProviders } from '@/test/testProviders';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  me: vi.fn(),
  listProfiles: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  createProfile: vi.fn(),
  updateProfile: vi.fn(),
  deleteProfile: vi.fn(),
  activateProfile: vi.fn(),
}));

vi.mock('@/services/authApi', () => ({
  authApi: {
    login: (...a: unknown[]) => mocks.login(...(a as [])),
    register: (...a: unknown[]) => mocks.register(...(a as [])),
    me: (...a: unknown[]) => mocks.me(...(a as [])),
    listProfiles: (...a: unknown[]) => mocks.listProfiles(...(a as [])),
    logout: (...a: unknown[]) => mocks.logout(...(a as [])),
    refresh: (...a: unknown[]) => mocks.refresh(...(a as [])),
    createProfile: (...a: unknown[]) => mocks.createProfile(...(a as [])),
    updateProfile: (...a: unknown[]) => mocks.updateProfile(...(a as [])),
    deleteProfile: (...a: unknown[]) => mocks.deleteProfile(...(a as [])),
    activateProfile: (...a: unknown[]) => mocks.activateProfile(...(a as [])),
  },
  AVATAR_PRESETS: ['aurora', 'nova', 'ember'],
  bindSessionHandlers: vi.fn(() => () => {}),
  setAccessToken: vi.fn(),
}));

function resetStore() {
  useAuthStore.setState({ status: 'unauthenticated', user: null, profile: null, profiles: [] });
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('submits credentials and navigates home on success', async () => {
    const user = userEvent.setup();
    const { container } = render(
      testProviders(
        <>
          <LoginPage />
          <Routes>
            <Route path="/" element={<div>Landing</div>} />
          </Routes>
        </>,
        { route: '/login' },
      ),
    );

    await user.type(screen.getByLabelText('Email'), 'ada@cinemora.test');
    await user.type(screen.getByLabelText('Password'), 'Password123');
    mocks.login.mockResolvedValueOnce({
      user: { id: 'u1', email: 'ada@cinemora.test', displayName: 'Ada', role: 'USER' },
      profile: { id: 'p1', name: 'Ada', avatarKey: 'aurora' },
      accessToken: 't',
    });
    mocks.listProfiles.mockResolvedValueOnce({ profiles: [] });

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith({ email: 'ada@cinemora.test', password: 'Password123' }));
    await waitFor(() => expect(screen.getByText('Landing')).toBeInTheDocument());
    void container;
  });

  it('surfaces server errors (invalid credentials) in the alert region', async () => {
    const user = userEvent.setup();
    render(testProviders(<LoginPage />, { route: '/login' }));

    await user.type(screen.getByLabelText('Email'), 'ada@cinemora.test');
    await user.type(screen.getByLabelText('Password'), 'WrongPassword1');
    mocks.login.mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', 'Invalid email or password'));

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid email or password/i);
  });

  it('links to the register page', () => {
    render(testProviders(<LoginPage />, { route: '/login' }));
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/register');
  });
});

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('validates password guidance client-side and submits valid input', async () => {
    const user = userEvent.setup();
    render(testProviders(<RegisterPage />, { route: '/register' }));

    await user.type(screen.getByLabelText('Display name'), 'Ada');
    await user.type(screen.getByLabelText('Email'), 'ada@cinemora.test');
    // browser-level minLength blocks submit for the short password; verify the hint exists
    expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Password'), 'Password123');
    mocks.register.mockResolvedValueOnce({
      user: { id: 'u1', email: 'ada@cinemora.test', displayName: 'Ada', role: 'USER' },
      profile: { id: 'p1', name: 'Ada', avatarKey: 'aurora' },
      accessToken: 't',
    });
    mocks.listProfiles.mockResolvedValueOnce({ profiles: [] });

    await user.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() =>
      expect(mocks.register).toHaveBeenCalledWith({
        email: 'ada@cinemora.test',
        password: 'Password123',
        displayName: 'Ada',
      }),
    );
  });

  it('surfaces validation details from the server', async () => {
    const user = userEvent.setup();
    render(testProviders(<RegisterPage />, { route: '/register' }));

    await user.type(screen.getByLabelText('Display name'), 'A');
    await user.type(screen.getByLabelText('Email'), 'ada@cinemora.test');
    await user.type(screen.getByLabelText('Password'), 'Password123');

    mocks.register.mockRejectedValueOnce(
      new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', [
        { message: 'Display name must be at least 2 characters' },
      ]),
    );

    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/display name must be at least 2 characters/i);
  });
});
