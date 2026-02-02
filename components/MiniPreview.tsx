
import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AppState } from '../types';
import { generateKirigamiGeometry } from '../utils/mathEngine';

// A lightweight version of the main mesh logic for the sidebar icon
const MiniMesh: React.FC<{ appState: AppState }> = ({ appState }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Use lower resolution for the icon to keep performance high
  const lowResState = { ...appState, rows: 4, cols: 15 };
  
  const { positions } = generateKirigamiGeometry(lowResState);

  useFrame((state) => {
    if (meshRef.current) {
        meshRef.current.rotation.y += 0.01;
    }
  });

  return (
    <group scale={0.6}>
        <mesh ref={meshRef}>
            <bufferGeometry>
            <bufferAttribute
                attach="attributes-position"
                count={positions.length / 3}
                array={positions}
                itemSize={3}
            />
            </bufferGeometry>
            <meshStandardMaterial color="#6366f1" wireframe={true} />
        </mesh>
    </group>
  );
};

export const MiniPreview: React.FC<{ appState: AppState }> = ({ appState }) => {
    return (
        <div className="w-full h-32 bg-slate-900 rounded-lg overflow-hidden relative shadow-inner border border-slate-700">
             <div className="absolute top-2 left-2 text-[10px] text-indigo-400 font-mono z-10">HOLOGRAPHIC PREVIEW</div>
             <Canvas camera={{ position: [0, 150, 150], fov: 50 }}>
                <ambientLight intensity={1} />
                <pointLight position={[100, 100, 100]} />
                <MiniMesh appState={appState} />
             </Canvas>
        </div>
    );
};
