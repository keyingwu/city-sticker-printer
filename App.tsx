import React, { useState, useRef } from 'react';
import { generateCitySticker } from './services/geminiService';
import { Printer } from './components/Printer';
import { PlacedSticker, DragItem } from './types';
import JSZip from 'jszip';

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
  const [isZipping, setIsZipping] = useState(false);
  
  // Generation Logic State
  // We track how many times we've printed for the current input to cycle through categories
  const [generationCount, setGenerationCount] = useState(0);
  
  // History State: Tracks concepts generated for the current city to avoid repetition
  const [conceptHistory, setConceptHistory] = useState<string[]>([]);
  
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
      // Step 1 & 2: Call service with history
      const { imageUrl, concept } = await generateCitySticker(city, generationCount, conceptHistory);
      
      // Store city alongside url for filename generation
      setFreshSticker({ url: imageUrl, city });
      
      // Increment count so the next click gets the next aspect category
      setGenerationCount(prev => prev + 1);
      
      // Add the new concept to history so we don't generate it again
      setConceptHistory(prev => [...prev, concept]);
      
    } catch (err) {
      console.error(err);
      setError("Printer jammed! Try again.");
    } finally {
      setLoading(false);
    }
  };

  // Input Change Handler
  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setCity(e.target.value);
      // Reset the cycle and history when the user changes the city name
      setGenerationCount(0);
      setConceptHistory([]);
  };

  // Download Handler (Single)
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

  // Download Handler (ZIP)
  const handleDownloadAll = async () => {
      if (placedStickers.length === 0) return;
      setIsZipping(true);
      try {
          const zip = new JSZip();
          const folder = zip.folder("my-stickers");

          if (!folder) return;

          placedStickers.forEach((sticker, index) => {
              // sticker.url is "data:image/png;base64,..."
              // We need to strip the prefix to get the raw base64 string
              const base64Data = sticker.url.split(',')[1];
              const safeCity = sticker.city.replace(/[^a-z0-9]/gi, '-').toLowerCase();
              const fileName = `sticker-${safeCity}-${index + 1}.png`;
              
              folder.file(fileName, base64Data, { base64: true });
          });

          const content = await zip.generateAsync({ type: "blob" });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(content);
          link.download = `sticker-collection-${Date.now()}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } catch (e) {
          console.error("Failed to zip stickers", e);
          setError("Could not zip files.");
      } finally {
          setIsZipping(false);
      }
  };

  // Delete Handler
  const deleteSticker = (id: string) => {
      setPlacedStickers(prev => prev.filter(sticker => sticker.id !== id));
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
      // Updated for smaller 256px sticker
      const stickerWidth = 256;
      const printerX = (rect.width / 2) - (stickerWidth / 2);
      // Adjusted printerY for the compact printer head (approx 220px down)
      const printerY = 220; 

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
                    width: '256px', // w-64 (256px)
                    height: '256px'
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
                        filter: 'drop-shadow(2px 4px 5px rgba(0,0,0,0.25))'
                    }}
                    draggable={false} 
                 />
                 
                 {/* Delete Button (Visible on Hover - Top Left) */}
                 <button 
                    className="absolute -top-3 -left-3 bg-white text-slate-400 p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-50 hover:text-red-600 hover:scale-110 z-20"
                    title="Delete Sticker"
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        deleteSticker(sticker.id);
                    }}
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                     </svg>
                 </button>

                 {/* Download Button (Visible on Hover - Top Right) */}
                 <button 
                    className="absolute -top-3 -right-3 bg-white text-slate-600 p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-blue-50 hover:text-blue-600 hover:scale-110 z-20"
                    title="Download Sticker"
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        downloadSticker(sticker.url, sticker.city);
                    }}
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M12 9v6m0 0 3-3m-3 3-3-3" />
                     </svg>
                 </button>
              </div>
          ))}

          {/* Instructions (if empty) */}
          {placedStickers.length === 0 && !freshSticker && !loading && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 mt-64">
                  <h2 className="text-5xl font-black text-slate-400 -rotate-6 tracking-widest text-center">
                    YOUR DESK<br/>IS EMPTY
                  </h2>
              </div>
          )}
      </div>

      {/* Printer Station (Fixed UI Layer) */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none flex justify-center z-50 pt-4">
        <div className="pointer-events-auto w-full px-4">
            <Printer 
                loading={loading} 
                freshSticker={freshSticker}
                onStartDragFresh={startDragFresh}
                onDownloadFresh={() => freshSticker && downloadSticker(freshSticker.url, freshSticker.city)}
            >
                <form onSubmit={handleGenerate} className="flex gap-3">
                    <input
                        type="text"
                        value={city}
                        onChange={handleCityChange}
                        placeholder="TYPE CITY..."
                        className="flex-grow bg-white px-5 py-3 rounded-lg text-xl font-bold border-2 border-slate-300 focus:ring-4 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none uppercase tracking-wide placeholder-slate-300 text-slate-700"
                        disabled={loading}
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={loading || !city}
                        className={`px-6 py-3 rounded-lg text-white font-black text-lg uppercase tracking-widest transition-all transform active:scale-95 ${loading ? 'bg-slate-400 shadow-none cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 shadow-xl hover:shadow-2xl hover:-translate-y-1'}`}
                    >
                        {loading ? '...' : 'PRINT'}
                    </button>
                </form>
                {error && <div className="text-xs text-red-500 mt-2 font-bold text-center tracking-wide">{error}</div>}
            </Printer>
        </div>
      </div>
      
      {/* Footer/Credits */}
      <div className="absolute bottom-4 left-4 text-xs text-slate-400 font-mono pointer-events-none opacity-60">
        POWERED BY GEMINI • DRAG TO ARRANGE • HOVER TO DOWNLOAD
      </div>

      {/* Download All Button */}
      {placedStickers.length > 0 && (
          <button 
              onClick={handleDownloadAll}
              disabled={isZipping}
              className="absolute bottom-4 right-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-full shadow-xl hover:shadow-2xl hover:-translate-y-1 active:scale-95 transition-all flex items-center gap-2 z-50 disabled:bg-slate-400"
          >
              {isZipping ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    ZIPPING...
                  </>
              ) : (
                  <>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M12 9v6m0 0 3-3m-3 3-3-3" />
                      </svg>
                      DOWNLOAD ALL ({placedStickers.length})
                  </>
              )}
          </button>
      )}

    </div>
  );
}