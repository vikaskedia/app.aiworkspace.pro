<template>
  <div class="login-container">
    <header class="site-header">
      <div class="header-content">
        <img src="/logo.png" alt="Legal AI Studio" class="logo-image" />
        <h1>Legal AI Studio</h1>
      </div>
    </header>

    <el-card class="login-card">
      <div class="logo-section">
        <h2>Welcome Back</h2>
        <p>Sign in to continue to your account</p>
      </div>
      
      <div class="login-buttons">
        <div class="button-row">
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
        </div>

        <div class="button-row">
          <el-button
            class="login-button facebook" 
            @click="loginWithProvider('facebook')"
            size="large">
            <i class="fab fa-facebook"></i>
            Facebook
          </el-button>

          <el-button
            class="login-button twitter"
            @click="loginWithProvider('twitter')"
            size="large">
            <i class="fab fa-twitter"></i>
            X (Twitter)
          </el-button>
        </div>
      </div>

      <div class="terms">
        By continuing, you agree to Legal AI Studio's Terms of Service and Privacy Policy
      </div>
    </el-card>
  </div>
</template>

<script>
import { supabase } from '../supabase';
import { ElMessage } from 'element-plus';

export default {
  methods: {
    async loginWithProvider(provider) {
      try {
        const redirectTo = `${window.location.origin}/callback`;
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: provider,
          options: {
            redirectTo: redirectTo,
            queryParams: {
              redirect_origin: window.location.origin
            }
          },
        });
        
        if (error) {
          ElMessage.error('Login failed: ' + error.message);
        } else {
          ElMessage.success('Redirecting to login provider...');
        }
      } catch (err) {
        ElMessage.error('An unexpected error occurred');
        console.error(err);
      }
    },
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
  font-size: 1.8rem;
}

.logo-section p {
  color: #606266;
  font-size: 0.9rem;
}

.login-buttons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.button-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.login-button {
  flex: 1;
  height: 48px;
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
  .login-card {
    margin: 1rem;
    padding: 1.5rem;
  }

  .button-row {
    flex-direction: column;
    margin-bottom: 0;
  }

  .login-button {
    width: 100%;
  }

  .header-content h1 {
    font-size: 1.5rem;
  }
}
</style>
  