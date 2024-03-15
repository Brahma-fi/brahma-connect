import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'

import BrowserFrame from './Frame'
import { KERNEL_MESSAGE_SEPARATOR, MessageType } from '../types'

const Browser: React.FC = () => {
  const [location, setLocation] = useState('')

  const handleURLLoad = () => {
    window.addEventListener('message', ({ data }) => {
      if (data === 'loadKernelURL') {
        const urlParams = new URLSearchParams(window.location.search)
        const _activeURL = urlParams.get('url')

        setLocation(_activeURL!)

        window.postMessage(
          `${MessageType.LOADED_KERNEL_URL}${KERNEL_MESSAGE_SEPARATOR}${_activeURL}`,
          '*'
        )
      }
    })
  }
  useEffect(handleURLLoad, [])

  return (
    <Layout>
      <BrowserFrame src={location} />
    </Layout>
  )
}

export default Browser
