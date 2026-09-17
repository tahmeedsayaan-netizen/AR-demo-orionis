// Generate the presenter voiceover (edge-tts neural voice) plus caption cues.
// Each script line is synthesised separately so caption timing is exact.
// Replace public/audio/voiceover.mp3 with a real recording any time — just keep the cue file in sync.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addEnvelope } from './voice-envelope.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const content = JSON.parse(readFileSync(join(root, 'src/content/content.json'), 'utf8'));
const { voice, rate, script } = content.presenter;
const tmp = join(root, '.voice-tmp');
const GAP = 0.45; // seconds of silence between lines
const LEAD = 0.3;

rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

const python = process.platform === 'win32' ? ['py', ['-3.12']] : ['python3', []];
const tts = (text, out) =>
  execFileSync(python[0], [...python[1], '-m', 'edge_tts', '--voice', voice, `--rate=${rate}`, '--text', text, '--write-media', out], { stdio: 'inherit' });
const duration = (file) =>
  parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString());

const cues = [];
const parts = [];
let t = LEAD;
script.forEach((line, i) => {
  const wav = join(tmp, `line${i}.wav`);
  const mp3 = join(tmp, `line${i}.mp3`);
  tts(line.text, mp3);
  // normalise to wav so concat is sample-accurate
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp3, '-ar', '44100', '-ac', '1', wav]);
  const d = duration(wav);
  cues.push({ start: +t.toFixed(3), end: +(t + d).toFixed(3), text: line.text, gesture: line.gesture });
  parts.push(wav);
  t += d + GAP;
  console.log(`line ${i}: ${d.toFixed(2)}s`);
});

// Build ffmpeg filter: lead silence, then each line followed by a gap.
const inputs = parts.flatMap((p) => ['-i', p]);
const filters = parts.map((_, i) => `[${i}:a]apad=pad_dur=${GAP}[a${i}]`).join(';');
const concat = parts.map((_, i) => `[a${i}]`).join('') + `concat=n=${parts.length}:v=0:a=1,adelay=${LEAD * 1000}[out]`;
execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', `${filters};${concat}`, '-map', '[out]',
  '-c:a', 'libmp3lame', '-b:a', '96k', join(root, 'public/audio/voiceover.mp3')], { stdio: 'inherit' });

writeFileSync(join(root, 'public/audio/voiceover-cues.json'), JSON.stringify({ duration: +t.toFixed(3), cues }, null, 2));
addEnvelope(root);
rmSync(tmp, { recursive: true, force: true });
console.log(`voiceover: ${t.toFixed(1)}s, ${cues.length} cues`);
