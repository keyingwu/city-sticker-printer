import React, { useState, useRef } from 'react';
import { generateCitySticker } from './services/geminiService';
import { Printer } from './components/Printer';
import { PlacedSticker, DragItem } from './types';

// Helper to normalize mouse and touch coordinates
const getClientCoords = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if ('touches' in e && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if ('changedTouches' in e && e.changedTouches.length > 0) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    } else if ('clientX' in e) {
      return { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
    }
    return { x: 0, y: 0 };
};

export default function App() {
  // Input State
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Generation Logic State
  // We track how many times we've printed for the current input to cycle through categories
  const [generationCount, setGenerationCount] = useState(0);
  
  // Sticker State
  // Changed from just string URL to object to track city name for downloads
  const [freshSticker, setFreshSticker] = useState<{url: string, city: string} | null>(null);
  const [placedStickers, setPlacedStickers] = useState<PlacedSticker[]>([]);

  // Drag State
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Generate Handler
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim() || loading) return;
    
    setLoading(true);
    setError(null);
    setFreshSticker(null);

    try {
      // Pass the generation count to cycle through categories (Landmark -> Food -> Transport -> Animal)
      const url = await generateCitySticker(city, generationCount);
      
      // Store city alongside url for filename generation
      setFreshSticker({ url, city });
      
      // Increment count so the next click gets the next category
      setGenerationCount(prev => prev + 1);
    } catch (err) {
      setError("Printer jammed! Try again.");
    } finally {
      setLoading(false);
    }
  };

  // Input Change Handler
  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setCity(e.target.value);
      // Reset the cycle when the user changes the city name
      // This ensures "New York" starts with the most iconic Landmark, not a random rat.
      setGenerationCount(0);
  };

  // Download Handler
  const downloadSticker = (url: string, cityName: string) => {
      const link = document.createElement('a');
      link.href = url;
      // Sanitize filename
      const safeCity = cityName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      link.download = `sticker-${safeCity}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // Drag Handlers
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent, type: 'fresh' | 'placed', id?: string) => {
    const { x: clientX, y: clientY } = getClientCoords(e);

    let initialItemX = 0;
    let initialItemY = 0;

    if (type === 'placed' && id) {
        const sticker = placedStickers.find(s => s.id === id);
        if (sticker) {
            initialItemX = sticker.x;
            initialItemY = sticker.y;
        }
    }

    setDragItem({
        type,
        id,
        startX: clientX,
        startY: clientY,
        initialItemX,
        initialItemY
    });
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragItem || !canvasRef.current) return;

    const { x: clientX, y: clientY } = getClientCoords(e);
    const deltaX = clientX - dragItem.startX;
    const deltaY = clientY - dragItem.startY;

    if (dragItem.type === 'placed' && dragItem.id) {
        setPlacedStickers(prev => prev.map(s => {
            if (s.id === dragItem.id) {
                return { ...s, x: dragItem.initialItemX + deltaX, y: dragItem.initialItemY + deltaY };
            }
            return s;
        }));
    }
  };

  const handleMouseUp = () => {
    setDragItem(null);
  };

  const startDragFresh = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault(); 
      if (!freshSticker || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const { x: clientX, y: clientY } = getClientCoords(e);

      // Calculate precise start position relative to canvas
      // The sticker is w-48 (192px) and centered.
      const stickerWidth = 192;
      const printerX = (rect.width / 2) - (stickerWidth / 2);
      // Visually align with where the printer head ends (~170px from top)
      const printerY = 170; 

      const newId = Date.now().toString();
      const newSticker: PlacedSticker = {
          id: newId,
          url: freshSticker.url,
          city: freshSticker.city,
          x: printerX,
          y: printerY,
          rotation: Math.random() * 10 - 5, // Slight random rotation
          scale: 1
      };

      // 1. Add to state
      setPlacedStickers(prev => [...prev, newSticker]);
      setFreshSticker(null);
      
      // 2. IMMEDIATELY start dragging with calculated coordinates
      setDragItem({
          type: 'placed',
          id: newId,
          startX: clientX,
          startY: clientY,
          initialItemX: printerX, 
          initialItemY: printerY
      });
  };

  return (
    <div 
        className="min-h-screen bg-slate-50 text-slate-800 overflow-hidden fixed inset-0 flex flex-col"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
    >
      {/* Desk Pattern Background */}
      <div className="absolute inset-0 desk-pattern pointer-events-none z-0"></div>

      {/* Canvas Area (The Desk) */}
      <div ref={canvasRef} className="relative flex-grow z-0 w-full h-full">
          
          {/* Placed Stickers */}
          {placedStickers.map(sticker => (
              <div
                key={sticker.id}
                className="absolute cursor-grab active:cursor-grabbing group"
                style={{
                    left: sticker.x,
                    top: sticker.y,
                    transform: `rotate(${sticker.rotation}deg) scale(${sticker.scale})`,
                    zIndex: dragItem?.id === sticker.id ? 100 : 10, 
                    touchAction: 'none',
                    width: '192px', // w-48
                    height: '192px'
                }}
                onMouseDown={(e) => handleMouseDown(e, 'placed', sticker.id)}
                onTouchStart={(e) => handleMouseDown(e, 'placed', sticker.id)}
              >
                 <img 
                    src={sticker.url} 
                    alt="sticker" 
                    className="w-full h-full object-contain pointer-events-none select-none transition-transform active:scale-105"
                    style={{ 
                        // Drop shadow creates the "thick paper" illusion for the die-cut sticker
                        filter: 'drop-shadow(2px 4px 3px rgba(0,0,0,0.2))'
                    }}
                    draggable={false} 
                 />
                 
                 {/* Download Button (Visible on Hover) */}
                 <button 
                    className="absolute -top-2 -right-2 bg-white text-slate-600 p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-blue-50 hover:text-blue-600 hover:scale-110 z-20"
                    title="Download Sticker"
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        downloadSticker(sticker.url, sticker.city);
                    }}
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M12 9v6m0 0 3-3m-3 3-3-3" />
                     </svg>
                 </button>
              </div>
          ))}

          {/* Instructions (if empty) */}
          {placedStickers.length === 0 && !freshSticker && !loading && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                  <h2 className="text-4xl font-black text-slate-400 -rotate-6 tracking-widest">YOUR DESK IS EMPTY</h2>
              </div>
          )}
      </div>

      {/* Printer Station (Fixed UI Layer) */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none flex justify-center z-50 pt-4">
        <div className="pointer-events-auto">
            <Printer 
                loading={loading} 
                freshSticker={freshSticker}
                onStartDragFresh={startDragFresh}
                onDownloadFresh={() => freshSticker && downloadSticker(freshSticker.url, freshSticker.city)}
            >
                <form onSubmit={handleGenerate} className="flex gap-2">
                    <input
                        type="text"
                        value={city}
                        onChange={handleCityChange}
                        placeholder="Type a city name..."
                        className="flex-grow bg-white px-3 py-2 rounded text-sm font-bold border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none uppercase tracking-wide"
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        disabled={loading || !city}
                        className={`px-4 py-2 rounded text-white font-bold text-xs uppercase tracking-wider transition-all ${loading ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-500 shadow-lg'}`}
                    >
                        {loading ? '...' : 'PRINT'}
                    </button>
                </form>
                {error && <div className="text-[10px] text-red-500 mt-1 font-bold text-center">{error}</div>}
            </Printer>
        </div>
      </div>
      
      {/* Footer/Credits */}
      <div className="absolute bottom-4 left-4 text-[10px] text-slate-400 font-mono pointer-events-none">
        POWERED BY GEMINI • DRAG TO ARRANGE • HOVER TO DOWNLOAD
      </div>

    </div>
  );
}