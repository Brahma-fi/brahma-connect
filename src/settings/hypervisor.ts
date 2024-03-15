export const production = true

export const HYPERVISOR_BASE_URL = production
  ? 'https://gtw.brahma.fi/v1/rpc'
  : 'https://gtw.dev.brahma.fi/v1/rpc'
