// Compress the user's story video for mobile WebAR and grab a poster frame.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const src = readdirSync(root).find((f) => f.startsWith('WhatsApp Video') && f.endsWith('.mp4'));
if (!src) throw new Error('Source video (WhatsApp Video *.mp4) not found in project root');

const input = join(root, src);
const out = join(root, 'public/media/orionis-story.mp4');
const poster = join(root, 'public/media/orionis-story.jpg');
const run = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });

// Full source resolution (576x1024), high quality: it plays on a large AR screen.
run(['-i', input, '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-tune', 'film',
  '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out]);
run(['-ss', '8', '-i', input, '-frames:v', '1', '-q:v', '2', poster]);

for (const f of [out, poster]) {
  if (existsSync(f)) console.log(f, (statSync(f).size / 1e6).toFixed(2) + ' MB');
}
