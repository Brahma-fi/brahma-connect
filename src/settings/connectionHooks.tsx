import { Eip1193Provider } from '../types'

declare global {
  interface Window {
    ethereum?: Eip1193Provider
  }
}

export const getConnection = () => {
  const windowHref = window.location.href

  const regex =
    /\/account\/(0x[a-fA-F0-9]{40})(?:\/subaccount\/(0x[a-fA-F0-9]{40}))?/
  const match = regex.exec(windowHref)

  let consoleAddress

  // if subaccount found use that
  if (match && match[2]) {
    consoleAddress = match[2]
  } else if (match && match[1]) {
    // just console address
    consoleAddress = match[1]
  } else {
    const connectionError = 'An error occurred with connecting account'
    throw new Error(connectionError)
  }

  const connectionIdName = new Date().getTime()
  return {
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
  }
}
