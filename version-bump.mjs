import { readFileSync, writeFileSync } from 'node:fs';

const targetVersion = process.env.npm_package_version;
if (!targetVersion) throw new Error('Missing npm package version.');

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => {
	writeFileSync(path, `${JSON.stringify(value, null, '\t')}\n`);
};

const manifest = readJson('manifest.json');
manifest.version = targetVersion;
writeJson('manifest.json', manifest);

const versions = readJson('versions.json');
versions[targetVersion] = manifest.minAppVersion;
writeJson('versions.json', versions);
