<template>
  <div class="simple-container">
    <div v-if="isLoading" class="message">
      <p>Checking authentication status...</p>
    </div>

    <div v-else-if="isAuthenticated" class="message">
      <p>Redirecting...</p>
    </div>

    <div v-else class="message">
      <p>Please log in to continue</p>
      <p><a href="https://login.aiworkspace.pro">Go to Login</a></p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase'

const isLoading = ref(true)
const isAuthenticated = ref(false)

const checkAuthStatus = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      console.error('Error checking auth status:', error)
      isAuthenticated.value = false
    } else {
      isAuthenticated.value = !!user
    }
  } catch (error) {
    console.error('Error checking auth status:', error)
    isAuthenticated.value = false
  } finally {
    isLoading.value = false
  }
}

const redirectToDashboard = () => {
  try {
    window.location.href = 'https://all-ws-dashboard.aiworkspace.pro/all-workspace/dashboard'
  } catch (error) {
    console.error('Redirect failed:', error)
    if (window.location.hostname === 'aiworkspace.pro') {
      window.location.href = '/all-workspace/dashboard'
    }
  }
}

onMounted(async () => {
  await checkAuthStatus()
  
  // If user is authenticated, redirect after a short delay
  if (isAuthenticated.value) {
    setTimeout(() => {
      redirectToDashboard()
    }, 1000)
  }
})
</script>

<style scoped>
.simple-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  font-family: Arial, sans-serif;
}

.message {
  text-align: center;
  padding: 2rem;
}

.message p {
  margin: 0.5rem 0;
  font-size: 1.1rem;
  color: #333;
}

.message a {
  color: #409eff;
  text-decoration: none;
}

.message a:hover {
  text-decoration: underline;
}
</style>
