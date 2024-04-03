// This script will be injected via contentScripts.ts into the browser iframe running the Dapp.
import InjectedProvider from './bridge/InjectedProvider'
declare let window: Window & {
  ethereum: InjectedProvider
  web3: { currentProvider: InjectedProvider }
}

if (window.ethereum) {
  // There is already a provider injected
  const descriptor = Object.getOwnPropertyDescriptor(window, 'ethereum')
  if (descriptor?.writable === false) {
    // We got a problem: The provider is not configurable (most probably Rabby)
    alert(
      `Brahma Connect cannot operate with the Rabby extension active. Please disable Rabby from your browser's extension page to use Connect. We're working with Rabby to resolve this issue.`
    )
  }
}

const chainIdEl = document.getElementById('kernel-chain-id')

if (!chainIdEl) throw new Error('Invalid chain ID')
const chainId = chainIdEl.innerHTML

// inject bridged ethereum provider
const injectedProvider = new InjectedProvider(chainId)

window.ethereum = injectedProvider
window.web3 = {
  currentProvider: injectedProvider,
}
console.log('injected into', document.title, window.ethereum, window.web3)

// establish message bridge for location requests
window.addEventListener('message', (ev: MessageEvent) => {
  const { consoleKernelHrefRequest } = ev.data
  if (consoleKernelHrefRequest) {
    if (!window.top) throw new Error('Must run inside iframe')
    window.top.postMessage(
      {
        consoleKernelHrefResponse: true,
        href: window.location.href,
      },
      '*'
    )
  }
})

/**
 * EIP-6963 support
 **/
const announceEip6963Provider = (provider: InjectedProvider) => {
  const info = {
    uuid: 'f3c205d4-5785-4f34-b019-2472b4e03a7a', // random uuid
    name: 'Brahma Connect',
    icon: 'https://console.brahma.fi/favicon.png',
    rdns: 'fi.brahma.console',
  }

  window.dispatchEvent(
    new CustomEvent('eip6963:announceProvider', {
      detail: Object.freeze({ info, provider }),
    })
  )
}

window.addEventListener('eip6963:requestProvider', () => {
  announceEip6963Provider(injectedProvider)
})

announceEip6963Provider(injectedProvider)

window.dispatchEvent(new Event('ethereum#initialized'))

export {}
