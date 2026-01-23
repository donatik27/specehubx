interface AlienIconProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

export default function AlienIcon({ size = 32, className = '', animate = false }: AlienIconProps) {
  return (
    <div 
      className={`inline-block alien-icon-container ${animate ? 'alien-walk' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%' }}
      >
        {/* Outer glow */}
        <defs>
          <filter id={`alien-glow-${size}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
            <feOffset dx="0" dy="0" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="2" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          <radialGradient id={`alien-gradient-${size}`} cx="50%" cy="30%">
            <stop offset="0%" stopColor="#00ff00" stopOpacity="1" />
            <stop offset="40%" stopColor="#00ee00" stopOpacity="1" />
            <stop offset="70%" stopColor="#00cc00" stopOpacity="1" />
            <stop offset="100%" stopColor="#00aa00" stopOpacity="1" />
          </radialGradient>

          <radialGradient id={`alien-eye-gradient-${size}`} cx="30%" cy="30%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#000000" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#000000" stopOpacity="1" />
          </radialGradient>
        </defs>

        {/* Head */}
        <circle 
          cx="50" 
          cy="35" 
          r="28" 
          fill={`url(#alien-gradient-${size})`}
          filter={`url(#alien-glow-${size})`}
          className="alien-head"
        />

        {/* Body */}
        <ellipse 
          cx="50" 
          cy="70" 
          rx="16" 
          ry="22" 
          fill={`url(#alien-gradient-${size})`}
          filter={`url(#alien-glow-${size})`}
          className="alien-body"
        />

        {/* Left Eye */}
        <ellipse 
          cx="38" 
          cy="32" 
          rx="9" 
          ry="13" 
          fill={`url(#alien-eye-gradient-${size})`}
          className="alien-eye"
        />
        
        {/* Right Eye */}
        <ellipse 
          cx="62" 
          cy="32" 
          rx="9" 
          ry="13" 
          fill={`url(#alien-eye-gradient-${size})`}
          className="alien-eye"
        />

        {/* Eye highlights */}
        <ellipse cx="40" cy="28" rx="3" ry="4" fill="white" opacity="0.6" />
        <ellipse cx="64" cy="28" rx="3" ry="4" fill="white" opacity="0.6" />

        {/* Smile */}
        <path 
          d="M 42 42 Q 50 46 58 42" 
          stroke="#006600" 
          strokeWidth="2" 
          fill="none"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* Left Arm */}
        <path 
          d="M 36 65 Q 28 70 32 78" 
          stroke={`url(#alien-gradient-${size})`}
          strokeWidth="6" 
          fill="none"
          strokeLinecap="round"
          filter={`url(#alien-glow-${size})`}
        />

        {/* Right Arm - waving */}
        <path 
          d="M 64 65 Q 72 60 70 52" 
          stroke={`url(#alien-gradient-${size})`}
          strokeWidth="6" 
          fill="none"
          strokeLinecap="round"
          filter={`url(#alien-glow-${size})`}
          className="alien-wave"
        />

        {/* Legs */}
        <ellipse cx="44" cy="92" rx="5" ry="8" fill={`url(#alien-gradient-${size})`} filter={`url(#alien-glow-${size})`} />
        <ellipse cx="56" cy="92" rx="5" ry="8" fill={`url(#alien-gradient-${size})`} filter={`url(#alien-glow-${size})`} />
      </svg>

      <style jsx>{`
        @keyframes alien-wave-anim {
          0%, 100% { 
            transform: rotate(0deg);
            transform-origin: 64px 65px;
          }
          50% { 
            transform: rotate(-15deg);
            transform-origin: 64px 65px;
          }
        }

        .alien-wave {
          animation: alien-wave-anim 1.2s ease-in-out infinite;
        }

        .alien-head, .alien-body {
          transition: all 0.3s ease;
        }

        svg:hover .alien-head {
          filter: url(#alien-glow-${size}) brightness(1.3);
        }

        svg:hover .alien-body {
          filter: url(#alien-glow-${size}) brightness(1.2);
        }
      `}</style>
    </div>
  );
}
