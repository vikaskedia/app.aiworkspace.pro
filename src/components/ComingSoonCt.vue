<template>
  <div class="coming-soon">
    <HeaderCt />
    <div class="content">
      <div class="message-container">
        <h2>{{ title }}</h2>
        <p>This feature is coming soon! We're working hard to bring you a comprehensive view of all {{ feature }} across your matters.</p>
        <el-button type="primary" @click="$router.push('/all-matters')">
          Return to All Matters
        </el-button>
      </div>
    </div>
  </div>
</template>

<script>
import HeaderCt from './HeaderCt.vue';

export default {
  name: 'ComingSoonCt',
  components: {
    HeaderCt
  },
  props: {
    title: {
      type: String,
      required: true
    },
    feature: {
      type: String,
      required: true
    }
  }
};
</script>

<style scoped>
.coming-soon {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.message-container {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

h2 {
  color: #303133;
  margin-bottom: 1rem;
  font-size: 1.8rem;
  font-weight: 500;
}

p {
  color: #606266;
  margin-bottom: 2rem;
  font-size: 1.1rem;
  line-height: 1.6;
}

@media (max-width: 640px) {
  .content {
    padding: 1rem;
  }
  
  .message-container {
    padding: 1.5rem;
  }
  
  h2 {
    font-size: 1.5rem;
  }
  
  p {
    font-size: 1rem;
  }
}
</style> 