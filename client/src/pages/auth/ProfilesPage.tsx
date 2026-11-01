import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { AvatarCircle } from '@/components/auth/AvatarCircle';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Spinner } from '@/components/ui/Spinner';
import { AVATAR_PRESETS } from '@/services/authApi';
import { cn } from '@/lib/cn';

/**
 * /profiles — cinematic profile selection + management (max 5 per account).
 * Selecting a profile activates it and re-issues the session.
 */
export function ProfilesPage() {
  const navigate = useNavigate();
  const { profile: activeProfile, profiles, switchProfile, createProfile, updateProfile, deleteProfile } = useAuthStore();
  const [managing, setManaging] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAvatar, setNewAvatar] = useState<string>('aurora');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  async function onSelect(profileId: string) {
    setError(null);
    setBusy(true);
    try {
      await switchProfile(profileId);
      navigate('/');
    } catch {
      setError('Could not switch profile. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    if (newName.trim().length === 0) return;
    setError(null);
    setBusy(true);
    try {
      await createProfile(newName.trim(), newAvatar);
      setAdding(false);
      setNewName('');
      setNewAvatar('aurora');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the profile.');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(profileId: string) {
    setError(null);
    try {
      await deleteProfile(profileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the profile.');
    }
  }

  async function onRename(profileId: string) {
    if (editName.trim().length === 0) return;
    try {
      await updateProfile(profileId, { name: editName.trim() });
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename the profile.');
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col items-center justify-center px-4 py-16">
      <h1 className="font-display text-3xl font-bold tracking-wide text-ink">Who's watching?</h1>
      <p className="mt-2 text-sm text-muted">Choose a profile — each keeps its own library and preferences.</p>

      {error && (
        <p role="alert" className="mt-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="mt-10 flex flex-wrap items-start justify-center gap-6 sm:gap-8">
        {profiles.map((p) => {
          const isActive = activeProfile?.id === p.id;
          const isEditing = editingId === p.id;
          return (
            <div key={p.id} className="flex w-32 flex-col items-center sm:w-36">
              <button
                type="button"
                onClick={() => (managing ? undefined : onSelect(p.id))}
                disabled={busy}
                className={cn(
                  'group relative rounded-full transition-all duration-300',
                  !managing && 'hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                )}
                aria-label={managing ? undefined : `Continue as ${p.name}`}
              >
                <AvatarCircle
                  avatarKey={p.avatarKey}
                  name={p.name}
                  size="xl"
                  className={cn(
                    'ring-2 transition-all',
                    isActive ? 'ring-gold' : 'ring-transparent group-hover:ring-white/30',
                  )}
                />
                {isActive && !managing && (
                  <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border border-base bg-gold text-base">
                    <Check className="h-4 w-4" aria-hidden />
                  </span>
                )}
              </button>

              {isEditing ? (
                <form
                  className="mt-3 w-full"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void onRename(p.id);
                  }}
                >
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={25}
                    aria-label="Profile name"
                    className="h-9 w-full rounded-md border border-white/10 bg-surface px-2 text-center text-sm text-ink focus:border-gold/40 focus:outline-none"
                  />
                  <div className="mt-2 flex justify-center gap-2">
                    <button type="submit" aria-label="Save name" className="text-xs font-medium text-gold hover:underline">
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="text-xs text-muted hover:text-ink"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="mt-3 truncate text-center text-sm font-semibold text-ink" title={p.name}>
                    {p.name}
                  </p>
                  {managing && (
                    <div className="mt-2 flex gap-3">
                      <button
                        type="button"
                        aria-label={`Rename ${p.name}`}
                        onClick={() => {
                          setEditingId(p.id);
                          setEditName(p.name);
                        }}
                        className="text-muted transition-colors hover:text-gold"
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${p.name}`}
                        onClick={() => void onDelete(p.id)}
                        className="text-muted transition-colors hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {profiles.length < 5 && !adding && (
          <div className="flex w-32 flex-col items-center sm:w-36">
            <button
              type="button"
              onClick={() => setAdding(true)}
              aria-label="Add a profile"
              className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-dashed border-white/20 text-muted transition-all duration-300 hover:border-gold/50 hover:text-gold sm:h-32 sm:w-32"
            >
              <Plus className="h-10 w-10" aria-hidden />
            </button>
            <p className="mt-3 text-sm font-semibold text-muted">Add profile</p>
          </div>
        )}

        {adding && (
          <form onSubmit={onAdd} className="w-64 rounded-xl border border-white/10 bg-card/80 p-5 backdrop-blur">
            <label htmlFor="new-profile-name" className="mb-1.5 block text-xs font-medium text-muted">
              Profile name
            </label>
            <input
              id="new-profile-name"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={25}
              required
              className="h-10 w-full rounded-lg border border-white/10 bg-surface px-3 text-sm text-ink focus:border-gold/40 focus:outline-none"
              placeholder="Up to 25 characters"
            />
            <p className="mb-2 mt-4 text-xs font-medium text-muted">Avatar</p>
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_PRESETS.map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-label={`Avatar ${key}`}
                  aria-pressed={newAvatar === key}
                  onClick={() => setNewAvatar(key)}
                  className={cn(
                    'rounded-full ring-2 transition-all',
                    newAvatar === key ? 'ring-gold' : 'ring-transparent hover:ring-white/30',
                  )}
                >
                  <AvatarCircle avatarKey={key} name={newName || 'A'} size="sm" />
                </button>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              <Button type="submit" size="sm" loading={busy} className="flex-1">
                Create
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>

      <Button
        variant="secondary"
        size="sm"
        className="mt-12"
        onClick={() => {
          setManaging((m) => !m);
          setAdding(false);
          setEditingId(null);
        }}
      >
        {managing ? 'Done' : 'Manage profiles'}
      </Button>
    </div>
  );
}

/** Loading screen shown while the session bootstrap runs. */
export function AuthLoadingScreen() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner label="Preparing your session" />
    </div>
  );
}

/** Error fallback for a failed profile load (kept simple). */
export function ProfilesErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <ErrorState title="Could not load profiles" onRetry={onRetry} />
    </div>
  );
}
