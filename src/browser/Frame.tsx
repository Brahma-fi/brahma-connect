import React, { useEffect, useState } from 'react'

import BridgeHost from '../bridge/host'
import { useConnection } from '../settings'

import { useProvider } from './ProvideProvider'

type Props = {
  src: string
}

const BrowserFrame: React.FC<Props> = ({ src }) => {
  const provider = useProvider()
  const { connection } = useConnection()
  const [bridgeHost, setBridgeHost] = useState<BridgeHost | null>(null)

  useEffect(() => {
    if (!provider || !connection) return

    if (!bridgeHost) {
      setBridgeHost(new BridgeHost(provider, connection as any))
    } else {
      bridgeHost.setProvider(provider)
      bridgeHost.setConnection(connection as any)
    }
  }, [provider])

  useEffect(() => {
    if (!bridgeHost) return

    const handle = (ev: MessageEvent<any>) => {
      bridgeHost.handleMessage(ev)
    }

    window.addEventListener('message', handle)

    return () => {
      window.removeEventListener('message', handle)
    }
  }, [bridgeHost])

  return (
    <iframe
      id="kernel-frame"
      name="kernel-frame"
      title="Console Kernel"
      src={src}
      style={{
        width: '100%',
        height: '100%',
        border: 0,
      }}
    />
  )
}

export default BrowserFrame
