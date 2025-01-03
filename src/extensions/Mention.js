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
          // Get shared users from editor's parent component
          const component = this.editor.options.element.closest('.editor')
            .__vueParentComponent.ctx
          
          const sharedUsers = component.sharedUsers || []
          const normalizedQuery = query.toLowerCase()
          
          return sharedUsers.filter(user =>
            user.fullName?.toLowerCase().includes(normalizedQuery) ||
            user.username?.toLowerCase().includes(normalizedQuery) ||
            user.email.toLowerCase().includes(normalizedQuery)
          ).map(user => ({
            id: user.id,
            label: user.fullName || user.username || user.email
          }))
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
          let popup
          return {
            onStart: (props) => {
              const component = this.editor.options.element.closest('.editor')
                .__vueParentComponent.ctx
              popup = component.renderMentionPopup(props)
            },
            onUpdate: (props) => {
              const component = this.editor.options.element.closest('.editor')
                .__vueParentComponent.ctx
              component.updateMentionPopup(props)
            },
            onKeyDown: (props) => {
              const component = this.editor.options.element.closest('.editor')
                .__vueParentComponent.ctx
              return component.handleMentionKeydown(props)
            },
            onExit: () => {
              const component = this.editor.options.element.closest('.editor')
                .__vueParentComponent.ctx
              component.destroyMentionPopup()
            },
          }
        }
      }),
    ]
  },
})