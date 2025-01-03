import { Node, mergeAttributes } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion from '@tiptap/suggestion'

export const MentionPluginKey = new PluginKey('mention')

export const Mention = Node.create({
  name: 'mention',
  group: 'inline',
  inline: true,
  selectable: false,
  atom: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-id'),
        renderHTML: attributes => {
          return {
            'data-id': attributes.id,
          }
        },
      },
      label: {
        default: null,
        parseHTML: element => element.getAttribute('data-label'),
        renderHTML: attributes => {
          return {
            'data-label': attributes.label,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-mention]',
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-mention': '' }, HTMLAttributes), `@${node.attrs.label}`]
  },

  renderText({ node }) {
    return `@${node.attrs.label}`
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '@',
        pluginKey: MentionPluginKey,
        items: ({ query }) => {
          // Return empty array by default, the actual filtering will be handled by TiptapEditor
          return []
        },
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: this.name,
                attrs: props
              },
              {
                type: 'text',
                text: ' '
              }
            ])
            .run()
        },
        allow: ({ editor, range }) => {
          return editor.can().insertContentAt(range, { type: this.name })
        },
        render: () => {
          // Return empty object, the actual rendering will be handled by TiptapEditor
          return {
            onStart: () => {},
            onUpdate: () => {},
            onKeyDown: () => false,
            onExit: () => {},
          }
        }
      }),
    ]
  },
})