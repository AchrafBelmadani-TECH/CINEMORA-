import { create } from 'zustand';
import {
  authApi,
  setAccessToken,
  bindSessionHandlers,
  type ProfileDto,
} from '@/services/authApi';

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: 'USER' | 'ADMIN';
}

export interface SessionProfile {
  id: string;
  name: string;
  avatarKey: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: SessionUser | null;
  profile: SessionProfile | null;
  profiles: ProfileDto[];
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfiles: () => Promise<void>;
  switchProfile: (profileId: string) => Promise<void>;
  createProfile: (name: string, avatarKey: string) => Promise<void>;
  updateProfile: (profileId: string, patch: { name?: string; avatarKey?: string }) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
}

function applySession(session: { user: SessionUser; profile: SessionProfile; accessToken: string }) {
  setAccessToken(session.accessToken);
  return {
    status: 'authenticated' as const,
    user: session.user,
    profile: session.profile,
  };
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Silent refresh / expiry wiring — one-time side effect on store creation.
  bindSessionHandlers(
    (session) => set(applySession(session)),
    () => set({ status: 'unauthenticated', user: null, profile: null, profiles: [] }),
  );

  return {
    status: 'loading',
    user: null,
    profile: null,
    profiles: [],

    /** Restores the session from the refresh cookie on app boot. */
    async bootstrap() {
      try {
        const session = await authApi.refresh();
        set(applySession(session));
        await get().refreshProfiles();
      } catch {
        setAccessToken(null);
        set({ status: 'unauthenticated', user: null, profile: null, profiles: [] });
      }
    },

    async login(email, password) {
      const session = await authApi.login({ email, password });
      set(applySession(session));
      await get().refreshProfiles();
    },

    async register(email, password, displayName) {
      const session = await authApi.register({ email, password, displayName });
      set(applySession(session));
      await get().refreshProfiles();
    },

    async logout() {
      // The local session always clears — a failed network call must not
      // leave the user trapped in a signed-in UI (errors surface nowhere:
      // logout is intentionally infallible from the caller's perspective).
      try {
        await authApi.logout();
      } catch {
        // ignored by design
      } finally {
        setAccessToken(null);
        set({ status: 'unauthenticated', user: null, profile: null, profiles: [] });
      }
    },

    async refreshProfiles() {
      const { profiles } = await authApi.listProfiles();
      set({ profiles });
    },

    async switchProfile(profileId) {
      const session = await authApi.activateProfile(profileId);
      set(applySession(session));
    },

    async createProfile(name, avatarKey) {
      const { profile } = await authApi.createProfile({ name, avatarKey });
      set((state) => ({ profiles: [...state.profiles, profile] }));
    },

    async updateProfile(profileId, patch) {
      const { profile } = await authApi.updateProfile(profileId, patch);
      set((state) => ({
        profiles: state.profiles.map((p) => (p.id === profileId ? profile : p)),
        profile: state.profile?.id === profileId ? profile : state.profile,
      }));
    },

    async deleteProfile(profileId) {
      await authApi.deleteProfile(profileId);
      set((state) => ({
        profiles: state.profiles.filter((p) => p.id !== profileId),
        // the backend keeps the session on a valid profile; resync identity
        profile: state.profile?.id === profileId ? null : state.profile,
      }));
      const { user } = await authApi.me();
      set((state) => ({
        user,
        profiles: user.profiles,
        profile:
          state.profile ??
          user.profiles.find((p) => p.id === state.profile?.id) ??
          user.profiles[0] ??
          null,
      }));
    },
  };
});
