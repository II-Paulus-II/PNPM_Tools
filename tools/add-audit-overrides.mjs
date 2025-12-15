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

/* Read Workspace Yaml file */
const WORKSPACE_LOCKFILE = "pnpm-workspace.yaml";

function GetOverridesFromWorkspaceYamlFile()
{
	const AuditOverridesFileData = yaml.load(fs.readFileSync(WORKSPACE_LOCKFILE, "utf8"));

	const overridesData = [];

	if (AuditOverridesFileData.overrides)
	{
		for (const key of Object.keys(AuditOverridesFileData.overrides)) 
		{
			const NameEnd = key.indexOf(">") - 1;
			const NAME = key.slice(0, NameEnd);
			let Package = { [NAME] : AuditOverridesFileData.overrides[key] }
			overridesData.push(Package);
		}
	}

	return overridesData;
}

/* Find Duplicates in Overrides and Select highest version considered safe */
function SortDuplicatesInOverridesData(overridesData)
{
	let sortedOverridesData = {};

	function CompareVersionNumbers(entry, oldEntry)
	{
		const parsedEntry = entry.split('.').map(Number);
		const parsedOldEntry = oldEntry.split('.').map(Number);

		const numberLength = Math.max(parsedEntry.length, parsedOldEntry.length);

		for (let i=0; i < numberLength; i++)
		{
			const numberEntry = parsedEntry[i] ?? 0;
			const numberOldEntry = parsedOldEntry[i] ?? 0;

			if ( numberEntry > numberOldEntry)
			{
				return 1;
			}
			if (numberOldEntry > numberEntry )
			{
				return -1;
			}
		}
		return 0;
	}

	for (const item of overridesData)
	{
		const key = Object.keys(item)[0];
		//console.log("SortDuplicatesInOverridesData - Key is ", key)
		const Value = item[key];
		//console.log("SortDuplicatesInOverridesData - Value is ",Value);
		const entry = Value.replace(">=", "").trim();

		if (!sortedOverridesData[key])
		{
			sortedOverridesData[key] = entry;
		}
		else
		{
			const oldEntry = sortedOverridesData[key];
			const entryToChoose = CompareVersionNumbers(entry, oldEntry);
			if (entryToChoose === 1 )
			{
				//console.log("Using New Entry");
				sortedOverridesData[key] = entry;
			}
		}
	}

	return sortedOverridesData;
}

/* Change Keys in Package.json */
function ChangeKeyInJsonObject(obj, searchKey, newValue)
{
	if (obj === null || typeof obj !== "object") 
	{
		return false;
	}

  for (const key of Object.keys(obj)) 
	{
    if (key === searchKey) 
		{
      obj[key] = newValue;
      return true; 
    }

    const value = obj[key];

    if (typeof value === "object" && value !== null) 
		{
      const changed = ChangeKeyInJsonObject(value, searchKey, newValue);
      if (changed)
			{
				return true;
			}
    }
  }

  return false;
}

/* Now Change the package.json */
function AddOverridesFromWorkspaceFileToPackageJson(sortedOverridesData)
{
	const pkgPath = path.resolve("package.json");
  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

	for (const [key, value] of Object.entries(sortedOverridesData))
	{
		const found = ChangeKeyInJsonObject(pkgJson, key, value);
		if (!found)
		{
			console.log("Package ", key, " not found!");
		}
	}

	fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2));
}

function AddAuditFixDataToProject()
{
	if (!fs.existsSync(WORKSPACE_LOCKFILE)) 
	{
		console.log(`No ${WORKSPACE_LOCKFILE} found in this directory. PNPM Audit didn't add override packages`);
		return;
	}

	const overridesData = GetOverridesFromWorkspaceYamlFile();

	console.log("Overrides Data from Workspace.yaml file: ", overridesData);

	const sortedOverridesData = SortDuplicatesInOverridesData(overridesData);

	console.log("Sorted Overrides Data", sortedOverridesData);

	AddOverridesFromWorkspaceFileToPackageJson(sortedOverridesData);

}

AddAuditFixDataToProject();
