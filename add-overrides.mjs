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

if (yaml !== undefined)
{
	console.log("You Are About to YAML")
}