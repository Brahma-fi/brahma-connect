import { useState } from 'react'

import { Eip1193Provider } from '../types'

declare global {
  interface Window {
    ethereum?: Eip1193Provider
  }
}

export const useConnection = (id?: string) => {
  const windowHref = window.location.href

  const regex = /\/account\/([^\/]+)\/kernel/
  const match = regex.exec(windowHref)

  let consoleAddress

  if (match && match[1]) {
    consoleAddress = match[1]
  } else {
    const connectionError = 'An error occurred with connecting account'
    throw new Error(connectionError)
  }

  const connectionIdName = new Date().getTime()
  const [connection] = useState({
    connection: {
      id: connectionIdName,
      consoleAddress,
      consoleOwnerAddress: '0x74526AD2CAA5CC3be413897E05aaAD22fc41bAe6',
      /// NOTE: chain ID here is the default value and will be overriden later upon receiving chain ID from UI
      chainId: 1,
    },
    provider: window.ethereum,
    /// NOTE: chain ID here is the default value and will be overriden later upon receiving chain ID from UI
    chainId: 1,
  })

  return connection
}
