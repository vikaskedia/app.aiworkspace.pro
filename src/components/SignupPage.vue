<template>
  <div class="signup-container">
    <header class="site-header">
      <div class="header-content">
        <img src="/associate-ai-attorney-logo.svg" alt="Legal Studio" class="logo-image" />
        <h1>Legal Studio</h1>
      </div>
    </header>

    <el-card class="signup-card">
      <div class="logo-section">
        <h2>Create Account</h2>
        <p>Sign up to get started with AI Associate Attorney</p>
      </div>
      
      <div class="social-buttons">
        <div class="button-row">
          <el-button
            class="social-button google"
            @click="loginWithProvider('google')"
            size="large">
            <i class="fab fa-google"></i>
            Google
          </el-button>

          <el-button
            class="social-button github"
            @click="loginWithProvider('github')"
            size="large">
            <i class="fab fa-github"></i>
            GitHub
          </el-button>
        </div>

        <div class="button-row">
          <!-- <el-button
            class="social-button facebook" 
            @click="loginWithProvider('facebook')"
            size="large">
            <i class="fab fa-facebook"></i>
            Facebook
          </el-button> -->

          <el-button
            class="social-button twitter"
            @click="loginWithProvider('twitter')"
            size="large">
            <i class="fab fa-twitter"></i>
            X (Twitter)
          </el-button>
        </div>
      </div>

      <div class="terms">
        By continuing, you agree to AI Associate Attorney's Terms of Service and Privacy Policy
      </div>

      <div class="login-link">
        Already have an account? 
        <router-link to="/login">Sign in</router-link>
      </div>
    </el-card>
  </div>
</template>

<script>
import { supabase } from '../supabase';
import { ElMessage } from 'element-plus';

export default {
  name: 'SignupPage',
  methods: {
    async loginWithProvider(provider) {
      try {
        const redirectTo = `${window.location.origin}/callback`;
        const { error } = await supabase.auth.signInWithOAuth({
          provider: provider,
          options: {
            redirectTo: redirectTo,
            queryParams: {
              redirect_origin: window.location.origin
            }
          },
        });
        
        if (error) {
          ElMessage.error('Signup failed: ' + error.message);
        } else {
          ElMessage.success('Redirecting to login provider...');
        }
      } catch (err) {
        ElMessage.error('An unexpected error occurred');
        console.error(err);
      }
    }
  }
};
</script>

<style scoped>
.signup-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
  font-family: Open Sans,sans-serif;
  width: 100%;
  overflow-x: hidden;
}

.signup-card {
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
  font-size: 1.8rem;
}

.logo-section p {
  color: #606266;
  font-size: 0.9rem;
}

.social-buttons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.button-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.social-button {
  flex: 1;
  height: 48px;
  font-size: 0.9rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.social-button i {
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

.github:hover {
  background-color: #2f363d;
}

.facebook {
  background-color: #1877f2;
  color: #fff;
  border: none;
}

.facebook:hover {
  background-color: #166fe5;
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

.login-link {
  text-align: center;
  margin-top: 1.5rem;
  font-size: 0.9rem;
  color: #606266;
}

.login-link a {
  color: #409eff;
  text-decoration: none;
  margin-left: 4px;
}

.login-link a:hover {
  text-decoration: underline;
}

.site-header {
  background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
  padding: 0.8rem;
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 1.5rem;
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

@media (max-width: 640px) {
  .signup-card {
    margin: 1rem;
    padding: 1.5rem;
    width: auto;
  }

  .button-row {
    flex-direction: column;
  }

  .social-button {
    width: 100%;
  }

  .header-content h1 {
    font-size: 1.5rem;
  }
}

@supports (padding: max(0px)) {
  .signup-container {
    padding-left: max(0px, env(safe-area-inset-left));
    padding-right: max(0px, env(safe-area-inset-right));
  }
}
</style> 