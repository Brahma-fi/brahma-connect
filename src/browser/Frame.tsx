import React, { useEffect, useState } from 'react'

import BridgeHost from '../bridge/host'
import { getConnection } from '../settings'

import { useProvider } from './ProvideProvider'

type Props = {
  src: string
}

declare let window: Window & {
  handleBridgeHost: ((ev: MessageEvent<any>) => void) | undefined
}

const BrowserFrame: React.FC<Props> = ({ src }) => {
  const provider = useProvider()
  const { connection } = getConnection()
  const [bridgeHost, setBridgeHost] = useState<BridgeHost | null>(null)

  useEffect(() => {
    if (!provider || !connection) return

    if (!bridgeHost) {
      setBridgeHost(new BridgeHost(provider, connection as any))
    } else {
      bridgeHost.setProvider(provider)
      bridgeHost.setConnection(connection as any)
    }
  }, [provider, connection])

  useEffect(() => {
    if (!bridgeHost) return

    const handle = (ev: MessageEvent<any>) => {
      bridgeHost.handleMessage(ev)
    }

    if (!window.handleBridgeHost) {
      console.log('setting handle bridge host')
      window.handleBridgeHost = handle

      window.addEventListener('message', handle)
    }
  }, [bridgeHost])

  return (
    <iframe
      id="kernel-frame"
      name="kernel-frame"
      title="Brahma Connect"
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
