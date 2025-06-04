import { reactive } from 'vue';

export const dragState = reactive({
  hoveredId: null, // ID of the item currently hovered for drop
  hoveredPosition: null // 'top' or 'bottom'
}); 