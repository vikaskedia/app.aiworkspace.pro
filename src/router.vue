<template>
  <div>
    <!-- The <router-view/> is a special component that is replaced by the component defined in the router config. Ref: https://www.youtube.com/watch?v=4lk9-PYensI-->
    <Suspense>
      <template #default>
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </template>
      <template #fallback>
        <div style="display: flex; justify-content: center; align-items: center; height: 100vh;">
          Loading...
        </div>
      </template>
    </Suspense>
  </div>
</template>

<script>
export default {
  name: 'App',
  errorCaptured(err, vm, info) {
    console.error('Error captured in App.vue:', err, info);
    return false; // Prevent error from propagating
  }
}
</script>
