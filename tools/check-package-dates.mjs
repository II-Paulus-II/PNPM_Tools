#!/usr/bin/env node

/* Basic Node JS Dependencies */
import fs from "fs";
import path from "path";
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

/* Import js-yaml */
const __dirname = dirname(fileURLToPath(import.meta.url));
const libDir = join(__dirname, 'lib');
const yamlPath = join(libDir, 'yaml-loader.mjs');

const { default: yaml } = await import(yamlPath);

/* */

const LOCKFILE = "pnpm-lock.yaml";
const MAX_AGE_HOURS = 72;

const WORKSPACE_LOCKFILE = "pnpm-workspace.yaml";

function getPackagesFromLockfile() 
{
	if (!fs.existsSync(LOCKFILE)) 
	{
		console.error(`No ${LOCKFILE} found in this directory.`);
		process.exit(1);
	}

	const lockData = yaml.load(fs.readFileSync(LOCKFILE, "utf8"));
	const pkgs = [];

	if (lockData.packages) 
	{
		for (const key of Object.keys(lockData.packages)) 
		{

			const atIndex = key.lastIndexOf("@");

			let NAME, version;
			if (key.startsWith("@")) 
			{
				const secondAt = key.indexOf("@", 1); 
				NAME = key.slice(0, secondAt);
				version = key.slice(secondAt + 1);
			} else
			{
				NAME = key.slice(0, atIndex);
				version = key.slice(atIndex + 1);
			}

			if (NAME && version) 
			{
				pkgs.push({ NAME, version });
			}
		}
	}

	const deduped = Array.from(
		new Map(pkgs.map(p => [`${p.NAME}@${p.version}`, p])).values()
	);

	return deduped;
}

async function getPublishTimes(pkg, version) 
{
  try {
    const res = await fetch(`https://registry.npmjs.org/${pkg}`);
    if (!res.ok) throw new Error(`Failed to fetch ${pkg}`);
    const data = await res.json();
    return data.time || {};
  } catch (e) {
    console.warn(`Failed to fetch times for ${pkg}: ${e.message}`);
    return {};
  }
}

function addOverridesForSuspicious(suspicious) 
{
  const pkgPath = path.resolve("package.json");
  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  if (!pkgJson.pnpm) {
		pkgJson.pnpm = {};
	}
	if (!pkgJson.pnpm.overrides) {
		pkgJson.pnpm.overrides = {};
	}

  for (const { NAME, version, published, hoursOld } of suspicious) {
		if (!published || typeof published !== "object") {
			console.warn(`No published data found for ${NAME}, skipping`);
			continue;
		}

		const cutoff = Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000;

		const safeVersion = Object.entries(published)
			.filter(([v, t]) => v !== "created" && v !== "modified")
			.filter(([v, t]) => new Date(t).getTime() <= cutoff)
			.sort(([v1, t1], [v2, t2]) => new Date(t2) - new Date(t1))[0]?.[0];

		if (!safeVersion) {
			console.warn(`Could not find a safe version for ${NAME}`);
			continue;
		}

		pkgJson.pnpm.overrides[NAME] = safeVersion;
		console.log(`Will override ${NAME} -> ${safeVersion}`);
  }

	fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2));
	console.log("Overrides applied to package.json.");
}

async function checkPackages() {
	const pkgs = getPackagesFromLockfile();
	const now = new Date();
	const suspicious = [];

	const batchSize = 10;
	let index = 0;

	while (index < pkgs.length) {
		const batch = pkgs.slice(index, index + batchSize);

		const results = await Promise.all(
			batch.map(({ NAME, version }) => getPublishTimes(NAME, version).then(published => ({ NAME, version, published })))
		);

		for (const { NAME, version, published } of results) {

			if (!published) {
				suspicious.push({ NAME, version, data: "no published data" });
				continue;
			}
			const timeStr = new Date(published?.[version]);
			console.log("Name: ", NAME, "Version: ", version, "Time: ", timeStr);

			const hoursOld = (now - timeStr) / (1000 * 60 * 60);
			if (hoursOld < MAX_AGE_HOURS) {
				suspicious.push({ NAME, version, published, hoursOld });
			}
		}

		index += batchSize;
	}

	if (suspicious.length > 0) {
		console.log("\nSuspiciously new packages detected:");
		suspicious.forEach(p =>
			console.log(
				` - ${p.NAME}@${p.version} published ${p.hoursOld?.toFixed(
					1
				)}h ago (${p.published?.[p.version] || p.data})`
			)
		);
		addOverridesForSuspicious(suspicious);
		process.exit(1);
	} else {
		console.log("All packages are older than threshold.");
	}
}

checkPackages();
