import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export const CollapsibleHeading = Extension.create({
  name: 'collapsibleHeading',

  addProseMirrorPlugins() {
    let decorationSet = DecorationSet.empty

    return [
      new Plugin({
        key: new PluginKey('collapsibleHeading'),
        state: {
          init() {
            return decorationSet
          },
          apply(tr, oldState) {
            const meta = tr.getMeta('collapsibleHeading')
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

              const heading = target.closest('h1, h2, h3')
              if (!heading) return false

              const rect = heading.getBoundingClientRect()
              const clickX = event.clientX
              if (clickX > rect.left + 20) return false

              event.preventDefault()
              event.stopPropagation()

              const pos = view.posAtDOM(heading, 0)
              const $pos = view.state.doc.resolve(pos)
              const node = $pos.node()

              if (node) {
                const tr = view.state.tr
                const isCurrentlyCollapsed = heading.hasAttribute('data-collapsed')
                const headingPos = $pos.before($pos.depth)
                const currentLevel = node.attrs.level

                // Find the end position by looking for next heading of same or higher level
                let endPos = headingPos + node.nodeSize
                let i = headingPos + node.nodeSize
                
                while (i < view.state.doc.content.size) {
                  const nextNode = view.state.doc.nodeAt(i)
                  if (nextNode && nextNode.type.name === 'heading') {
                    const nextLevel = nextNode.attrs.level
                    // Only break if we find a heading of same or higher level (smaller number)
                    if (nextLevel <= currentLevel) {
                      endPos = i
                      break
                    }
                  }
                  i += nextNode ? nextNode.nodeSize : 1
                }

                if (isCurrentlyCollapsed) {
                  tr.setMeta('collapsibleHeading', { clear: headingPos })
                  tr.setNodeMarkup(headingPos, null, { 
                    ...node.attrs,
                    collapsed: false 
                  })
                } else {
                  const decoration = Decoration.node(headingPos, endPos, {
                    class: 'collapsed',
                    'data-collapsed': 'true'
                  })
                  const newDecorationSet = DecorationSet.create(view.state.doc, [decoration])
                  tr.setMeta('collapsibleHeading', { decorations: newDecorationSet })
                  tr.setNodeMarkup(headingPos, null, { 
                    ...node.attrs,
                    collapsed: true 
                  })
                }

                view.dispatch(tr)
                return true
              }

              return false
            }
          }
        }
      })
    ]
  }
})