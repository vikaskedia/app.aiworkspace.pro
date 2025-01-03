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
            // Get the current text and cursor position
            const text = view.state.doc.textBetween(0, view.state.selection.from, '\n')
            const cursorPosition = view.state.selection.from
            
            // Call the onKeyDown handler with the event
            const handled = this.options.onKeyDown?.({
              text,
              cursorPosition,
              event
            })
            
            // Return true if the event was handled
            return handled || false
          },
        },
      }),
    ]
  },
}) 