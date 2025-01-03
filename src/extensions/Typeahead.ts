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
            
            // Get the last word before cursor
            const lastWord = text.slice(0, cursorPosition).split(/\s+/).pop()
            
            // Don't trigger typeahead if the word starts with @
            if (lastWord?.startsWith('@')) {
              return false
            }
            
            // Call the onKeyDown handler with the event
            const handled = this.options.onKeyDown?.({
              text,
              cursorPosition,
              event
            })
            
            return handled || false
          },
        },
      }),
    ]
  },
}) 