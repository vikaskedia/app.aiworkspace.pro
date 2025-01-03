import { Extension } from '@tiptap/core'

export const FileUpload = Extension.create({
  name: 'fileUpload',
  
  addCommands() {
    return {
      insertFile: (attributes) => ({ tr, dispatch }) => {
        const node = tr.doc.type.schema.text(
          `[${attributes.name}](${attributes.url})`
        )
        
        if (dispatch) {
          tr.replaceSelectionWith(node)
        }
        
        return true
      },
    }
  },
}) 