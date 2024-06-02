import { HYPERVISOR_BASE_URL } from './settings'
import { MessageType } from './types'

// Attention: The URL must also be updated in manifest.json
const KERNEL_URL = 'https://console.brahma.fi/account/'

interface Fork {
  networkId: number
  rpcUrl: string
}

enum HashTypes {
  REDIRECT = 'REDIRECT',
  HEADERS = 'HEADERS',
}

// Track tabs showing our extension, so we can dynamically adjust the declarativeNetRequest rule.
// This rule removes some headers so foreign pages can be loaded in iframes. We don't want to
// generally circumvent this security mechanism, so we only apply it to extension tabs.
const activeExtensionTabs = new Set<number>()

const startTrackingTab = (tabId: number) => {
  activeExtensionTabs.add(tabId)
  updateHeadersRule()
  console.log('Kernel: started tracking tab', tabId)
}

const stopTrackingTab = (tabId: number) => {
  removeRpcRedirectRules(tabId)
  activeExtensionTabs.delete(tabId)
  simulatingExtensionTabs.delete(tabId)
  updateHeadersRule()
  console.log('Kernel: stopped tracking tab', tabId)
}

const updateHeadersRule = () => {
  const RULE_ID = 1

  chrome.declarativeNetRequest.updateSessionRules(
    {
      addRules: [
        {
          id: RULE_ID,
          priority: 1,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            responseHeaders: [
              {
                header: 'x-frame-options',
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
              },
              {
                header: 'X-Frame-Options',
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
              },
              {
                header: 'content-security-policy',
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
              },
              {
                header: 'Content-Security-Policy',
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
              },
            ],
          },
          condition: {
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
            ],
            tabIds: Array.from(activeExtensionTabs),
          },
        },
      ],
      removeRuleIds: [RULE_ID],
    },
    () => {
      if (chrome.runtime.lastError) {
        console.log(
          'Rule update failed',
          chrome.runtime.lastError,
          activeExtensionTabs
        )
      } else {
        console.log('Rule update successful', activeExtensionTabs)
      }
    }
  )
}

const updateRPCConfigHeadersRule = (chainId: string, jwtToken: string) => {
  const RULE_ID = 2

  chrome.declarativeNetRequest.updateSessionRules(
    {
      addRules: [
        {
          id: RULE_ID,
          priority: 1,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: [
              {
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                header: 'Authorization',
                value: `Bearer ${jwtToken}`,
              },
              {
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                header: 'ChainID',
                value: chainId,
              },
            ],
          },
          condition: {
            resourceTypes: ['xmlhttprequest'],
            urlFilter: `${HYPERVISOR_BASE_URL}/*`,
            tabIds: Array.from(activeExtensionTabs),
          },
        } as chrome.declarativeNetRequest.Rule,
      ],
      removeRuleIds: [RULE_ID],
    },
    () => {
      if (chrome.runtime.lastError) {
        console.log(
          'RPC Config Rule update failed',
          chrome.runtime.lastError,
          activeExtensionTabs
        )
      } else {
        console.log('RPC Config Rule update successful', activeExtensionTabs)
      }
    }
  )
}

// When clicking the extension button, load the current tab's page in the simulation browser
const toggle = async (tab: chrome.tabs.Tab) => {
  if (!tab.id || !tab.url) return

  if (!tab.url.startsWith(KERNEL_URL)) {
    // add to tracked list
    startTrackingTab(tab.id)

    const url =
      tab.url.startsWith('chrome://') || tab.url.startsWith('about:')
        ? ''
        : tab.url
    chrome.tabs.update(tab.id, {
      url: `${KERNEL_URL}#${encodeURIComponent(url)}`,
    })
  } else {
    // remove from tracked list
    stopTrackingTab(tab.id)

    const url = new URL(tab.url)
    const appUrl = decodeURIComponent(url.hash.slice(1))

    await chrome.tabs.update(tab.id, {
      url: appUrl,
    })
  }
}
chrome.action.onClicked.addListener(toggle)

