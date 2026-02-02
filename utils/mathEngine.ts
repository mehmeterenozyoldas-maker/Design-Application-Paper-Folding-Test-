
import { AppState, GeometryData, BlueprintLine } from '../types';
import * as THREE from 'three';

// --- MATH HELPERS ---

// Catmull-Rom Spline Interpolation
// Calculates a point on a curve passing through p1 and p2, influenced by p0 and p3
const catmullRom = (p0: number, p1: number, p2: number, p3: number, t: number) => {
    const v0 = (p2 - p0) * 0.5;
    const v1 = (p3 - p1) * 0.5;
    const t2 = t * t;
    const t3 = t * t2;
    return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
};

// Helper to push a quad (single side)
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
  
  // Safety check for NaN
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

// Helper to push a volumetric box (Top + Bottom + Sides)
const pushVolumetricSegment = (
  positions: number[], normals: number[], indices: number[],
  v0: THREE.Vector3, v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3,
  n: THREE.Vector3,
  thickness: number,
  generateLeftWall: boolean,
  generateRightWall: boolean
) => {
    // 1. Top Face
    pushQuad(positions, normals, indices, v0, v1, v2, v3, n);

    if (thickness > 0) {
        // Offset for thickness (in negative normal direction)
        const safeN = n.clone().normalize();
        if (isNaN(safeN.x)) safeN.set(0, 0, 1); // Fallback

        const off = safeN.multiplyScalar(-thickness);
        const b0 = v0.clone().add(off);
        const b1 = v1.clone().add(off);
        const b2 = v2.clone().add(off);
        const b3 = v3.clone().add(off);

        // 2. Bottom Face (Winding reversed)
        pushQuad(positions, normals, indices, b0, b3, b2, b1, n.clone().negate());

        // 3. Side Walls
        // Left Wall (v0 -> v3 edge)
        if (generateLeftWall) {
             const edge = new THREE.Vector3().subVectors(v3, v0);
             if (edge.lengthSq() > 0.000001) {
                 const nLeft = edge.cross(n).normalize();
                 pushQuad(positions, normals, indices, v0, v3, b3, b0, nLeft);
             }
        }

        // Right Wall (v1 -> v2 edge)
        if (generateRightWall) {
             const edge = new THREE.Vector3().subVectors(v2, v1);
             if (edge.lengthSq() > 0.000001) {
                 const nRight = edge.cross(n).normalize(); // Points out from 1->2
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
  
  // Laser Cutter Kerf (Gap between strips) to prevent Z-Fighting
  const KERF = 0.15; 

  // FOLDING KINEMATICS
  // t=0 (Flat), t=1 (90 deg)
  const t = state.foldProgress;
  const alpha = t * (Math.PI / 2); 

  // Rigid Body Vectors
  // Floor: Fixed on XY plane (y < 0). 
  const vecTread = new THREE.Vector3(0, 1, 0); 
  const normTread = new THREE.Vector3(0, 0, 1);

  // Wall: Rotates around X-axis.
  const vecRiser = new THREE.Vector3(0, Math.cos(alpha), Math.sin(alpha));
  const normRiser = new THREE.Vector3(0, -Math.sin(alpha), Math.cos(alpha));

  // Generate Geometry
  for (let c = 0; c < state.cols; c++) {
    // Calculate raw coordinates
    const xBase = -width / 2 + margin + c * stripWidth;
    
    // Apply Kerf: Shrink the strip slightly from both sides relative to the "cell"
    // This creates a physical gap between adjacent strips, resolving Z-fighting and simulating reality
    const xLeft = xBase + (KERF / 2);
    const xRight = xBase + stripWidth - (KERF / 2);
    
    const normX = ((c / state.cols) * 2 - 1); // -1 to 1

    const isPopup = c % 2 !== 0;

    // --- AMPLITUDE CALCULATION ---
    let shapeFactor = 0;
    
    if (isPopup) {
        switch (state.algorithm) {
            case 'stairs': shapeFactor = 1; break;
            case 'sine': shapeFactor = Math.abs(Math.sin(normX * Math.PI * state.frequency)); break;
            case 'gaussian': shapeFactor = Math.exp(-(normX * normX * state.spread / 100)); break;
            case 'ripple': shapeFactor = (Math.cos(Math.abs(normX) * 10 * state.frequency) * 0.5 + 0.5) * Math.exp(-Math.abs(normX) * 2); break;
            case 'voronoi': shapeFactor = (Math.abs(Math.sin(normX * 10)) * Math.abs(Math.cos(normX * 5 * state.frequency))); break;
            case 'noise': shapeFactor = (Math.sin(normX * 13.0 * state.frequency) * Math.sin(normX * 27.0) * 0.5 + 0.5); break;
            case 'sphere':
                const sphExp = Math.max(0.1, state.curvature); 
                const sphWidth = 0.5 + state.frequency * 0.5;
                const sphX = Math.abs(normX * sphWidth);
                if (sphX < 1) {
                    let baseVal = Math.pow(1 - Math.pow(sphX, sphExp), 1 / sphExp);
                    if (state.roughness > 0) baseVal += Math.abs(Math.sin(normX * 40 * sphWidth)) * state.roughness * 0.2 * baseVal;
                    shapeFactor = baseVal;
                }
                break;
            case 'pyramid':
                const pyrExp = Math.max(0.1, state.curvature);
                const pyrWidth = 0.5 + state.frequency * 0.5;
                const pyrX = Math.abs(normX * pyrWidth);
                let basePyr = Math.pow(Math.max(0, 1 - pyrX), pyrExp);
                if (state.roughness > 0) {
                     const steps = 2 + Math.floor((1.1 - state.roughness) * 20);
                     basePyr = Math.floor(basePyr * steps) / steps;
                }
                shapeFactor = basePyr;
                break;
            case 'torus':
                const torExp = Math.max(0.1, state.curvature);
                const torScale = 1.0 + state.frequency;
                const torX = (Math.abs(normX) - 0.5) * torScale * 2;
                if (Math.abs(torX) < 1) {
                    let baseTor = Math.pow(1 - Math.pow(Math.abs(torX), torExp), 1 / torExp);
                    if (state.roughness > 0) baseTor += Math.sin(normX * 30) * state.roughness * 0.3 * baseTor;
                    shapeFactor = baseTor;
                }
                break;
            case 'pagoda':
                const pTiers = 2 + Math.floor(state.frequency * 4);
                const rawPagoda = Math.max(0, 1 - Math.abs(normX) * 1.2);
                const pagodaCurve = state.curvature * 0.5; 
                let curvedP = Math.pow(rawPagoda, pagodaCurve); 
                if (state.roughness > 0) {
                    const tierPhase = (curvedP * pTiers) % 1;
                    if (tierPhase < 0.2) curvedP += (0.2 - tierPhase) * state.roughness * 0.5;
                }
                shapeFactor = Math.floor(curvedP * pTiers) / pTiers;
                break;
            case 'vase':
                const vx = normX * Math.PI * (state.frequency + 0.5);
                const envPow = state.curvature; 
                const envelope = Math.max(0, 1 - Math.pow(Math.abs(normX), envPow)); 
                let vaseShape = (Math.cos(vx * 2) * 0.5 + 0.5) * envelope;
                if (state.roughness > 0) vaseShape += Math.cos(normX * 60) * state.roughness * 0.1 * envelope;
                shapeFactor = vaseShape;
                break;
            case 'canyon':
                const cx = Math.abs(normX * (0.5 + state.frequency * 0.5));
                const canyonExp = state.curvature;
                let baseCanyon = Math.pow(Math.min(1, Math.max(0, cx)), canyonExp);
                if (state.roughness > 0) {
                     const pseudoRand = Math.sin(c * 12.9898) * 43758.5453;
                     const noise = (pseudoRand - Math.floor(pseudoRand)) * state.roughness * 0.2;
                     baseCanyon += noise;
                }
                shapeFactor = baseCanyon;
                break;
            case 'steps':
                 const stepCount = Math.floor(2 + state.frequency * 8);
                 let stepRaw = Math.max(0, 1 - Math.abs(normX));
                 stepRaw = Math.pow(stepRaw, state.curvature);
                 shapeFactor = Math.floor(stepRaw * stepCount) / stepCount;
                 break;
            case 'fractal':
                let v = 0;
                let amp = 0.5;
                let freq = state.frequency;
                for(let k=0; k < state.fractalOctaves; k++) {
                    v += Math.sin(normX * 5 * freq + k * 1.32) * amp;
                    amp *= 0.5;
                    freq *= 2;
                }
                shapeFactor = Math.min(1, Math.abs(v) + 0.1); 
                break;
            case 'custom':
                try {
                    const safeEval = new Function('x', 'f', 'i', 'Math', `try { return (${state.customFormula}); } catch(e) { return 0; }`);
                    const result = safeEval(normX, state.frequency, c, Math);
                    shapeFactor = isNaN(result) ? 0 : Math.max(0, Math.min(1, Math.abs(result)));
                } catch (e) { shapeFactor = 0; }
                break;
            case 'image':
                if (state.heightMapData) {
                    const u = (normX + 1) / 2;
                    const imgW = state.heightMapData.width;
                    const imgH = state.heightMapData.height;
                    const col = Math.floor(u * (imgW - 1));
                    const row = Math.floor(imgH / 2); 
                    const idx = (row * imgW + col) * 4;
                    const brightness = (state.heightMapData.data[idx] + state.heightMapData.data[idx+1] + state.heightMapData.data[idx+2]) / 3;
                    shapeFactor = brightness / 255;
                }
                break;
            case 'sketch':
                // UPGRADED: Catmull-Rom Spline Interpolation for organic curves
                if (state.sketchPoints && state.sketchPoints.length > 1) {
                    const u = (normX + 1) / 2; // 0 to 1
                    const pts = state.sketchPoints;
                    
                    if (pts.length < 2) {
                        shapeFactor = pts[0].y;
                    } else {
                        // Find index i such that pts[i].x <= u < pts[i+1].x
                        let i = 0;
                        while (i < pts.length - 2 && u > pts[i+1].x) {
                            i++;
                        }
                        
                        // Define control points
                        const p1 = pts[i];
                        const p2 = pts[i+1];
                        const p0 = i > 0 ? pts[i-1] : { x: p1.x - (p2.x - p1.x), y: p1.y }; // Extrapolate if start
                        const p3 = i < pts.length - 2 ? pts[i+2] : { x: p2.x + (p2.x - p1.x), y: p2.y }; // Extrapolate if end
                        
                        // Normalized t (0 to 1) between p1 and p2
                        const range = p2.x - p1.x;
                        const tLerp = range === 0 ? 0 : (u - p1.x) / range;
                        
                        // Spline interpolate Y
                        shapeFactor = Math.max(0, Math.min(1, catmullRom(p0.y, p1.y, p2.y, p3.y, tLerp)));
                    }
                } else {
                    shapeFactor = 0.5;
                }
                break;
        }
    }

    const maxSafe = (height / 2) - 5;
    const amplitude = Math.min(Math.abs(state.amplitude * shapeFactor), maxSafe);
    const isFlat = amplitude < 0.5;

    // Symmetric fold
    const run = isFlat ? 0 : amplitude;
    const rise = isFlat ? 0 : amplitude;
    const numSteps = isFlat ? 1 : state.rows; 

    const stepRun = run / numSteps;
    const stepRise = rise / numSteps;

    // Anchors
    const yPaperBottom = -height / 2;
    const yAnchorFloor = -run;
    
    // 1. FLOOR FRAME (Static)
    pushVolumetricSegment(positions, normals, indices,
        new THREE.Vector3(xLeft, yPaperBottom, 0),
        new THREE.Vector3(xRight, yPaperBottom, 0),
        new THREE.Vector3(xRight, yAnchorFloor, 0),
        new THREE.Vector3(xLeft, yAnchorFloor, 0),
        normTread, thickness, true, true
    );

    // 2. WALL FRAME (Rotating)
    const pWallStart = new THREE.Vector3().addScaledVector(vecRiser, rise);
    const pWallEnd = new THREE.Vector3().addScaledVector(vecRiser, height/2);
    
    pushVolumetricSegment(positions, normals, indices,
        new THREE.Vector3(xLeft, pWallStart.y, pWallStart.z),
        new THREE.Vector3(xRight, pWallStart.y, pWallStart.z),
        new THREE.Vector3(xRight, pWallEnd.y, pWallEnd.z),
        new THREE.Vector3(xLeft, pWallEnd.y, pWallEnd.z),
        normRiser, thickness, true, true
    );

    // 3. STRIP (Connecting Floor to Wall)
    let currentPos = new THREE.Vector3(0, yAnchorFloor, 0); 
    let currentPaperY = yAnchorFloor;

    if (!isFlat) {
        // BLUEPRINT LINES
        // For blueprint, we use the logical edges (without kerf) or with kerf? 
        // Usually blueprint needs the cut line. We will use xBase + stripWidth for the cut line.
        // But to keep it aligned with the 3D model, we use the model coords.
        blueprintLines.push({ x1: xLeft, y1: yAnchorFloor, x2: xLeft, y2: rise, type: 'cut' });
        blueprintLines.push({ x1: xRight, y1: yAnchorFloor, x2: xRight, y2: rise, type: 'cut' });
        blueprintLines.push({ x1: xLeft, y1: currentPaperY, x2: xRight, y2: currentPaperY, type: 'valley' });

        for(let i=0; i<numSteps; i++) {
            // Riser
            const pStart = currentPos.clone();
            const pEnd = currentPos.clone().addScaledVector(vecRiser, stepRise);
            
            pushVolumetricSegment(positions, normals, indices,
                new THREE.Vector3(xLeft, pStart.y, pStart.z),
                new THREE.Vector3(xRight, pStart.y, pStart.z),
                new THREE.Vector3(xRight, pEnd.y, pEnd.z),
                new THREE.Vector3(xLeft, pEnd.y, pEnd.z),
                normRiser, thickness, true, true
            );
            
            currentPos.copy(pEnd);
            currentPaperY += stepRise;
            blueprintLines.push({ x1: xLeft, y1: currentPaperY, x2: xRight, y2: currentPaperY, type: 'mountain' });

            // Tread
            const pStartT = currentPos.clone();
            const pEndT = currentPos.clone().addScaledVector(vecTread, stepRun);
            
            pushVolumetricSegment(positions, normals, indices,
                new THREE.Vector3(xLeft, pStartT.y, pStartT.z),
                new THREE.Vector3(xRight, pStartT.y, pStartT.z),
                new THREE.Vector3(xRight, pEndT.y, pEndT.z),
                new THREE.Vector3(xLeft, pEndT.y, pEndT.z),
                normTread, thickness, true, true
            );

            currentPos.copy(pEndT);
            currentPaperY += stepRun;
            
            if (i < numSteps - 1) {
                blueprintLines.push({ x1: xLeft, y1: currentPaperY, x2: xRight, y2: currentPaperY, type: 'valley' });
            }
        }
        blueprintLines.push({ x1: xLeft, y1: currentPaperY, x2: xRight, y2: currentPaperY, type: 'valley' });

    } else {
        // FLAT SPACER
        pushVolumetricSegment(positions, normals, indices,
            new THREE.Vector3(xLeft, yAnchorFloor, 0),
            new THREE.Vector3(xRight, yAnchorFloor, 0),
            new THREE.Vector3(xRight, pWallStart.y, pWallStart.z),
            new THREE.Vector3(xLeft, pWallStart.y, pWallStart.z),
            normTread, thickness, true, true
        );
        blueprintLines.push({ x1: xLeft, y1: 0, x2: xRight, y2: 0, type: 'valley' });
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices,
    blueprintLines
  };
};