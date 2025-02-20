export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Handle GET and POST methods
  if (req.method === 'GET') {
    return res.status(200).json({ 
      message: 'Hello World from GET method!'
    });
  }
  
  if (req.method === 'POST') {
    return res.status(200).json({ 
      message: 'Hello World from POST method!'
    });
  }

  // Handle unsupported methods
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ 
    error: `Method ${req.method} Not Allowed` 
  });
}