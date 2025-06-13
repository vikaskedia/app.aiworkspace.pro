<template>
  <div class="login-container">
    <header class="site-header">
      <div class="header-content">
        <img src="/associate-ai-attorney-logo.svg" alt="Legal Studio" class="logo-image" />
        <h1>Legal Studio</h1>
      </div>
    </header>

    <el-card class="login-card">
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
import { ref } from 'vue';
import { MP } from '../mixpanel';

export default {
  setup() {
    const loginForm = ref({
      email: '',
      password: ''
    });

    const loading = ref(false);
    const loginFormRef = ref(null);

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

    return {
      loginForm,
      loading,
      loginFormRef,
      rules
    };
  },

  methods: {
    async loginWithProvider(provider) {
      try {
        const redirectTo = `${window.location.origin}/callback`;
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
        MP.identify(data.user.id);
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
        });

        ElMessage.success('Login successful');

        // Access the user ID from the session data
        const userId = data.user?.id;
        console.log(userId);

        const { data: matters, error: mattersError } = await supabase
        .from('matters')
        .select(`
          *,
         workspace_access!inner (
            access_type,
            shared_with_user_id
          )
        `)
        .eq('archived', false)
        .eq('workspace_access.shared_with_user_id', userId);

      if (mattersError) throw mattersError;

      // Handle the 3 scenarios
      if (matters.length === 0) {
        this.$router.push('/initial-consultation');
        return;
      } else {
        this.$router.push('/all-workspace');
        return;
      } 
        
      } catch (error) {
        // Track failed login
        MP.track('Login Failed', {
          loginMethod: 'email',
          error: error.message
        });
        ElMessage.error('Login failed: ' + error.message);
      } finally {
        this.loading = false;
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
</style>
  