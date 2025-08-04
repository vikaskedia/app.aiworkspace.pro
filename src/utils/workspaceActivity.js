import { supabase } from '../supabase';

/**
 * Function to record activity for a matter
 * @param {number} matterId - The workspace ID
 */
export async function updateMatterActivity(matterId) {
  try {
    // Get the current logged-in user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('No authenticated user found for workspace activity tracking');
      return;
    }

    // First check if records already exist for this matter-user combination
    const { data: existingActivities } = await supabase
      .from('workspace_activities')
      .select('id, updated_at')
      .eq('matter_id', matterId)
      .eq('user_id', user.id);

    const timestamp = new Date().toISOString();

    if (existingActivities && existingActivities.length > 0) {
      // If multiple records exist, delete all duplicates
      if (existingActivities.length > 1) {
        await supabase
          .from('workspace_activities')
          .delete()
          .eq('matter_id', matterId)
          .eq('user_id', user.id);
        
        // Insert a fresh record
        await supabase
          .from('workspace_activities')
          .insert({
            matter_id: matterId,
            user_id: user.id,
            updated_at: timestamp
          });
      } else {
        // Update the single existing record
        await supabase
          .from('workspace_activities')
          .update({ updated_at: timestamp })
          .eq('matter_id', matterId)
          .eq('user_id', user.id);
      }
    } else {
      // Insert new record
      await supabase
        .from('workspace_activities')
        .insert({
          matter_id: matterId,
          user_id: user.id,
          updated_at: timestamp
        });
    }
  } catch (error) {
    console.error('Error recording workspace activity:', error);
    // Don't throw error to avoid breaking the main functionality
  }
}

/**
 * Function to get recent activities for a matter
 * @param {number} matterId - The workspace ID
 * @param {number} limit - Number of activities to fetch (default: 10)
 */
export async function getMatterActivities(matterId, limit = 10) {
  try {
    const { data, error } = await supabase
      .from('workspace_activities')
      .select('*')
      .eq('matter_id', matterId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Get user information for each activity
    const activitiesWithUsers = await Promise.all(
      data.map(async (activity) => {
        try {
          const userData = await supabase.rpc('get_user_info_by_id', {
            user_id: activity.user_id
          });
          
          return {
            ...activity,
            user: userData.data?.[0] || { email: 'Unknown User' }
          };
        } catch (userError) {
          console.error('Error fetching user info:', userError);
          return {
            ...activity,
            user: { email: 'Unknown User' }
          };
        }
      })
    );

    return activitiesWithUsers;
  } catch (error) {
    console.error('Error fetching workspace activities:', error);
    return [];
  }
}

/**
 * Function to get user's recent activities across all workspaces
 * @param {string} userId - The user ID (optional, defaults to current user)
 * @param {number} limit - Number of activities to fetch (default: 20)
 */
export async function getUserActivities(userId = null, limit = 20) {
  try {
    let targetUserId = userId;
    
    // If no userId provided, get current user
    if (!targetUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('No authenticated user found');
        return [];
      }
      targetUserId = user.id;
    }

    const { data, error } = await supabase
      .from('workspace_activities')
      .select(`
        *,
        workspaces!inner (
          title,
          matter_number
        )
      `)
      .eq('user_id', targetUserId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching user activities:', error);
    return [];
  }
} 