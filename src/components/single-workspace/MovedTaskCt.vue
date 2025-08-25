<template>
  <div class="moved-task-warning" role="alert" aria-live="polite">
    <svg class="warning-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M1 21h22L12 2 1 21zm13-3h-4v-2h4v2zm0-4h-4v-4h4v4z"/>
    </svg>
    <div class="message">
      The task component has been moved to <strong>https://tasks.aiworkspace.pro</strong>.
      You can access the page here <a :href="redirectUrl">{{ redirectUrl }}</a>.
    </div>
  </div>
</template>

<script>
export default {
  name: "MovedTaskCt",
  data() {
    return {
      redirectUrl: 'https://tasks.aiworkspace.pro'
    };
  },
  mounted() {
    try {
      const current = new URL(window.location.href);
      const target = new URL('https://tasks.aiworkspace.pro');

      // Preserve path, query and hash but replace origin
      const newUrl = `${target.protocol}//${target.hostname}${current.pathname}${current.search}${current.hash}`;
      this.redirectUrl = newUrl;
    } catch (err) {
      // fallback already set
      console.warn('Could not construct redirect URL, using default:', err);
    }
  }
};
</script>

<style scoped>
.moved-task-warning {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  background: #fff7e6;
  border-left: 4px solid #ffb62b;
  color: #5a3a00;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 14px;
}
.warning-icon {
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  color: #ff9800;
  margin-top: 2px;
}
.message {
  line-height: 1.35;
}
.message a {
  color: #0b63ff;
  text-decoration: underline;
  margin-left: 4px;
}
.message strong {
  color: #4b2b00;
}
</style>