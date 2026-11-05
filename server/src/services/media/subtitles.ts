/**
 * Converts SubRip (SRT) subtitles to WebVTT. The original SRT is preserved
 * (per phase requirements) — the VTT is stored alongside it.
 */
export function srtToVtt(srt: string): string {
  const body = srt
    .replace(/\r+/g, '')
    .replace(/^\uFEFF/, '')
    // WEBVTT cue timing uses '.' as the millisecond separator
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    .trim();

  if (body.length === 0) {
    throw new Error('Subtitle file is empty');
  }

  const lines = body.split('\n');
  const out: string[] = ['WEBVTT', ''];

  let sawCue = false;
  for (const line of lines) {
    // Numeric cue identifiers are optional in WebVTT — drop bare sequence numbers.
    if (/^\d+$/.test(line.trim()) && !line.includes('-->')) {
      continue;
    }
    if (line.includes('-->')) sawCue = true;
    out.push(line);
  }

  if (!sawCue) {
    throw new Error('No valid SRT cues found — file may not be a subtitle file');
  }

  return out.join('\n') + '\n';
}

export function isSrt(content: string): boolean {
  return /\d{2}:\d{2}:\d{2},\d{3}\s+-->/.test(content);
}

export function looksLikeVtt(content: string): boolean {
  return /^\uFEFF?WEBVTT/.test(content.trimStart());
}
