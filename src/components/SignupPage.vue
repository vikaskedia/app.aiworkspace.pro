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
        <h2>Create Your Account</h2>
        <p>Join AI Associate Attorney to get started</p>
      </div>
      
      <el-form 
        :model="signupForm" 
        :rules="rules"
        ref="signupFormRef"
        class="signup-form">
        <div class="name-email-row">
          <el-form-item prop="fullName" class="name-field">
            <el-input 
              v-model="signupForm.fullName"
              placeholder="Full Name"
              type="text">
              <template #prefix>
                <i class="fas fa-user"></i>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item prop="email" class="email-field">
            <el-input 
              v-model="signupForm.email"
              placeholder="Work Email"
              type="email">
              <template #prefix>
                <i class="fas fa-envelope"></i>
              </template>
            </el-input>
          </el-form-item>
        </div>

        <el-form-item prop="password">
          <el-input 
            v-model="signupForm.password"
            placeholder="Password"
            type="password"
            show-password>
            <template #prefix>
              <i class="fas fa-lock"></i>
            </template>
          </el-input>
          <div class="password-requirements">
            <p>Password must:</p>
            <ul>
              <li :class="{ met: passwordLength }">Be at least 6 characters</li>
              <li :class="{ met: hasLetterAndNumber }">Include both letters and numbers</li>
            </ul>
          </div>
        </el-form-item>

        <el-form-item prop="confirmPassword">
          <el-input 
            v-model="signupForm.confirmPassword"
            placeholder="Confirm Password"
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
            @click="handleEmailSignup">
            Create Account
          </el-button>
        </el-form-item>
      </el-form>

      <div class="divider">
        <span>Or continue with</span>
      </div>

      <div class="social-buttons">
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

        <el-button
          class="social-button twitter"
          @click="loginWithProvider('twitter')"
          size="large">
          <i class="fab fa-twitter"></i>
          X (Twitter)
        </el-button>
      </div>

      <div class="terms">
        By continuing, you agree to AI Associate Attorney's 
        <a href="/terms" target="_blank">Terms of Service</a> and 
        <a href="/privacy" target="_blank">Privacy Policy</a>
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
import { ref, computed } from 'vue';

