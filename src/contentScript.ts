/* eslint-disable @typescript-eslint/no-empty-function */
import { production } from './settings'
import { KERNEL_MESSAGE_SEPARATOR, MessageType } from './types'

const ALLOWED_ORIGINS = ['https://console.brahma.fi']

window.addEventListener('message', function (ev: MessageEvent<string>) {
  console.log('message received on contentScript', ev.data)
  if (!ALLOWED_ORIGINS.includes(ev.origin) || !(typeof ev.data === 'string'))
    return

  if (ev.data.startsWith(MessageType.UPDATE_RPC_CONFIG)) {
    const rpcConfigData = ev.data.split(KERNEL_MESSAGE_SEPARATOR)
    const chainId = rpcConfigData[1]
    const jwtToken = rpcConfigData[2]

    /// validate chainId to be int string & supported
    if (!/^\d+$/.test(chainId)) {
      const chainError = 'Invalid Chain ID'
      window.postMessage(
        `${MessageType.ERROR}${KERNEL_MESSAGE_SEPARATOR}${chainError}`
      )
      throw new Error(chainError)
    }

    chrome.runtime.sendMessage({
      type: MessageType.UPDATE_RPC_CONFIG,
      chainId,
      jwtToken,
    })
    chrome.storage.sync.set({ chainId }, function () {
      console.log('current chainId saved')
    })
  }
})

function inject(windowName: string, scriptPath: string) {
  if (window.name === windowName) {
    chrome.storage.sync.get(['chainId'], ({ chainId }) => {
      console.log('eth_chainId current from content-script', chainId)

      const node = document.createElement('script')
      node.src = chrome.runtime.getURL(scriptPath)

      const chainIdEl = document.createElement('div')
      chainIdEl.id = 'kernel-chain-id'
      chainIdEl.style.visibility = 'hidden'
      chainIdEl.style.display = 'none'
      chainIdEl.innerHTML = chainId

      const parent = document.head || document.documentElement
      parent.insertBefore(node, parent.children[0])
      parent.insertBefore(chainIdEl, parent.children[0])
      node.onload = function () {
        node.remove()
      }
    })
  }
}

inject('kernel-frame', 'build/injection.js')

if (production)
  window.console = {
    log: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    info: () => {},
  } as any

// Provide the background script with the chainId of a given RPC endpoint on request
if (window.name === 'kernel-frame') {
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message.type === 'requestChainId') {
      fetch(message.url, {
        method: 'POST',
        body: JSON.stringify({
          method: 'eth_chainId',
          params: [],
          jsonrpc: '2.0',
          id: 1,
        }),
      })
        .then((res) => res.json())
        .then((json) => {
          const networkId = parseInt(json.result)
          respond(networkId && !isNaN(networkId) ? networkId : 1)
        })

      return true // without this the response won't be sent
    }
  })
}

export {}
