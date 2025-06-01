#!/usr/bin/env node
/**
 * Simple D1 Database CLI
 * Usage: node scripts/d1.js <command> [args...]
 */

import { execSync } from 'child_process';

const DB_NAME = 'd1-notso-livedash';
const args = process.argv.slice(2);

if (args.length === 0) {
    console.log(`
🗄️  Simple D1 CLI for ${DB_NAME}

Usage: node scripts/d1.js <command> [args...]

Commands:
  list                     List databases
  info                     Show database info
  tables                   List all tables
  schema <table>           Show table schema  
  query "<sql>"            Execute SQL query
  export [file]            Export database
  
Add --remote flag for production database

Examples:
  node scripts/d1.js tables
  node scripts/d1.js schema User
  node scripts/d1.js query "SELECT COUNT(*) FROM Company"
  node scripts/d1.js --remote info
`);
    process.exit(0);
}

const isRemote = args.includes('--remote');
const filteredArgs = args.filter(arg => !arg.startsWith('--'));
const [ command, ...params ] = filteredArgs;
const remoteFlag = isRemote ? '--remote' : '';

function run(cmd) {
    try {
        console.log(`💫 ${cmd}`);
        execSync(cmd, { stdio: 'inherit' });
    } catch (error) {
        console.error('❌ Command failed');
        process.exit(1);
    }
}

switch (command) {
    case 'list':
        run('npx wrangler d1 list');
        break;

    case 'info':
        run(`npx wrangler d1 info ${DB_NAME} ${remoteFlag}`);
        break;

    case 'tables':
        run(`npx wrangler d1 execute ${DB_NAME} ${remoteFlag} --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"`);
        break;

    case 'schema':
        if (!params[ 0 ]) {
            console.error('❌ Please specify table name');
            process.exit(1);
        }
        run(`npx wrangler d1 execute ${DB_NAME} ${remoteFlag} --command "PRAGMA table_info(${params[ 0 ]})"`);
        break;

    case 'query':
        if (!params[ 0 ]) {
            console.error('❌ Please specify SQL query');
            process.exit(1);
        }
        run(`npx wrangler d1 execute ${DB_NAME} ${remoteFlag} --command "${params[ 0 ]}"`);
        break;

    case 'export':
        const filename = params[ 0 ] || `backup_${new Date().toISOString().slice(0, 10)}.sql`;
        run(`npx wrangler d1 export ${DB_NAME} ${remoteFlag} --output ${filename}`);
        break;

    default:
        console.error(`❌ Unknown command: ${command}`);
        process.exit(1);
}
