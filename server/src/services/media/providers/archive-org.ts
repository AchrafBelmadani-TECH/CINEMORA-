/**
 * Source provider abstraction (ADR: multi-source streaming expansion).
 * Each provider discovers, verifies and registers playable content
 * from a legally authorized origin. Providers never fabricate URLs —
 * every source URL is probed live before registration.
 */

export interface DiscoveredSource {
  /** The direct playback URL (MP4, HLS, etc.). */
  url: string;
  /** Human-readable source title (from the provider's metadata). */
  title: string;
  /** Release year if known. */
  year?: string;
  /** Provider identifier (e.g. 'archive.org', 'wikimedia'). */
  provider: string;
  /** License type. */
  licenseType: 'PUBLIC_DOMAIN' | 'CREATIVE_COMMONS';
  /** URL or document id of the license evidence. */
  licenseRef: string;
  /** File size in bytes (for storage accounting). */
  sizeBytes?: number;
}

export interface SourceProvider {
  readonly id: string;
  readonly name: string;
  /** Searches the provider for playable content. Returns discovered sources. */
  search(query: string, limit?: number): Promise<DiscoveredSource[]>;
  /** Probes a URL to verify it's live and is a playable media file. */
  verify(url: string): Promise<boolean>;
}

// ── Archive.org provider ────────────────────────────────────────────────────

const IA_SEARCH_BASE = 'https://archive.org/advancedsearch.php';
const IA_METADATA_BASE = 'https://archive.org/metadata';
const IA_DOWNLOAD_BASE = 'https://archive.org/download';

interface IaSearchDoc {
  identifier: string;
  title?: string;
  year?: string;
  licenseurl?: string;
}

interface IaMetadataFile {
  name: string;
  format?: string;
  size?: string;
}

export class ArchiveOrgProvider {
  readonly id = 'archive.org';
  readonly name = 'Internet Archive';

  async search(collection: string, page: number, rows: number): Promise<DiscoveredSource[]> {
    const url = `${IA_SEARCH_BASE}?q=collection%3A${collection}+AND+format%3AMPEG4&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&fl%5B%5D=licenseurl&rows=${rows}&page=${page}&output=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    const body = (await res.json() as { response?: { docs?: IaSearchDoc[] } });
    const docs = body.response?.docs ?? [];

    const results: DiscoveredSource[] = [];
    for (const doc of docs) {
      const mp4 = await this.findBestMp4(doc.identifier);
      if (!mp4) continue;
      const licenseurl = doc.licenseurl ?? '';
      const isPd = licenseurl.includes('publicdomain') || licenseurl.includes('licenses/by');
      results.push({
        url: `${IA_DOWNLOAD_BASE}/${doc.identifier}/${encodeURIComponent(mp4.name)}`,
        title: doc.title ?? doc.identifier,
        year: doc.year,
        provider: this.id,
        licenseType: isPd ? 'PUBLIC_DOMAIN' : 'CREATIVE_COMMONS',
        licenseRef: licenseurl || `${IA_METADATA_BASE}/${doc.identifier}`,
        sizeBytes: Number(mp4.size ?? 0),
      });
    }
    return results;
  }

  private async findBestMp4(identifier: string): Promise<{ name: string; size: number } | null> {
    const res = await fetch(`${IA_METADATA_BASE}/${identifier}`, { signal: AbortSignal.timeout(20_000) });
    const body = (await res.json() as { files?: IaMetadataFile[] });
    const mp4s = (body.files ?? [])
      .filter((f) => /\.mp4$/i.test(f.name))
      .sort((a, b) => Number(b.size ?? 0) - Number(a.size ?? 0));
    // Skip tiny files (trailers, samples)
    const best = mp4s.find((f) => Number(f.size ?? 0) > 50_000_000) ?? mp4s[0];
    return best ? { name: best.name, size: Number(best.size ?? 0) } : null;
  }

  async verify(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, {
        headers: { Range: 'bytes=0-256' },
        signal: AbortSignal.timeout(20_000),
      });
      return (res.status === 206 || res.status === 200) &&
        (res.headers.get('content-type') ?? '').includes('video');
    } catch {
      return false;
    }
  }
}
