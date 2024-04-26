import EventEmitter from 'events'

import { ethers } from 'ethers'
import { MetaTransaction } from 'react-multisend'
import { TransactionOptions } from '@safe-global/safe-core-sdk-types'
import { generatePreValidatedSignature } from '@safe-global/protocol-kit/dist/src/utils'

import {
  Eip1193Provider,
  KERNEL_MESSAGE_SEPARATOR,
  MessageType,
  TransactionData,
  TransactionParamsMetadata,
  safeInterface,
} from '../types'
import { ConsoleHypervisorProvider } from './ProvideConsoleHypervisor'
import { hexlify } from 'ethers/lib/utils'

import { timeout } from '../utils'

class UnsupportedMethodError extends Error {
  code = 4200
}

interface Handlers {
  onBeforeTransactionSend(checkpointId: string, metaTx: MetaTransaction): void
  onTransactionSent(checkpointId: string, hash: string): void
}

class ForkProvider extends EventEmitter {
  private provider: ConsoleHypervisorProvider
  private handlers: Handlers
  private consoleAddress: string

  private ownerAddress: string | undefined

  private blockGasLimitPromise: Promise<number>

  private rpcRequestResponses: { [x: number]: object }

  constructor(
    provider: ConsoleHypervisorProvider,
    {
      consoleAddress,
      ownerAddress,

      ...handlers
    }: {
      consoleAddress: string
      /** If set, will simulate the transaction though an `execTransaction` call */
      ownerAddress?: string
    } & Handlers
  ) {
    super()
    this.provider = provider
    this.consoleAddress = consoleAddress
    this.ownerAddress = ownerAddress
    this.handlers = handlers
    this.rpcRequestResponses = {}

    this.blockGasLimitPromise = readBlockGasLimit(this.provider)
  }

