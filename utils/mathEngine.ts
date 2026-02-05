
import { AppState, GeometryData, BlueprintLine } from '../types';
import * as THREE from 'three';

// --- MATH HELPERS ---

const pushQuad = (
  positions: number[],
  normals: number[],
  indices: number[],
  v0: THREE.Vector3,
  v1: THREE.Vector3,
  v2: THREE.Vector3,
  v3: THREE.Vector3,
  n: THREE.Vector3
) => {
  const idx = positions.length / 3;
  
  if (isNaN(v0.x) || isNaN(n.x)) return;

  positions.push(v0.x, v0.y, v0.z);
  positions.push(v1.x, v1.y, v1.z);
  positions.push(v2.x, v2.y, v2.z);
  positions.push(v3.x, v3.y, v3.z);

  normals.push(n.x, n.y, n.z);
  normals.push(n.x, n.y, n.z);
  normals.push(n.x, n.y, n.z);
  normals.push(n.x, n.y, n.z);

  indices.push(idx, idx + 1, idx + 2);
  indices.push(idx, idx + 2, idx + 3);
};

const pushVolumetricSegment = (
  positions: number[], normals: number[], indices: number[],
  v0: THREE.Vector3, v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3,
  n: THREE.Vector3,
  thickness: number,
  generateLeftWall: boolean,
  generateRightWall: boolean
) => {
    pushQuad(positions, normals, indices, v0, v1, v2, v3, n);

    if (thickness > 0) {
        const safeN = n.clone().normalize();
        if (isNaN(safeN.x)) safeN.set(0, 0, 1);

        const off = safeN.multiplyScalar(-thickness);
        const b0 = v0.clone().add(off);
        const b1 = v1.clone().add(off);
        const b2 = v2.clone().add(off);
        const b3 = v3.clone().add(off);

        pushQuad(positions, normals, indices, b0, b3, b2, b1, n.clone().negate());

        if (generateLeftWall) {
             const edge = new THREE.Vector3().subVectors(v3, v0);
             if (edge.lengthSq() > 0.000001) {
                 const nLeft = n.clone().cross(edge).normalize();
                 pushQuad(positions, normals, indices, v0, v3, b3, b0, nLeft);
             }
        }

        if (generateRightWall) {
             const edge = new THREE.Vector3().subVectors(v2, v1);
             if (edge.lengthSq() > 0.000001) {
                 const nRight = edge.clone().cross(n).normalize();
                 pushQuad(positions, normals, indices, v1, b1, b2, v2, nRight);
             }
        }
    }
};

