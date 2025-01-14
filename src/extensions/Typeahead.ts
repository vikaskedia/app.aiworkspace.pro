import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'

export const Typeahead = Extension.create({
  name: 'typeahead',

  addProseMirrorPlugins() {
    let lastText = ''

    return [
      new Plugin({
        key: new PluginKey('typeahead'),
        props: {
          handleKeyDown: (view, event) => {
            // Skip suggestion fetching for navigation keys and Tab
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(event.key)) {
              // Only handle Tab if suggestions are already showing
              if (event.key === 'Tab') {
                const { state } = view
                const { selection } = state
                const currentText = state.doc.textBetween(0, selection.from, '\n')
                
                const hasActiveSuggestions = this.options.onKeyDown?.({
                  text: currentText,
                  cursorPosition: selection.from,
                  event,
                  checkSuggestions: true,
                  preventFetch: true  // Add this to prevent fetching suggestions
                })

                if (hasActiveSuggestions) {
                  event.preventDefault();
                  return true;
                }
              }
              return false;
            }

            if (event.key === 'Escape') {
              const hasActiveSuggestions = this.options.onKeyDown?.({
                text: '',
                cursorPosition: 0,
                event,
                shouldHideTypeahead: true,
                preventFetch: true
              })
              
              if (hasActiveSuggestions) {
                event.preventDefault();
                event.stopPropagation();
                return true;
              }
              return false;
            }

            const { state } = view
            const { selection } = state
            const { $from } = selection
            
            // Get current text
            let currentText = state.doc.textBetween(0, selection.from, '\n')

            // Only append the new character if it's a printable character
            if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
              currentText += event.key
            }
            
            // Only proceed if text has actually changed
            if (currentText === lastText) {
              return false
            }
            
            lastText = currentText
            const cursorPosition = selection.from

            // Check if cursor is inside a link
            const isInLink = $from.marks().some(mark => mark.type.name === 'link')
            
            // Get the last word before cursor
            const lastWord = currentText.slice(0, cursorPosition).split(/\s+/).pop()

            // Don't trigger typeahead if:
            // 1. The word starts with @
            // 2. The cursor is inside a link
            if (lastWord?.startsWith('@') || isInLink) {
              this.options.onKeyDown?.({
                text: currentText,
                cursorPosition,
                event,
                shouldHideTypeahead: true
              })
              return false
            }
            
            // Only trigger suggestions if we have at least 2 characters
            if (lastWord && lastWord.length >= 2) {
              this.options.onKeyDown?.({
                text: currentText,
                cursorPosition,
                event,
                shouldHideTypeahead: false
              })
            }
            
            return false
          },
        },
      }),
    ]
  },
}) 