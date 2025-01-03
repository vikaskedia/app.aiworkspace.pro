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
            const { state } = view
            const { selection } = state
            const { $from } = selection
            
            // Get the current text and cursor position
            const text = state.doc.textBetween(0, selection.from, '\n')
            const cursorPosition = selection.from

            // Get the last word before cursor
            const lastWord = text.slice(0, cursorPosition).split(/\s+/).pop()

            // Check if cursor is inside an anchor tag
            const isInLink = $from.marks().some(mark => mark.type.name === 'link')

            // Don't trigger typeahead if:
            // 1. The word starts with @
            // 2. The cursor is inside a link
            if (lastWord?.startsWith('@') || isInLink) {
              // Call onKeyDown with a flag to hide typeahead
              this.options.onKeyDown?.({
                text,
                cursorPosition,
                event,
                shouldHideTypeahead: true
              })
              return false
            }
            
            // Call the onKeyDown handler with the event
            const handled = this.options.onKeyDown?.({
              text,
              cursorPosition,
              event,
              shouldHideTypeahead: false
            })
            
            return handled || false
          },
        },
      }),
    ]
  },
}) 