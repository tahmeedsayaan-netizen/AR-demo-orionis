// Build the 8th Wall image target for the printed marker (public/image-targets/).
// Wraps the interactive `@8thwall/image-target-cli` by piping its answers:
// flat target, default centred 3:4 crop.
import { execSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const image = join(root, 'marker/orionis-marker.png');
const out = join(root, 'public/image-targets');
const name = 'orionis-marker';

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const answers = [image, '1', 'y', out, name].join('\n') + '\n';
execSync('npx -y @8thwall/image-target-cli@1', { input: answers, stdio: ['pipe', 'inherit', 'inherit'] });

// The engine only needs the metadata JSON and the luminance image.
for (const f of readdirSync(out)) {
  if (f !== `${name}.json` && f !== `${name}_luminance.png`) rmSync(join(out, f));
}
const meta = JSON.parse(readFileSync(join(out, `${name}.json`), 'utf8'));
console.log('image target:', meta.imagePath, meta.properties);
