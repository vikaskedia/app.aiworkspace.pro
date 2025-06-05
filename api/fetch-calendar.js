export default async function handler(req, res) {
  // Set CORS headers to allow requests from your frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { icalUrl } = req.query;

  if (!icalUrl) {
    return res.status(400).json({ error: 'icalUrl parameter is required' });
  }

  try {
    console.log('Fetching iCal data from:', icalUrl);
    
    // Fetch the iCal data from Google Calendar
    const response = await fetch(icalUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch calendar data: ${response.status} ${response.statusText}`);
    }

    const icalData = await response.text();
    
    console.log('Successfully fetched iCal data, length:', icalData.length);
    
    // Return the iCal data as plain text
    res.setHeader('Content-Type', 'text/calendar');
    res.status(200).send(icalData);
    
  } catch (error) {
    console.error('Error fetching calendar data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch calendar data', 
      details: error.message 
    });
  }
} 