export default {
  name: 'SignupPage',
  setup() {
    const signupForm = ref({
      fullName: '',
      email: '',
      password: '',
      confirmPassword: ''
    });

    const loading = ref(false);
    const signupFormRef = ref(null);

    // Password validation computeds
    const passwordLength = computed(() => 
      signupForm.value.password.length >= 6
    );

    const hasLetterAndNumber = computed(() => 
      /[A-Za-z]/.test(signupForm.value.password) && 
      /[0-9]/.test(signupForm.value.password)
    );

    const rules = {
      fullName: [
        { required: true, message: 'Please enter your full name', trigger: 'blur' },
        { min: 2, message: 'Name must be at least 2 characters', trigger: 'blur' }
      ],
      email: [
        { required: true, message: 'Please enter your email', trigger: 'blur' },
        { type: 'email', message: 'Please enter a valid email', trigger: 'blur' }
      ],
      password: [
        { required: true, message: 'Please enter your password', trigger: 'blur' },
        { min: 6, message: 'Password must be at least 6 characters', trigger: 'blur' },
        { 
          validator: (rule, value, callback) => {
            if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
              callback(new Error('Password must contain both letters and numbers'));
            } else {
              callback();
            }
          },
          trigger: 'blur'
        }
      ],
      confirmPassword: [
        { required: true, message: 'Please confirm your password', trigger: 'blur' },
        {
          validator: (rule, value, callback) => {
            if (value !== signupForm.value.password) {
              callback(new Error('Passwords do not match'));
            } else {
              callback();
            }
          },
          trigger: 'blur'
        }
      ]
    };

    return {
      signupForm,
      loading,
      signupFormRef,
      rules,
      passwordLength,
      hasLetterAndNumber
    };
  },
  async mounted() {
    const cookies = document.cookie.split(';');
    const referralCookie = cookies.find(cookie => 
      cookie.trim().startsWith('referral=')
    );
    
    if (referralCookie) {
      const referralValue = referralCookie.split('=')[1];
      console.log('Referral cookie found:', referralValue);
      
      try {
        // Get referrer's ID first
        const { data: referrerId, error: rpcError } = await supabase
          .rpc('get_user_id_by_email_prefix', {
            email_prefix: referralValue
          });

        if (rpcError) throw rpcError;
        
        if (referrerId) {
          // Check if a pending referral already exists for this referrer
          const { data: existingReferrals, error: checkError } = await supabase
            .from('referrals')
            .select('id')
            .eq('referrer_id', referrerId)
            .eq('status', 'Pending')
            .eq('referred_email', 'pending');

          if (checkError) throw checkError;

          // Only proceed if no pending referral exists for this referrer
          if (!existingReferrals || existingReferrals.length === 0) {
            // Create pending referral record
            const { error: insertError } = await supabase.from('referrals').insert({
              referrer_id: referrerId,
              referred_email: 'pending',
              status: 'Pending',
              reward_amount: 0
            });

            if (insertError) throw insertError;
            
            // Store referral info in localStorage and remove cookie
            localStorage.setItem('referralCode', referralValue);
            localStorage.setItem('referrerId', referrerId);
            document.cookie = `referral=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
          } else {
            // Reuse existing pending referral and remove cookie
            localStorage.setItem('referralCode', referralValue);
            localStorage.setItem('referrerId', referrerId);
            document.cookie = `referral=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
          }
        }
      } catch (error) {
        console.error('Error handling referral:', error);
      }
    }
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
          ElMessage.error('Signup failed: ' + error.message);
        } else {
          ElMessage.success('Redirecting to provider...');
        }
      } catch (err) {
        ElMessage.error('An unexpected error occurred');
        console.error(err);
      }
    },
    async handleEmailSignup() {
      if (!this.signupFormRef) return;
      
      try {
        await this.signupFormRef.validate();
        this.loading = true;

        const { data, error } = await supabase.auth.signUp({
          email: this.signupForm.email,
          password: this.signupForm.password,
          options: {
            data: {
              full_name: this.signupForm.fullName
            },
            emailRedirectTo: `${window.location.origin}/callback`
          }
        });

        if (error) throw error;

        // Handle referral if exists
        if (data?.user) {
          const referralCode = localStorage.getItem('referralCode');
          const referrerId = localStorage.getItem('referrerId');
          
          if (referrerId && referralCode) {
            await supabase
              .from('referrals')
              .update({
                referred_email: data.user.email,
                status: 'Active',
                reward_amount: 0.00
              })
              .eq('referrer_id', referrerId)
              .eq('status', 'Pending')
              .eq('referred_email', 'pending');

            localStorage.removeItem('referrerId');
            localStorage.removeItem('referralCode');
          }
        }

        ElMessage.success('Signup successful! Please check your email to confirm your account.');
        this.$router.push('/login');
      } catch (error) {
        ElMessage.error(error.message || 'Signup failed');
      } finally {
        this.loading = false;
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
  margin-top: 0;
  font-size: 1.8rem;
}

.logo-section p {
  color: #606266;
  font-size: 0.9rem;
}

.name-email-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 640px) {
  .name-email-row {
    grid-template-columns: 1fr 1fr;
  }
}

.social-buttons {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.8rem;
}

@media (min-width: 640px) {
  .social-buttons {
    grid-template-columns: repeat(3, 1fr);
  }
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
  width: calc(50% - 70px);
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

.social-button {
  justify-content: center;
  font-size: 0.95rem;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.social-button i {
  margin-right: 8px;
  font-size: 1.2rem;
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
  font-size: 0.85rem;
  color: #606266;
}

.terms a {
  color: #409eff;
  text-decoration: none;
}

.terms a:hover {
  text-decoration: underline;
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

.signup-form {
  margin: 2rem 0;
}

.password-requirements {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #606266;
}

.password-requirements p {
  margin: 0 0 0.3rem 0;
}

.password-requirements ul {
  list-style: none;
  padding-left: 0;
  margin: 0;
}

.password-requirements li {
  margin: 0.2rem 0;
  color: #909399;
}

.password-requirements li::before {
  content: '○';
  margin-right: 0.5rem;
}

.password-requirements li.met {
  color: #67c23a;
}

.password-requirements li.met::before {
  content: '●';
}

.submit-button {
  width: 100%;
  height: 44px;
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0.3px;
}

:deep(.el-input__wrapper) {
  padding: 0 12px;
  height: 44px;
}

:deep(.el-input__inner) {
  font-size: 0.95rem;
}

:deep(.el-form-item__error) {
  font-size: 0.85rem;
}

@media (max-width: 640px) {
  .social-buttons {
    grid-template-columns: 1fr;
  }
  
  .signup-card {
    margin: 1rem;
    padding: 1.5rem;
  }
}

@supports (padding: max(0px)) {
  .signup-container {
    padding-left: max(0px, env(safe-area-inset-left));
    padding-right: max(0px, env(safe-area-inset-right));
  }
}
</style> 