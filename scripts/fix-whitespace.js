// Fix Trailing Whitespace
// This script removes trailing whitespace from specified file types

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure which file types to process
const fileTypes = [".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".css"];

// Configure directories to ignore
const ignoreDirs = ["node_modules", ".next", ".git", "out", "build", "dist"];

// Recursively process directories
async function processDirectory(dir) {
  try {
    const files = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(dir, file.name);

      // Skip ignored directories
      if (file.isDirectory()) {
        if (!ignoreDirs.includes(file.name)) {
          await processDirectory(fullPath);
        }
        continue;
      }

      // Process only files with matching extensions
      const ext = path.extname(file.name);
      if (!fileTypes.includes(ext)) {
        continue;
      }

      try {
        // Read and process the file
        const content = await fs.promises.readFile(fullPath, "utf8");

        // Remove trailing whitespace from each line
        const processedContent = content
          .split("\n")
          .map((line) => line.replace(/\s+$/, ""))
          .join("\n");

        // Only write if changes were made
        if (processedContent !== content) {
          await fs.promises.writeFile(fullPath, processedContent, "utf8");
          console.log(`Fixed trailing whitespace in ${fullPath}`);
        }
      } catch (fileError) {
        console.error(`Error processing file ${fullPath}:`, fileError);
      }
    }
  } catch (dirError) {
    console.error(`Error reading directory ${dir}:`, dirError);
  }
}

// Start processing from root directory
const rootDir = process.cwd();
console.log(`Starting whitespace cleanup from ${rootDir}`);
processDirectory(rootDir)
  .then(() => console.log("Whitespace cleanup completed"))
  .catch((err) => console.error("Error in whitespace cleanup:", err));
