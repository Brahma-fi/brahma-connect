import { EventEmitter } from 'events'
import { KERNEL_MESSAGE_SEPARATOR, MessageType } from '../types'

interface JsonRpcRequest {
  method: string
  params?: Array<any>
}

interface JsonRpcResponse {
  method: string
  result?: unknown
  error?: Error
}

export default class InjectedProvider extends EventEmitter {
  private messageId = 0

  selectedAddress: string | undefined = undefined

  chainId = '0x1'

  constructor(chainId: string) {
    super()
    if (!window.top) throw new Error('Must run inside iframe')

    window.top.postMessage(
      {
        consoleKernelBridgeInit: true,
      },
      '*'
    )

    this.chainId = chainId
    this.emit('connect', {
      chainId,
    })

    const handleBridgeEvent = (ev: MessageEvent) => {
      const { consoleKernelBridgeEvent, event, args } = ev.data
      if (!consoleKernelBridgeEvent) {
        return
      }
      this.emit(event, ...args)
    }

    window.addEventListener('message', handleBridgeEvent)

    this.chainId = chainId
    this.emit('connect', {
      chainId,
    })

    // keep window.ethereum.selectedAddress in sync
    this.request({ method: 'eth_accounts' })
      .then((accounts) => {
        this.selectedAddress = accounts[0]
      })
      .catch((e) => console.error('eth_accounts error', e))
    this.on('accountsChanged', (accounts) => {
      this.selectedAddress = accounts[0]
    })

    window.addEventListener('message', (ev: MessageEvent) => {
      if (
        typeof ev.data === 'string' &&
        ev.data.startsWith(MessageType.KERNEL_ACCOUNTS_CHANGED)
      ) {
        this.selectedAddress = ev.data.split(KERNEL_MESSAGE_SEPARATOR)[1]
      }
    })
  }

  _metamask = {
    isUnlocked: () => {
      return new Promise((resolve) => {
        resolve(true)
      })
    },
  }

  request = (request: JsonRpcRequest): Promise<any> => {
    const currentMessageId = this.messageId
    this.messageId++

    if (request.method === 'eth_chainId') {
      console.log('dapp requested eth_chainId', this.chainId)
      return new Promise((resolve) =>
        resolve(`0x${parseInt(this.chainId).toString(16)}`)
      )
    }

    return new Promise((resolve, reject) => {
      if (!window.top) throw new Error('Must run inside iframe')
      console.log('request to window postmes', request)
      window.top.postMessage(
        {
          consoleKernelBridgeRequest: true,
          request,
          messageId: currentMessageId,
        },
        '*'
      )

      const handleMessage = (ev: MessageEvent) => {
        const { consoleKernelBridgeResponse, messageId, error, response } =
          ev.data
        if (consoleKernelBridgeResponse && messageId === currentMessageId) {
          window.removeEventListener('message', handleMessage)
          console.debug('RES', messageId, response)
          if (error) {
            reject(error)
          } else {
            resolve(response)
          }
        }
      }

      window.addEventListener('message', handleMessage)
    })
  }

  // Legacy API (still used by some Dapps)
  send = async (
    method: string,
    params?: Array<any>
  ): Promise<JsonRpcResponse> => {
    try {
      const result = await this.request({ method, params })
      return { method, result }
    } catch (e) {
      return { method, error: e as Error }
    }
  }

  // Legacy API (still used by some Dapps)
  sendAsync = async (
    request: JsonRpcRequest,
    callback: (error: Error | undefined, response: JsonRpcResponse) => unknown
  ) => {
    try {
      const result = await this.request(request)
      callback(undefined, { method: request.method, result })
    } catch (e) {
      const error = e as Error
      callback(error, { method: request.method, error })
    }
  }

  'isConsole Kernel' = true

  // This is required for connecting to Etherscan
  enable = () => {
    return Promise.resolve()
  }

  isConnected = () => true

  // Some apps don't support generic injected providers, so we pretend to be MetaMask
  isMetaMask = true
}
