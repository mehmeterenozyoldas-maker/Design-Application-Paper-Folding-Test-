
import React, { useState, useCallback } from 'react';
import { Viewer3D } from './components/Viewer3D';
import { Blueprint2D } from './components/Blueprint2D';
import { MiniPreview } from './components/MiniPreview';
import { SketchPad } from './components/SketchPad';
import { AppState, AlgoType, PAPER_A4 } from './types';
import { generateKirigamiGeometry } from './utils/mathEngine';
import { Layers, Settings2, Download, Calculator, Sigma, Activity, Boxes, Mountain, Component, Camera, Projector, Upload, HelpCircle, X, MousePointer2, Sliders, PlayCircle, FileOutput, Image as ImageIcon, Ruler, PenTool, Undo, FileCode, ChevronRight, Menu } from 'lucide-react';

const App = () => {
  const initialState: AppState = {
    algorithm: 'sphere',
    rows: 12,
    cols: 31,
    amplitude: 50,
    frequency: 1.0,
    spread: 300,
    curvature: 2.0,
    roughness: 0.0,
    fractalOctaves: 3,
    customFormula: 'Math.sin(x * 10 * f) * Math.cos(x * 5)',
    sketchPoints: [{x:0, y:0}, {x:0.5, y:0.8}, {x:1, y:0}],
    foldProgress: 0.8,
    paperThickness: 0.2,
    showWireframe: false,
    paperSize: PAPER_A4,
    heightMapData: null,
    overlayTexture: null,
    isVideoTexture: false,
  };

  const [appState, setAppState] = useState<AppState>(initialState);
  const [history, setHistory] = useState<AppState[]>([initialState]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showGuide, setShowGuide] = useState(false);
  const [activeTab, setActiveTab] = useState<'design' | 'pattern'>('design');

  // Undo System
  const updateState = (key: keyof AppState, value: any) => {
    setAppState(prev => {
        const newState = { ...prev, [key]: value };
        return newState;
    });
  };

  const commitState = () => {
      const currentEntry = history[historyIndex];
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(appState);
      if(newHistory.length > 20) newHistory.shift();
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
      if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setAppState(history[newIndex]);
      }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    setAppState(prev => ({ 
                        ...prev, 
                        algorithm: 'image',
                        heightMapData: imageData 
                    }));
                }
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    }
  };

  const handleTextureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const url = URL.createObjectURL(file);
        const isVideo = file.type.startsWith('video/');
        setAppState(prev => ({
            ...prev,
            overlayTexture: url,
            isVideoTexture: isVideo
        }));
    }
  };

  const handleExportPNG = () => {
    const { blueprintLines } = generateKirigamiGeometry(appState);
    const canvas = document.createElement('canvas');
    const scale = 8; 
    const w = appState.paperSize.width * scale;
    const h = appState.paperSize.height * scale;
    
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    
    ctx.translate(w/2, h/2);
    ctx.scale(scale, scale); 

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(-appState.paperSize.width/2, -appState.paperSize.height/2, appState.paperSize.width, appState.paperSize.height);

    blueprintLines.forEach(line => {
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        ctx.lineWidth = 0.3;
        
        switch(line.type) {
            case 'cut': ctx.strokeStyle = '#ef4444'; ctx.setLineDash([]); break;
            case 'mountain': ctx.strokeStyle = '#3b82f6'; ctx.setLineDash([2, 2]); break;
            case 'valley': ctx.strokeStyle = '#22c55e'; ctx.setLineDash([1, 1]); break;
            default: ctx.strokeStyle = '#cbd5e1'; ctx.setLineDash([]);
        }
        ctx.stroke();
    });

    ctx.scale(1/scale, 1/scale);
    ctx.fillStyle = '#64748b';
    ctx.font = '24px monospace';
    ctx.fillText(`KiriGen X | ${appState.algorithm.toUpperCase()}`, 40, h - 40);

    const link = document.createElement('a');
    link.download = `kirigen_export_${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const handleExportSVG = () => {
    const { blueprintLines } = generateKirigamiGeometry(appState);
    const w = appState.paperSize.width;
    const h = appState.paperSize.height;

    let svg = `<?xml version="1.0" encoding="utf-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="${-w/2} ${-h/2} ${w} ${h}">
  <style type="text/css">
    .cut { stroke: #ef4444; stroke-width: 0.1mm; fill: none; }
    .mountain { stroke: #3b82f6; stroke-width: 0.1mm; stroke-dasharray: 2,1; fill: none; }
    .valley { stroke: #22c55e; stroke-width: 0.1mm; stroke-dasharray: 1,1; fill: none; }
    .border { stroke: #94a3b8; stroke-width: 0.1mm; fill: none; }
  </style>
  <rect x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" class="border" />
  <g>`;

    blueprintLines.forEach(line => {
        let cls = 'border';
        if (line.type === 'cut') cls = 'cut';
        if (line.type === 'mountain') cls = 'mountain';
        if (line.type === 'valley') cls = 'valley';
        svg += `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" class="${cls}" />`;
    });

    svg += `</g></svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kirigen_${appState.algorithm}_${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportDXF = () => {
    const { blueprintLines } = generateKirigamiGeometry(appState);
    const w = appState.paperSize.width;
    const h = appState.paperSize.height;
    
    const allLines = [
        ...blueprintLines,
        { x1: -w/2, y1: -h/2, x2: w/2, y2: -h/2, type: 'outline' },
        { x1: w/2, y1: -h/2, x2: w/2, y2: h/2, type: 'outline' },
        { x1: w/2, y1: h/2, x2: -w/2, y2: h/2, type: 'outline' },
        { x1: -w/2, y1: h/2, x2: -w/2, y2: -h/2, type: 'outline' }
    ];

    let dxfContent = [
      "999", "Kirigami DXF Generated by KiriGen X",
      "  0", "SECTION", "  2", "HEADER", "  9", "$ACADVER", "  1", "AC1009", "  0", "ENDSEC",
      "  0", "SECTION", "  2", "TABLES", 
      "  0", "TABLE", "  2", "LAYER", " 70", "4",
      "  0", "LAYER", "  2", "CUT", " 70", "0", " 62", "1", "  6", "CONTINUOUS",
      "  0", "LAYER", "  2", "MOUNTAIN", " 70", "0", " 62", "5", "  6", "DASHED",
      "  0", "LAYER", "  2", "VALLEY", " 70", "0", " 62", "3", "  6", "DASHED",
      "  0", "LAYER", "  2", "OUTLINE", " 70", "0", " 62", "7", "  6", "CONTINUOUS",
      "  0", "ENDTAB", "  0", "ENDSEC",
      "  0", "SECTION", "  2", "ENTITIES"
    ];

    allLines.forEach((line: any) => {
       const layerMap: Record<string, string> = {
           'cut': 'CUT',
           'mountain': 'MOUNTAIN',
           'valley': 'VALLEY',
           'spine': 'OUTLINE',
           'outline': 'OUTLINE'
       };
       const layer = layerMap[line.type] || '0';
       dxfContent.push("  0", "LINE", "  8", layer, " 10", line.x1.toFixed(4), " 20", line.y1.toFixed(4), " 30", "0.0", " 11", line.x2.toFixed(4), " 21", line.y2.toFixed(4), " 31", "0.0");
    });

    dxfContent.push("  0", "ENDSEC", "  0", "EOF");

    const blob = new Blob([dxfContent.join("\r\n")], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kirigen_${appState.algorithm}_${Date.now()}.dxf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isGeometric = ['sphere', 'pyramid', 'steps', 'torus', 'pagoda', 'vase', 'canyon'].includes(appState.algorithm);

  return (
    <div className="h-screen flex flex-col font-sans bg-neutral-50 text-neutral-900 overflow-hidden">
      
      {/* Help Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/30 backdrop-blur-md p-6">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-neutral-100">
                <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-2xl font-light tracking-tight text-neutral-900">Kirigami Workflow</h2>
                            <p className="text-sm text-neutral-500 mt-1 font-light">Parametric Design Guide</p>
                        </div>
                        <button onClick={() => setShowGuide(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors text-neutral-400">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="space-y-6">
                        <div className="flex gap-4 items-start">
                            <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0 text-neutral-900 text-sm font-medium">1</div>
                            <div>
                                <h3 className="text-sm font-medium text-neutral-900">Select Form</h3>
                                <p className="text-sm text-neutral-500 font-light leading-relaxed mt-1">
                                    Choose a mathematical surface or geometric primitive from the design panel.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4 items-start">
                            <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0 text-neutral-900 text-sm font-medium">2</div>
                            <div>
                                <h3 className="text-sm font-medium text-neutral-900">Tune Parameters</h3>
                                <p className="text-sm text-neutral-500 font-light leading-relaxed mt-1">
                                    Adjust frequency, amplitude, and density. Use the slider at the bottom to simulate the fold.
                                </p>
                            </div>
                        </div>
                         <div className="flex gap-4 items-start">
                            <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0 text-neutral-900 text-sm font-medium">3</div>
                            <div>
                                <h3 className="text-sm font-medium text-neutral-900">Fabricate</h3>
                                <p className="text-sm text-neutral-500 font-light leading-relaxed mt-1">
                                    Export as SVG or DXF for laser cutting or plotting.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-8 pt-6 border-t border-neutral-100 flex justify-end">
                        <button onClick={() => setShowGuide(false)} className="px-6 py-2 bg-neutral-900 hover:bg-black text-white text-sm font-medium rounded-full transition-all">Begin</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Floating Header */}
      <header className="absolute top-0 left-0 right-0 h-20 flex items-center justify-between px-8 z-30 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-4">
            <div className="flex flex-col">
                <h1 className="font-semibold text-xl tracking-tight text-neutral-900">KiriGen X</h1>
                <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-medium">Atelier v2.0</span>
            </div>
            <div className="h-6 w-px bg-neutral-200 mx-2"></div>
            <div className="flex bg-white rounded-full p-1 shadow-sm border border-neutral-200">
                <button 
                    onClick={() => setActiveTab('design')}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${activeTab === 'design' ? 'bg-neutral-900 text-white shadow-md' : 'text-neutral-500 hover:text-neutral-900'}`}
                >
                    Design
                </button>
                <button 
                    onClick={() => setActiveTab('pattern')}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${activeTab === 'pattern' ? 'bg-neutral-900 text-white shadow-md' : 'text-neutral-500 hover:text-neutral-900'}`}
                >
                    Blueprint
                </button>
            </div>
        </div>

        <div className="pointer-events-auto flex gap-3">
             <button onClick={undo} disabled={historyIndex === 0} className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-neutral-600 hover:text-neutral-900 border border-neutral-200 shadow-sm disabled:opacity-50 transition-all hover:scale-105 active:scale-95">
                <Undo size={18} />
            </button>
             <button onClick={() => setShowGuide(true)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-neutral-600 hover:text-neutral-900 border border-neutral-200 shadow-sm transition-all hover:scale-105 active:scale-95">
                <HelpCircle size={18} />
            </button>
            <div className="w-px h-6 bg-neutral-300 self-center mx-1"></div>
            <div className="flex gap-2">
                <button onClick={handleExportSVG} className="h-10 px-5 flex items-center gap-2 rounded-full bg-white text-neutral-900 border border-neutral-200 shadow-sm hover:border-neutral-300 font-medium text-xs transition-all hover:translate-y-px">
                    SVG
                </button>
                 <button onClick={handleExportDXF} className="h-10 px-5 flex items-center gap-2 rounded-full bg-neutral-900 text-white shadow-lg shadow-neutral-200 hover:bg-black font-medium text-xs transition-all hover:translate-y-px">
                    <Download size={16} /> Export
                </button>
            </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex relative">
        
        {/* Sidebar - Floating Card */}
        <aside className={`absolute top-24 left-8 bottom-8 w-80 z-20 transition-transform duration-500 ease-out ${activeTab === 'design' ? 'translate-x-0' : '-translate-x-[120%]'}`}>
            <div className="h-full bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl shadow-neutral-200/50 border border-white flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    
                    {/* Algorithm Selection */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block">Core Geometry</label>
                        <div className="flex flex-wrap gap-2">
                            {(['stairs', 'sine', 'gaussian', 'ripple', 'voronoi', 'noise', 'sphere', 'pyramid', 'steps', 'torus', 'pagoda', 'vase', 'canyon'] as AlgoType[]).map(algo => (
                                <button
                                    key={algo}
                                    onClick={() => { updateState('algorithm', algo); commitState(); }}
                                    className={`px-3 py-1.5 text-[11px] font-medium rounded-full border transition-all capitalize
                                        ${appState.algorithm === algo 
                                            ? 'bg-neutral-900 border-neutral-900 text-white shadow-md' 
                                            : 'bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-900'}`}
                                >
                                    {algo}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                             <button onClick={() => { updateState('algorithm', 'sketch'); commitState(); }} className={`px-2 py-2 text-[10px] rounded-xl border flex flex-col items-center gap-1 transition-all ${appState.algorithm === 'sketch' ? 'bg-neutral-50 border-neutral-900 text-neutral-900' : 'bg-white border-neutral-100 text-neutral-400 hover:border-neutral-300'}`}>
                                <PenTool size={14} /> Sketch
                             </button>
                             <button onClick={() => { updateState('algorithm', 'custom'); commitState(); }} className={`px-2 py-2 text-[10px] rounded-xl border flex flex-col items-center gap-1 transition-all ${appState.algorithm === 'custom' ? 'bg-neutral-50 border-neutral-900 text-neutral-900' : 'bg-white border-neutral-100 text-neutral-400 hover:border-neutral-300'}`}>
                                <Calculator size={14} /> Custom
                             </button>
                             <label className={`cursor-pointer px-2 py-2 text-[10px] rounded-xl border flex flex-col items-center gap-1 transition-all ${appState.algorithm === 'image' ? 'bg-neutral-50 border-neutral-900 text-neutral-900' : 'bg-white border-neutral-100 text-neutral-400 hover:border-neutral-300'}`}>
                                <Camera size={14} /> Image
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => { handleImageUpload(e); commitState(); }} />
                             </label>
                        </div>
                    </div>

                    {/* Contextual Inputs */}
                    <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-100 space-y-4">
                        {appState.algorithm === 'sketch' && (
                             <SketchPad points={appState.sketchPoints} onChange={(pts) => updateState('sketchPoints', pts)} />
                        )}
                        {appState.algorithm === 'custom' && (
                            <textarea 
                                value={appState.customFormula}
                                onChange={(e) => updateState('customFormula', e.target.value)}
                                onBlur={commitState}
                                className="w-full h-20 text-xs font-mono p-3 rounded-lg border border-neutral-200 bg-white focus:ring-1 focus:ring-neutral-900 focus:outline-none"
                            />
                        )}

                        {/* Sliders */}
                        {appState.algorithm !== 'sketch' && appState.algorithm !== 'custom' && appState.algorithm !== 'image' && (
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] uppercase tracking-wide text-neutral-500 font-medium">
                                    <span>Scale</span>
                                    <span>{appState.frequency.toFixed(1)}</span>
                                </div>
                                <input type="range" min="0.1" max="5.0" step="0.1" value={appState.frequency} onChange={(e) => updateState('frequency', parseFloat(e.target.value))} onPointerUp={commitState} />
                            </div>
                        </div>
                        )}
                        
                        {isGeometric && (
                             <div className="space-y-4">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] uppercase tracking-wide text-neutral-500 font-medium">
                                        <span>Curvature</span>
                                        <span>{appState.curvature.toFixed(1)}</span>
                                    </div>
                                    <input type="range" min="0.1" max="6.0" step="0.1" value={appState.curvature} onChange={(e) => updateState('curvature', parseFloat(e.target.value))} onPointerUp={commitState} />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] uppercase tracking-wide text-neutral-500 font-medium">
                                        <span>Roughness</span>
                                        <span>{appState.roughness.toFixed(2)}</span>
                                    </div>
                                    <input type="range" min="0.0" max="1.0" step="0.05" value={appState.roughness} onChange={(e) => updateState('roughness', parseFloat(e.target.value))} onPointerUp={commitState} />
                                </div>
                             </div>
                        )}
                    </div>

                    {/* Global Settings */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block">Structure</label>
                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-neutral-500">
                                    <span>X-Density</span>
                                    <span>{appState.cols}</span>
                                </div>
                                <input type="range" min="9" max="101" step="2" value={appState.cols} onChange={(e) => updateState('cols', parseInt(e.target.value))} onPointerUp={commitState} />
                             </div>
                             <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-neutral-500">
                                    <span>Y-Res</span>
                                    <span>{appState.rows}</span>
                                </div>
                                <input type="range" min="1" max="48" step="1" value={appState.rows} onChange={(e) => updateState('rows', parseInt(e.target.value))} onPointerUp={commitState} />
                             </div>
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-neutral-500">
                                <span>Amplitude (Z)</span>
                                <span>{appState.amplitude}mm</span>
                            </div>
                            <input type="range" min="10" max="80" value={appState.amplitude} onChange={(e) => updateState('amplitude', parseInt(e.target.value))} onPointerUp={commitState} />
                        </div>
                    </div>

                    <div className="pt-6 border-t border-neutral-100 space-y-4">
                         <label className="flex items-center justify-between group cursor-pointer">
                            <span className="text-xs font-medium text-neutral-600 group-hover:text-neutral-900">Wireframe Mode</span>
                            <input type="checkbox" checked={appState.showWireframe} onChange={(e) => updateState('showWireframe', e.target.checked)} className="rounded text-neutral-900 focus:ring-neutral-900 border-neutral-300" />
                        </label>
                         <label className="flex items-center justify-between group cursor-pointer">
                             <span className="text-xs font-medium text-neutral-600 group-hover:text-neutral-900">Project Texture</span>
                             <div className="relative">
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => { handleTextureUpload(e); commitState(); }} />
                                <span className="text-[10px] uppercase font-bold text-neutral-400 hover:text-neutral-900 transition-colors">Select File</span>
                             </div>
                        </label>
                    </div>

                </div>
            </div>
        </aside>

        {/* 3D Viewport - Takes full space */}
        <main className="absolute inset-0 z-0">
            <Viewer3D appState={appState} />
            
            {/* Simulation Slider Floating */}
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-80 md:w-96 bg-white/10 backdrop-blur-md p-4 rounded-full shadow-2xl border border-white/20 z-30 group transition-all hover:bg-white/20 hover:scale-105">
                 <div className="flex justify-between text-[9px] font-bold text-white/50 mb-2 tracking-widest px-2 group-hover:text-white/80 transition-colors">
                    <span>FLAT</span>
                    <span>FOLDED</span>
                </div>
                <input 
                    type="range" min="0" max="1" step="0.005"
                    value={appState.foldProgress}
                    onChange={(e) => updateState('foldProgress', parseFloat(e.target.value))}
                    className="w-full accent-white h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
            </div>
        </main>

        {/* Blueprint Overlay - Only shows when Blueprint tab active */}
        <div className={`absolute inset-0 z-10 bg-neutral-50 transition-transform duration-500 ease-in-out ${activeTab === 'pattern' ? 'translate-y-0' : 'translate-y-full'}`}>
            <div className="h-full w-full flex flex-col pt-24 pb-8 px-8">
                <div className="flex-1 bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden relative">
                    <div className="absolute top-4 left-4 z-10 flex gap-2">
                        <span className="px-3 py-1 bg-neutral-100 rounded-full text-[10px] font-bold text-neutral-500 uppercase tracking-wide">A4 Scaled</span>
                        <span className="px-3 py-1 bg-neutral-100 rounded-full text-[10px] font-bold text-neutral-500 uppercase tracking-wide">{appState.algorithm}</span>
                    </div>
                    <Blueprint2D appState={appState} />
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default App;
