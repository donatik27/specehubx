'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'

export function WalletConnectButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading'
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus ||
            authenticationStatus === 'authenticated')

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              'style': {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <div className="relative group">
                    <button
                      disabled
                      type="button"
                      className="px-6 py-3 bg-gray-600 text-gray-400 font-bold pixel-border cursor-not-allowed uppercase tracking-wider text-sm opacity-60"
                    >
                      🔌 CONNECT_WALLET
                    </button>
                    {/* Coming Soon Badge */}
                    <div className="absolute -top-2 -right-2 px-2 py-1 bg-yellow-500 text-black text-[10px] font-bold pixel-border animate-pulse">
                      BETA
                    </div>
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="bg-black pixel-border border-yellow-500/50 px-4 py-2 whitespace-nowrap">
                        <p className="text-xs font-mono text-yellow-400">⚠️ COMING_SOON</p>
                        <p className="text-[10px] font-mono text-muted-foreground mt-1">Will be activated soon!</p>
                      </div>
                    </div>
                  </div>
                )
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="px-6 py-3 bg-red-500 text-white font-bold pixel-border hover:bg-red-400 transition-all uppercase tracking-wider text-sm"
                  >
                    ⚠️ WRONG_NETWORK
                  </button>
                )
              }

              return (
                <div className="flex items-center gap-3">
                  <button
                    onClick={openChainModal}
                    className="px-4 py-2 bg-black pixel-border border-primary/40 font-mono text-sm text-white hover:border-primary transition-all flex items-center gap-2"
                    type="button"
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      <img
                        alt={chain.name ?? 'Chain icon'}
                        src={chain.iconUrl}
                        className="w-4 h-4"
                      />
                    )}
                    {chain.name}
                  </button>

                  <button
                    onClick={openAccountModal}
                    type="button"
                    className="px-4 py-2 bg-primary text-black font-bold pixel-border hover:bg-primary/80 transition-all uppercase tracking-wider text-sm"
                  >
                    {account.displayBalance
                      ? ` ${account.displayBalance}`
                      : ''}
                    {' '}
                    {account.displayName}
                  </button>
                </div>
              )
            })()}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}
