#!/usr/bin/env node
/**
 * Comprehensive D1 Database Management Script
 *
 * Usage Examples:
 *   node scripts/d1-manager.js tables
 *   node scripts/d1-manager.js schema Company
 *   node scripts/d1-manager.js count User
 *   node scripts/d1-manager.js query "SELECT * FROM User LIMIT 5"
 *   node scripts/d1-manager.js backup
 *   node scripts/d1-manager.js --remote query "SELECT COUNT(*) FROM Session"
 */

import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const DB_NAME = "d1-notso-livedash";
const args = process.argv.slice(2);

// Parse flags
const isRemote = args.includes("--remote");
const filteredArgs = args.filter((arg) => !arg.startsWith("--"));

if (filteredArgs.length === 0) {
  showHelp();
  process.exit(1);
}

const command = filteredArgs[0];
const params = filteredArgs.slice(1);

function showHelp() {
  console.log(`
🗄️  D1 Database Manager for ${DB_NAME}

Usage: node scripts/d1-manager.js [--remote] <command> [params...]

Commands:
  info                     Show database information
  tables                   List all tables
  schema <table>           Show table schema
  count <table>            Count rows in table
  query "<sql>"            Execute custom SQL query
  backup [filename]        Export database to SQL file
  backup-schema            Export just the schema
  recent-logs              Show recent query activity

Flags:
  --remote                 Execute against remote D1 (production)

Examples:
  node scripts/d1-manager.js tables
  node scripts/d1-manager.js schema User
  node scripts/d1-manager.js count Company
  node scripts/d1-manager.js query "SELECT * FROM User WHERE role = 'admin'"
  node scripts/d1-manager.js backup
  node scripts/d1-manager.js --remote info
`);
}

function execute(sql, silent = false) {
  const remoteFlag = isRemote ? "--remote" : "";
  const cmd = `npx wrangler d1 execute ${DB_NAME} ${remoteFlag} --command "${sql}"`;

  if (!silent) {
    console.log(
      `🔍 Executing${isRemote ? " (remote)" : " (local)"}: ${sql}\\n`
    );
  }

  try {
    return execSync(cmd, { encoding: "utf8" });
  } catch (error) {
    console.error("❌ Query failed:", error.message);
    process.exit(1);
  }
}

function wranglerCommand(subcommand, silent = false) {
  const remoteFlag = isRemote ? "--remote" : "";
  const cmd = `npx wrangler d1 ${subcommand} ${DB_NAME} ${remoteFlag}`;

  if (!silent) {
    console.log(`📊 Running: ${cmd}\\n`);
  }

  try {
    return execSync(cmd, { stdio: "inherit" });
  } catch (error) {
    console.error("❌ Command failed:", error.message);
    process.exit(1);
  }
}

switch (command) {
  case "info":
    wranglerCommand("info");
    break;

  case "tables":
    console.log("📋 Listing all tables:\\n");
    execute(
      "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name;"
    );
    break;

  case "schema":
    if (!params[0]) {
      console.error("❌ Please specify a table name");
      console.log("Usage: node scripts/d1-manager.js schema <table_name>");
      process.exit(1);
    }
    console.log(`🏗️  Schema for table '${params[0]}':\\n`);
    execute(`PRAGMA table_info(${params[0]});`);
    break;

  case "count":
    if (!params[0]) {
      console.error("❌ Please specify a table name");
      console.log("Usage: node scripts/d1-manager.js count <table_name>");
      process.exit(1);
    }
    console.log(`🔢 Row count for table '${params[0]}':\\n`);
    execute(`SELECT COUNT(*) as row_count FROM ${params[0]};`);
    break;

  case "query":
    if (!params[0]) {
      console.error("❌ Please specify a SQL query");
      console.log(
        'Usage: node scripts/d1-manager.js query "SELECT * FROM table"'
      );
      process.exit(1);
    }
    execute(params[0]);
    break;

  case "backup":
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const filename = params[0] || `backup_${timestamp}.sql`;

    try {
      mkdirSync("backups", { recursive: true });
    } catch (e) {
      // Directory might already exist
    }

    const backupPath = join("backups", filename);
    console.log(`💾 Creating backup: ${backupPath}\\n`);
    wranglerCommand(`export --output ${backupPath}`);
    console.log(`\\n✅ Backup created successfully: ${backupPath}`);
    break;

  case "backup-schema":
    try {
      mkdirSync("backups", { recursive: true });
    } catch (e) {
      // Directory might already exist
    }

    console.log("📜 Exporting schema only...\\n");
    wranglerCommand("export --no-data --output backups/schema.sql");
    console.log("\\n✅ Schema exported to backups/schema.sql");
    break;

  case "recent-logs":
    console.log("📊 Recent database activity:\\n");
    try {
      wranglerCommand("insights");
    } catch (error) {
      console.log("ℹ️  Insights not available for this database");
    }
    break;

  case "all-tables-info":
    console.log("📊 Information about all tables:\\n");
    const tables = ["Company", "User", "Session"];
    for (const table of tables) {
      console.log(`\\n🏷️  Table: ${table}`);
      console.log("─".repeat(50));
      execute(`SELECT COUNT(*) as row_count FROM ${table};`);
    }
    break;

  default:
    console.error(`❌ Unknown command: ${command}`);
    showHelp();
    process.exit(1);
}
