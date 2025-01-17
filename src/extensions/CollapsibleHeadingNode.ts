import { Node } from '@tiptap/core'

export const CollapsibleHeadingNode = Node.create({
  name: 'collapsibleHeadingNode',
  
  addAttributes() {
    return {
      level: {
        default: 1,
        rendered: true
      },
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
    return [
      { tag: 'h1', attrs: { level: 1 } },
      { tag: 'h2', attrs: { level: 2 } },
      { tag: 'h3', attrs: { level: 3 } }
    ]
  },
  
  renderHTML({ node, HTMLAttributes }) {
    const attrs = { ...HTMLAttributes }
    if (attrs.collapsed) {
      attrs.class = (attrs.class || '') + ' collapsed'
      attrs['data-collapsed'] = 'true'
    }
    return [`h${node.attrs.level}`, attrs, 0]
  }
}) 