
import React, { useRef, useEffect } from 'react';
import { AppState, PAPER_A4 } from '../types';
import { generateKirigamiGeometry } from '../utils/mathEngine';

export const Blueprint2D: React.FC<{ appState: AppState }> = ({ appState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get Lines
    const { blueprintLines } = generateKirigamiGeometry(appState);

    // Setup Canvas
    const scale = 1.5; // Zoom level
    const w = PAPER_A4.width * scale;
    const h = PAPER_A4.height * scale;
    
    // Handle High DPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `100%`;
    canvas.style.height = `100%`;
    // Object fit contain handled by CSS if needed, but here we render to aspect ratio
    
    ctx.scale(dpr, dpr);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, w, h);

    // Transform to Center
    // We need to calculate how to center this in the canvas DOM
    // For now, simpler is to just render the paper centered in the canvas dimensions
    const canvasW = w;
    const canvasH = h;
    
    ctx.translate(canvasW/2, canvasH/2);
    ctx.scale(scale, scale);

    // Draw Grid
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for(let i = -PAPER_A4.width/2; i <= PAPER_A4.width/2; i+=10) { ctx.moveTo(i, -PAPER_A4.height/2); ctx.lineTo(i, PAPER_A4.height/2); }
    for(let i = -PAPER_A4.height/2; i <= PAPER_A4.height/2; i+=10) { ctx.moveTo(-PAPER_A4.width/2, i); ctx.lineTo(PAPER_A4.width/2, i); }
    ctx.stroke();

    // Draw Paper Outline
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(-PAPER_A4.width/2, -PAPER_A4.height/2, PAPER_A4.width, PAPER_A4.height);

    // Draw Lines
    blueprintLines.forEach(line => {
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        
        ctx.lineWidth = 1.0;
        
        switch(line.type) {
            case 'cut':
                ctx.strokeStyle = '#ef4444'; // Red
                ctx.setLineDash([]);
                break;
            case 'mountain':
                ctx.strokeStyle = '#3b82f6'; // Blue
                ctx.setLineDash([4, 2]); // Dash
                break;
            case 'valley':
                ctx.strokeStyle = '#22c55e'; // Green
                ctx.setLineDash([2, 2]); // Dot
                break;
            case 'spine':
                ctx.strokeStyle = '#cbd5e1';
                ctx.lineWidth = 1;
                ctx.setLineDash([]);
                break;
        }
        ctx.stroke();
    });

  }, [appState]);

  return (
    <div className="w-full h-full flex items-center justify-center p-8 bg-white">
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  );
};
