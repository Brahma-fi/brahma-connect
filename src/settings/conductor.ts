export const production = true

export const CONDUCTOR_BASE_URL = production
  ? 'https://gtw.brahma.fi/v1/conductor/forks'
  : 'https://gtw.dev.brahma.fi/v1/conductor/forks'

export const CONDUCTOR_ENDPOINTS = {
  createFork: 'assign/connect',
  rpc: 'sandbox/connect',
}

export const CONDUCTOR_RPC_URL = `${CONDUCTOR_BASE_URL}/${CONDUCTOR_ENDPOINTS.rpc}`
