import {
  Connection,
  Eip1193Provider,
  KERNEL_MESSAGE_SEPARATOR,
  MessageType,
} from '../types'

interface Request {
  method: string
  params?: Array<any>
}

export default class BridgeHost {
  private provider: Eip1193Provider
  private connection: Connection
  private source: WindowProxy | undefined

  constructor(provider: Eip1193Provider, connection: Connection) {
    this.provider = provider
    this.connection = connection
  }

  setProvider(provider: Eip1193Provider) {
    this.provider = provider
  }

  setConnection(connection: Connection) {
    if (connection.consoleAddress !== this.connection.consoleAddress) {
      this.emitBridgeEvent('accountsChanged', [[connection.consoleAddress]])
    }

    if (connection.chainId !== this.connection.chainId) {
      this.emitBridgeEvent('chainChanged', [connection.chainId])
    }

    this.connection = connection
  }

  initBridge(event: MessageEvent<any>) {
    if (!event.source) throw new Error('Unable to get message source')
    if (
      event.source instanceof MessagePort ||
      event.source instanceof ServiceWorker
    ) {
      throw new Error('Expected message to originate from window')
    }

    this.source = event.source
    this.source.postMessage(
      `${MessageType.KERNEL_ACCOUNTS_CHANGED}${KERNEL_MESSAGE_SEPARATOR}${this.connection.consoleAddress}`,
      '*'
    )
  }

  private emitBridgeEvent(event: string, args: any[]) {
    if (!this.source) throw new Error('source must be set')

    this.source.postMessage(
      {
        consoleKernelBridgeEvent: true,
        event,
        args,
      },
      '*'
    )
  }

  private async handleRequest(request: Request, messageId: number) {
    if (!this.source) throw new Error('source must be set')

    let response
    let error
    try {
      console.log('handleRequest REQ', messageId, request)
      response = await this.provider.request(request)
    } catch (e) {
      error = e
    }

    this.source.postMessage(
      {
        consoleKernelBridgeResponse: true,
        messageId,
        response,
        error,
      },
      '*'
    )
  }

  handleMessage(ev: MessageEvent<any>) {
    const {
      consoleKernelBridgeInit,
      consoleKernelBridgeRequest,
      messageId,
      request,
    } = ev.data

    if (consoleKernelBridgeInit) {
      this.initBridge(ev)
      return
    }

    if (consoleKernelBridgeRequest) {
      this.assertConsistentSource(ev)
      this.handleRequest(request, messageId)
    }
  }

  private assertConsistentSource(event: MessageEvent<any>) {
    if (event.source !== this.source) {
      throw new Error('unexpected message source')
    }
  }
}
