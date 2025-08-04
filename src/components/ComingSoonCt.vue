<template>
  <div>
    <div class="message-container">
      <h2>{{ title }}</h2>
      <p>This feature is coming soon! We're working hard to bring you a comprehensive view of all {{ feature }} across your workspaces.</p>
      <el-button type="primary" @click="$router.push('/all-workspace')">
        Return to All Workspaces
      </el-button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ComingSoonCt',
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
/* Remove these styles as they're now in AllWorkspaceLayout */
.coming-soon,
.content {
  /* Remove these */
}

/* Keep the rest of the styles */
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
</style> 