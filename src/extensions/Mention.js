import { Node, mergeAttributes } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion from '@tiptap/suggestion'
import { supabase } from '../supabase'

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
    return [
      'span',
      mergeAttributes(
        {
          'data-mention': '',
          'style': 'color: #409EFF; font-weight: 500;'
        },
        HTMLAttributes
      ),
      `@${node.attrs.label}`
    ]
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
        items: async ({ query }) => {
          const component = this.editor.options.element?.closest('.editor')?.__vueParentComponent?.ctx;
          if (!component) return [];
          
          const normalizedQuery = query?.toLowerCase() || '';
          
          let suggestions = [];
          
          // Only include AI attorneys if we're in a task comment
          if (component.isTaskComment) {
            // Get AI Attorneys from Supabase
            let attorneys = [];
            try {
              const { data } = await supabase
                .from('attorneys')
                .select('id, name, specialty, system_prompt');
              attorneys = data || [];
            } catch (error) {
              console.error('Error loading attorneys:', error);
            }

            suggestions = [
              // AI attorneys with special type
              ...attorneys.map(attorney => ({
                id: attorney.id,
                label: attorney.name,
                type: 'ai_attorney',
                systemPrompt: attorney.system_prompt
              })),
              
              // Default AI Attorney
              {
                id: 'aiAttorney',
                label: 'AI Attorney',
                type: 'default_ai'
              }
            ];
          }
          
          // Always include regular users
          suggestions = [
            ...suggestions,
            ...component.sharedUsers.map(user => ({
              id: user.id,
              label: user.email,
              type: 'user'
            }))
          ];

          return suggestions
            .filter(item => {
              const label = item.label.toLowerCase();
              return label.includes(normalizedQuery);
            })
            .slice(0, 10);
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
              const component = this.editor.options.element?.closest('.editor')
                ?.__vueParentComponent?.ctx
              if (component?.renderMentionPopup) {
                popup = component.renderMentionPopup(props)
              }
            },
            onUpdate: (props) => {
              const component = this.editor.options.element?.closest('.editor')
                ?.__vueParentComponent?.ctx
              if (component?.updateMentionPopup) {
                component.updateMentionPopup(props)
              }
            },
            onKeyDown: (props) => {
              const component = this.editor.options.element?.closest('.editor')
                ?.__vueParentComponent?.ctx
              if (component?.handleMentionKeydown) {
                return component.handleMentionKeydown(props)
              }
              return false
            },
            onExit: () => {
              const component = this.editor.options.element?.closest('.editor')
                ?.__vueParentComponent?.ctx
              if (component?.destroyMentionPopup) {
                component.destroyMentionPopup()
              }
            },
          }
        }
      }),
    ]
  },
})