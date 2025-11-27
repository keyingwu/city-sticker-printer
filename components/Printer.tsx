import React from 'react';

interface PrinterProps {
  loading: boolean;
  children?: React.ReactNode; // The content (form/inputs) inside the printer interface
  freshSticker: { url: string, city: string } | null;
  onStartDragFresh: (e: React.MouseEvent | React.TouchEvent) => void;
  onDownloadFresh: () => void;
}

export const Printer: React.FC<PrinterProps> = ({ loading, children, freshSticker, onStartDragFresh, onDownloadFresh }) => {
  return (
    <div className="relative w-full max-w-lg mx-auto z-50 select-none">
      
      {/* Printer Top Body (The "Head") - High Z-index to cover the paper origin */}
      <div className="relative z-20 bg-slate-800 rounded-t-[2rem] shadow-2xl border-b-[10px] border-slate-900 overflow-hidden">
        {/* Status Light & Branding */}
        <div className="h-20 flex items-center justify-between px-6 bg-slate-800">
           <div className="flex items-center gap-3">
             <div className={`w-5 h-5 rounded-full shadow-inner ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)]'}`}></div>
             <span className="text-xs font-mono text-slate-400 tracking-widest font-bold">
               {loading ? 'PRINTING...' : 'READY'}
             </span>
           </div>
           <div className="text-slate-600 font-black italic opacity-30 text-2xl tracking-tighter">STICKER-MATIC</div>
        </div>

        {/* Input Area (The "Screen" of the printer) */}
        <div className="bg-slate-100 p-6 border-y border-slate-300 shadow-inner">
            {children}
        </div>

        {/* The Extrusion Slot */}
        <div className="h-6 bg-slate-900 relative">
           <div className="absolute bottom-0 left-6 right-6 h-3 bg-black rounded-full opacity-50"></div>
        </div>
      </div>

      {/* The Hanging Area - Lower Z-index so it comes "out" from behind/under the top body */}
      <div className="relative z-10 flex justify-center -mt-3 perspective-1000">
        
        {freshSticker && (
             <div 
                className="relative cursor-grab active:cursor-grabbing hover:scale-105 transition-transform origin-top group"
                onMouseDown={onStartDragFresh}
                onTouchStart={onStartDragFresh}
                style={{
                    animation: 'print-emerge 2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards'
                }}
             >
                {/* The "Sticker" itself - Now opaque with true die-cut transparency */}
                <img 
                    src={freshSticker.url} 
                    alt="Fresh Sticker" 
                    className="w-64 h-64 object-contain pointer-events-none select-none" 
                    style={{ 
                        // Drop-shadow makes white border visible
                        filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))' 
                    }}
                    draggable={false}
                />
                
                <div className="absolute -bottom-8 left-0 right-0 flex justify-center gap-2 animate-bounce">
                    <span className="text-[10px] text-slate-400 font-mono bg-white/90 border border-slate-200 px-2 py-1 rounded-full shadow-sm">
                        DRAG ME
                    </span>
                </div>

                {/* Quick Download Button for fresh sticker */}
                <button 
                    className="absolute top-4 right-4 w-10 h-10 bg-white/90 hover:bg-blue-50 text-slate-600 rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    title="Download Now"
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        onDownloadFresh();
                    }}
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M12 9v6m0 0 3-3m-3 3-3-3" />
                     </svg>
                 </button>
             </div>
        )}
      </div>

      <style>{`
        @keyframes print-emerge {
            0% { transform: translateY(-90%); opacity: 0; }
            10% { opacity: 1; }
            100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};