import EventEmitter from 'events'

import { JsonRpcProvider } from '@ethersproject/providers'
import React, { useContext, useEffect, useState } from 'react'

import { getConnection } from '../settings/connectionHooks'
import { Eip1193Provider, JsonRpcRequest } from '../types'
import { useBeforeUnload } from '../utils'
import { HYPERVISOR_BASE_URL } from '../settings'

const ConsoleHypervisorContext =
  React.createContext<ConsoleHypervisorProvider | null>(null)

export const useConsoleHypervisorProvider =
  (): ConsoleHypervisorProvider | null => useContext(ConsoleHypervisorContext)

const ProvideConsoleHypervisor: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [consoleHypervisorProvider, setConsoleHypervisorProvider] =
    useState<ConsoleHypervisorProvider | null>(null)

  useEffect(() => {
    const { provider, chainId, connection } = getConnection()
    const { consoleAddress } = connection

    console.log('provide consoleHypervisor', provider, chainId, connection)
    if (!chainId) return

    const consoleHypervisorProvider = new ConsoleHypervisorProvider(
      provider!,
      chainId,
      consoleAddress
    )
    setConsoleHypervisorProvider(consoleHypervisorProvider)

    return () => {
      consoleHypervisorProvider.deleteFork()
    }
  }, [])

  useBeforeUnload(() => {
    if (consoleHypervisorProvider) consoleHypervisorProvider.deleteFork()
  })

  return (
    <ConsoleHypervisorContext.Provider value={consoleHypervisorProvider}>
      {children}
    </ConsoleHypervisorContext.Provider>
  )
}

export default ProvideConsoleHypervisor

export class ConsoleHypervisorProvider extends EventEmitter {
  private provider: Eip1193Provider
  private chainId: number
  private forkProviderPromise: Promise<JsonRpcProvider> | undefined

  private blockNumber: number | undefined

  private consoleAddress: string

  constructor(
    provider: Eip1193Provider,
    chainId: number,
    consoleAddress: string
  ) {
    super()
    this.provider = provider
    this.chainId = chainId
    this.consoleAddress = consoleAddress
  }

  async request(request: JsonRpcRequest): Promise<any> {
    console.log('request in consoleHypervisor prov', request)
    if (request.method === 'eth_chainId') {
      // WalletConnect seems to return a number even though it must be a string value, we patch this bug here
      return `0x${this.chainId.toString(16)}`
    }

    if (request.method === 'evm_snapshot' || request.method === 'evm_revert')
      return

    if (request.method === 'eth_blockNumber' && this.blockNumber) {
      return this.blockNumber
    }

    if (!this.forkProviderPromise && request.method === 'eth_sendTransaction') {
      // spawn a fork lazily when sending the first transaction
      this.forkProviderPromise = this.createFork(this.chainId)
    } else if (!this.forkProviderPromise) {
      // We have not spawned a fork currently, so we can just use the provider to get the latest on-chain state
      return await this.provider.request(request)
    }

    const provider = await this.forkProviderPromise

    const result = await provider.send(request.method, request.params || [])

    return result
  }

  async deleteFork() {
    const provider = await this.forkProviderPromise

    // notify the background script to stop intercepting JSON RPC requests
    window.postMessage({ type: 'stopSimulating', toBackground: true }, '*')

    this.forkProviderPromise = undefined
    this.blockNumber = 19027441

    if (provider) await provider.send('console_reset', [this.consoleAddress])
  }

  private async createFork(networkId: number): Promise<JsonRpcProvider> {
    const rpcUrl = `${HYPERVISOR_BASE_URL}/${this.consoleAddress}`

    // notify the background script to start intercepting JSON RPC requests
    window.postMessage(
      { type: 'startSimulating', toBackground: true, networkId, rpcUrl },
      '*'
    )

    return new JsonRpcProvider(rpcUrl)
  }
}
