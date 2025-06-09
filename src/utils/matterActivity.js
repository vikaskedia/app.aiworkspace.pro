import { supabase } from '../supabase';

/**
 * Simple function to update the last_activity_at timestamp for a matter
 * @param {number} matterId - The matter ID
 */
export async function updateMatterActivity(matterId) {
  try {
    await supabase
      .from('matters')
      .update({ 
        last_activity_at: new Date().toISOString()
      })
      .eq('id', matterId);
  } catch (error) {
    console.error('Error updating matter activity:', error);
    // Don't throw error to avoid breaking the main functionality
  }
} 