// Track extension tabs that are actively simulating, meaning that RPC requests are being sent to
// a fork network.
const simulatingExtensionTabs = new Map<number, Fork>()

// Hash the RPC URL+ tab ID to a number, so we can use it as a declarativeNetRequest rule ID.
// Implementation taken from https://github.com/darkskyapp/string-hash (CC0 Public Domain)
function hash(rpcUrl: string, tabId: number, type: string) {
  rpcUrl = `${rpcUrl}:${type}`
  const str = `${tabId}:${rpcUrl}`

  const MAX_RULE_ID = 0xffffff // chrome throws an error if the rule ID is too large ("expected integer, got number")

  let hash = 5381,
    i = str.length

  while (i) {
    hash = (hash * 33) ^ str.charCodeAt(--i)
  }

  /* JavaScript does bitwise operations (like XOR, above) on 32-bit signed
   * integers. Since we want the results to be always positive, convert the
   * signed int to an unsigned by doing an unsigned bitshift. */
  return (hash >>> 0) % MAX_RULE_ID
}

const updateRpcRedirectRules = (tabId: number) => {
  const fork = simulatingExtensionTabs.get(tabId)
  if (!fork) {
    return
  }

  const networkIdOfRpcUrl = networkIdOfRpcUrlPerTab.get(tabId)
  if (!networkIdOfRpcUrl) {
    return
  }

  const networkRpcEntries = [...networkIdOfRpcUrl.entries()].map(
    ([rpcUrl]) => rpcUrl
  )
  const addRules = networkRpcEntries
    .filter((rpcUrl, pos) => networkRpcEntries.indexOf(rpcUrl) == pos)
    .map(
      (rpcUrl) =>
        ({
          id: hash(rpcUrl, tabId, HashTypes.REDIRECT),
          priority: 1,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
            redirect: { url: fork.rpcUrl },
          },
          condition: {
            resourceTypes: ['xmlhttprequest'],
            urlFilter: rpcUrl,
            tabIds: [tabId],
          },
        } as chrome.declarativeNetRequest.Rule)
    )

  const ruleIds = [...networkIdOfRpcUrl.entries()].map(([rpcUrl]) =>
    hash(rpcUrl, tabId, HashTypes.REDIRECT)
  )

  console.log('Add redirect rules', addRules, ruleIds)

  chrome.declarativeNetRequest.updateSessionRules({
    addRules,
    removeRuleIds: ruleIds,
  })
}

const removeRpcRedirectRules = (tabId: number) => {
  const networkIdOfRpcUrl = networkIdOfRpcUrlPerTab.get(tabId)

  if (!networkIdOfRpcUrl) return
  const ruleIds = [...networkIdOfRpcUrl.entries()].map(([rpcUrl]) =>
    hash(rpcUrl, tabId, HashTypes.REDIRECT)
  )

  chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: ruleIds,
  })
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!sender.tab?.id) return
  if (message.type === 'startSimulating') {
    const { networkId, rpcUrl } = message
    console.log({ message: JSON.stringify(message), id: sender.tab.id, rpcUrl })

    simulatingExtensionTabs.set(sender.tab.id, {
      networkId,
      rpcUrl,
    })
    updateRpcRedirectRules(sender.tab.id)

    console.debug(
      `start intercepting JSON RPC requests for network #${networkId} in tab #${sender.tab.id}`,
      rpcUrl
    )
  }
  if (message.type === 'stopSimulating') {
    simulatingExtensionTabs.delete(sender.tab.id)
    removeRpcRedirectRules(sender.tab.id)

    console.debug(
      `stop intercepting JSON RPC requests in tab #${sender.tab.id}`
    )
  }
  if (message.type === MessageType.UPDATE_RPC_CONFIG) {
    const { chainId, jwtToken } = message
    console.log('rpc config received', { message: JSON.stringify(message) })

    updateRPCConfigHeadersRule(chainId, jwtToken)
  }
})

