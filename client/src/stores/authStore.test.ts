import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './authStore';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
  listProfiles: vi.fn(),
  createProfile: vi.fn(),
  updateProfile: vi.fn(),
  deleteProfile: vi.fn(),
  activateProfile: vi.fn(),
}));

vi.mock('@/services/authApi', () => ({
  authApi: {
    refresh: (...a: unknown[]) => mocks.refresh(...(a as [])),
    login: (...a: unknown[]) => mocks.login(...(a as [])),
    register: (...a: unknown[]) => mocks.register(...(a as [])),
    logout: (...a: unknown[]) => mocks.logout(...(a as [])),
    me: (...a: unknown[]) => mocks.me(...(a as [])),
    listProfiles: (...a: unknown[]) => mocks.listProfiles(...(a as [])),
    createProfile: (...a: unknown[]) => mocks.createProfile(...(a as [])),
    updateProfile: (...a: unknown[]) => mocks.updateProfile(...(a as [])),
    deleteProfile: (...a: unknown[]) => mocks.deleteProfile(...(a as [])),
    activateProfile: (...a: unknown[]) => mocks.activateProfile(...(a as [])),
  },
  AVATAR_PRESETS: ['aurora', 'nova'],
  bindSessionHandlers: vi.fn(() => () => {}),
  setAccessToken: vi.fn(),
}));

const session = {
  user: { id: 'u1', email: 'a@b.c', displayName: 'Ada', role: 'USER' as const },
  profile: { id: 'p1', name: 'Ada', avatarKey: 'aurora' },
  accessToken: 'token-123',
};

describe('authStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      status: 'unauthenticated',
      user: null,
      profile: null,
      profiles: [],
    });
  });

  it('bootstraps from the refresh cookie and loads profiles', async () => {
    mocks.refresh.mockResolvedValueOnce(session);
    mocks.listProfiles.mockResolvedValueOnce({ profiles: [{ id: 'p1', name: 'Ada', avatarKey: 'aurora' }] });

    await useAuthStore.getState().bootstrap();

    const state = useAuthStore.getState();
    expect(state.status).toBe('authenticated');
    expect(state.user?.displayName).toBe('Ada');
    expect(state.profiles).toHaveLength(1);
  });

  it('ends unauthenticated when the silent refresh fails', async () => {
    mocks.refresh.mockRejectedValueOnce(new Error('no session'));
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('logs in and stores the session', async () => {
    mocks.login.mockResolvedValueOnce(session);
    mocks.listProfiles.mockResolvedValueOnce({ profiles: [] });

    await useAuthStore.getState().login('a@b.c', 'Password123');

    expect(mocks.login).toHaveBeenCalledWith({ email: 'a@b.c', password: 'Password123' });
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('logs out and clears the session even if the API call fails', async () => {
    useAuthStore.setState({ status: 'authenticated', user: session.user, profile: session.profile });
    mocks.logout.mockRejectedValueOnce(new Error('offline'));

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('switches the active profile', async () => {
    const other = { id: 'p2', name: 'Kids', avatarKey: 'coral' };
    mocks.activateProfile.mockResolvedValueOnce({
      ...session,
      profile: other,
    });

    await useAuthStore.getState().switchProfile('p2');

    expect(mocks.activateProfile).toHaveBeenCalledWith('p2');
    expect(useAuthStore.getState().profile?.name).toBe('Kids');
  });

  it('creates and deletes profiles', async () => {
    mocks.createProfile.mockResolvedValueOnce({ profile: { id: 'p3', name: 'New', avatarKey: 'jade' } });
    await useAuthStore.getState().createProfile('New', 'jade');
    expect(useAuthStore.getState().profiles.some((p) => p.id === 'p3')).toBe(true);

    mocks.deleteProfile.mockResolvedValueOnce(undefined);
    mocks.me.mockResolvedValueOnce({
      user: { ...session.user, profiles: [{ id: 'p1', name: 'Ada', avatarKey: 'aurora' }] },
    });
    useAuthStore.setState({ profiles: [{ id: 'p1', name: 'Ada', avatarKey: 'aurora' }, { id: 'p3', name: 'New', avatarKey: 'jade' }] });

    await useAuthStore.getState().deleteProfile('p3');
    expect(useAuthStore.getState().profiles).toHaveLength(1);
  });
});
