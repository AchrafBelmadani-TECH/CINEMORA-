import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfilesPage } from './ProfilesPage';
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

const PROFILES = [
  { id: 'p1', name: 'Ada', avatarKey: 'aurora' },
  { id: 'p2', name: 'Kids', avatarKey: 'coral' },
];

describe('ProfilesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'u1', email: 'a@b.c', displayName: 'Ada', role: 'USER' },
      profile: PROFILES[0]!,
      profiles: PROFILES,
    });
  });

  it('renders profile cards with the active one marked', () => {
    render(testProviders(<ProfilesPage />, { route: '/profiles' }));

    expect(screen.getByRole('heading', { name: /who's watching/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue as Ada' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue as Kids' })).toBeInTheDocument();
  });

  it('activates a profile on click', async () => {
    const user = userEvent.setup();
    mocks.activateProfile.mockResolvedValueOnce({
      user: { id: 'u1', email: 'a@b.c', displayName: 'Ada', role: 'USER' },
      profile: PROFILES[1]!,
      accessToken: 't',
    });

    render(testProviders(<ProfilesPage />, { route: '/profiles' }));
    await user.click(screen.getByRole('button', { name: 'Continue as Kids' }));

    await waitFor(() => expect(mocks.activateProfile).toHaveBeenCalledWith('p2'));
  });

  it('creates a profile through the add form', async () => {
    const user = userEvent.setup();
    mocks.createProfile.mockResolvedValueOnce({ profile: { id: 'p3', name: 'New', avatarKey: 'nova' } });

    render(testProviders(<ProfilesPage />, { route: '/profiles' }));
    await user.click(screen.getByRole('button', { name: /add a profile/i }));
    await user.type(screen.getByLabelText('Profile name'), 'New');
    await user.click(screen.getByRole('button', { name: 'Avatar nova' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(mocks.createProfile).toHaveBeenCalledWith({ name: 'New', avatarKey: 'nova' }));
    expect(await screen.findByText('New')).toBeInTheDocument();
  });

  it('manage mode exposes rename and delete actions', async () => {
    const user = userEvent.setup();
    mocks.deleteProfile.mockResolvedValueOnce(undefined);
    mocks.me.mockResolvedValueOnce({ user: { id: 'u1', email: 'a@b.c', displayName: 'Ada', role: 'USER', profiles: [PROFILES[0]!] } });

    render(testProviders(<ProfilesPage />, { route: '/profiles' }));
    await user.click(screen.getByRole('button', { name: /manage profiles/i }));

    await user.click(screen.getByRole('button', { name: 'Delete Kids' }));
    await waitFor(() => expect(mocks.deleteProfile).toHaveBeenCalledWith('p2'));
  });

  it('blocks adding a 6th profile by hiding the add card', () => {
    useAuthStore.setState({
      profiles: [...PROFILES, { id: 'p3', name: 'Three', avatarKey: 'jade' }, { id: 'p4', name: 'Four', avatarKey: 'mono' }, { id: 'p5', name: 'Five', avatarKey: 'star' }],
    });

    render(testProviders(<ProfilesPage />, { route: '/profiles' }));
    expect(screen.queryByRole('button', { name: /add a profile/i })).toBeNull();
  });
});
