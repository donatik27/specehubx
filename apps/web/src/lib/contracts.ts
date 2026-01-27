// Polymarket Contract Addresses on Polygon
export const CONTRACTS = {
  // USDC on Polygon
  USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  
  // Conditional Tokens Framework (CTF) - holds user positions
  CTF: '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045',
  
  // Multicall3 for batch calls
  MULTICALL3: '0xcA11bde05977b3631167028862bE2a173976CA11',
} as const

// USDC ABI (minimal - only what we need)
export const USDC_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
] as const

// CTF ABI (minimal)
export const CTF_ABI = [
  'function balanceOf(address owner, uint256 id) view returns (uint256)',
] as const
