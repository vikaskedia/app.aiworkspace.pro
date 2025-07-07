import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

// Function to get current git commit hash
function getGitCommitHash() {
  try {
    return execSync('git rev-parse HEAD').toString().trim();
  } catch (error) {
    console.warn('Could not get git commit hash:', error.message);
    return 'unknown';
  }
}

// Plugin to generate version.json file
function generateVersionFile() {
  return {
    name: 'generate-version-file',
    buildStart() {
      const commitHash = getGitCommitHash();
      const shortCommitHash = commitHash.substring(0, 7);
      
      const versionData = {
        fullCommitHash: commitHash,
        shortCommitHash: shortCommitHash,
        timestamp: new Date().toISOString(),
        buildTime: new Date().toISOString()
      };

      // Write to public directory so it's accessible as a static file
      const publicDir = resolve(process.cwd(), 'public');
      const versionFilePath = resolve(publicDir, 'version.json');
      
      try {
        writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2));
        console.log('✅ Generated version.json with hash:', shortCommitHash);
      } catch (error) {
        console.error('❌ Failed to generate version.json:', error);
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  if (!env.VITE_GITEA_HOST) {
    console.warn('WARNING: VITE_GITEA_HOST is not defined in your environment variables');
  }

  // Get commit hash for version tracking
  const commitHash = getGitCommitHash();
  const shortCommitHash = commitHash.substring(0, 7);

  return {
    plugins: [
      vue(),
      generateVersionFile()
    ],
    base: "/",
    define: {
      __COMMIT_HASH__: JSON.stringify(commitHash),
      __SHORT_COMMIT_HASH__: JSON.stringify(shortCommitHash),
    },
    server: {
      port: 80,
      host: "0.0.0.0",
      watch: {
        ignored: ["**/coverage/**"],
      },
      headers: {
        'Permissions-Policy': 'browsing-topics=()'
      }
    },
    preview: {
      port: 80,
    }
  };
});