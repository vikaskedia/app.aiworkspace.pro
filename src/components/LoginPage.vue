<template>
  <div class="login-container">
    <header class="site-header">
      <div class="header-content">
        <img src="/associate-ai-attorney-logo.svg" alt="AI Workspace" class="logo-image" />
        <h1>AI Workspace</h1>
      </div>
    </header>

    <!-- Show profile if user is logged in -->
    <el-card v-if="isAuthenticated" class="profile-card" shadow="never">
      <div class="profile-header">
        <h1>Welcome to AI Workspace</h1>
        <el-button type="danger" @click="handleLogout" class="logout-btn">
          Logout
        </el-button>
      </div>
      
      <div class="success-message">
        <h2>You have successfully logged in into AI Workspace</h2>
      </div>

      <div class="profile-content">
        <div class="avatar-section">
          <img 
            :src="userAvatar" 
            :alt="userName"
            class="user-avatar"
          />
        </div>
        
        <div class="user-details">
          <div class="detail-row">
            <span class="label">Logged In User Details:</span>
          </div>
          <div class="detail-row">
            <span class="field-label">Name:</span>
            <span class="field-value">{{ userName }}</span>
          </div>
          <div class="detail-row">
            <span class="field-label">Email:</span>
            <span class="field-value">{{ userEmail }}</span>
          </div>
          <div class="detail-row">
            <span class="field-label">Login Provider:</span>
            <span class="field-value">{{ loginProvider }}</span>
          </div>
        </div>
      </div>
    </el-card>

    <!-- Show login form if user is not logged in -->
    <el-card v-else class="login-card">
      <div class="logo-section">
        <h2>Welcome Back</h2>
        <p>Sign in to continue to your account</p>
      </div>
      
      <el-form 
        :model="loginForm" 
        :rules="rules"
        ref="loginFormRef"
        class="login-form">
        <el-form-item prop="email">
          <el-input 
            v-model="loginForm.email"
            placeholder="Email"
            type="email">
            <template #prefix>
              <i class="fas fa-envelope"></i>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item prop="password">
          <el-input 
            v-model="loginForm.password"
            placeholder="Password"
            type="password"
            show-password>
            <template #prefix>
              <i class="fas fa-lock"></i>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item>
          <el-button 
            type="primary" 
            class="submit-button"
            :loading="loading"
            @click="handleEmailLogin">
            Sign In
          </el-button>
        </el-form-item>
      </el-form>

      <div class="divider">
        <span>Or continue with</span>
      </div>

      <div class="login-buttons">
        <el-button
          class="login-button google"
          @click="loginWithProvider('google')"
          size="large">
          <i class="fab fa-google"></i>
          Google
        </el-button>

        <el-button
          class="login-button github"
          @click="loginWithProvider('github')"
          size="large">
          <i class="fab fa-github"></i>
          GitHub
        </el-button>

        <el-button
          class="login-button twitter"
          @click="loginWithProvider('twitter')"
          size="large">
          <i class="fab fa-twitter"></i>
          X (Twitter)
        </el-button>
      </div>

      <div class="terms">
        By continuing, you agree to AI Associate Attorney's Terms of Service and Privacy Policy
      </div>

      <div class="forgot-password">
        <router-link to="/forgot-password">Forgot Password?</router-link>
      </div>

      <div class="signup-link">
        Don't have an account? 
        <router-link to="/signup">Sign up</router-link>
      </div>
    </el-card>
  </div>
</template>

<script>
import { supabase } from '../supabase';
import { ElMessage } from 'element-plus';
import { ref, computed } from 'vue';
import { MP } from '../mixpanel';
import { useRouter } from 'vue-router';
import { setPageTitle } from '../utils/page-title';
import { buildOAuthRedirectUrl } from '../utils/authRedirect';

