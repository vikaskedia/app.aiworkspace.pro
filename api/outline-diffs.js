import { supabase } from '../src/supabase';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { method } = req;
    const { outlineId, matterId, sequenceNumber, diffs } = req.body;

    switch (method) {
      case 'GET':
        // Get diffs after a certain sequence number
        const { outlineId: queryOutlineId, sequenceNumber: querySequenceNumber } = req.query;
        const outlineIdParam = outlineId || queryOutlineId;
        const sequenceNumberParam = sequenceNumber || querySequenceNumber || 0;
        
        if (!outlineIdParam) {
          return res.status(400).json({ error: 'outlineId is required' });
        }

        const { data: diffs, error: fetchError } = await supabase
          .rpc('get_outline_diffs_after_sequence', {
            p_outline_id: parseInt(outlineIdParam),
            p_after_sequence: parseInt(sequenceNumberParam)
          });

        if (fetchError) {
          console.error('Error fetching diffs:', fetchError);
          return res.status(500).json({ error: 'Failed to fetch diffs' });
        }

        return res.status(200).json({ diffs });

      case 'POST':
        // Create new diffs
        if (!outlineId || !matterId || !diffs || !Array.isArray(diffs)) {
          return res.status(400).json({ error: 'outlineId, matterId, and diffs array are required' });
        }

        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        // Insert multiple diffs
        const diffsToInsert = diffs.map(diff => ({
          outline_id: outlineId,
          matter_id: matterId,
          diff_type: diff.diff_type,
          node_id: diff.node_id,
          parent_node_id: diff.parent_node_id,
          diff_data: diff.diff_data,
          user_id: user.id,
          session_id: diff.session_id || 'unknown',
          operation_metadata: diff.operation_metadata || {}
        }));

        const { data: insertedDiffs, error: insertError } = await supabase
          .from('outline_diffs')
          .insert(diffsToInsert)
          .select();

        if (insertError) {
          console.error('Error inserting diffs:', insertError);
          return res.status(500).json({ error: 'Failed to insert diffs' });
        }

        return res.status(200).json({ 
          success: true, 
          diffs: insertedDiffs,
          message: `Successfully inserted ${insertedDiffs.length} diffs`
        });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Outline diffs API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 