  async request(request: {
    method: string
    params?: Array<any>
    id: number
  }): Promise<any> {
    const { method, params = [], id } = request
    console.log('request on ForkProvider', method, params)

    if (!!id && !!this.rpcRequestResponses[id]) {
      return this.rpcRequestResponses[id]
    }

    switch (method) {
      case 'wallet_switchEthereumChain': {
        return null
      }

      case 'wallet_requestPermissions':
        return [
          {
            caveats: [
              {
                type: 'restrictReturnedAccounts',
                value: [this.consoleAddress],
              },
            ],
            date: Math.floor(new Date().getTime() / 1000),
          },
        ]

      case 'eth_chainId': {
        const result = await this.provider.request(request)
        return typeof result === 'number' ? `0x${result.toString(16)}` : result
      }

      case 'eth_requestAccounts': {
        return [this.consoleAddress]
      }

      case 'eth_accounts': {
        return [this.consoleAddress]
      }

      // Uniswap will try to use this for ERC-20 permits, but we prefer to do a regular approval as part of the batch
      case 'personal_sign':
      case 'eth_signTypedData':
      case 'eth_signTypedData_v4': {
        let consoleThreshold

        try {
          consoleThreshold = parseInt(
            await this.provider.request({
              method: 'eth_call',
              params: [
                {
                  to: this.consoleAddress,
                  data: safeInterface.encodeFunctionData('getThreshold', []),
                },
              ],
            }),
            16
          )
          console.log('consoleThreshold', consoleThreshold)
        } catch (e) {
          window.postMessage(
            `${MessageType.ERROR}${KERNEL_MESSAGE_SEPARATOR}An error occurred`
          )
          throw new Error('Failed to fetch threshold')
        }

        if (consoleThreshold !== 1) {
          const unsupportedError = `${method} is only supported on single threshold consoles`
          window.postMessage(
            `${MessageType.ERROR}${KERNEL_MESSAGE_SEPARATOR}${unsupportedError}`
          )
          throw new UnsupportedMethodError(unsupportedError)
        }

        let receivedSignature

        // Post request to UI, to request user signature in format - MESSAGE%METHOD%ADDRESS%CHALLENGE
        const isPersonalSign = method === 'personal_sign'
        const kernelSignatureReq = `${
          MessageType.KERNEL_SIGNATURE_REQUEST
        }${KERNEL_MESSAGE_SEPARATOR}${method}${KERNEL_MESSAGE_SEPARATOR}${
          isPersonalSign ? params[1] : params[0]
        }${KERNEL_MESSAGE_SEPARATOR}${
          isPersonalSign ? params[0] : JSON.stringify(JSON.parse(params[1]))
        }`
        console.log({ kernelSignatureReq })
        window.postMessage(kernelSignatureReq)

        // Expect response from UI, in format - MESSAGE%SIGNATURE
        const signatureResponseHandler = ({ data }: MessageEvent<any>) => {
          if (typeof data === 'string') {
            const [messageType, signature] = data.split(
              KERNEL_MESSAGE_SEPARATOR
            )
            console.log('sig event listener message', messageType, signature)

            if (messageType === MessageType.KERNEL_SIGNATURE_RESPONSE) {
              receivedSignature = signature
              window.removeEventListener('message', signatureResponseHandler)
            }
          }
        }
        window.addEventListener('message', signatureResponseHandler)

        // Wait till signature is received; timeout in 2mins
        const SECOND = 1000
        const MAX_RETRIES = 120

        let numAttempts = 0

        while (!receivedSignature) {
          if (numAttempts++ >= MAX_RETRIES) {
            const timeoutError = 'Signature timed out. Please retry'
            window.postMessage(
              `${MessageType.ERROR}${KERNEL_MESSAGE_SEPARATOR}${timeoutError}`
            )
            throw new Error(timeoutError)
          }

          // TODO: remove log
          console.log('sig attempt:', numAttempts)
          await timeout(SECOND)
        }

        return receivedSignature
      }

      case 'eth_sendTransaction': {
        console.log('sendTransaction called', new Date().toUTCString())

        // take a snapshot and record the transaction
        const checkpointId: string = await this.provider.request({
          method: 'evm_snapshot',
        })

        const txData = params[0] as TransactionData
        const metaTx: MetaTransaction = {
          to: txData.to || ZERO_ADDRESS,
          value: `${txData.value || 0}`,
          data: txData.data || '',
          operation: 0,
        }
        this.handlers.onBeforeTransactionSend(checkpointId, metaTx)

        const finalRequest = {
          method,
          params: [
            execTransaction(
              metaTx,
              this.consoleAddress,
              this.ownerAddress!,
              await this.blockGasLimitPromise
            ),
          ],
        }
        finalRequest.params[0].metadata = {
          ...(request.params?.[0] || {}),
        }
        const result = await this.provider.request(finalRequest)

        this.handlers.onTransactionSent(checkpointId, result)
        return result
      }
    }

    const response = await this.provider.request(request)
    if (id) this.rpcRequestResponses[id] = response

    return response
  }

  async deleteFork(): Promise<void> {
    await this.provider.deleteFork()
  }
}

export default ForkProvider

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/** Encode an execTransaction call by the given owner (address must be an actual owner of the Safe) */
export function execTransaction(
  tx: MetaTransaction & TransactionOptions,
  consoleAddress: string,
  ownerAddress: string,
  blockGasLimit: number
): TransactionData & TransactionOptions & TransactionParamsMetadata {
  const signature = generatePreValidatedSignature(ownerAddress)
  const data = safeInterface.encodeFunctionData('execTransaction', [
    tx.to,
    tx.value,
    tx.data,
    tx.operation,
    tx.gasLimit || tx.gas || 0,
    0,
    tx.gasPrice || 0,
    ZERO_ADDRESS,
    ZERO_ADDRESS,
    signature.staticPart() + signature.dynamicPart(),
  ])

  return {
    to: consoleAddress,
    data,
    value: '0x0',
    from: ownerAddress,
    // We simulate setting the entire block gas limit as the gas limit for the transaction
    gasLimit: hexlify(blockGasLimit),
    // With gas price 0 account don't need token for gas
    gasPrice: '0x0',
  }
}

const readBlockGasLimit = async (
  provider: Eip1193Provider
): Promise<number> => {
  const web3Provider = new ethers.providers.Web3Provider(provider)
  const block = await web3Provider.getBlock('latest')
  return block.gasLimit.toNumber()
}
