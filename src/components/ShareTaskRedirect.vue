<template>
  <div class="redirect-container">
    <el-loading-spinner />
    <p>Redirecting to shared task...</p>
  </div>
</template>

<script>
import { supabase } from '../supabase'

export default {
  name: 'ShareTaskRedirect',
  async mounted() {
    try {
      const shortId = this.$route.params.shortId
      
      if (!shortId) {
        this.$router.push('/login')
        return
      }

      // Look up the full share record by short_id
      const { data, error } = await supabase
        .from('task_external_shares')
        .select('id, token, status, expires_at')
        .eq('short_id', shortId)
        .eq('status', 'active')
        .single()

      if (error || !data) {
        console.error('Short URL not found or expired:', error)
        this.$router.push('/login')
        return
      }

      // Check if the share has expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        console.error('Share link has expired')
        this.$router.push('/login')
        return
      }

      // Redirect to the full external task URL
      const fullUrl = `/external-task/${data.id}?token=${data.token}`
      this.$router.replace(fullUrl)

    } catch (error) {
      console.error('Error redirecting:', error)
      this.$router.push('/login')
    }
  }
}
</script>

<style scoped>
.redirect-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 1rem;
}
</style> 