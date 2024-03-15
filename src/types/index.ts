export const KERNEL_MESSAGE_SEPARATOR = '%'

export enum MessageType {
  LOADED_KERNEL_URL = 'loadedKernelURL',
  ERROR = 'errorKernel',
  UPDATE_RPC_CONFIG = 'updateRpcConfig',
}

export enum ProviderType {
  WalletConnect,
  MetaMask,
}

export type Connection = {
  id: string
  consoleAddress: string
  consoleOwnerAddress: string
  chainId: number
}

export interface JsonRpcRequest {
  method: string
  params?: Array<any>
}

export interface JsonRpcError extends Error {
  data: {
    code: number
    message?: string
    data?: string
    originalError?: JsonRpcError['data']
  }
}

export interface Eip1193Provider {
  request(request: JsonRpcRequest): Promise<unknown>
  on(event: string, listener: (...args: any[]) => void): void
  removeListener(event: string, listener: (...args: any[]) => void): void
}

export interface TransactionData {
  to?: string
  value?: number | string
  data?: string
  from?: string
}

export interface TransactionParamsMetadata {
  metadata?: Object
}
