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
          target: env.VITE_GITEA_HOST || 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
          ws: true,
          xfwd: true,
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              // Preserve original headers
              proxyReq.setHeader('origin', new URL(env.VITE_GITEA_HOST || 'http://localhost:3000').origin);
              proxyReq.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              proxyReq.setHeader('Pragma', 'no-cache');
              proxyReq.setHeader('Expires', '0');
              
              console.log('Sending Request to:', req.url, 'Headers:', proxyReq.getHeaders());
            });

            proxy.on('proxyRes', (proxyRes, req, _res) => {
              // Enhanced logging
              console.log('Received Response from:', req.url, 'Status:', proxyRes.statusCode);
              console.log('Response headers:', proxyRes.headers);
              
              // Set CORS headers
              proxyRes.headers['access-control-allow-origin'] = '*';
              proxyRes.headers['access-control-allow-methods'] = 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS';
              proxyRes.headers['access-control-allow-headers'] = 'Content-Type,Authorization,Accept,Origin,X-Requested-With';
              proxyRes.headers['access-control-max-age'] = '3600';
            });

            proxy.on('error', (err, _req, _res) => {
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
