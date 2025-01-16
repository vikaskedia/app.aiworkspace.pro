import { Node } from '@tiptap/core'

export const CollapsibleListItem = Node.create({
  name: 'collapsibleListItem',
  
  group: 'listItem',
  
  content: 'paragraph block*',
  
  defining: true,
  
  addAttributes() {
    return {
      collapsed: {
        default: false,
        keepOnSplit: false,
        parseHTML: element => {
          return element.hasAttribute('data-collapsed') || 
                 element.classList.contains('collapsed')
        },
        renderHTML: attributes => {
          if (!attributes.collapsed) return {}
          return {
            'data-collapsed': 'true',
            class: 'collapsed'
          }
        }
      }
    }
  },
  
  parseHTML() {
    return [{ tag: 'li' }]
  },
  
  renderHTML({ HTMLAttributes }) {
    const attrs = { ...HTMLAttributes }
    if (attrs.collapsed) {
      attrs.class = (attrs.class || '') + ' collapsed'
      attrs['data-collapsed'] = 'true'
    }
    return ['li', attrs, 0]
  }
})
