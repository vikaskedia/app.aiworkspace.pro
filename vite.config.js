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
          target: env.VITE_GITEA_HOST,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/gitea/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log('Proxy request:', req.method, req.url);
              // Remove duplicate headers
              const existingAuth = proxyReq.getHeader('Authorization');
              if (Array.isArray(existingAuth)) {
                proxyReq.setHeader('Authorization', existingAuth[0]);
              }
            });
            proxy.on('proxyRes', (proxyRes, req, res) => {
              proxyRes.headers['access-control-allow-origin'] = '*';
              proxyRes.headers['access-control-allow-methods'] = 'GET,HEAD,PUT,PATCH,POST,DELETE';
              proxyRes.headers['access-control-allow-headers'] = 'Content-Type,Authorization,Accept,Origin,X-Requested-With';
            });
            proxy.on('error', (err, req, res) => {
              console.error('Proxy error:', err);
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