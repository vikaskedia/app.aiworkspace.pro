<template>
  <div class="referral-system-container">
    <HeaderCt />
    <div class="content">
      <el-card class="stats-card">
        <template #header>
          <div class="card-header">
            <h3>Your Referral Stats</h3>
          </div>
        </template>
        <div class="stats-grid">
          <div class="stat-item">
            <h4>Total Referrals</h4>
            <div class="stat-value">23</div>
          </div>
          <div class="stat-item">
            <h4>Active Users</h4>
            <div class="stat-value">12</div>
          </div>
          <div class="stat-item">
            <h4>Rewards Earned</h4>
            <div class="stat-value">$460</div>
          </div>
        </div>
      </el-card>

      <el-card class="referral-link-card">
        <template #header>
          <div class="card-header">
            <h3>Your Referral Link</h3>
          </div>
        </template>
        <div class="referral-link-section">
          <el-input
            v-model="referralLink"
            readonly
            :suffix-icon="CopyDocument"
          >
            <template #append>
              <el-button @click="copyLink">Copy</el-button>
            </template>
          </el-input>
          <div class="share-buttons">
            <el-button type="primary" @click="shareOnLinkedIn">
              <i class="fab fa-linkedin"></i> Share on LinkedIn
            </el-button>
            <el-button type="success" @click="shareOnWhatsApp">
              <i class="fab fa-whatsapp"></i> Share on WhatsApp
            </el-button>
            <el-button type="info" @click="shareOnTwitter">
              <i class="fab fa-twitter"></i> Share on Twitter
            </el-button>
          </div>
        </div>
      </el-card>

      <el-card class="referrals-list-card">
        <template #header>
          <div class="card-header">
            <h3>Recent Referrals</h3>
          </div>
        </template>
        <el-table :data="referrals" style="width: 100%">
          <el-table-column prop="name" label="Name" />
          <el-table-column prop="date" label="Join Date" />
          <el-table-column prop="status" label="Status">
            <template #default="scope">
              <el-tag :type="getStatusType(scope.row.status)">
                {{ scope.row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="reward" label="Reward" />
        </el-table>
      </el-card>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import HeaderCt from '../HeaderCt.vue'

export default {
  name: 'ReferralSystemCt',
  components: {
    HeaderCt
  },
  setup() {
    const referralLink = ref('https://www.associateattorney.ai/jonathan')
    const referrals = ref([
      { name: 'John Doe', date: '2024-03-15', status: 'Active', reward: '$20' },
      { name: 'Jane Smith', date: '2024-03-14', status: 'Pending', reward: '$0' },
      { name: 'Mike Johnson', date: '2024-03-12', status: 'Active', reward: '$20' }
    ])

    const copyLink = () => {
      navigator.clipboard.writeText(referralLink.value)
      ElMessage.success('Referral link copied to clipboard!')
    }

    const shareOnLinkedIn = () => {
      const url = encodeURIComponent(referralLink.value)
      const text = encodeURIComponent('Join me on Legal Studio - AI-powered legal assistance platform')
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}&summary=${text}`, '_blank')
    }

    const shareOnWhatsApp = () => {
      const text = encodeURIComponent(`Join me on Legal Studio! ${referralLink.value}`)
      window.open(`https://wa.me/?text=${text}`, '_blank')
    }

    const shareOnTwitter = () => {
      const url = encodeURIComponent(referralLink.value)
      const text = encodeURIComponent('Join me on Legal Studio - AI-powered legal assistance platform')
      window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank')
    }

    const getStatusType = (status) => {
      switch (status) {
        case 'Active': return 'success'
        case 'Pending': return 'warning'
        default: return 'info'
      }
    }

    return {
      referralLink,
      referrals,
      copyLink,
      shareOnLinkedIn,
      shareOnWhatsApp,
      shareOnTwitter,
      getStatusType,
      CopyDocument
    }
  }
}
</script>

<style scoped>
.referral-system-container {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 500;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
  padding: 1rem;
}

.stat-item {
  text-align: center;
}

.stat-item h4 {
  margin: 0 0 0.5rem 0;
  color: var(--el-text-color-secondary);
  font-size: 0.9rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: 600;
  color: var(--el-color-primary);
}

.referral-link-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.share-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .content {
    padding: 1rem;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .share-buttons {
    flex-direction: column;
  }
}
</style>

<style>
.el-button>span {
    align-items: center;
    display: inline-flex;
    gap: 5px;
}
</style>
