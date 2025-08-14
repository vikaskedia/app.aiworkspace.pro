import type { FUniver } from '@univerjs/presets'

export function setupCommandsListenerSwitch($toolbar: HTMLElement, univerAPI: FUniver) {
  const $button = document.createElement('a')
  $button.textContent = 'start listening commands'
  $toolbar.appendChild($button)
  const el = $button
  let listener: any = null

  $button.addEventListener('click', () => {
    if (!univerAPI)
      throw new Error('univerAPI is not defined')

    if (listener) {
      listener.dispose()
      listener = null
      el.innerHTML = 'start listening commands'
      return
    }

    listener = univerAPI.addEvent(univerAPI.Event.CommandExecuted, (command) => {
      // eslint-disable-next-line no-console
      console.log(command)
    })
    el.innerHTML = 'stop listening commands'

    // eslint-disable-next-line no-alert
    alert('Press "Ctrl + Shift + I" to open the console and do some actions in the Univer Sheets, you will see the commands in the console.')
  })
}

export function setupEditSwitch($toolbar: HTMLElement, univerAPI: FUniver) {
  const $button = document.createElement('a')
  $button.textContent = 'disable edit'
  $toolbar.appendChild($button)
  const el = $button
  let listener: any = null
  let errListener: any = null

  $button.addEventListener('click', () => {
    if (!univerAPI)
      throw new Error('univerAPI is not defined')

    class DisableEditError extends Error {
      constructor() {
        super('editing is disabled')
        this.name = 'DisableEditError'
      }
    }

    if (listener) {
      listener.dispose()
      window.removeEventListener('error', errListener)
      window.removeEventListener('unhandledrejection', errListener)
      listener = null
      el.innerHTML = 'disable edit'
      return
    }

    errListener = (e: PromiseRejectionEvent | ErrorEvent) => {
      const error = e instanceof PromiseRejectionEvent ? e.reason : e.error
      if (error instanceof DisableEditError) {
        e.preventDefault()
        console.warn('editing is disabled')
      }
    }
    window.addEventListener('error', errListener)
    window.addEventListener('unhandledrejection', errListener)
    listener = univerAPI.addEvent(univerAPI.Event.BeforeCommandExecute, () => {
      throw new DisableEditError()
    })

    // eslint-disable-next-line no-alert
    alert('Editing is disabled, try to edit a cell to see the effect')
    el.innerHTML = 'enable edit'
  })
}

export function setupUndo($toolbar: HTMLElement, univerAPI: FUniver) {
  const $button = document.createElement('a')
  $button.textContent = 'undo'
  $toolbar.appendChild($button)

  $button.addEventListener('click', () => {
    if (!univerAPI)
      throw new Error('univerAPI is not defined')

    univerAPI.undo()
  })
}

export function setupRedo($toolbar: HTMLElement, univerAPI: FUniver) {
  const $button = document.createElement('a')
  $button.textContent = 'redo'
  $toolbar.appendChild($button)

  $button.addEventListener('click', () => {
    if (!univerAPI)
      throw new Error('univerAPI is not defined')

    univerAPI.redo()
  })
}

export function setupSelectText($toolbar: HTMLElement, univerAPI: FUniver) {
  const $button = document.createElement('a')
  $button.textContent = 'select text'
  $toolbar.appendChild($button)

  $button.addEventListener('click', () => {
    if (!univerAPI)
      throw new Error('univerAPI is not defined')

    univerAPI.getActiveDocument()?.setSelection(0, 1)
  })
}

export function setupSaveContent($toolbar: HTMLElement, univerAPI: FUniver) {
  const $button = document.createElement('a')
  $button.textContent = 'save content'
  $toolbar.appendChild($button)

  $button.addEventListener('click', async () => {
    if (!univerAPI)
      throw new Error('univerAPI is not defined')

    try {
      const doc = univerAPI.getActiveDocument()
      if (!doc) {
        alert('No active document found')
        return
      }

      // Get the document snapshot which contains all the content and formatting
      const snapshot = doc.getSnapshot()
      
      // Save to localStorage as JSON
      const contentData = {
        snapshot,
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
      
      localStorage.setItem('univer-doc-content', JSON.stringify(contentData))
      alert('Content saved successfully!')
    } catch (error) {
      console.error('Error saving content:', error)
      alert('Error saving content. Check console for details.')
    }
  })
}

export function setupLoadContent($toolbar: HTMLElement, univerAPI: FUniver) {
  const $button = document.createElement('a')
  $button.textContent = 'load content'
  $toolbar.appendChild($button)

  $button.addEventListener('click', async () => {
    if (!univerAPI)
      throw new Error('univerAPI is not defined')

    try {
      const savedData = localStorage.getItem('univer-doc-content')
      if (!savedData) {
        alert('No saved content found')
        return
      }

      const contentData = JSON.parse(savedData)
      
      // Replace the current document content with the saved snapshot
      // For now, we'll reload the page to properly reset the document
      sessionStorage.setItem('loadOnReload', 'true')
      window.location.reload()
    } catch (error) {
      console.error('Error loading content:', error)
      alert('Error loading content. Check console for details.')
    }
  })
}

export function loadSavedContentOnStartup() {
  try {
    const savedData = localStorage.getItem('univer-doc-content')
    const shouldLoadOnReload = sessionStorage.getItem('loadOnReload')
    
    // Clear the reload flag
    if (shouldLoadOnReload) {
      sessionStorage.removeItem('loadOnReload')
    }
    
    // Always load saved content if it exists (both on startup and after manual load)
    if (savedData) {
      const contentData = JSON.parse(savedData)
      return contentData.snapshot
    }
  } catch (error) {
    console.error('Error loading saved content on startup:', error)
  }
  return null
}