export default {
  setup() {
    const loginForm = ref({
      email: '',
      password: ''
    });

    const loading = ref(false);
    const loginFormRef = ref(null);
    const router = useRouter();
    const user = ref(null);
    const isAuthenticated = ref(false);

    const rules = {
      email: [
        { required: true, message: 'Please enter your email', trigger: 'blur' },
        { type: 'email', message: 'Please enter a valid email', trigger: 'blur' }
      ],
      password: [
        { required: true, message: 'Please enter your password', trigger: 'blur' },
        { min: 6, message: 'Password must be at least 6 characters', trigger: 'blur' }
      ]
    };

    // User profile computed properties
    const userName = computed(() => {
      if (!user.value) return 'Unknown User'
      return user.value.user_metadata?.full_name || 
             user.value.user_metadata?.name || 
             user.value.email || 'Unknown User'
    });

    const userEmail = computed(() => {
      if (!user.value) return 'No email'
      return user.value.email || 'No email'
    });

    const userAvatar = computed(() => {
      if (!user.value) return ''
      return user.value.user_metadata?.avatar_url || 
             user.value.user_metadata?.picture || 
             `https://ui-avatars.com/api/?name=${encodeURIComponent(userName.value)}&background=random`
    });

    const loginProvider = computed(() => {
      if (!user.value) return 'Unknown'
      const providers = user.value.app_metadata?.providers
      if (providers && Array.isArray(providers)) {
        return providers.map(provider => {
          if (provider === 'google') return 'Google'
          if (provider === 'github') return 'GitHub' 
          if (provider === 'twitter') return 'Twitter/X'
          return provider
        }).join(', ')
      }
      // Fallback to single provider if providers array not available
      const provider = user.value.app_metadata?.provider
      if (provider === 'google') return 'Google'
      if (provider === 'github') return 'GitHub' 
      if (provider === 'twitter') return 'Twitter/X'
      return provider || 'Email/Password'
    });

    // Check authentication status
    const checkAuthStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          user.value = session.user;
          isAuthenticated.value = true;
        } else {
          user.value = null;
          isAuthenticated.value = false;
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        user.value = null;
        isAuthenticated.value = false;
      }
    };

    // Set page title
    setPageTitle({ componentName: 'Sign In' });

    // Check auth status on component mount
    checkAuthStatus();

    return {
      loginForm,
      loading,
      loginFormRef,
      rules,
      router,
      user,
      isAuthenticated,
      userName,
      userEmail,
      userAvatar,
      loginProvider,
      checkAuthStatus
    };
  },

  methods: {
    async loginWithProvider(provider) {
      try {
        const redirectTo = buildOAuthRedirectUrl();
        const mainDomain = window.location.hostname === 'localhost' 
          ? 'http://localhost' 
          : `https://www.${window.location.hostname.split('.').slice(-2).join('.')}`;

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: provider,
          options: {
            redirectTo: redirectTo,
            queryParams: {
              redirect_origin: mainDomain
            }
          },
        });
        
        if (error) {
          MP.track('Login Failed', {
            loginMethod: provider,
            error: error.message
          });
          ElMessage.error('Login failed: ' + error.message);
        } else {
          MP.track('User Login Initiated', {
            loginMethod: provider
          });
          ElMessage.success('Redirecting to login provider...');
        }
      } catch (err) {
        MP.track('Login Failed', {
          loginMethod: provider,
          error: err.message
        });
        ElMessage.error('An unexpected error occurred');
      }
    },

    async handleEmailLogin() {
      if (!this.loginFormRef) return;
      
      try {
        await this.loginFormRef.validate();
        this.loading = true;

        const { data, error } = await supabase.auth.signInWithPassword({
          email: this.loginForm.email,
          password: this.loginForm.password
        });

        if (error) throw error;

        // Track successful login
       /* MP.identify(data.user.id);
        MP.track('User Login', {
          loginMethod: 'email',
          userId: data.user.id,
          email: data.user.email
        });
        MP.setUserProperties({
          email: data.user.email,
          name: data.user.user_metadata?.full_name,
          accountType: 'email',
          lastLoginAt: new Date().toISOString()
        });*/

        ElMessage.success('Login successful');

        // Update user state
        this.user = data.user;
        this.isAuthenticated = true;

        // Access the user ID from the session data
        const userId = data.user?.id;
        console.log(userId);

        const { data: workspaces, error: workspacesError } = await supabase
        .from('workspaces')
        .select(`
          *,
         workspace_access!inner (
            access_type,
            shared_with_user_id
          )
        `)
        .eq('archived', false)
        .eq('workspace_access.shared_with_user_id', userId);

      if (workspacesError) throw workspacesError;

      // Handle the 3 scenarios
      if (workspaces.length === 0) {
        this.router.push('/initial-consultation');
        return;
      } else {
        this.router.push('/all-workspace');
        return;
      } 
        
      } catch (error) {
        // Track failed login
        // MP.track('Login Failed', {
        //   loginMethod: 'email',
        //   error: error.message
        // });
        ElMessage.error('Login failed: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async handleLogout() {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        // Clear user state
        this.user = null;
        this.isAuthenticated = false;
        
        ElMessage.success('Logged out successfully');
      } catch (error) {
        console.error('Logout error:', error);
        ElMessage.error('Failed to logout');
      }
    }
  },
};
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
  font-family: Open Sans,sans-serif;
  width: 100%;
  overflow-x: hidden;
}

