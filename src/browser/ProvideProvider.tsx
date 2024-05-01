import React, { createContext, ReactNode, useContext, useMemo } from 'react'

import { ForkProvider, useConsoleHypervisorProvider } from '../providers'
import { getConnection } from '../settings'
import { Eip1193Provider } from '../types'

interface Props {
  simulate: boolean
  children: ReactNode
}

const ProviderContext = createContext<Eip1193Provider | null>(null)
export const useProvider = () => useContext(ProviderContext)

const SubmitTransactionsContext = createContext<(() => Promise<string>) | null>(
  null
)
export const useSubmitTransactions = () => useContext(SubmitTransactionsContext)

const ProvideProvider: React.FC<Props> = ({ children }) => {
  const consoleHypervisorProvider = useConsoleHypervisorProvider()

  const forkProvider = useMemo(() => {
    const { connection, chainId } = getConnection()

    if (consoleHypervisorProvider)
      return new ForkProvider(consoleHypervisorProvider, {
        consoleAddress: connection.consoleAddress,
        ownerAddress: connection.consoleOwnerAddress,

        async onBeforeTransactionSend(txId, metaTx) {
          if (!chainId) {
            throw new Error('chainId is undefined')
          }
        },

        async onTransactionSent(txId, transactionHash) {},
      })

    return null
  }, [consoleHypervisorProvider])

  return (
    <ProviderContext.Provider value={forkProvider}>
      <SubmitTransactionsContext.Provider value={null}>
        {children}
      </SubmitTransactionsContext.Provider>
    </ProviderContext.Provider>
  )
}

export default ProvideProvider
