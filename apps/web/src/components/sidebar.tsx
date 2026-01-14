'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Users, 
  TrendingUp, 
  Store, 
  Bell, 
  Activity,
  Globe
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'COMMAND_CENTER', href: '/', icon: LayoutDashboard },
  { name: 'TRADER_INTEL', href: '/traders', icon: Users },
  { name: 'ALPHA_MARKETS', href: '/markets/smart', icon: TrendingUp },
  { name: 'TRADER_RADAR', href: '/map', icon: Globe },
  { name: 'Markets', href: '/markets', icon: Store },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'DIAGNOSTICS', href: '/health', icon: Activity },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="w-64 bg-black flex flex-col relative overflow-hidden">
      {/* Cosmic background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-5 w-1 h-1 bg-primary animate-pulse"></div>
        <div className="absolute top-32 right-8 w-1 h-1 bg-white animate-pulse" style={{animationDelay: '0.5s'}}></div>
        <div className="absolute top-48 left-12 w-1 h-1 bg-primary animate-pulse" style={{animationDelay: '1s'}}></div>
      </div>
      
      <div className="p-6 relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="text-3xl">🛸</div>
          <div>
            <h1 className="text-lg font-bold text-primary alien-glow">SPACEHUB</h1>
          </div>
        </div>
        <p className="text-xs text-muted-foreground font-mono ml-11">&gt; SMART_MONEY.SYS</p>
      </div>
      
      <nav className="flex-1 px-3 py-4 relative z-10">
        {navigation.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname?.startsWith(item.href))
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 mb-2 transition-all group font-bold uppercase text-xs tracking-wider',
                isActive 
                  ? 'bg-primary text-black alien-glow' 
                  : 'text-white hover:text-primary hover:bg-primary/5'
              )}
            >
              <item.icon className={cn(
                'h-5 w-5 transition-transform group-hover:scale-110',
                isActive && 'text-black'
              )} />
              <span className="font-mono">{item.name}</span>
            </Link>
          )
        })}
      </nav>
      
      <div className="p-4 relative z-10">
        <div className="bg-black p-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 text-2xl opacity-20">👽</div>
          <p className="text-xs font-bold text-primary mb-1 uppercase tracking-wider">System Status</p>
          <p className="text-xs text-white font-mono">PHASE_0 [ACTIVE] ✓</p>
        </div>
        <p className="text-xs text-primary mt-3 text-center font-mono animate-pulse">&gt; v1.0.0_ALIEN</p>
      </div>
    </div>
  )
}

