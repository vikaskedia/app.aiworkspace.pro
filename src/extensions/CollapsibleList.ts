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
            const meta = tr.getMeta('collapsibleList')
            if (meta?.decorations) {
              // Merge new decorations with existing ones
              const oldDecorations = oldState.find()
              const newDecorations = meta.decorations.find()
              
              // Filter out decorations at the same position as new ones
              const filteredOldDecorations = oldDecorations.filter(oldDec => {
                return !newDecorations.some(newDec => newDec.from === oldDec.from)
              })
              
              // Combine filtered old decorations with new ones
              return DecorationSet.create(tr.doc, [...filteredOldDecorations, ...newDecorations])
            }
            if (meta?.clear) {
              // Clear specific decoration
              const oldDecorations = oldState.find()
              const filtered = oldDecorations.filter(dec => dec.from !== meta.clear)
              return DecorationSet.create(tr.doc, filtered)
            }
            return oldState.map(tr.mapping, tr.doc)
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

              const pos = view.posAtDOM(listItem, 0)
              const $pos = view.state.doc.resolve(pos)
              
              let depth = $pos.depth
              while (depth > 0) {
                const node = $pos.node(depth)
                if (node.type.name === 'listItem' || node.type.name === 'collapsibleListItem') {
                  const listItemPos = $pos.before(depth)
                  const listItemNode = view.state.doc.nodeAt(listItemPos)

                  if (listItemNode) {
                    const isCurrentlyCollapsed = listItem.hasAttribute('data-collapsed')
                    const tr = view.state.tr
                    
                    if (isCurrentlyCollapsed) {
                      // Clear this specific decoration
                      tr.setMeta('collapsibleList', { clear: listItemPos })
                      tr.setNodeMarkup(listItemPos, null, { ...listItemNode.attrs, collapsed: false })
                    } else {
                      // Add new decoration for this item
                      const decoration = Decoration.node(listItemPos, listItemPos + listItemNode.nodeSize, {
                        class: 'collapsed',
                        'data-collapsed': 'true'
                      })
                      const newDecorationSet = DecorationSet.create(view.state.doc, [decoration])
                      tr.setMeta('collapsibleList', { decorations: newDecorationSet })
                      tr.setNodeMarkup(listItemPos, null, { ...listItemNode.attrs, collapsed: true })
                    }
                    
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