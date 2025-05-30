<template>
  <div class="outline-container">
    <div class="outline-header">
      <el-button type="primary" @click="saveOutline" :loading="saving">
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
import { supabase } from '../../supabase';
import OutlinePointsCt from './OutlinePointsCt.vue';

const LOCAL_KEY = 'outline';

export default {
  name: 'OutlineCt',
  components: { OutlinePointsCt },
  setup() {
    const route = useRoute();
    const matterId = route.params.matterId;
    const saving = ref(false);
    const outline = ref([]);
    const outlineId = ref(null);

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
      // First load from localStorage
      const data = localStorage.getItem(LOCAL_KEY);
      if (data) {
        try {
          outline.value = JSON.parse(data);
        } catch {
          outline.value = defaultOutline;
        }
      } else {
        outline.value = defaultOutline;
      }

      // Then fetch from Supabase
      if (matterId) {
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
            // Only update if the content is different
            if (JSON.stringify(outlineData.content) !== JSON.stringify(outline.value)) {
              outline.value = outlineData.content;
              localStorage.setItem(LOCAL_KEY, JSON.stringify(outlineData.content));
            }
          }
          // If no outline data in Supabase, keep the localStorage/default data
        } catch (error) {
          console.error('Error in outline setup:', error);
        }
      }
    });

    // Save to localStorage on change
    watch(outline, (val) => {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(val));
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
          // Update existing outline
          const { error: updateError } = await supabase
            .from('outlines')
            .update({
              content: outline.value,
              version: supabase.rpc('increment_version', { outline_id: outlineId.value })
            })
            .eq('id', outlineId.value);

          if (updateError) throw updateError;
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
        }

        // Create version record
        const { error: versionError } = await supabase
          .from('outline_versions')
          .insert([{
            outline_id: outlineId.value,
            content: outline.value,
            version: outlineId.value ? (await supabase.rpc('get_latest_version', { outline_id: outlineId.value })).data : 1,
            created_by: user.id
          }]);

        if (versionError) throw versionError;

      } catch (error) {
        console.error('Error saving outline:', error);
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