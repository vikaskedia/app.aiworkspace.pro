import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'

export const Typeahead = Extension.create({
  name: 'typeahead',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('typeahead'),
        props: {
          handleKeyDown: (view, event) => {
            // Emit custom event that parent can listen to
            const text = view.state.doc.textBetween(0, view.state.selection.from, '\n')
            const cursorPosition = view.state.selection.from
            
            this.options.onKeyDown?.({
              text,
              cursorPosition,
              event
            })
            
            return false
          },
        },
      }),
    ]
  },
}) 