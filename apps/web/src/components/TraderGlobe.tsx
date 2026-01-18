'use client';

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Html } from '@react-three/drei';
import * as THREE from 'three';

interface TraderMarker {
  address: string;
  displayName: string;
  tier: string;
  lat: number;
  lng: number;
  pnl: number;
  profileImage: string;
}

interface TraderGlobeProps {
  traders: TraderMarker[];
  onTraderHover?: (trader: TraderMarker | null) => void;
  focusedTrader?: { lat: number; lng: number; address: string } | null;
}

// Convert lat/lng to 3D coordinates on sphere surface
function latLngToVector3(lat: number, lng: number, radius: number = 2): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

// Earth sphere (without rotation - will be rotated by parent group)
function Earth() {
  const [textureUrl] = React.useState(
    'https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg'
  );

  return (
    <>
      {/* Main Earth sphere - SOLID, NOT TRANSPARENT */}
      <Sphere args={[2, 64, 64]}>
        <meshStandardMaterial
          color="#ffffff"
          roughness={0.7}
          metalness={0.2}
          transparent={false}
          opacity={1.0}
        >
          <primitive
            attach="map"
            object={new THREE.TextureLoader().load(textureUrl)}
          />
        </meshStandardMaterial>
      </Sphere>

      {/* Glowing atmosphere - reduced opacity */}
      <Sphere args={[2.15, 32, 32]}>
        <meshBasicMaterial
          color="#4da6ff"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </Sphere>

      {/* Green alien grid overlay - reduced opacity */}
      <Sphere args={[2.05, 24, 24]}>
        <meshBasicMaterial
          color="#00ff00"
          wireframe
          transparent
          opacity={0.06}
        />
      </Sphere>
    </>
  );
}

// Rotating group that contains Earth + Traders
function RotatingGlobe({ 
  traders, 
  shouldRotate,
  onHoverChange,
  focusedTrader
}: { 
  traders: TraderMarker[];
  shouldRotate: boolean;
  onHoverChange: (trader: TraderMarker | null) => void;
  focusedTrader?: { lat: number; lng: number; address: string } | null;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const targetRotationRef = useRef({ y: 0, x: 0 });

  // Update target rotation when focused trader changes
  React.useEffect(() => {
    if (focusedTrader && groupRef.current) {
      // Convert lat/lng to rotation angles to face the camera
      // Longitude: rotate around Y axis (horizontal spin)
      // We need to rotate TO the point, so it faces the camera (at z=5)
      const targetY = (focusedTrader.lng * Math.PI) / 180;
      
      // Latitude: tilt around X axis (vertical tilt)
      // Negative to tilt correctly (positive lat = tilt down to see it)
      const targetX = -(focusedTrader.lat * Math.PI) / 180;
      
      // Clamp X rotation to prevent extreme tilting
      const clampedX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, targetX));
      
      targetRotationRef.current = { y: targetY, x: clampedX };
    }
  }, [focusedTrader]);

  // Auto-rotate or animate to focused trader
  useFrame(() => {
    if (groupRef.current) {
      if (focusedTrader) {
        // Smoothly rotate to focused trader
        const lerpSpeed = 0.05;
        groupRef.current.rotation.y += (targetRotationRef.current.y - groupRef.current.rotation.y) * lerpSpeed;
        groupRef.current.rotation.x += (targetRotationRef.current.x - groupRef.current.rotation.x) * lerpSpeed;
      } else if (shouldRotate) {
        // Auto-rotate
        groupRef.current.rotation.y += 0.002;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* Earth */}
      <Earth />

      {/* Trader markers - they will rotate with the group */}
      {traders.map((trader) => (
        <TraderPin 
          key={trader.address} 
          trader={trader}
          onHoverChange={onHoverChange}
          isFocused={focusedTrader?.address === trader.address}
        />
      ))}
    </group>
  );
}

// Trader marker on globe surface
function TraderPin({ 
  trader,
  onHoverChange,
  isFocused = false
}: { 
  trader: TraderMarker;
  onHoverChange?: (trader: TraderMarker | null) => void;
  isFocused?: boolean;
}) {
  const position = useMemo(
    () => latLngToVector3(trader.lat, trader.lng, 2.05),
    [trader.lat, trader.lng]
  );

  const [hovered, setHovered] = React.useState(false);

  const handlePointerOver = () => {
    setHovered(true);
    onHoverChange?.(trader);
  };

  const handlePointerOut = () => {
    setHovered(false);
    onHoverChange?.(null);
  };

  const handleClick = () => {
    // Navigate to trader profile
    window.location.href = `/traders/${trader.address}`;
  };

  // Tier colors for border (only S, A, B)
  const tierColor = {
    S: '#FFD700', // Gold for S-tier
    A: '#ffffff', // White for A-tier
    B: '#00ff00', // Green for B-tier
  }[trader.tier] || '#FFD700';

  return (
    <group position={position}>
      {/* Avatar Image */}
      <Html
        position={[0, 0, 0]}
        center
        distanceFactor={0.6}
        zIndexRange={[100, 0]}
        style={{
          pointerEvents: 'auto',
          cursor: 'pointer',
        }}
      >
        <div
          onMouseEnter={handlePointerOver}
          onMouseLeave={handlePointerOut}
          onClick={handleClick}
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            border: `${isFocused ? '5' : '3'}px solid ${tierColor}`,
            overflow: 'hidden',
            transition: 'all 0.25s ease-out',
            boxShadow: (hovered || isFocused)
              ? `0 0 25px ${tierColor}, 0 0 50px ${tierColor}` 
              : `0 0 15px ${tierColor}`,
            transform: (hovered || isFocused) ? 'scale(1.3)' : 'scale(1)',
            backgroundColor: '#000',
            willChange: 'transform, box-shadow',
            animation: isFocused ? 'pulse 2s infinite' : 'none',
          }}
        >
          <img
            src={trader.profileImage}
            alt={trader.displayName}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onError={(e) => {
              // Fallback to colored circle if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              if (target.parentElement) {
                target.parentElement.style.backgroundColor = tierColor;
              }
            }}
          />
        </div>
      </Html>

      {/* Glow effect behind avatar */}
      {(hovered || isFocused) && (
        <mesh>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshBasicMaterial 
            color={tierColor} 
            transparent 
            opacity={isFocused ? 0.6 : 0.4} 
          />
        </mesh>
      )}
    </group>
  );
}

