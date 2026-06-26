import nextEnv from "@next/env";
const {loadEnvConfig}=nextEnv;
import {runProductCommandSync} from "./lib/product-command-sync.mjs";
loadEnvConfig(process.cwd());
const dryRun=process.argv.includes("--dry-run");
try{const result=await runProductCommandSync({dryRun});console.log(JSON.stringify(result,null,2));if(result.errors.length)process.exitCode=1}catch(error){console.error(error instanceof Error?error.stack||error.message:error);process.exitCode=1}
