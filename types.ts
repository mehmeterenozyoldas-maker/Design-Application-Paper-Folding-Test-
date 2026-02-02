
export type AlgoType = 'stairs' | 'sine' | 'gaussian' | 'ripple' | 'voronoi' | 'noise' | 'fractal' | 'custom' | 'sphere' | 'pyramid' | 'steps' | 'torus' | 'pagoda' | 'vase' | 'canyon' | 'image' | 'sketch';

export interface AppState {
  algorithm: AlgoType;
  rows: number; // Complexity/Resolution
  cols: number; // Density
  amplitude: number; // Height
  frequency: number; // Wave freq/Width
  spread: number; // For gaussian/ripple width
  curvature: number; // For Geometric primitives (Exponent/Profile)
  roughness: number; // For Geometric primitives (Noise/Stepping)
  fractalOctaves: number; // For fractal
  customFormula: string; // For custom
  sketchPoints: {x: number, y: number}[]; // For sketch algorithm
  foldProgress: number; // 0 to 1
  paperThickness: number; // Physical thickness in mm
  showWireframe: boolean;
  paperSize: { width: number; height: number; margin: number };
  
  // CV & Projection
  heightMapData: ImageData | null; // For 'image' algorithm (CV)
  overlayTexture: string | null; // URL for projection mapping
  isVideoTexture: boolean;
}

export interface GeometryData {
  positions: Float32Array; // Vertex positions
  normals: Float32Array;
  indices: number[];
  blueprintLines: BlueprintLine[];
}

export interface BlueprintLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: 'cut' | 'mountain' | 'valley' | 'spine' | 'outline';
}

export const PAPER_A4 = {
  width: 210, // mm
  height: 297, // mm
  margin: 20
};