.login-card {
  width: 100%;
  max-width: 600px;
  padding: 2rem;
  margin: 2rem auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.logo-section {
  text-align: center;
  margin-bottom: 2.5rem;
}

.logo-section h2 {
  color: #303133;
  margin-bottom: 0.5rem;
  margin-top: 0;
  font-size: 1.8rem;
}

.logo-section p {
  color: #606266;
  font-size: 0.9rem;
}

.login-buttons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.login-button {
  font-size: 1rem;
  border-radius: 8px;
  transition: transform 0.2s;
}

.login-button i {
  font-size: 1.2rem;
  margin-right: 8px;
}

.google {
  background-color: #fff;
  color: #606266;
  border: 1px solid #dcdfe6;
}

.google:hover {
  background-color: #f5f7fa;
  border-color: #c0c4cc;
}

.github {
  background-color: #24292e;
  color: #fff;
  border: none;
}

.facebook {
  background-color: #1877f2;
  color: #fff;
  border: none;
}

.facebook:hover {
  background-color: #166fe5;
}

.github:hover {
  background-color: #2f363d;
}

.twitter {
  background-color: #1da1f2;
  color: #fff;
  border: none;
}

.twitter:hover {
  background-color: #1a91da;
}

.terms {
  margin-top: 2rem;
  text-align: center;
  font-size: 0.8rem;
  color: #909399;
}

.el-button+.el-button {
  margin-left: 0;
}

.signup-link {
  text-align: center;
  margin-top: 1.5rem;
  font-size: 0.9rem;
  color: #606266;
}

.signup-link a {
  color: #409eff;
  text-decoration: none;
  margin-left: 4px;
}

.signup-link a:hover {
  text-decoration: underline;
}

.site-header {
  /* Modern blue gradient with better contrast */
  /*background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);*/
  /* Alternative gradient options (uncomment to try):
  background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);*/
  background: linear-gradient(135deg, #0f172a 0%, #334155 100%); 
  
  padding: 0.8rem;
  color: white;
  /* Improved shadow for depth */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 1.5rem; /* Increased gap slightly */
}

.header-content h1 {
  font-weight: 400;
  font-size: 1.7rem;
  letter-spacing: -0.5px;
  margin: 0;
}

.logo-image {
  height: 40px;
  width: auto;
  background-color: white;
  padding: 6px;
  border-radius: 8px;
}

/* Media queries for responsive design */
@media (max-width: 640px) {
  .login-buttons {
    grid-template-columns: 1fr;
  }
  
  .login-card {
    margin: 0.5rem;
    padding: 1rem;
    width: auto;
  }

  .header-content h1 {
    font-size: 1.5rem;
  }
}

@supports (padding: max(0px)) {
  .login-container {
    padding-left: max(0px, env(safe-area-inset-left));
    padding-right: max(0px, env(safe-area-inset-right));
  }
}

.login-form {
  margin-bottom: 2rem;
}

.submit-button {
  width: 100%;
  height: 48px;
  font-size: 1rem;
}

.divider {
  text-align: center;
  margin: 1.5rem 0;
  position: relative;
}

.divider::before,
.divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: calc(50% - 50px);
  height: 1px;
  background-color: #dcdfe6;
}

.divider::before {
  left: 0;
}

.divider::after {
  right: 0;
}

.divider span {
  background-color: white;
  padding: 0 1rem;
  color: #909399;
  font-size: 0.9rem;
}

.forgot-password {
  text-align: center;
  margin: 1rem 0;
}

.forgot-password a {
  color: #409eff;
  text-decoration: none;
  font-size: 0.9rem;
}

.forgot-password a:hover {
  text-decoration: underline;
}

:deep(.el-input__wrapper) {
  padding-left: 0;
}

:deep(.el-input__prefix) {
  margin-right: 8px;
}

/* Profile card styles */
.profile-card {
  width: 100%;
  max-width: none;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: #fff;
  box-shadow: 0 10px 25px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
  padding: 0;
  overflow: hidden;
  margin: auto;
}

@media (min-width: 900px) {
  .profile-card {
    max-width: 1000px;
  }
}

.profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 32px;
  background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
  color: white;
  margin: 0;
  border-bottom: none;
}

