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
            <div class="stat-value">{{ referralStats.totalReferrals }}</div>
          </div>
          <div class="stat-item">
            <h4>Active Users</h4>
            <div class="stat-value">{{ referralStats.activeUsers }}</div>
          </div>
          <div class="stat-item">
            <h4>Rewards Earned</h4>
            <div class="stat-value">${{ referralStats.rewardsEarned }}</div>
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
import { ref, onMounted } from 'vue'
import { CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { supabase } from '../../supabase'
import HeaderCt from '../HeaderCt.vue'

export default {
  name: 'ReferralSystemCt',
  components: {
    HeaderCt
  },
  setup() {
    const user = ref(null)
    const referralStats = ref({
      totalReferrals: 0,
      activeUsers: 0,
      rewardsEarned: 0
    })
    const referrals = ref([])
    const referralLink = ref('')

    const loadUserData = async () => {
      const { data: { user: userData } } = await supabase.auth.getUser()
      if (userData) {
        user.value = userData
        // Generate referral link using username or user ID
        const username = userData.email.split('@')[0] // Simple way to get username
        referralLink.value = `https://www.aiworkspace.pro/?r=${username}`
      }
    }

    const loadReferralData = async () => {
      try {
        // Get referrals
        const { data: referralsData, error: referralsError } = await supabase
          .from('referrals')
          .select('*')
          .eq('referrer_id', user.value.id)
          .order('created_at', { ascending: false })

        if (referralsError) throw referralsError

        // Calculate stats
        const activeUsers = referralsData.filter(r => r.status === 'Active').length
        const totalRewards = referralsData.reduce((sum, r) => sum + Number(r.reward_amount), 0)

        referralStats.value = {
          totalReferrals: referralsData.length,
          activeUsers,
          rewardsEarned: totalRewards
        }

        // Format referrals for display
        referrals.value = referralsData.map(r => ({
          name: r.referred_email,
          date: new Date(r.created_at).toLocaleDateString(),
          status: r.status,
          reward: `$${r.reward_amount}`
        }))
      } catch (error) {
        console.error('Error loading referral data:', error)
        ElMessage.error('Failed to load referral data')
      }
    }

    onMounted(async () => {
      await loadUserData()
      if (user.value) {
        await loadReferralData()
      }
    })

    const copyLink = () => {
      navigator.clipboard.writeText(referralLink.value)
      ElMessage.success('Referral link copied to clipboard!')
    }

    const shareOnLinkedIn = () => {
      const url = encodeURIComponent(referralLink.value)
      const text = encodeURIComponent('Join me on AI Workspace - AI-powered legal assistance platform')
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}&summary=${text}`, '_blank')
    }

    const shareOnWhatsApp = () => {
      const text = encodeURIComponent(`Join me on AI Workspace! ${referralLink.value}`)
      window.open(`https://wa.me/?text=${text}`, '_blank')
    }

    const shareOnTwitter = () => {
      const url = encodeURIComponent(referralLink.value)
      const text = encodeURIComponent('Join me on AI Workspace - AI-powered legal assistance platform')
      window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank')
    }

    const getStatusType = (status) => {
      switch (status) {
        case 'Active': return 'success'
        case 'Pending': return 'warning'
        default: return 'info'
      }
    }

    const handleSignupSuccess = async (user) => {
      const referralCode = localStorage.getItem('referralCode')
      if (referralCode) {
        try {
          // Create referral record using email
          await supabase.from('referrals').insert({
            referrer_id: user.id,
            referred_email: user.email,
            status: 'Pending'
          })
          
          localStorage.removeItem('referralCode')
        } catch (error) {
          console.error('Error processing referral:', error)
        }
      }
    }

    return {
      referralLink,
      referrals,
      referralStats,
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
