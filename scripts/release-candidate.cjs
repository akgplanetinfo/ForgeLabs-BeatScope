'use strict';
// Safe ForgeLabs release-candidate report. No network, install, or publication.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function fail(message) { throw new Error(message); }
function verifyPE(file) {
  const handle = fs.openSync(file, 'r');
  try {
    const len = fs.fstatSync(handle).size;
    if (len < 4096) fail('EXE too small: ' + file);
    const header = Buffer.alloc(64);
    if (fs.readSync(handle, header, 0, 64, 0) !== 64 || header.toString('ascii', 0, 2) !== 'MZ') fail('MZ missing: ' + file);
    const off = header.readUInt32LE(0x3c);
    if (off < 64 || off > len - 4) fail('Invalid PE offset: ' + file);
    const pe = Buffer.alloc(4);
    if (fs.readSync(handle, pe, 0, 4, off) !== 4 || pe.toString('ascii') !== 'PE\u0000\u0000') fail('PE signature missing: ' + file);
    return len;
  } finally { fs.closeSync(handle); }
}
function createManifest({ appId, version, channel, files, output, commit = '' }) {
  if (!['m32r', 'lumina', 'browser', 'exe2user'].includes(appId)) fail('Unsupported appId');
  if (!['beta', 'stable'].includes(channel)) fail('Invalid channel');
  if (!/^\d+\.\d+(?:\.\d+){0,2}(?:-[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*)?$/.test(version)) fail('Invalid version');
  if (channel === 'stable' && version.includes('-')) fail('Prerelease cannot use stable channel');
  if (!Array.isArray(files) || files.length < 1 || files.length > 2) fail('Provide one or two EXEs');
  if (files.length !== new Set(files.map(x => path.basename(x).toLowerCase())).size) fail('Duplicate EXE file name');
  const packages = files.map(file => {
    if (path.extname(file).toLowerCase() !== '.exe') fail('Only EXE files accepted');
    if (!fs.statSync(file).isFile()) fail('Not a regular file');
    const fileName = path.basename(file);
    if (!/^[a-zA-Z0-9][\w .()-]*\.exe$/i.test(fileName)) fail('Unsafe EXE name: ' + fileName);
    const length = verifyPE(file);
    const sha256 = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    return {
      fileName,
      kind: /portable/i.test(fileName) ? 'portable' : /setup|install/i.test(fileName) ? 'installer-unverified' : 'exe-unverified',
      sizeBytes: length,
      sha256,
    };
  });
  const manifest = {
    schemaVersion: 1,
    appId, version, channel, status: 'candidate-only',
    distributionEnabled: false, installerVerifiedPerUser: false,
    sourceCommit: /^[a-f\d]{40}$/i.test(commit) ? commit.toLowerCase() : null,
    packages,
  };
  const outputPath = path.resolve(output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n', { flag: 'w' });
  console.log('ForgeLabs release candidate:', appId, version, channel, packages.length, 'EXEs; no publication');
  return manifest;
}
function main(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!['--app-id','--version','--channel','--exe','--output'].includes(arg) || i + 1 >= argv.length) fail('Unknown/missing argument '+arg);
    if (arg === '--exe') (parsed.files ??= []).push(argv[++i]);
    else {
      if (Object.prototype.hasOwnProperty.call(parsed,arg)) fail('Duplicate arg '+arg);
      parsed[arg] = argv[++i];
    }
  }
  for (const arg of ['--app-id','--version','--channel','--output']) if (!parsed[arg]) fail('Required: ' + arg);
  return createManifest({
    appId: parsed['--app-id'],
    version: parsed['--version'],
    channel: parsed['--channel'],
    files: parsed.files,
    output: parsed['--output'],
    commit: process.env.GITHUB_SHA || '',
  });
}
if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (error) { console.error('ERROR:',error.message); process.exitCode=1; }
}
module.exports = { createManifest, verifyPE };
