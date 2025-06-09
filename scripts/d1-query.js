#!/usr/bin/env node
/**
 * Simple D1 query helper script
 * Usage: node scripts/d1-query.js "SELECT * FROM User LIMIT 5"
 * Usage: node scripts/d1-query.js --remote "SELECT COUNT(*) FROM Company"
 */

import { execSync } from "child_process";
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node scripts/d1-query.js [--remote] "SQL_QUERY"');
  console.log("Examples:");
  console.log('  node scripts/d1-query.js "SELECT * FROM User LIMIT 5"');
  console.log(
    '  node scripts/d1-query.js --remote "SELECT COUNT(*) FROM Company"'
  );
  process.exit(1);
}

const isRemote = args.includes("--remote");
const query = args[args.length - 1];

if (!query || query.startsWith("--")) {
  console.error("Error: Please provide a SQL query");
  process.exit(1);
}

const remoteFlag = isRemote ? "--remote" : "";
const command = `npx wrangler d1 execute d1-notso-livedash ${remoteFlag} --command "${query}"`;

try {
  console.log(`🔍 Executing${isRemote ? " (remote)" : " (local)"}: ${query}\n`);
  execSync(command, { stdio: "inherit" });
} catch (error) {
  console.error("Query failed:", error.message);
  process.exit(1);
}
