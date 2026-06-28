import {execSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

function readGitShortSha() {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'local';
  }
}

const buildStamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 12);
const version = `${packageJson.version}-${readGitShortSha()}-${buildStamp}`;
const generatedAt = new Date().toISOString();

mkdirSync(join(root, 'public'), {recursive: true});
mkdirSync(join(root, 'src', 'generated'), {recursive: true});

writeFileSync(
  join(root, 'public', 'version.json'),
  `${JSON.stringify({version, generatedAt}, null, 2)}\n`,
  'utf8'
);

writeFileSync(
  join(root, 'src', 'generated', 'app-version.ts'),
  `export const APP_VERSION = ${JSON.stringify(version)};\n`,
  'utf8'
);

writeFileSync(
  join(root, 'public', 'sw.js'),
  `const BUILD_VERSION = ${JSON.stringify(version)};

self.addEventListener('install', () => {
  console.info('[SW] installed', BUILD_VERSION);
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.claim().then(() =>
      self.clients.matchAll({includeUncontrolled: true}).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({type: 'SW_ACTIVATED', version: BUILD_VERSION});
        });
      })
    )
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
`,
  'utf8'
);

console.log(`Wrote app build version ${version}`);
