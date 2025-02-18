export default function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );
    return res.status(200).end();
  }

  // Handle GET request
  if (req.method === 'GET') {
    return res.status(200).json({ 
      success: true,
      message: 'Hello from Email API! (GET)'
    });
  }

  // Handle POST request
  if (req.method === 'POST') {
    return res.status(200).json({ 
      success: true,
      message: 'Hello from Email API! (POST)'
    });
  }

  // Handle other methods
  return res.status(405).json({ 
    success: false,
    error: 'Method not allowed' 
  });
}

// export default function handler(req, res) {
//     if (req.method !== 'GET') {
//       return res.status(405).json({ message: 'Method not allowed' });
//     }
//     return res.status(200).json({ message: 'Hello World!' });
// }