.profile-header h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  color: white;
  text-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.logout-btn {
  font-size: 14px;
  font-weight: 600;
  padding: 12px 24px;
  border-radius: 8px;
  background: rgba(255,255,255,0.2);
  border: 2px solid rgba(255,255,255,0.3);
  color: white;
  transition: all 0.2s ease;
}

.logout-btn:hover {
  background: rgba(255,255,255,0.3);
  border-color: rgba(255,255,255,0.5);
  transform: translateY(-1px);
}

.success-message {
  text-align: center;
  padding: 30px 32px 20px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
}

.success-message h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #059669;
  text-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.profile-content {
  display: flex;
  gap: 32px;
  align-items: flex-start;
  padding: 32px;
  background: #fafafa;
}

.avatar-section {
  flex-shrink: 0;
}

.user-avatar {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  object-fit: cover;
  border: 5px solid #fff;
  box-shadow: 0 8px 20px rgba(0,0,0,0.12);
  transition: transform 0.3s ease;
}

.user-avatar:hover {
  transform: scale(1.05);
}

.user-details {
  flex: 1;
  background: white;
  border-radius: 12px;
  padding: 5px 28px;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f3f4f6;
}

.detail-row:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.label {
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
  display: block;
  width: 100%;
}

.field-label {
  font-size: 16px;
  font-weight: 600;
  color: #6b7280;
  min-width: 140px;
}

.field-value {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  background: linear-gradient(135deg, #0f172a, #334155);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

@media (max-width: 768px) {
  .profile-card {
    margin: 12px;
  }
  
  .profile-header {
    flex-direction: column;
    gap: 16px;
    align-items: center;
    padding: 20px;
  }
  
  .profile-header h1 {
    font-size: 22px;
    text-align: center;
  }
  
  .success-message {
    padding: 24px 20px 12px;
  }
  
  .success-message h2 {
    font-size: 20px;
  }
  
  .profile-content {
    flex-direction: column;
    gap: 20px;
    align-items: center;
    padding: 24px 16px;
  }
  
  .user-avatar {
    width: 100px;
    height: 100px;
  }
  
  .user-details {
    padding: 20px 16px;
  }
  
  .detail-row {
    justify-content: flex-start;
    flex-wrap: nowrap;
    padding: 8px 0;
    margin-bottom: 12px;
  }
  
  .field-label {
    min-width: auto;
    margin-right: 8px;
  }
  
  .label {
    font-size: 18px;
    padding-bottom: 8px;
    margin-bottom: 4px;
  }
}
</style>
  