import '@univerjs/presets/lib/styles/preset-docs-core.css'
import '@univerjs/presets/lib/styles/preset-docs-thread-comment.css'
import '@univerjs/presets/lib/styles/preset-docs-drawing.css'
import '@univerjs/presets/lib/styles/preset-docs-hyper-link.css'

import { LocaleType, LogLevel, createUniver, defaultTheme, merge } from '@univerjs/presets'

import { UniverDocsCorePreset } from '@univerjs/presets/preset-docs-core'
import docsCoreEnUs from '@univerjs/presets/preset-docs-core/locales/en-US'

import { UniverDocsDrawingPreset } from '@univerjs/presets/preset-docs-drawing'
import docsDrawingEnUs from '@univerjs/presets/preset-docs-drawing/locales/en-US'

import { UniverDocsHyperLinkPreset } from '@univerjs/presets/preset-docs-hyper-link'
import docsHyperLinkEnUs from '@univerjs/presets/preset-docs-hyper-link/locales/en-US'

import { UniverDocsThreadCommentPreset } from '@univerjs/presets/preset-docs-thread-comment'
import docsThreadCommentEnUs from '@univerjs/presets/preset-docs-thread-comment/locales/en-US'

import { loadSavedContentOnStartup } from './api'

export function setupUniver() {
  const { univerAPI } = createUniver({
    locale: LocaleType.EN_US,
    locales: {
      [LocaleType.EN_US]: merge(
        {},
        docsCoreEnUs,
        docsDrawingEnUs,
        docsHyperLinkEnUs,
        docsThreadCommentEnUs,
      ),
    },
    logLevel: LogLevel.VERBOSE,
    theme: defaultTheme,
    presets: [
      UniverDocsCorePreset({
        container: 'univer',
        header: true,
        footer: true,
      }),
      UniverDocsDrawingPreset(),
      UniverDocsHyperLinkPreset(),
      UniverDocsThreadCommentPreset(),
    ],
    plugins: [],
  })

  // Try to load saved content, otherwise create a new document with default text
  const savedSnapshot = loadSavedContentOnStartup()

  const testData = {
    "id": "doc-1755177256508",
    "body": {
        "dataStream": "final test\r\n\r\nWelcome to your new Univer document! Start typing to add your content.\r\n\r\n",
        "textRuns": [
            {
                "st": 0,
                "ed": 10,
                "ts": {
                    "fs": 24,
                    "bl": 1
                }
            },
            {
                "st": 12,
                "ed": 81,
                "ts": {
                    "fs": 14
                }
            }
        ],
        "paragraphs": [
            {
                "startIndex": 11,
                "paragraphStyle": {
                    "spaceBelow": {
                        "v": 20
                    },
                    "headingId": "heading1"
                }
            },
            {
                "startIndex": 82,
                "paragraphStyle": {
                    "spaceBelow": {
                        "v": 10
                    }
                }
            }
        ]
    },
    "documentStyle": {
        "pageSize": {
            "width": 595,
            "height": 842
        },
        "marginTop": 72,
        "marginBottom": 72,
        "marginRight": 90,
        "marginLeft": 90
    }
}
  
  if (savedSnapshot) {
    //univerAPI.createUniverDoc(savedSnapshot)
    univerAPI.createUniverDoc(testData)
  } else {
    univerAPI.createUniverDoc({})
    univerAPI.getActiveDocument()?.appendText('Hello World!')
  }

  return univerAPI
}