// Stars background
function Stars() {
  const starsRef = useRef<THREE.Points>(null);

  const starPositions = useMemo(() => {
    const positions = new Float32Array(1000 * 3);
    for (let i = 0; i < 1000; i++) {
      const radius = 50;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }
    return positions;
  }, []);

  useFrame(() => {
    if (starsRef.current) {
      starsRef.current.rotation.y += 0.0001;
    }
  });

  return (
    <points ref={starsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={starPositions.length / 3}
          array={starPositions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.1} color="#00ff00" transparent opacity={0.6} />
    </points>
  );
}

// Main 3D Globe Component
export default function TraderGlobe({ traders, onTraderHover, focusedTrader }: TraderGlobeProps) {
  const [shouldRotate, setShouldRotate] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isInteracting, setIsInteracting] = React.useState(false);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset inactivity timer
  const resetInactivityTimer = () => {
    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // Stop rotation
    setShouldRotate(false);

    // Start new timer (15 seconds of inactivity)
    inactivityTimerRef.current = setTimeout(() => {
      if (!isHovered && !isInteracting) {
        setShouldRotate(true);
      }
    }, 15000);
  };

  // Handle trader hover
  const handleHoverChange = (trader: TraderMarker | null) => {
    setIsHovered(trader !== null);
    onTraderHover?.(trader);
    
    if (trader) {
      setShouldRotate(false);
      // Reset timer when hover ends
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      inactivityTimerRef.current = setTimeout(() => {
        if (!isInteracting) {
          setShouldRotate(true);
        }
      }, 10000); // 10 seconds after hover ends
    }
  };

  // Handle user interaction with controls
  const handleInteractionStart = () => {
    setIsInteracting(true);
    resetInactivityTimer();
  };

  const handleInteractionEnd = () => {
    setIsInteracting(false);
    resetInactivityTimer();
  };

  // Start initial timer on mount
  React.useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        style={{ background: '#000000' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />

        {/* Stars */}
        <Stars />

        {/* Rotating Globe (Earth + Traders together) */}
        <RotatingGlobe 
          traders={traders}
          shouldRotate={shouldRotate}
          onHoverChange={handleHoverChange}
          focusedTrader={focusedTrader}
        />

        {/* Controls */}
        <OrbitControls
          enableZoom={true}
          enablePan={false}
          minDistance={3}
          maxDistance={8}
          autoRotate={false}
          rotateSpeed={0.5}
          onStart={handleInteractionStart}
          onEnd={handleInteractionEnd}
        />
      </Canvas>
    </div>
  );
}
