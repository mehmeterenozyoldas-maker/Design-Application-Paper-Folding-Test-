
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, useTexture, useVideoTexture, SoftShadows, AccumulativeShadows, RandomizedLight } from '@react-three/drei';
import { EffectComposer, Bloom, SSAO, Vignette, Noise, TiltShift2 } from '@react-three/postprocessing';
import * as THREE from 'three';
import { AppState, PAPER_A4 } from '../types';
import { generateKirigamiGeometry } from '../utils/mathEngine';

interface ViewerProps {
  appState: AppState;
}

// Advanced Procedural Paper Material Generator
const usePaperMaterial = () => {
    const { map, bumpMap, roughnessMap } = useMemo(() => {
        const width = 1024;
        const height = 1024;
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) return { map: null, bumpMap: null, roughnessMap: null };

        // 1. Diffuse Map (Color)
        // Warm white paper base
        ctx.fillStyle = '#fdfdfd';
        ctx.fillRect(0, 0, width, height);
        
        // Subtle organic noise for grain
        for(let i=0; i<150000; i++) {
             ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.01})`;
             ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
        }
        
        // Paper Fibers
        ctx.lineWidth = 0.5;
        for(let i=0; i<800; i++) {
            ctx.strokeStyle = `rgba(0,0,0,${Math.random() * 0.03})`;
            ctx.beginPath();
            const x = Math.random() * width;
            const y = Math.random() * height;
            const len = Math.random() * 20 + 5;
            const angle = Math.random() * Math.PI * 2;
            ctx.moveTo(x,y);
            ctx.quadraticCurveTo(
                x + Math.cos(angle) * len * 0.5, 
                y + Math.sin(angle) * len * 0.5, 
                x + Math.cos(angle + 0.2) * len, 
                y + Math.sin(angle + 0.2) * len
            );
            ctx.stroke();
        }

        const map = new THREE.CanvasTexture(canvas);
        map.wrapS = THREE.RepeatWrapping;
        map.wrapT = THREE.RepeatWrapping;
        map.repeat.set(2, 2);

        // 2. Bump / Roughness Map (Texture)
        // Mid-grey base
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, width, height);
        
        // High frequency noise
        for(let i=0; i<200000; i++) {
             const v = Math.random();
             ctx.fillStyle = v > 0.5 ? '#959595' : '#6b6b6b';
             ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
        }
        
        // Embossed Fibers
        ctx.lineWidth = 1.5;
        for(let i=0; i<600; i++) {
             const v = Math.random();
             ctx.strokeStyle = v > 0.5 ? '#a0a0a0' : '#606060';
             ctx.beginPath();
             const x = Math.random() * width;
             const y = Math.random() * height;
             const len = Math.random() * 15 + 5;
             const angle = Math.random() * Math.PI * 2;
             ctx.moveTo(x,y);
             ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
             ctx.stroke();
        }

        const bumpMap = new THREE.CanvasTexture(canvas);
        bumpMap.wrapS = THREE.RepeatWrapping;
        bumpMap.wrapT = THREE.RepeatWrapping;
        bumpMap.repeat.set(2, 2);

        return { map, bumpMap, roughnessMap: bumpMap };
    }, []);

    return { map, bumpMap, roughnessMap };
};

const ProjectionMaterial: React.FC<{ appState: AppState }> = ({ appState }) => {
    let overlayTexture = null;
    const { map, bumpMap, roughnessMap } = usePaperMaterial();

    if (appState.overlayTexture) {
        if (appState.isVideoTexture) {
            overlayTexture = useVideoTexture(appState.overlayTexture);
        } else {
            overlayTexture = useTexture(appState.overlayTexture);
        }
    }
    
    // Configure texture mapping
    if (overlayTexture) {
        overlayTexture.wrapS = THREE.ClampToEdgeWrapping;
        overlayTexture.wrapT = THREE.ClampToEdgeWrapping;
        overlayTexture.rotation = -Math.PI / 2;
        overlayTexture.center.set(0.5, 0.5);
    }

    return (
        <meshStandardMaterial 
            color={overlayTexture ? "#ffffff" : "#ffffff"}
            map={overlayTexture || map}
            bumpMap={bumpMap}
            bumpScale={0.02}
            roughnessMap={roughnessMap}
            roughness={0.95} 
            metalness={0.0}
            side={THREE.DoubleSide}
        />
    );
};

const KirigamiMesh: React.FC<{ appState: AppState }> = ({ appState }) => {
  const geometry = useMemo(() => {
    const { positions, normals, indices } = generateKirigamiGeometry(appState);
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setIndex(indices);
    
    const count = positions.length / 3;
    const uvs = new Float32Array(count * 2);
    const w = PAPER_A4.width;
    const h = PAPER_A4.height;
    
    for(let i=0; i<count; i++) {
        const x = positions[i*3];
        const y = positions[i*3+1]; 
        uvs[i*2] = (x + w/2) / w;
        uvs[i*2+1] = (y + h/2) / h;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.computeBoundingSphere();
    
    return geo;
  }, [appState.algorithm, appState.rows, appState.cols, appState.amplitude, appState.frequency, appState.foldProgress, appState.spread, appState.heightMapData, appState.fractalOctaves, appState.customFormula, appState.sketchPoints, appState.paperThickness]);

  const [currentAlpha, setCurrentAlpha] = useState(0);
  const targetAlpha = appState.foldProgress * (Math.PI / 2);

  useFrame((state, delta) => {
      const speed = 10;
      const diff = targetAlpha - currentAlpha;
      if (Math.abs(diff) > 0.001) {
         setCurrentAlpha(prev => prev + diff * Math.min(delta * speed, 1));
      }
  });

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}> 
      
      {/* The Paper Mesh */}
      <mesh geometry={geometry} castShadow receiveShadow>
        <React.Suspense fallback={<meshStandardMaterial color="#f8fafc" />}>
            <ProjectionMaterial appState={appState} />
        </React.Suspense>
      </mesh>
      
      {/* Wireframe Overlay */}
      {appState.showWireframe && (
        <mesh geometry={geometry}>
             <meshBasicMaterial color="#000000" wireframe opacity={0.1} transparent />
        </mesh>
      )}

    </group>
  );
};

export const Viewer3D: React.FC<ViewerProps> = ({ appState }) => {
  return (
    <div className="w-full h-full bg-[#1c1c1c] relative">
      <Canvas 
        shadows 
        dpr={[1, 1.5]} 
        camera={{ position: [100, 300, 300], fov: 35 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      >
        <color attach="background" args={['#171717']} />
        
        <ambientLight intensity={0.5} />
        
        {/* Main Key Light - Cool Studio Light */}
        <spotLight 
            position={[100, 400, 200]} 
            angle={0.4} 
            penumbra={1} 
            intensity={2.5} 
            color="#ffffff"
            castShadow 
            shadow-mapSize={[2048, 2048]} 
            shadow-bias={-0.0001} 
        />
        
        {/* Fill Light */}
        <spotLight position={[-200, 200, 100]} angle={0.5} penumbra={1} intensity={1} color="#eef2ff" />
        
        {/* Rim Light */}
        <spotLight position={[0, 100, -200]} angle={0.5} penumbra={1} intensity={1.5} color="#e0e7ff" />

        <Environment preset="studio" blur={1} background={false} />

        <group position={[0, 0, 0]}>
            <KirigamiMesh appState={appState} />
        </group>

        {/* Floor / Shadow Catcher */}
        <mesh position={[0, -2.5, 0]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
            <planeGeometry args={[1000, 1000]} />
            <meshStandardMaterial color="#171717" roughness={0.8} metalness={0.2} />
        </mesh>
        
        {/* Grid Fade Out */}
        <gridHelper args={[1000, 50, '#333333', '#171717']} position={[0, -2.4, 0]} />

        <ContactShadows 
            resolution={1024} 
            scale={400} 
            blur={2.5} 
            opacity={0.5} 
            far={50} 
            color="#000000" 
            position={[0, -2.45, 0]} 
        />
        
        <OrbitControls 
            minPolarAngle={0} 
            maxPolarAngle={Math.PI / 2.1} 
            maxDistance={800} 
            minDistance={50}
            enableDamping
            dampingFactor={0.05}
        />

        <EffectComposer disableNormalPass={false} multisampling={0}>
             <SSAO 
                radius={0.04} 
                intensity={15} 
                luminanceInfluence={0.4} 
                color="black" 
             />
             <Bloom 
                luminanceThreshold={0.98} 
                mipmapBlur 
                intensity={0.4} 
                radius={0.4} 
             />
             <TiltShift2 blur={0.1} />
             <Vignette eskil={false} offset={0.1} darkness={0.5} />
             <Noise opacity={0.03} />
        </EffectComposer>
      </Canvas>
      
       <div className="absolute top-4 right-4 pointer-events-none z-10">
         <div className="bg-white/5 backdrop-blur px-3 py-1 rounded-full text-[9px] font-mono text-white/40 border border-white/10 uppercase tracking-widest">
            Fidelity: High | {Math.round((appState.cols * appState.rows * 4) * 6)} Polys
         </div>
      </div>
    </div>
  );
};
