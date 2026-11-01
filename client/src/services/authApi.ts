import { apiClient, setAccessToken, onSessionRefreshed, onSessionExpired } from './apiClient';
import type { SessionProfile, SessionUser } from '@/stores/authStore';

export interface AuthSession {
  user: SessionUser;
  profile: SessionProfile;
  accessToken: string;
}

export interface ProfileDto {
  id: string;
  name: string;
  avatarKey: string;
}

export interface PreferencesDto {
  profileId: string;
  preferredLanguage: string;
  subtitleLanguage: string | null;
  autoplayNext: boolean;
}

export const AVATAR_PRESETS = [
  'aurora', 'nova', 'ember', 'frost', 'sage', 'royal',
  'dawn', 'dusk', 'jade', 'coral', 'mono', 'star',
] as const;

export const authApi = {
  async register(input: { email: string; password: string; displayName: string }): Promise<AuthSession> {
    return apiClient.post<AuthSession>('/auth/register', input);
  },

  async login(input: { email: string; password: string }): Promise<AuthSession> {
    return apiClient.post<AuthSession>('/auth/login', input);
  },

  /** Silent refresh — the httpOnly cookie carries the credential. */
  async refresh(): Promise<AuthSession> {
    return apiClient.post<AuthSession>('/auth/refresh');
  },

  async logout(): Promise<void> {
    await apiClient.post<void>('/auth/logout');
  },

  async me(): Promise<{ user: SessionUser & { profiles: ProfileDto[] } }> {
    return apiClient.get<{ user: SessionUser & { profiles: ProfileDto[] } }>('/auth/me');
  },

  async listProfiles(): Promise<{ profiles: ProfileDto[] }> {
    return apiClient.get<{ profiles: ProfileDto[] }>('/profiles');
  },

  async createProfile(input: { name: string; avatarKey: string }): Promise<{ profile: ProfileDto }> {
    return apiClient.post<{ profile: ProfileDto }>('/profiles', input);
  },

  async updateProfile(id: string, patch: { name?: string; avatarKey?: string }): Promise<{ profile: ProfileDto }> {
    return apiClient.patch<{ profile: ProfileDto }>(`/profiles/${id}`, patch);
  },

  async deleteProfile(id: string): Promise<void> {
    return apiClient.delete<void>(`/profiles/${id}`);
  },

  /** Switch active profile — re-issues the session bound to that profile. */
  async activateProfile(id: string): Promise<AuthSession> {
    return apiClient.post<AuthSession>(`/profiles/${id}/activate`);
  },
};

// Session token plumbing: the api client stores the access token in memory
// only, and the auth store reacts to refresh/expiry events.
export function bindSessionHandlers(
  onRefreshed: (session: AuthSession) => void,
  onExpired: () => void,
): () => void {
  const refreshed = onSessionRefreshed((session) => onRefreshed(session as AuthSession));
  const expired = onSessionExpired(() => onExpired());
  return () => {
    refreshed();
    expired();
  };
}

export { setAccessToken };
