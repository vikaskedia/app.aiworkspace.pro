<template>
  <div class="ai-chat-panel">
    <div class="panel-header">
      <h3>Chat with AI about: {{ goal.title }}</h3>
      <el-button @click="$emit('close')" icon="Close" circle />
    </div>
    <div class="chat-content">
      <!-- Add your chat interface here -->
    </div>
  </div>
</template>

<script>
export default {
  props: {
    goal: {
      type: Object,
      required: true
    }
  }
};
</script>

<style scoped>
.ai-chat-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  height: 100vh;
  background: white;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 16px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

@media (max-width: 640px) {
  .ai-chat-panel {
    width: 100%;
  }
}
</style> 