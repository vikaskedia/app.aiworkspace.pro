export default function middleware(req) {
    const url = req.url;
    
    // Handle OPTIONS requests for CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization,Accept,Origin,X-Requested-With',
          'Access-Control-Max-Age': '86400'
        }
      });
    }
    
    // Forward the request to Gitea
    if (url.startsWith('/gitea/')) {
      const giteaUrl = `${process.env.VITE_GITEA_HOST}${url.replace('/gitea', '')}`;
      return fetch(giteaUrl, {
        method: req.method,
        headers: req.headers,
        body: req.body
      });
    }
    
    return next();
  }