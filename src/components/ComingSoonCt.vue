<template>
  <div class="coming-soon-container">
    <div class="message-container">
      <div class="brand">
        AI WORKSPACE
      </div>
      
      <h1>Great things coming soon.</h1>
      
      <div class="description">
        <p>We're building something incredible and growing something meaningful day by day.</p>
      </div>
      
      <div class="actions">
        <el-button type="primary" @click="goBack" size="large" round>
          <el-icon><ArrowLeft /></el-icon>
          Go to Dashboard
        </el-button>
      </div>
      
    </div>
  </div>
</template>

<script>
import { ArrowLeft } from '@element-plus/icons-vue';

export default {
  name: 'ComingSoonCt',
  components: {
    ArrowLeft
  },
  props: {
    title: {
      type: String,
      default: 'Great things coming soon.'
    },
    feature: {
      type: String,
      default: 'features'
    }
  },
  data() {
    return {
      email: ''
    };
  },
  methods: {
    goBack() {
      window.location.href = 'https://all-ws-dashboard.aiworkspace.pro/all-workspace/dashboard';
      /*if (window.history.length > 1) {
        window.history.back();
      } else {
        this.$router.push('/login');
      }*/
    },
    
    subscribe() {
      if (this.email) {
        // Handle subscription logic here
        console.log('Subscribing email:', this.email);
        this.$message.success('Thank you for subscribing!');
        this.email = '';
      }
    }
  }
};
</script>

<style scoped>
.coming-soon-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ffeef8 0%, #f0f4ff 50%, #e6f3ff 100%);
  position: relative;
}

.message-container {
  background: transparent;
  text-align: center;
  max-width: 600px;
  width: 100%;
  position: relative;
}

.brand {
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: 2px;
  color: #6b7280;
  margin-bottom: 2rem;
  text-transform: uppercase;
}

h1 {
  color: #1f2937;
  margin-bottom: 1.5rem;
  font-size: 3.5rem;
  font-weight: 300;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.description {
  margin-bottom: 3rem;
}

.description p {
  color: #6b7280;
  font-size: 1.1rem;
  line-height: 1.6;
  margin: 0;
  font-weight: 400;
  max-width: 400px;
  margin: 0 auto;
}

.actions {
  margin-bottom: 4rem;
}

.actions .el-button {
  background: #1f2937;
  border-color: #1f2937;
  color: white;
  min-width: 140px;
  height: 44px;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.3s ease;
}

.actions .el-button:hover {
  background: #374151;
  border-color: #374151;
  transform: translateY(-1px);
}

.subscribe-section {
  margin-top: 6rem;
}

.subscribe-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.subscribe-label {
  font-size: 0.9rem;
  color: #6b7280;
  font-weight: 500;
}

.email-input-wrapper {
  display: flex;
  gap: 0;
  max-width: 360px;
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  overflow: hidden;
  background: white;
}

.email-input {
  flex: 1;
  padding: 12px 16px;
  border: none;
  outline: none;
  font-size: 0.95rem;
  background: transparent;
}

.email-input::placeholder {
  color: #9ca3af;
}

.submit-btn {
  background: #1f2937;
  color: white;
  border: none;
  padding: 12px 20px;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: background 0.3s ease;
}

.submit-btn:hover {
  background: #374151;
}

@media (max-width: 768px) {
  .coming-soon-container {
    padding: 15px;
  }
  
  h1 {
    font-size: 2.5rem;
  }
  
  .description p {
    font-size: 1rem;
  }
  
  .email-input-wrapper {
    flex-direction: column;
    border-radius: 6px;
  }
  
  .email-input {
    border-bottom: 1px solid #e5e7eb;
  }
  
  .submit-btn {
    border-radius: 0 0 5px 5px;
  }
}

@media (max-width: 480px) {
  h1 {
    font-size: 2rem;
  }
  
  .brand {
    font-size: 0.7rem;
    margin-bottom: 2rem;
  }
  
  .subscribe-section {
    margin-top: 4rem;
  }
}
</style>