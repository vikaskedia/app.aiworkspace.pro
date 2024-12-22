import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  if (!env.VITE_GITEA_HOST) {
    console.warn('WARNING: VITE_GITEA_HOST is not defined in your environment variables');
  }

  return {
    plugins: [vue()],
    base: "/",
    server: {
      port: 80,
      host: "0.0.0.0",
      proxy: {
        '/gitea': {
          target: env.VITE_GITEA_HOST || 'http://localhost:3000', // Fallback URL for development
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/gitea/, ''),
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending Request to:', req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Received Response from:', req.url, 'Status:', proxyRes.statusCode);
            });
          }
        }
      },
      watch: {
        ignored: ["**/coverage/**"],
      },
    },
    preview: {
      port: 80,
    }
  };
});