export const generateKirigamiGeometry = (state: AppState): GeometryData => {
  const { width, height, margin } = state.paperSize;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const blueprintLines: BlueprintLine[] = [];
  const thickness = state.paperThickness || 0.1;

  const effectiveWidth = width - margin * 2;
  const stripWidth = effectiveWidth / state.cols;
  const KERF = 0.15; 

  const t = state.foldProgress;
  const foldAngleRad = t * (Math.PI / 2); 

  const vecFloor = new THREE.Vector3(0, 1, 0); 
  const vecWall = new THREE.Vector3(0, Math.cos(foldAngleRad), Math.sin(foldAngleRad));
  const normFloor = new THREE.Vector3(0, 0, 1);
  const normWall = new THREE.Vector3(0, -Math.sin(foldAngleRad), Math.cos(foldAngleRad));

  for (let c = 0; c < state.cols; c++) {
    const xBase = -width / 2 + margin + c * stripWidth;
    const xLeft = xBase + (KERF / 2);
    const xRight = xBase + stripWidth - (KERF / 2);
    const normX = ((c / state.cols) * 2 - 1); 
    const isPopup = c % 2 !== 0;

    if (!isPopup) {
        // Floor Segment
        pushVolumetricSegment(positions, normals, indices,
            new THREE.Vector3(xLeft, -height/2, 0), new THREE.Vector3(xRight, -height/2, 0),
            new THREE.Vector3(xRight, 0, 0), new THREE.Vector3(xLeft, 0, 0),
            normFloor, thickness, true, true
        );
        blueprintLines.push({ x1: xLeft, y1: -height/2, x2: xLeft, y2: 0, type: 'spine' });
        blueprintLines.push({ x1: xRight, y1: -height/2, x2: xRight, y2: 0, type: 'spine' });

        // Wall Segment
        const pSpine = new THREE.Vector3(0,0,0);
        const pTop = new THREE.Vector3().addScaledVector(vecWall, height/2);
        
        pushVolumetricSegment(positions, normals, indices,
            new THREE.Vector3(xLeft, pSpine.y, pSpine.z), new THREE.Vector3(xRight, pSpine.y, pSpine.z),
            new THREE.Vector3(xRight, pTop.y, pTop.z), new THREE.Vector3(xLeft, pTop.y, pTop.z),
            normWall, thickness, true, true
        );
        
        blueprintLines.push({ x1: xLeft, y1: 0, x2: xRight, y2: 0, type: 'valley' });
        blueprintLines.push({ x1: xLeft, y1: 0, x2: xLeft, y2: height/2, type: 'spine' });
        blueprintLines.push({ x1: xRight, y1: 0, x2: xRight, y2: height/2, type: 'spine' });
        continue;
    }

    // Active Strips
    let profileRadius = 0;
    
    switch(state.algorithm) {
        case 'sphere':
            const rSphere = state.amplitude;
            const xDist = Math.abs(normX * (width/2 - margin));
            if (xDist < rSphere) profileRadius = Math.sqrt(rSphere*rSphere - xDist*xDist);
            break;
        case 'pyramid':
            const rPyr = state.amplitude;
            const xD = Math.abs(normX * (width/2 - margin));
            profileRadius = Math.max(0, rPyr - xD);
            break;
        case 'steps':
        case 'stairs':
             profileRadius = state.amplitude;
             break;
        default:
             profileRadius = state.amplitude * (Math.cos(normX * Math.PI) * 0.5 + 0.5);
             break;
    }

    profileRadius = Math.min(profileRadius, height/2 - margin);
    
    // If radius is negligible, treat as passive to avoid glitches
    if (profileRadius < 1) {
         pushVolumetricSegment(positions, normals, indices, new THREE.Vector3(xLeft, -height/2, 0), new THREE.Vector3(xRight, -height/2, 0), new THREE.Vector3(xRight, 0, 0), new THREE.Vector3(xLeft, 0, 0), normFloor, thickness, true, true);
         const pTop = new THREE.Vector3().addScaledVector(vecWall, height/2);
         pushVolumetricSegment(positions, normals, indices, new THREE.Vector3(xLeft, 0, 0), new THREE.Vector3(xRight, 0, 0), new THREE.Vector3(xRight, pTop.y, pTop.z), new THREE.Vector3(xLeft, pTop.y, pTop.z), normWall, thickness, true, true);
         blueprintLines.push({ x1: xLeft, y1: 0, x2: xRight, y2: 0, type: 'valley' });
         continue;
    }

    const steps = Math.max(2, state.rows);
    const yStart = -profileRadius;
    
    let currentPos = new THREE.Vector3(0, yStart, 0); 
    let currentPaperY = yStart; 
    
    // 1. Floor Margin (Static)
    // Connects -Height/2 to yStart
    pushVolumetricSegment(positions, normals, indices,
        new THREE.Vector3(xLeft, -height/2, 0), new THREE.Vector3(xRight, -height/2, 0),
        new THREE.Vector3(xRight, yStart, 0), new THREE.Vector3(xLeft, yStart, 0),
        normFloor, thickness, true, true
    );
    
    // CUT LINES: The active strip is fully detached from neighbors along its length
    blueprintLines.push({ x1: xLeft, y1: -height/2, x2: xLeft, y2: height/2, type: 'cut' }); 
    blueprintLines.push({ x1: xRight, y1: -height/2, x2: xRight, y2: height/2, type: 'cut' });

    // Note: No fold at yStart because Floor Margin -> First Tread is typically coplanar (Flat -> Flat)

    for(let i=0; i<steps; i++) {
        const ang1 = (i / steps) * (Math.PI / 2);
        const ang2 = ((i + 1) / steps) * (Math.PI / 2);
        
        const y1 = -profileRadius * Math.cos(ang1);
        const z1 = profileRadius * Math.sin(ang1);
        const y2 = -profileRadius * Math.cos(ang2);
        const z2 = profileRadius * Math.sin(ang2);
        
        const dy = Math.abs(y2 - y1);
        const dz = Math.abs(z2 - z1);
        
        // 2. Tread (Floor-Parallel)
        const pTreadEnd = currentPos.clone().addScaledVector(vecFloor, dy);
        pushVolumetricSegment(positions, normals, indices,
            new THREE.Vector3(xLeft, currentPos.y, currentPos.z), new THREE.Vector3(xRight, currentPos.y, currentPos.z),
            new THREE.Vector3(xRight, pTreadEnd.y, pTreadEnd.z), new THREE.Vector3(xLeft, pTreadEnd.y, pTreadEnd.z),
            normFloor, thickness, true, true
        );
        currentPaperY += dy;
        currentPos.copy(pTreadEnd);
        
        // FOLD: Tread (Horizontal) -> Riser (Vertical)
        // This creates an "inner corner" or "step base". In 90deg popups, this is a VALLEY fold.
        if (dz > 0.01) {
             blueprintLines.push({ x1: xLeft, y1: currentPaperY, x2: xRight, y2: currentPaperY, type: 'valley' });
        }
        
        // 3. Riser (Wall-Parallel)
        const pRiserEnd = currentPos.clone().addScaledVector(vecWall, dz);
        pushVolumetricSegment(positions, normals, indices,
            new THREE.Vector3(xLeft, currentPos.y, currentPos.z), new THREE.Vector3(xRight, currentPos.y, currentPos.z),
            new THREE.Vector3(xRight, pRiserEnd.y, pRiserEnd.z), new THREE.Vector3(xLeft, pRiserEnd.y, pRiserEnd.z),
            normWall, thickness, true, true
        );
        currentPaperY += dz;
        currentPos.copy(pRiserEnd);
        
        // FOLD: Riser (Vertical) -> Next Tread (Horizontal)
        // This creates an "outer corner" or "step edge". This is a MOUNTAIN fold.
        // We only add this if we are NOT at the very end (connecting to Wall Margin)
        if (i < steps - 1 && dy > 0.01) {
            blueprintLines.push({ x1: xLeft, y1: currentPaperY, x2: xRight, y2: currentPaperY, type: 'mountain' });
        }
    }
    
    // Note: No fold at currentPaperY (Top Anchor) because Last Riser -> Wall Margin is coplanar (Vertical -> Vertical)

    // 4. Wall Margin (Static)
    const pWallMarginEnd = new THREE.Vector3(0,0,0).addScaledVector(vecWall, height/2);
    pushVolumetricSegment(positions, normals, indices,
        new THREE.Vector3(xLeft, currentPos.y, currentPos.z), new THREE.Vector3(xRight, currentPos.y, currentPos.z),
        new THREE.Vector3(xRight, pWallMarginEnd.y, pWallMarginEnd.z), new THREE.Vector3(xLeft, pWallMarginEnd.y, pWallMarginEnd.z),
        normWall, thickness, true, true
    );
  }

  // Statistics Calculation
  let totalCut = 0;
  let totalFold = 0;
  blueprintLines.forEach(l => {
      const len = Math.sqrt(Math.pow(l.x2 - l.x1, 2) + Math.pow(l.y2 - l.y1, 2));
      if (l.type === 'cut') totalCut += len;
      if (l.type === 'mountain' || l.type === 'valley') totalFold += len;
  });

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices,
    blueprintLines,
    stats: {
        totalCutLength: totalCut,
        totalFoldLength: totalFold,
        polyCount: indices.length / 3
    }
  };
};
