<script>
import { ref, onMounted, watch } from 'vue';
import { supabase } from '../supabase';
import { ElMessage } from 'element-plus';
import { useRouter, useRoute } from 'vue-router';
import { useMatterStore } from '../store/matter';
import { storeToRefs } from 'pinia';
import { CaretBottom, More } from '@element-plus/icons-vue';

export default {
  components: {
    CaretBottom,
    More
  },
  emits: ['matter-selected'],
  setup(props, { emit }) {
    const matters = ref([]);
    const selectedMatter = ref(null);
    const dialogVisible = ref(false);
    const newMatter = ref({
      title: '',
      description: ''
    });
    const router = useRouter();
    const route = useRoute();
    const matterStore = useMatterStore();
    const { currentMatter } = storeToRefs(matterStore);

    // Watch for changes in the store's currentMatter
    watch(currentMatter, (newMatter) => {
      selectedMatter.value = newMatter;
    });

    const loadMatters = async () => {
      try {
        const { data: mattersData, error } = await supabase
          .from('matters')
          .select('*')
          .eq('deleted', false)
          .order('created_at', { ascending: false });

        if (error) throw error;
        matters.value = mattersData;

        // After loading matters, check URL for matter ID
        const matterId = route.params.matterId;
        if (matterId) {
          const matter = matters.value.find(m => m.id === parseInt(matterId));
          if (matter) {
            selectedMatter.value = matter;
            emit('matter-selected', matter);
          }
        }
      } catch (error) {
        ElMessage.error('Error loading matters: ' + error.message);
      }
    };

    const createMatter = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from('matters')
          .insert([{
            title: newMatter.value.title,
            description: newMatter.value.description,
            created_by: user.id
          }])
          .select();

        if (error) throw error;
        
        matters.value.unshift(data[0]);
        dialogVisible.value = false;
        newMatter.value = { title: '', description: '' };
        ElMessage.success('Matter created successfully');
      } catch (error) {
        ElMessage.error('Error creating matter: ' + error.message);
      }
    };

    const handleMatterSelect = (matter) => {
      selectedMatter.value = matter;
      if (matter === null) {
        router.push('/all-matters');
      } else {
        emit('matter-selected', matter);
      }
    };

    const handleMatterCommand = (command) => {
      if (!selectedMatter.value) return;
      
      switch(command) {
        case 'dashboard':
          router.push(`/matter/${selectedMatter.value.id}`);
          break;
        case 'goals':
          router.push(`/matter/${selectedMatter.value.id}/goals`);
          break;
        case 'tasks':
          router.push(`/matter/${selectedMatter.value.id}/tasks`);
          break;
        case 'events':
          router.push(`/matter/${selectedMatter.value.id}/events`);
          break;
        case 'files':
          router.push(`/matter/${selectedMatter.value.id}/files`);
          break;
        case 'manage':
          router.push(`/matter/${selectedMatter.value.id}/manage`);
          break;
      }
    };

    onMounted(() => {
      loadMatters();
    });

    return {
      matters,
      selectedMatter,
      dialogVisible,
      newMatter,
      createMatter,
      handleMatterSelect,
      handleMatterCommand
    };
  }
};
</script>

<template>
  <div class="matter-selector">
    <el-dropdown trigger="click">
      <span class="matter-dropdown-link">
        {{ selectedMatter?.title || 'All Matters' }}
        <el-icon><caret-bottom /></el-icon>
      </span>
      
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item @click="handleMatterSelect(null)">
            All Matters
          </el-dropdown-item>
          <el-dropdown-item divided />
          <el-dropdown-item
            v-for="matter in matters"
            :key="matter.id"
            @click="handleMatterSelect(matter)">
            {{ matter.title }}
          </el-dropdown-item>
          <el-dropdown-item divided @click="dialogVisible = true">
            New Matter
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<style scoped>
.matter-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.matter-dropdown-link {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.matter-dropdown-link:hover {
  background-color: rgba(0, 0, 0, 0.03);
}
</style> 