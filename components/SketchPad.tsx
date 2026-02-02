
import React, { useRef, useEffect, useState } from 'react';
import { Eraser, Pencil, RotateCcw } from 'lucide-react';

interface Point {
    x: number;
    y: number;
}

interface SketchPadProps {
    points: Point[];
    onChange: (points: Point[]) => void;
}

export const SketchPad: React.FC<SketchPadProps> = ({ points, onChange }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    
    // Convert normalized points (0-1) to canvas coordinates
    const drawCurve = (ctx: CanvasRenderingContext2D, width: number, height: number, ptrs: Point[]) => {
        ctx.clearRect(0, 0, width, height);
        
        // Draw Grid
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(let i=0; i<width; i+=40) { ctx.moveTo(i, 0); ctx.lineTo(i, height); }
        for(let i=0; i<height; i+=40) { ctx.moveTo(0, i); ctx.lineTo(width, i); }
        ctx.stroke();

        // Draw Baseline
        ctx.strokeStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(width, height);
        ctx.stroke();

        if (ptrs.length < 2) return;

        // Draw Curve
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        
        // Move to first point
        const startX = ptrs[0].x * width;
        const startY = (1 - ptrs[0].y) * height; // Invert Y because canvas Y is down
        ctx.moveTo(startX, startY);

        for (let i = 1; i < ptrs.length; i++) {
            const x = ptrs[i].x * width;
            const y = (1 - ptrs[i].y) * height;
            ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Draw Area under curve (gradient)
        ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
        ctx.lineTo(ptrs[ptrs.length-1].x * width, height);
        ctx.lineTo(ptrs[0].x * width, height);
        ctx.fill();
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        // Handle High DPI
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.scale(dpr, dpr);
            drawCurve(ctx, rect.width, rect.height, points);
        }
    }, [points]);

    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDrawing(true);
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.setPointerCapture(e.pointerId);
        addPoint(e);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDrawing) return;
        addPoint(e);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) canvas.releasePointerCapture(e.pointerId);
        
        // Sort points by X when finished to ensure valid function y=f(x)
        const sorted = [...points].sort((a, b) => a.x - b.x);
        // Ensure start and end cover 0 and 1
        if (sorted.length > 0) {
            if (sorted[0].x > 0.01) sorted.unshift({ x: 0, y: sorted[0].y });
            if (sorted[sorted.length-1].x < 0.99) sorted.push({ x: 1, y: sorted[sorted.length-1].y });
        }
        onChange(sorted);
    };

    const addPoint = (e: React.PointerEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
        
        // If drawing from scratch, clear; if continuing, append.
        // For simplicity in this tool, we'll implement "replace" mode mostly, 
        // but we need to handle the array intelligently.
        // Current simple logic: Just append, we sort later.
        
        // Optimization: Filter too close points
        const lastPt = points[points.length - 1];
        if (lastPt && Math.abs(lastPt.x - x) < 0.005) return;

        const newPoints = [...points, { x, y }];
        onChange(newPoints);
    };

    const handleReset = () => {
        onChange([{x: 0, y: 0.5}, {x: 0.5, y: 1}, {x: 1, y: 0.5}]);
    };

    const handleClear = () => {
         onChange([]);
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-bold text-slate-500 uppercase">Draw Profile</span>
                <div className="flex gap-1">
                    <button onClick={handleReset} title="Reset to default" className="p-1 hover:bg-slate-200 rounded text-slate-500"><RotateCcw size={14} /></button>
                    <button onClick={handleClear} title="Clear" className="p-1 hover:bg-slate-200 rounded text-slate-500"><Eraser size={14} /></button>
                </div>
            </div>
            <div className="relative h-40 w-full bg-white rounded-lg border border-slate-300 overflow-hidden shadow-inner cursor-crosshair touch-none">
                <canvas 
                    ref={canvasRef}
                    className="w-full h-full"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                />
            </div>
            <div className="text-[10px] text-slate-400 italic text-center">
                Draw left to right to define shape height
            </div>
        </div>
    );
};
