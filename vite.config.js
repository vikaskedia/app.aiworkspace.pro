import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import vueJsx from '@vitejs/plugin-vue-jsx';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  if (!env.VITE_GITEA_HOST) {
    console.warn('WARNING: VITE_GITEA_HOST is not defined in your environment variables');
  }

  return {
    plugins: [
      vue(),
      vueJsx()
    ],
    base: "/",
    server: {
      port: 80,
      host: "0.0.0.0",
      watch: {
        ignored: ["**/coverage/**"],
      },
    },
    preview: {
      port: 80,
    },
    esbuild: {
      jsxFactory: 'h',
      jsxFragment: 'Fragment'
    }
  };
});