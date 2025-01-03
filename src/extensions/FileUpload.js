import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export const FileUpload = Extension.create({
  name: 'fileUpload',
  
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('fileUpload'),
        props: {
          decorations: (state) => {
            const decorations = []
            const doc = state.doc

            doc.descendants((node, pos) => {
              if (node.isText) {
                const text = node.text
                const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
                let match

                while ((match = linkRegex.exec(text)) !== null) {
                  const start = pos + match.index
                  const end = start + match[0].length
                  const fullPath = match[1]
                  const fileUrl = match[2]
                  
                  // Extract just the filename from the full path
                  const fileName = fullPath.split('/').pop()

                  const element = document.createElement('a')
                  element.href = fileUrl
                  element.target = '_blank'
                  element.className = 'file-link'
                  element.textContent = fileName

                  decorations.push(
                    Decoration.widget(start, () => element, { destroyOnUpdate: true })
                  )
                  
                  // Hide the original markdown
                  decorations.push(
                    Decoration.inline(start, end, { style: 'display: none' })
                  )
                }
              }
            })

            return DecorationSet.create(doc, decorations)
          }
        }
      })
    ]
  },

  addCommands() {
    return {
      insertFile: (attributes) => ({ tr, dispatch }) => {
        const fileName = attributes.name.split('/').pop()
        const node = tr.doc.type.schema.text(
          `[${fileName}](${attributes.url})`
        )
        
        if (dispatch) {
          tr.replaceSelectionWith(node)
        }
        
        return true
      },
    }
  },
}) 