// Keep track of the network IDs for all JSON RPC endpoints used from apps in the Kernel frame
const networkIdOfRpcUrlPerTab = new Map<
  number,
  Map<string, number | undefined>
>()
const networkIdOfRpcUrlPromisePerTab = new Map<
  number,
  Map<string, Promise<number | undefined>>
>()
chrome.webRequest.onBeforeRequest.addListener(
  (details: chrome.webRequest.WebRequestBodyDetails) => {
    // only consider requests from extension tabs
    if (!activeExtensionTabs.has(details.tabId)) return
    // don't consider requests from the extension itself
    if (details.parentFrameId === -1) return
    // only consider POST requests
    if (details.method !== 'POST') return
    // don't consider requests that are already redirected to the fork RPC
    if (details.url === simulatingExtensionTabs.get(details.tabId)?.rpcUrl)
      return
    // only consider requests with a JSON RPC body
    if (!getJsonRpcBody(details)) return

    detectNetworkOfRpcUrl(details.url, details.tabId)
  },
  {
    urls: ['<all_urls>'],
    types: ['xmlhttprequest'],
  },
  ['requestBody']
)

const detectNetworkOfRpcUrl = async (url: string, tabId: number) => {
  if (!networkIdOfRpcUrlPerTab.has(tabId))
    networkIdOfRpcUrlPerTab.set(tabId, new Map())
  if (!networkIdOfRpcUrlPromisePerTab.has(tabId))
    networkIdOfRpcUrlPromisePerTab.set(tabId, new Map())
  const networkIdOfRpcUrl = networkIdOfRpcUrlPerTab.get(tabId) as Map<
    string,
    number | undefined
  >
  const networkIdOfRpcUrlPromise = networkIdOfRpcUrlPromisePerTab.get(
    tabId
  ) as Map<string, Promise<number | undefined>>

  if (!networkIdOfRpcUrlPromise.has(url)) {
    const promise = new Promise((resolve) => {
      // fetch from the injected script, so the request has the apps origin (otherwise the request may be blocked by the RPC provider)
      chrome.tabs.sendMessage(tabId, { type: 'requestChainId', url }, resolve)
    })

    networkIdOfRpcUrlPromise.set(url, promise as Promise<number | undefined>)
  }

  const result = await networkIdOfRpcUrlPromise.get(url)
  if (!networkIdOfRpcUrl.has(url)) {
    networkIdOfRpcUrl.set(url, result)
    console.debug(
      `detected network of JSON RPC endpoint ${url} in tab #${tabId}: ${result}`
    )
  }
}

const decoder = new TextDecoder('utf-8')
const getJsonRpcBody = (details: chrome.webRequest.WebRequestBodyDetails) => {
  const bytes = details.requestBody?.raw?.[0]?.bytes
  if (!bytes) return undefined

  let json
  try {
    json = JSON.parse(decodeURIComponent(decoder.decode(bytes)))
  } catch (e) {
    return undefined
  }

  const probeRpc = Array.isArray(json) ? json[0] : json
  if (probeRpc && probeRpc.jsonrpc !== '2.0') {
    return undefined
  }
  return json
}

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  const isExtensionTab = !!(
    tab.url?.startsWith(KERNEL_URL) &&
    tab.url?.split('?')[0]?.endsWith('kernel')
  )
  const wasExtensionTab = activeExtensionTabs.has(tabId)

  if (isExtensionTab && !wasExtensionTab) {
    startTrackingTab(tabId)
  }
  if (!isExtensionTab && wasExtensionTab) {
    stopTrackingTab(tabId)
  }

  if (changeInfo.status === 'complete' && isExtensionTab) {
    chrome.tabs.sendMessage(tabId, { type: 'navigationDetected' })

    updateRpcRedirectRules(tabId)

    if (tab.url?.endsWith('kernel')) {
      chrome.tabs.sendMessage(tabId, { type: 'injectIFrame' })
    }
  }
})

export {}
