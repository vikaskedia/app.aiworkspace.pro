<template>
  <div class="outline-container">
    <div v-if="breadcrumbPath.length" class="outline-breadcrumbs">
      <template v-for="(node, idx) in breadcrumbPath" :key="node.id">
        <span v-if="idx > 0"> &gt; </span>
        <span
          class="breadcrumb-link"
          @click="handleBreadcrumb(node, idx)"
          :style="{ fontWeight: idx === breadcrumbPath.length - 1 ? 'bold' : 'normal' }"
        >{{ getBreadcrumbText(node.text) }}</span>
      </template>
    </div>
    <div class="outline-header">
      <el-button 
        type="primary" 
        @click="saveOutline" 
        :loading="saving"
        :disabled="!hasChanges"
        style="margin-right: 8px;"
      >
        Save Outline
      </el-button>
      <el-button icon @click="openHistoryDialog" style="margin-right: 8px;">
        <el-icon><Clock /></el-icon>
      </el-button>
    </div>
    <el-dialog v-model="historyDialogVisible" title="Outline Version History" width="700px">
      <el-table :data="versionHistory" style="width: 100%" v-loading="loadingHistory">
        <el-table-column prop="version" label="Version" width="80" />
        <el-table-column label="Saved At" width="250">
          <template #default="scope">
            {{ formatDate(scope.row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="creator_email" label="Created By" width="250" />
        <el-table-column label="Action" width="80">
          <template #default="scope">
            <el-button size="small" @click="viewVersion(scope.row)">View</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="historyDialogVisible = false">Close</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="viewVersionDialogVisible" title="Version Content" width="800px">
      <div v-if="selectedVersion" class="version-content">
        <div class="version-info">
          <p><strong>Version:</strong> {{ selectedVersion.version }}</p>
          <p><strong>Created By:</strong> {{ selectedVersion.creator_email }}</p>
          <p><strong>Created At:</strong> {{ formatDate(selectedVersion.created_at) }}</p>
        </div>
        <div class="version-outline">
          <ul class="outline-list">
            <OutlinePointsCt
              v-for="item in selectedVersion.content"
              :key="item.id"
              :item="item"
              :readonly="true"
            />
          </ul>
        </div>
      </div>
      <template #footer>
        <el-button @click="viewVersionDialogVisible = false">Close</el-button>
      </template>
    </el-dialog>
    <ul class="outline-list">
      <OutlinePointsCt
        v-for="item in getFocusedOutline()"
        :key="item.id"
        :item="item"
        @update="onOutlineUpdate"
        @move="handleMove"
        @delete="handleDelete"
        @drilldown="handleDrilldown"
        @navigate="handleNavigate"
        @indent="handleIndent"
        @outdent="handleOutdent"
      />
    </ul>
  </div>
</template>

<script>
import { ref, watch, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { ElNotification } from 'element-plus';
import { Clock } from '@element-plus/icons-vue';
import { supabase } from '../../supabase';
import OutlinePointsCt from './OutlinePointsCt.vue';
import { updateMatterActivity } from '../../utils/matterActivity';

export default {
  name: 'OutlineCt',
  components: { OutlinePointsCt, Clock },
  setup() {
    const route = useRoute();
    const matterId = route.params.matterId;
    const saving = ref(false);
    const outline = ref([]);
    const outlineId = ref(null);
    const currentVersion = ref(1);
    const hasChanges = ref(false);
    const lastSavedContent = ref(null);
    const focusedId = ref(null);
    const historyDialogVisible = ref(false);
    const viewVersionDialogVisible = ref(false);
    const versionHistory = ref([]);
    const loadingHistory = ref(false);
    const selectedVersion = ref(null);

    // Get localStorage keys for current matter
    const getLocalStorageKey = () => `outline_${matterId}`;
    const getVersionKey = () => `outline_version_${matterId}`;

    // Function to check if content has changed
    const checkForChanges = (newContent) => {
      if (!lastSavedContent.value) return false;
      return JSON.stringify(newContent) !== JSON.stringify(lastSavedContent.value);
    };

    // Default outline data
    const defaultOutline = [
      {
        id: 1,
        text: 'Vue knowledge',
        children: [
          {
            id: 2,
            text: 'What is Vue Js',
            children: [
              {
                id: 3,
                text: 'It is Progressive framework that is mainly focused on view part. It follows a MVVM',
                children: []
              },
              {
                id: 4,
                text: 'test2 test 2 test2',
                children: [
                  {
                    id: 5,
                    text: 'My test testing',
                    children: []
                  },
                  {
                    id: 6,
                    text: 'Another subpoint',
                    children: [
                      {
                        id: 7,
                        text: 'Deep subpoint',
                        children: []
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            id: 8,
            text: '',
            children: []
          }
        ]
      }
    ];

    // Helper to ensure all items have autoFocus: false
    function ensureAutoFocusProp(items) {
      for (const item of items) {
        if (!('autoFocus' in item)) item.autoFocus = false;
        if (item.children && item.children.length) {
          ensureAutoFocusProp(item.children);
        }
      }
    }

    // Load from localStorage or use default
    onMounted(async () => {
      if (!matterId) return;

      // First load from localStorage
      const localStorageKey = getLocalStorageKey();
      const versionKey = getVersionKey();
      const data = localStorage.getItem(localStorageKey);
      const storedVersion = localStorage.getItem(versionKey);

      if (data) {
        try {
          outline.value = JSON.parse(data);
          ensureAutoFocusProp(outline.value);
          currentVersion.value = storedVersion ? parseInt(storedVersion) : 1;
        } catch {
          outline.value = defaultOutline;
          ensureAutoFocusProp(outline.value);
          currentVersion.value = 1;
        }
      } else {
        outline.value = defaultOutline;
        ensureAutoFocusProp(outline.value);
        currentVersion.value = 1;
      }

      // Then fetch from Supabase
      try {
        // Get the latest outline for this matter
        const { data: outlineData, error: outlineError } = await supabase
          .from('outlines')
          .select('*')
          .eq('matter_id', matterId)
          .order('version', { ascending: false })
          .limit(1)
          .single();

        if (outlineError && outlineError.code !== 'PGRST116') {
          console.error('Error fetching outline:', outlineError);
          return;
        }

        if (outlineData) {
          outlineId.value = outlineData.id;
          
          // If versions match, check for content differences
          if (outlineData.version === currentVersion.value) {
            const localContent = JSON.stringify(outline.value);
            const supabaseContent = JSON.stringify(outlineData.content);
            hasChanges.value = localContent !== supabaseContent;
            lastSavedContent.value = outlineData.content;
          } else if (outlineData.version > currentVersion.value) {
            // If Supabase version is newer, update local content
            outline.value = outlineData.content;
            ensureAutoFocusProp(outline.value);
            currentVersion.value = outlineData.version;
            localStorage.setItem(localStorageKey, JSON.stringify(outlineData.content));
            localStorage.setItem(versionKey, outlineData.version.toString());
            hasChanges.value = false;
            lastSavedContent.value = outlineData.content;
          }
        } else {
          // If no outline in Supabase, mark as changed if we have local content
          hasChanges.value = outline.value !== defaultOutline;
          lastSavedContent.value = outline.value;
        }
      } catch (error) {
        console.error('Error in outline setup:', error);
        // In case of error, assume we have changes if we have local content
        hasChanges.value = outline.value !== defaultOutline;
        lastSavedContent.value = outline.value;
      }
    });

    // Watch for changes in outline
    watch(outline, (val) => {
      if (matterId) {
        localStorage.setItem(getLocalStorageKey(), JSON.stringify(val));
        hasChanges.value = checkForChanges(val);
      }
    }, { deep: true });

    async function saveOutline() {
      if (!matterId) {
        console.error('No matter ID available');
        return;
      }

      saving.value = true;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');

        if (outlineId.value) {
          // First get the new version number
          const { data: newVersion, error: versionError } = await supabase
            .rpc('increment_version', { outline_id: outlineId.value });

          if (versionError) throw versionError;

          // Then update the outline with the new version
          const { data: updatedOutline, error: updateError } = await supabase
            .from('outlines')
            .update({
              content: outline.value,
              version: newVersion
            })
            .eq('id', outlineId.value)
            .select()
            .single();

          if (updateError) throw updateError;
          currentVersion.value = updatedOutline.version;
        } else {
          // Create new outline
          const { data: newOutline, error: insertError } = await supabase
            .from('outlines')
            .insert([{
              matter_id: matterId,
              title: 'Outline',
              content: outline.value,
              created_by: user.id
            }])
            .select()
            .single();

          if (insertError) throw insertError;
          outlineId.value = newOutline.id;
          currentVersion.value = newOutline.version;
        }

        // Create version record
        const { error: versionError } = await supabase
          .from('outline_versions')
          .insert([{
            outline_id: outlineId.value,
            content: outline.value,
            version: currentVersion.value,
            created_by: user.id
          }]);

        if (versionError) throw versionError;

        // Update version in localStorage
        localStorage.setItem(getVersionKey(), currentVersion.value.toString());

        // Update last saved content and reset changes flag
        lastSavedContent.value = JSON.parse(JSON.stringify(outline.value));
        hasChanges.value = false;

        // Update matter activity
        await updateMatterActivity(matterId);

        // Show success notification
        ElNotification({
          title: 'Success',
          message: 'Outline saved successfully',
          type: 'success',
          duration: 3000
        });

      } catch (error) {
        console.error('Error saving outline:', error);
        // Show error notification
        ElNotification({
          title: 'Error',
          message: 'Failed to save outline. Please try again.',
          type: 'error',
          duration: 5000
        });
      } finally {
        saving.value = false;
      }
    }

    // Update outline text by id (recursive)
    function updateTextById(items, id, text) {
      for (const item of items) {
        if (item.id.toString() === id.toString()) {
          item.text = text;
          return true;
        }
        if (item.children && item.children.length) {
          if (updateTextById(item.children, id, text)) return true;
        }
      }
      return false;
    }

    // Find and remove item by id (recursive)
    function removeItemById(items, id) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].id.toString() === id.toString()) {
          return items.splice(i, 1)[0];
        }
        if (items[i].children && items[i].children.length) {
          const removed = removeItemById(items[i].children, id);
          if (removed) return removed;
        }
      }
      return null;
    }

    // Find item by id (recursive)
    function findItemById(items, id) {
      for (const item of items) {
        if (item.id.toString() === id.toString()) {
          return item;
        }
        if (item.children && item.children.length) {
          const found = findItemById(item.children, id);
          if (found) return found;
        }
      }
      return null;
    }

    // Find parent of item by id (recursive)
    function findParentById(items, id, parent = null) {
      for (const item of items) {
        if (item.id.toString() === id.toString()) {
          return parent;
        }
        if (item.children && item.children.length) {
          const found = findParentById(item.children, id, item);
          if (found) return found;
        }
      }
      return null;
    }

    function onOutlineUpdate({ id, text }) {
      updateTextById(outline.value, id, text);
    }

    function handleMove({ draggedId, targetId, position }) {
      console.log('handleMove called in OutlineCt:', { draggedId, targetId, position });
      // Get the dragged item and its parent
      console.log('outline value', outline.value);
      console.log('draggedId', draggedId);
      console.log('targetId', targetId);
      console.log('position', position);
      const draggedItem = removeItemById(outline.value, draggedId);
      if (!draggedItem) {
        console.log('No dragged item found');
        return;
      }

      // Find the target item
      const targetItem = findItemById(outline.value, targetId);
      if (!targetItem) {
        console.log('No target item found');
        return;
      }

      // Get the parent of the target item
      const targetParent = findParentById(outline.value, targetId);

      if (position === 'after') {
        if (targetParent) {
          // Add as sibling in parent's children array
          const targetIndex = targetParent.children.findIndex(child => child.id.toString() === targetId);
          targetParent.children.splice(targetIndex + 1, 0, draggedItem);
        } else {
          // Add as sibling in root array
          const targetIndex = outline.value.findIndex(item => item.id.toString() === targetId);
          outline.value.splice(targetIndex + 1, 0, draggedItem);
        }
      } else if (position === 'child') {
        // Add as last child of the target item
        if (!targetItem.children) {
          targetItem.children = [];
        }
        targetItem.children.push(draggedItem);
      } else {
        // If position is 'before', add as child (first child)
        if (!targetItem.children) {
          targetItem.children = [];
        }
        targetItem.children.unshift(draggedItem);
      }

      // Force Vue to update
      outline.value = [...outline.value];
      console.log('Move operation completed');
    }

    function handleDelete(id) {
      console.log('handleDelete', id);
      // Remove the item from the outline
      removeItemById(outline.value, id);
      // Force Vue to update
      outline.value = [...outline.value];
    }

    function handleDrilldown(id) {
      focusedId.value = id;
    }

    function handleBack() {
      focusedId.value = null;
    }

    function getFocusedOutline() {
      if (!focusedId.value) return outline.value;
      function findById(items, id) {
        for (const item of items) {
          if (item.id.toString() === id.toString()) return [item];
          if (item.children) {
            const found = findById(item.children, id);
            if (found) return found;
          }
        }
        return null;
      }
      return findById(outline.value, focusedId.value) || [];
    }

    // Helper to find the path from root to focused node
    function findPathToNode(items, id, path = []) {
      for (const item of items) {
        const newPath = [...path, item];
        if (item.id.toString() === id?.toString()) return newPath;
        if (item.children) {
          const found = findPathToNode(item.children, id, newPath);
          if (found) return found;
        }
      }
      return null;
    }

    const breadcrumbPath = computed(() => {
      if (!focusedId.value) return [];
      return findPathToNode(outline.value, focusedId.value) || [];
    });

    function handleBreadcrumb(node, idx) {
      // If last breadcrumb, do nothing (already focused)
      if (idx === breadcrumbPath.value.length - 1) return;
      focusedId.value = node.id;
    }

    function getBreadcrumbText(text) {
      if (!text) return '';
      const words = text.split(/\s+/);
      return words.length > 5 ? words.slice(0, 5).join(' ') + '…' : text;
    }

    async function openHistoryDialog() {
      if (!outlineId.value) {
        ElNotification({
          title: 'No Outline',
          message: 'No outline found to show history.',
          type: 'warning',
          duration: 3000
        });
        return;
      }
      historyDialogVisible.value = true;
      loadingHistory.value = true;
      // Fetch version history from Supabase
      const { data: versionsData, error: versionsError } = await supabase
        .from('outline_versions')
        .select('id, version, created_at, content, created_by')
        .eq('outline_id', outlineId.value)
        .order('version', { ascending: false });
      
      if (versionsError) {
        ElNotification({
          title: 'Error',
          message: 'Failed to fetch version history.',
          type: 'error',
          duration: 4000
        });
        versionHistory.value = [];
        loadingHistory.value = false;
        return;
      }

      // Get unique creator IDs
      const creatorIds = [...new Set(versionsData.map(v => v.created_by))];
      
      // Fetch creator information for each creator
      const profilesData = [];
      for (const creatorId of creatorIds) {
        const { data: profileData, error: profileError } = await supabase
          .rpc('get_user_info_by_id', {
            user_id: creatorId
          });
        
        if (profileError) {
          console.error('Error fetching profile:', profileError);
          continue;
        }
        
        if (profileData) {
          console.log('profileData', profileData);
          profilesData.push(profileData[0]);
        }
      }

      // Create a map of creator IDs to names
      const creatorMap = new Map(
        profilesData.map(profile => [profile.id, profile.email])
      );

      console.log('creatorMap', creatorMap);
      // Transform the data to include creator name
      versionHistory.value = versionsData.map(version => ({
        ...version,
        creator_email: creatorMap.get(version.created_by) || 'Unknown'
      }));
      
      loadingHistory.value = false;
    }

    function viewVersion(versionRow) {
      selectedVersion.value = versionRow;
      viewVersionDialogVisible.value = true;
    }

    function formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }

    // --- Keyboard navigation logic ---
    function flattenOutline(items, result = []) {
      for (const item of items) {
        result.push(item);
        if (item.children && item.children.length) {
          flattenOutline(item.children, result);
        }
      }
      return result;
    }

    function handleNavigate({ id, direction }) {
      // Flatten the visible outline
      const flat = flattenOutline(getFocusedOutline());
      //console.log('Flat outline:', flat.map(i => i.text));
      const idx = flat.findIndex(item => item.id.toString() === id.toString());
      //console.log('Current item id:', id, 'index:', idx, 'direction:', direction);
      if (idx === -1) return;
      let targetIdx = null;
      if (direction === 'up' && idx > 0) targetIdx = idx - 1;
      if (direction === 'down' && idx < flat.length - 1) targetIdx = idx + 1;
      //console.log('Target index:', targetIdx, 'Target item:', targetIdx !== null ? flat[targetIdx] : null);
      if (targetIdx !== null) {
        // Use Object.assign to ensure reactivity
        Object.assign(flat[targetIdx], { autoFocus: true });
        outline.value = [...outline.value];
      }
    }

    // --- Indent/Outdent logic ---
    function handleIndent({ id }) {
      // Find parent and previous sibling
      function findParentAndIndex(items, id, parent = null) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].id.toString() === id.toString()) {
            return { parent, index: i, items };
          }
          if (items[i].children && items[i].children.length) {
            const res = findParentAndIndex(items[i].children, id, items[i]);
            if (res) return res;
          }
        }
        return null;
      }
      const res = findParentAndIndex(outline.value, id);
      if (!res || res.index === 0) return; // No previous sibling
      const { parent, index, items } = res;
      const prevSibling = items[index - 1];
      // Remove from current position
      const [moved] = items.splice(index, 1);
      // Add as last child of previous sibling
      if (!prevSibling.children) prevSibling.children = [];
      prevSibling.children.push(moved);
      // Set autoFocus for moved node
      moved.autoFocus = true;
      outline.value = [...outline.value];
    }

    function handleOutdent({ id }) {
      // Always use the latest structure from localStorage
      const localStorageKey = getLocalStorageKey();
      const latestOutline = JSON.parse(localStorage.getItem(localStorageKey) || '[]');

      // Recursively find the node, its parent, and its grandparent
      function findNodeAndAncestors(items, id, parent = null, grandparent = null) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.id.toString() === id.toString()) {
            return { node: item, parent, grandparent, index: i, items };
          }
          if (item.children && item.children.length) {
            const res = findNodeAndAncestors(item.children, id, item, parent);
            if (res) return res;
          }
        }
        return null;
      }
      const res = findNodeAndAncestors(latestOutline, id);
      if (!res || !res.parent || !res.grandparent) {
        //console.log('Cannot outdent: node is at root or top-level', res);
        return;
      }
      const { parent, grandparent, index, items } = res;

      // Log before
      //console.log('Outline before:', JSON.stringify(latestOutline, null, 2));
      //console.log('Node:', res.node.text, 'Parent:', parent.text, 'Grandparent:', grandparent.text);
      //console.log('Removing from items:', items.map(i => i.text));
      //console.log('Inserting into gpChildren:', (grandparent.children || latestOutline).map(i => i.text));

      // Remove from current position
      const [moved] = items.splice(index, 1);

      // Find parent in grandparent's children
      const gpChildren = grandparent.children || latestOutline;
      const parentIdx = gpChildren.findIndex(child => child.id === parent.id);
      if (parentIdx === -1) {
        //console.log('Parent not found in grandparent children');
        return;
      }

      gpChildren.splice(parentIdx + 1, 0, moved);

      // Log after
      //console.log('Outline after:', JSON.stringify(latestOutline, null, 2));

      // Set autoFocus for moved node
      moved.autoFocus = true;
      outline.value = [...latestOutline];
    }

    return { 
      outline, 
      saving,
      hasChanges,
      onOutlineUpdate, 
      handleMove, 
      handleDelete,
      saveOutline,
      // Drilldown
      focusedId,
      handleDrilldown,
      handleBack,
      getFocusedOutline,
      // Breadcrumbs
      breadcrumbPath,
      handleBreadcrumb,
      getBreadcrumbText,
      openHistoryDialog,
      historyDialogVisible,
      viewVersionDialogVisible,
      versionHistory,
      loadingHistory,
      selectedVersion,
      viewVersion,
      formatDate,
      handleNavigate,
      handleIndent,
      handleOutdent,
    };
  }
};
</script>

<style scoped>
.outline-container {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  min-height: 200px;
}

.outline-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.outline-list {
  list-style: none;
  padding-left: 0;
  margin: 0;
}

.outline-breadcrumbs {
  margin-bottom: 1rem;
  font-size: 0.95rem;
  color: #888;
}
.breadcrumb-link {
  cursor: pointer;
  color: #1976d2;
  text-decoration: none;
}
.breadcrumb-link[style*='bold'] {
  color: #23272f;
  text-decoration: none;
  cursor: default;
}

.version-content {
  max-height: 600px;
  overflow-y: auto;
}

.version-info {
  margin-bottom: 1rem;
  padding: 1rem;
  background: #f5f7fa;
  border-radius: 4px;
}

.version-info p {
  margin: 0.5rem 0;
}

.version-outline {
  margin-top: 1rem;
}
</style> 