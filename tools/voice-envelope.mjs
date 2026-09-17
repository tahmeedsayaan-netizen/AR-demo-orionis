// Precompute the voiceover's loudness envelope (for the presenter's mouth/head motion) into the cue file.
// Doing this offline avoids routing the voice through Web Audio, which iPhones mute with the silent
// switch and keep suspended until a tap.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STEP = 0.04; // seconds per envelope sample
const RATE = 8000;

export function addEnvelope(root) {
  const mp3 = join(root, 'public/audio/voiceover.mp3');
  const cuesFile = join(root, 'public/audio/voiceover-cues.json');
  const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', mp3, '-ac', '1', '-ar', String(RATE), '-f', 's16le', '-'], {
    maxBuffer: 256 * 1024 * 1024,
  });
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2));
  const win = Math.round(STEP * RATE);
  const rms = [];
  for (let i = 0; i < samples.length; i += win) {
    let sum = 0;
    const end = Math.min(samples.length, i + win);
    for (let j = i; j < end; j++) sum += (samples[j] / 32768) ** 2;
    rms.push(Math.sqrt(sum / Math.max(1, end - i)));
  }
  // normalise against a loud-speech reference (95th percentile) so the mouth opens fully on stressed syllables
  const sorted = [...rms].sort((a, b) => a - b);
  const ref = sorted[Math.floor(sorted.length * 0.95)] || 1;
  const values = rms.map((v) => Math.round(Math.min(1, v / ref) * 100) / 100);

  const cues = JSON.parse(readFileSync(cuesFile, 'utf8'));
  cues.envelope = { step: STEP, values };
  writeFileSync(cuesFile, JSON.stringify(cues, null, 2));
  return values.length;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  console.log('envelope samples:', addEnvelope(root));
}
