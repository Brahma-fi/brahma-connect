// This script will be injected via contentScripts.ts into the browser iframe running the Dapp.
import InjectedProvider from './bridge/InjectedProvider'
declare let window: Window & {
  ethereum: InjectedProvider
  web3: { currentProvider: InjectedProvider }
}

const chainIdEl = document.getElementById('kernel-chain-id')

if (!chainIdEl) throw new Error('Invalid chain ID')
const chainId = chainIdEl.innerHTML

// inject bridged ethereum provider
const injectedProvider = new InjectedProvider(chainId)

try {
  window.ethereum = injectedProvider
  window.web3.currentProvider = injectedProvider
} catch (e) {
  console.log('error overriding provider', e)
  window.ethereum.request = injectedProvider.request
  window.web3.currentProvider.request = injectedProvider.request
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
    icon: 'data:image/png;base64,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',
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
