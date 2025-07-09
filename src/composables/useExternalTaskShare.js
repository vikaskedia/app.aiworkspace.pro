import { ref } from 'vue'
import { supabase } from '../supabase'
import { ElMessage } from 'element-plus'

export function useExternalTaskShare() {
  const generatingExternalLink = ref(false)
  const revokingExternalLink = ref(false)
  const externalShareLink = ref('')
  const externalShareHistory = ref([])

  // Generate cryptographically secure token
  const generateSecureToken = () => {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  // Generate short ID for URL shortening (6 characters, alphanumeric)
  const generateShortId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  // Generate external share link
  const generateExternalShareLink = async (taskId, userId) => {
    try {
      generatingExternalLink.value = true

      // Generate secure token and short ID
      const token = generateSecureToken()
      const shareId = crypto.randomUUID()
      
      // Generate unique short ID (retry if collision)
      let shortId
      let attempts = 0
      const maxAttempts = 10
      
      while (attempts < maxAttempts) {
        shortId = generateShortId()
        
        // Check if short ID already exists
        const { data: existingShare } = await supabase
          .from('task_external_shares')
          .select('id')
          .eq('short_id', shortId)
          .single()
        
        if (!existingShare) {
          break // Short ID is unique
        }
        
        attempts++
      }
      
      if (attempts >= maxAttempts) {
        throw new Error('Failed to generate unique short ID after multiple attempts')
      }

      // Create external share record
      const { data, error } = await supabase
        .from('task_external_shares')
        .insert({
          id: shareId,
          task_id: taskId,
          shared_by: userId,
          token: token,
          short_id: shortId,
          status: 'active',
          access_count: 0,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        })
        .select()
        .single()

      if (error) {
        console.error('Supabase error:', error)
        throw new Error(error.message)
      }

      // Generate the short URL
      const baseUrl = window.location.origin
      const generatedLink = `${baseUrl}/short-link/${shortId}`
      
      externalShareLink.value = generatedLink
      
      // Add to history
      externalShareHistory.value.push({
        id: data.id,
        short_id: data.short_id,
        created_at: data.created_at,
        status: data.status,
        access_count: data.access_count,
        expires_at: data.expires_at
      })

      ElMessage.success('External share link generated successfully')
      return generatedLink

    } catch (error) {
      console.error('Error generating external share link:', error)
      ElMessage.error('Failed to generate external share link: ' + error.message)
      throw error
    } finally {
      generatingExternalLink.value = false
    }
  }

  // Revoke external share link
  const revokeExternalShareLink = async (taskId) => {
    try {
      revokingExternalLink.value = true

      // Update status to revoked for all active shares of this task
      const { error } = await supabase
        .from('task_external_shares')
        .update({ status: 'revoked' })
        .eq('task_id', taskId)
        .eq('status', 'active')

      if (error) {
        console.error('Supabase error:', error)
        throw new Error(error.message)
      }

      externalShareLink.value = ''
      externalShareHistory.value = externalShareHistory.value.map(entry => ({
        ...entry,
        status: entry.status === 'active' ? 'revoked' : entry.status
      }))

      ElMessage.success('External share link revoked successfully')

    } catch (error) {
      console.error('Error revoking external share link:', error)
      ElMessage.error('Failed to revoke external share link: ' + error.message)
      throw error
    } finally {
      revokingExternalLink.value = false
    }
  }

  // Revoke specific external share link
  const revokeSpecificExternalShareLink = async (shareId) => {
    try {
      const { error } = await supabase
        .from('task_external_shares')
        .update({ status: 'revoked' })
        .eq('id', shareId)

      if (error) {
        console.error('Supabase error:', error)
        throw new Error(error.message)
      }

      externalShareHistory.value = externalShareHistory.value.map(entry =>
        entry.id === shareId ? { ...entry, status: 'revoked' } : entry
      )

      ElMessage.success('External share link revoked successfully')

    } catch (error) {
      console.error('Error revoking specific external share link:', error)
      ElMessage.error('Failed to revoke external share link: ' + error.message)
      throw error
    }
  }

  // Load external share history
  const loadExternalShareHistory = async (taskId) => {
    try {
      const { data, error } = await supabase
        .from('task_external_shares')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Supabase error:', error)
        throw new Error(error.message)
      }

      externalShareHistory.value = data || []
      
      // Find active link
      const activeLink = data?.find(share => share.status === 'active')
      if (activeLink && activeLink.short_id) {
        const baseUrl = window.location.origin
        externalShareLink.value = `${baseUrl}/short-link/${activeLink.short_id}`
      } else {
        externalShareLink.value = ''
      }

    } catch (error) {
      console.error('Error loading external share history:', error)
      // Don't show error message for loading, just log it
    }
  }

  // Copy external link to clipboard
  const copyExternalLink = async () => {
    try {
      await navigator.clipboard.writeText(externalShareLink.value)
      ElMessage.success('External share link copied to clipboard')
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      ElMessage.error('Failed to copy external share link')
    }
  }

  // Get external task access (for external users)
  const getExternalTaskAccess = async (shareId, token) => {
    try {
      // Validate token and get task access
      const { data: shareData, error: shareError } = await supabase
        .from('task_external_shares')
        .select(`
          *,
          tasks:task_id (
            id,
            title,
            description,
            status,
            priority,
            due_date,
            created_at,
            updated_at,
            matters:matter_id (
              id,
              title,
              git_repo
            )
          )
        `)
        .eq('id', shareId)
        .eq('token', token)
        .eq('status', 'active')
        .single()

      if (shareError || !shareData) {
        throw new Error('Invalid or expired share link')
      }

      // Check if link has expired
      if (new Date(shareData.expires_at) < new Date()) {
        throw new Error('Share link has expired')
      }

      // Increment access count
      const { error: updateError } = await supabase
        .from('task_external_shares')
        .update({ 
          access_count: shareData.access_count + 1,
          last_accessed_at: new Date().toISOString()
        })
        .eq('id', shareId)

      if (updateError) {
        console.error('Failed to update access count:', updateError)
      }

      return shareData

    } catch (error) {
      console.error('Error getting external task access:', error)
      throw error
    }
  }

  // Add external comment
  const addExternalComment = async (taskId, userEmail, content) => {
    try {
      // First get the task to get the matter_id
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('matter_id')
        .eq('id', taskId)
        .single()

      if (taskError || !task) {
        throw new Error('Could not find task information')
      }

      const { data, error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          matter_id: task.matter_id,
          user_id: null, // External users don't have user_id
          external_user_email: userEmail,
          content: content,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Supabase error:', error)
        throw new Error(error.message)
      }

      return data

    } catch (error) {
      console.error('Error adding external comment:', error)
      throw error
    }
  }

  // Get task comments (including external ones)
  const getTaskComments = async (taskId) => {
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Supabase error:', error)
        throw new Error(error.message)
      }

      return data || []

    } catch (error) {
      console.error('Error getting task comments:', error)
      throw error
    }
  }

  return {
    // State
    generatingExternalLink,
    revokingExternalLink,
    externalShareLink,
    externalShareHistory,
    
    // Methods
    generateExternalShareLink,
    revokeExternalShareLink,
    revokeSpecificExternalShareLink,
    loadExternalShareHistory,
    copyExternalLink,
    getExternalTaskAccess,
    addExternalComment,
    getTaskComments
  }
} 