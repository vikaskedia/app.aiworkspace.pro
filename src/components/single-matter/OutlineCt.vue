<template>
  <div class="outline-container">
    <div class="outline-header">
      <el-button 
        type="primary" 
        @click="saveOutline" 
        :loading="saving"
        :disabled="!hasChanges"
      >
        Save Outline
      </el-button>
    </div>
    <ul class="outline-list">
      <OutlinePointsCt
        v-for="item in outline"
        :key="item.id"
        :item="item"
        @update="onOutlineUpdate"
        @move="handleMove"
        @delete="handleDelete"
      />
    </ul>
  </div>
</template>

<script>
import { ref, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElNotification } from 'element-plus';
import { supabase } from '../../supabase';
import OutlinePointsCt from './OutlinePointsCt.vue';

export default {
  name: 'OutlineCt',
  components: { OutlinePointsCt },
  setup() {
    const route = useRoute();
    const matterId = route.params.matterId;
    const saving = ref(false);
    const outline = ref([]);
    const outlineId = ref(null);
    const currentVersion = ref(1);
    const hasChanges = ref(false);
    const lastSavedContent = ref(null);

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
          currentVersion.value = storedVersion ? parseInt(storedVersion) : 1;
        } catch {
          outline.value = defaultOutline;
          currentVersion.value = 1;
        }
      } else {
        outline.value = defaultOutline;
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

      // If position is 'after', add as sibling
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
      } else {
        // If position is 'before', add as child
        if (!targetItem.children) {
          targetItem.children = [];
        }
        // Add as first child
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

    return { 
      outline, 
      saving,
      hasChanges,
      onOutlineUpdate, 
      handleMove, 
      handleDelete,
      saveOutline 
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
</style> 