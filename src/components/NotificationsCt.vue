<script>
import { supabase } from '../supabase';
import { ElMessage } from 'element-plus';
import { Bell } from '@element-plus/icons-vue';

export default {
  components: {
    Bell
  },
  data() {
    return {
      notifications: [],
      unreadCount: 0,
      loading: false,
      subscription: null,
      visible: false,
      userEmails: {}
    };
  },
  mounted() {
    this.loadNotifications();
    this.setupRealtimeSubscription();
  },
  methods: {
    async loadNotifications() {
      try {
        this.loading = true;
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data: notifications, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        // Load user emails for notifications
        for (const notification of notifications) {
          if (notification.actor_id && !this.userEmails[notification.actor_id]) {
            const { data: userData } = await supabase
              .rpc('get_user_info_by_id', {
                user_id: notification.actor_id
              });
            if (userData?.[0]) {
              this.userEmails[notification.actor_id] = userData[0].email;
            }
          }
        }

        this.notifications = notifications;
        this.unreadCount = notifications.filter(n => !n.read).length;
      } catch (error) {
        ElMessage.error('Error loading notifications: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async setupRealtimeSubscription() {
      const { data: { user } } = await supabase.auth.getUser();
      
      this.subscription = supabase
        .channel('notifications-changes')
        .on('postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          async (payload) => {
            if (payload.eventType === 'INSERT') {
              if (payload.new.actor_id && !this.userEmails[payload.new.actor_id]) {
                const { data: userData } = await supabase
                  .rpc('get_user_info_by_id', {
                    user_id: payload.new.actor_id
                  });
                if (userData?.[0]) {
                  this.userEmails[payload.new.actor_id] = userData[0].email;
                }
              }
              this.notifications.unshift(payload.new);
              this.unreadCount++;
            }
          }
        )
        .subscribe();
    },

    async markAsRead(notification) {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notification.id);

        if (error) throw error;

        const index = this.notifications.findIndex(n => n.id === notification.id);
        if (index !== -1) {
          this.notifications[index].read = true;
          this.unreadCount = Math.max(0, this.unreadCount - 1);
        }
      } catch (error) {
        ElMessage.error('Error marking notification as read: ' + error.message);
      }
    },

    getNotificationText(notification) {
      const actorEmail = this.userEmails[notification.actor_id] || 'Someone';
      switch (notification.type) {
        case 'task_assigned':
          return `${actorEmail} assigned you a task: ${notification.data.task_title}`;
        case 'task_created':
          return `${actorEmail} created a new task: ${notification.data.task_title}`;
        case 'task_updated':
          return `${actorEmail} updated task: ${notification.data.task_title}`;
        case 'matter_shared':
          return `${actorEmail} shared a workspace with you: ${notification.data.matter_title}`;
        default:
          return notification.message;
      }
    },

    handleVisibleChange(visible) {
      if (visible) {
        this.loadNotifications();
      }
    }
  },
  beforeUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
};
</script>

<template>
  <div class="notifications">
    <el-dropdown trigger="click" @visible-change="handleVisibleChange">
      <el-badge :value="unreadCount" :hidden="unreadCount === 0">
        <el-button circle class="notification-button">
          <el-icon><Bell /></el-icon>
        </el-button>
      </el-badge>

      <template #dropdown>
        <el-dropdown-menu class="notifications-dropdown">
          <div class="notifications-container">
            <div v-if="loading" class="loading-state">
              <el-skeleton :rows="3" animated />
            </div>
            <template v-else>
              <div v-if="notifications.length === 0" class="empty-state">
                No notifications
              </div>
              <el-dropdown-item 
                v-else
                v-for="notification in notifications"
                :key="notification.id"
                :class="['notification-item', { unread: !notification.read }]"
                @click="markAsRead(notification)">
                <div class="notification-content">
                  <p>{{ getNotificationText(notification) }}</p>
                  <span class="notification-time">
                    {{ new Date(notification.created_at).toLocaleString() }}
                  </span>
                </div>
              </el-dropdown-item>
            </template>
          </div>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<style>
.notifications-dropdown {
  width: 400px;
  max-height: 500px;
  overflow-y: auto;
}

.notifications-container {
  padding: 8px;
}

.notification-item {
  padding: 8px;
  margin: 4px 0;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.notification-item.unread {
  background-color: #ecf5ff;
  border-left: 3px solid #409EFF;
}

.notification-item:hover {
  background-color: #f5f7fa;
}

.notification-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.notification-content p {
  margin: 0;
  color: #303133;
  font-size: 0.9em;
  line-height: 1.4;
}

.notification-time {
  font-size: 0.8em;
  color: #909399;
}

.empty-state {
  text-align: center;
  color: #909399;
  padding: 16px;
}

@media (max-width: 768px) {
  .notifications-dropdown {
    width: 300px;
  }
}
</style> 