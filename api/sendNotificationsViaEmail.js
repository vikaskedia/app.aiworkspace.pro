import { createClient } from '@supabase/supabase-js';

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

  // Initialize Supabase client
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );

  if (req.method === 'GET') {
    try {
      // Fetch first 5 notifications
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .limit(5)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('First 5 notifications:', data);

      return res.status(200).json({ 
        message: 'Notifications retrieved successfully',
        data: data
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch notifications',
        details: error.message 
      });
    }
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