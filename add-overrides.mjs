#!/usr/bin/env node

/* Basic Node JS Dependencies */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

/* Using JsYaml Package for parsing pnpm yaml files */ 
function LoadJsYaml() 
{
	console.log("Loading JS-YAML Parser!");
	try 
	{
		return require("js-yaml");
	} 
	catch 
	{
		try 
		{
			const globalRoot = execSync("pnpm root -g", { encoding: "utf8" }).trim();
			return require(`${globalRoot}/js-yaml`);
		} 
		catch (err) 
		{
			console.error("Package js-yaml not found. Install globally with:\n\n  pnpm add -g js-yaml@4.1\n");
			process.exit(1);
		}
	}
}

const yaml = LoadJsYaml();

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

/* Find Keys in Package.json */
function FindKeyInJsonObject(obj, searchKey)
{
	if (obj === null || typeof obj !== 'object') 
	{
		return undefined;
	}

	for (const key of Object.keys(obj)) 
	{
		if (key === searchKey) 
		{
			return obj[key];
		}

		const child = obj[key];
		if (typeof child === 'object') 
		{
			const result = FindKeyInJsonObject(child, searchKey);
			if (result !== undefined) 
			{
				return result;
			}
		}
	}

	return undefined;
}

/* */
function AddOverridesFromWorkspaceFileToPackageJson(sortedOverridesData)
{
	const pkgPath = path.resolve("package.json");
  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

	const KEYS = Object.keys(sortedOverridesData);

	console.log(KEYS);
	KEYS.forEach((searchKey) => {
		const FOUND_OBJECT = FindKeyInJsonObject(pkgJson, searchKey);
		if (FOUND_OBJECT !== undefined)
		{
			console.log(FOUND_OBJECT);
		}
		
	})
}

function AddAuditFixDataToProject()
{
	if (!fs.existsSync(WORKSPACE_LOCKFILE)) 
	{
		console.log(`No ${WORKSPACE_LOCKFILE} found in this directory. PNPM Audit didn't add override packages`);
		return;
	}

	const overridesData = GetOverridesFromWorkspaceYamlFile();

	console.log(overridesData);

	const sortedOverridesData = SortDuplicatesInOverridesData(overridesData);

	console.log(sortedOverridesData);

	AddOverridesFromWorkspaceFileToPackageJson(sortedOverridesData);

}

AddAuditFixDataToProject();
