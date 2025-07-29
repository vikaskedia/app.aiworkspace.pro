export default async function handler(req, res) {
  console.log('📡 Outline diffs API called:', req.method, req.url);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS request handled');
    res.status(200).end();
    return;
  }

  try {
    const { method } = req;
    const { outlineId, matterId, sequenceNumber, diffs } = req.body || {};

    switch (method) {
      case 'GET':
        // Simple test response for now
        const { outlineId: queryOutlineId, sequenceNumber: querySequenceNumber } = req.query;
        const outlineIdParam = outlineId || queryOutlineId;
        const sequenceNumberParam = sequenceNumber || querySequenceNumber || 0;
        
        if (!outlineIdParam) {
          return res.status(400).json({ error: 'outlineId is required' });
        }

        // Return empty diffs for now
        return res.status(200).json({ diffs: [] });

      case 'POST':
        // Simple test response for now
        if (!outlineId || !matterId || !diffs || !Array.isArray(diffs)) {
          return res.status(400).json({ error: 'outlineId, matterId, and diffs array are required' });
        }

        // Return success response for now
        return res.status(200).json({ 
          success: true, 
          diffs: diffs,
          message: `Successfully processed ${diffs.length} diffs`
        });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Outline diffs API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 