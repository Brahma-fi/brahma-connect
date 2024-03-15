async function waitForElement(selector: string, interval = 1000) {
  while (true) {
    const element = document.querySelector(selector)
    if (element) {
      return element
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'injectIFrame') {
    const docEl = document.documentElement
    const path = window.location.pathname
    const isPathKernel = path.includes('/kernel')

    if (!isPathKernel) return

    let iframeComponent: Element | null = null
    waitForElement('#kernel-frame').then((element) => {
      iframeComponent = element
      while (docEl.attributes.length > 0)
        docEl.removeAttribute(docEl.attributes[0].name)
      docEl.setAttribute('lang', 'en')

      docEl.dataset.publicPath = chrome.runtime.getURL('/').slice(0, -1)

      iframeComponent.innerHTML = `
            <div id="root"></div>
      `

      const node = document.createElement('script')
      node.src = chrome.runtime.getURL('/build/app.js')
      const parent = document.head || document.documentElement
      parent.appendChild(node)

      window.postMessage(message, '*')
    })
  }
})

window.addEventListener('message', (event) => {
  if (event.data.toBackground) {
    chrome.runtime.sendMessage(event.data)
  }
})

export {}
