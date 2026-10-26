import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'combat/source/combat-v073-live.html';
const MANIFEST = 'combat/combat-v073-live.manifest.json';
const BOOTSTRAP = 'Battle-viewer.html';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function loaderParts(root = ROOT) {
  const viewer = readFileSync(path.join(root, BOOTSTRAP), 'utf8');
  const match = viewer.match(/const urls=\[([\s\S]*?)\];/);
  if (!match) throw new Error('Combat bootstrap bundle list is missing');
  const parts = JSON.parse(`[${match[1]}]`);
  if (!parts.length || parts.some((part) => !/^combat\/[a-zA-Z0-9/._-]+$/.test(part) || part.includes('..'))) {
    throw new Error('Invalid Combat bundle paths');
  }
  return parts;
}

function readBundle(root, parts) {
  const chunks = parts.map((part) => readFileSync(path.join(root, part), 'utf8').replace(/\s+/g, ''));
  const encoded = chunks.join('');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('Invalid Combat base64 payload');
  const compressed = Buffer.from(encoded, 'base64');
  return { chunks, compressed, source: gunzipSync(compressed) };
}

function manifestFor(parts, bundle) {
  return {
    schemaVersion: 1,
    runtimeVersion: '0.7.3-live',
    source: SOURCE,
    bootstrap: BOOTSTRAP,
    encoding: 'base64+gzip',
    sourceSha256: hash(bundle.source),
    compressedSha256: hash(bundle.compressed),
    parts: parts.map((file, index) => ({ file, encodedChars: bundle.chunks[index].length })),
  };
}

// The source is the pre-bootstrap payload. Battle-viewer still applies its
// compatibility patches and attaches the external live multiplayer bridges.
export function buildCombatLive({ root = ROOT, check = false, extract = false } = {}) {
  const parts = loaderParts(root);
  const bundle = readBundle(root, parts);
  const sourcePath = path.join(root, SOURCE);
  const manifestPath = path.join(root, MANIFEST);
  if (extract) {
    if (existsSync(sourcePath) || existsSync(manifestPath)) throw new Error('Combat source already exists; extraction will not overwrite edits');
    mkdirSync(path.dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, bundle.source);
    writeFileSync(manifestPath, JSON.stringify(manifestFor(parts, bundle), null, 2) + '\n');
    return { action: 'extracted', sourceSha256: hash(bundle.source), parts: parts.length };
  }
  const source = readFileSync(sourcePath);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.schemaVersion !== 1 || manifest.source !== SOURCE || manifest.bootstrap !== BOOTSTRAP ||
      JSON.stringify(manifest.parts.map((part) => part.file)) !== JSON.stringify(parts)) {
    throw new Error('Combat manifest does not match the bootstrap contract');
  }
  if (check) {
    if (!source.equals(bundle.source)) throw new Error('Combat source and packed runtime differ; run npm run build:combat-live');
    if (JSON.stringify(manifestFor(parts, bundle)) !== JSON.stringify(manifest)) throw new Error('Combat manifest or bundle integrity differs');
    return { action: 'verified', sourceSha256: hash(source), parts: parts.length };
  }
  // Preserve the existing compressed bytes on a no-op build. This keeps the
  // Phase 0 extraction byte-for-byte compatible with the shipped runtime.
  if (source.equals(bundle.source)) {
    const next = manifestFor(parts, bundle);
    if (JSON.stringify(manifest) !== JSON.stringify(next)) writeFileSync(manifestPath, JSON.stringify(next, null, 2) + '\n');
    return { action: 'unchanged', sourceSha256: hash(source), parts: parts.length };
  }
  const compressed = gzipSync(source, { level: 9, mtime: 0 });
  const encoded = compressed.toString('base64');
  const fixedLength = manifest.parts.slice(0, -1).reduce((sum, part) => sum + part.encodedChars, 0);
  if (encoded.length <= fixedLength) throw new Error('Combat payload is too short for the legacy split layout; migrate the loader layout explicitly');
  let offset = 0;
  const chunks = manifest.parts.map((part, index) => {
    const end = index === parts.length - 1 ? encoded.length : offset + part.encodedChars;
    const chunk = encoded.slice(offset, end);
    offset = end;
    return chunk;
  });
  parts.forEach((part, index) => writeFileSync(path.join(root, part), chunks[index]));
  writeFileSync(manifestPath, JSON.stringify(manifestFor(parts, { source, compressed, chunks }), null, 2) + '\n');
  return { action: 'built', sourceSha256: hash(source), parts: parts.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => !['--check', '--extract'].includes(arg)) || args.length > 1) throw new Error('Usage: node scripts/build-combat-live.mjs [--check|--extract]');
    console.log('Combat live bundle:', JSON.stringify(buildCombatLive({ check: args.includes('--check'), extract: args.includes('--extract') })));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
