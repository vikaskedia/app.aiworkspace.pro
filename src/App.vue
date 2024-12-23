<template>
  <router-view></router-view>
</template>

<script setup>
</script>

<style>
/* Add global styles for header optimization */
.header, 
nav,
.site-header {
  min-height: 40px !important;  /* Further reduced from 48px */
  padding: 2px 16px !important; /* Reduced top/bottom padding */
}

/* Optimize spacing for navigation elements */
.nav-items {
  gap: 8px;  /* Reduced from 12px */
}

/* Ensure dropdown menus are compact */
.dropdown-menu {
  margin-top: 2px;
  padding: 4px 0;
}

/* Adjust font sizes */
.header {
  font-size: 0.9rem;
}

/* Reduce logo and avatar sizes */
.logo-image,
.el-avatar {
  height: 32px !important;  /* Reduced from 40px */
  width: auto !important;
}

/* Reduce heading sizes */
.header-left h1 {
  font-size: 1.2rem !important;
}

/* Make all header elements more compact */
.header-left,
.header-center,
.header-right {
  gap: 8px !important;
}

/* Reduce padding for user profile */
.user-profile {
  padding: 4px 8px !important;
}
</style>
