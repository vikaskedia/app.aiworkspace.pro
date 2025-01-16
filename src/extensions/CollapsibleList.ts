import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export const CollapsibleList = Extension.create({
  name: 'collapsibleList',

  addProseMirrorPlugins() {
    let decorationSet = DecorationSet.empty

    return [
      new Plugin({
        key: new PluginKey('collapsibleList'),
        state: {
          init() {
            return decorationSet
          },
          apply(tr, oldState) {
            decorationSet = DecorationSet.empty
            const meta = tr.getMeta('collapsibleList')
            if (meta?.decorations) {
              return meta.decorations
            }
            return oldState
          }
        },
        props: {
          decorations(state) {
            return this.getState(state)
          },
          handleDOMEvents: {
            mousedown: (view, event) => {
              const target = event.target as HTMLElement
              if (!target) return false

              const listItem = target.closest('li')
              if (!listItem) return false

              const rect = listItem.getBoundingClientRect()
              const clickX = event.clientX
              if (clickX > rect.left + 20) return false

              const hasNestedList = listItem.querySelector('ul, ol')
              if (!hasNestedList) return false

              event.preventDefault()
              event.stopPropagation()

              // Find the list item position
              const pos = view.posAtDOM(listItem, 0)
              const $pos = view.state.doc.resolve(pos)
              
              // Find the list item node
              let depth = $pos.depth
              while (depth > 0) {
                const node = $pos.node(depth)
                if (node.type.name === 'listItem' || node.type.name === 'collapsibleListItem') {
                  const listItemPos = $pos.before(depth)
                  const listItemNode = view.state.doc.nodeAt(listItemPos)

                  if (listItemNode) {
                    // Check current collapsed state
                    const isCurrentlyCollapsed = listItem.hasAttribute('data-collapsed')
                    
                    const tr = view.state.tr
                    
                    if (isCurrentlyCollapsed) {
                      // Remove decoration and attributes
                      decorationSet = DecorationSet.empty
                      tr.setNodeMarkup(listItemPos, null, { ...listItemNode.attrs, collapsed: false })
                    } else {
                      // Add decoration and attributes
                      const decoration = Decoration.node(listItemPos, listItemPos + listItemNode.nodeSize, {
                        class: 'collapsed',
                        'data-collapsed': 'true'
                      })
                      decorationSet = DecorationSet.create(view.state.doc, [decoration])
                      tr.setNodeMarkup(listItemPos, null, { ...listItemNode.attrs, collapsed: true })
                    }

                    tr.setMeta('collapsibleList', { decorations: decorationSet })
                    view.dispatch(tr)
                    break
                  }
                }
                depth--
              }
              return true
            }
          }
        }
      })
    ]
  }
})