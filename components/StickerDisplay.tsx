import React from 'react';

interface StickerDisplayProps {
  imageUrl: string;
  isPrinting: boolean;
}

export const StickerDisplay: React.FC<StickerDisplayProps> = ({ imageUrl, isPrinting }) => {
  return (
    <div className={`
      relative bg-white p-4 shadow-xl rounded-b-lg border-x border-b border-gray-200
      transition-all duration-700 ease-out origin-top
      ${isPrinting ? 'animate-print' : ''}
    `}>
      {/* Perforation line at the top */}
      <div className="absolute top-0 left-0 right-0 h-4 w-full border-b-2 border-dashed border-gray-300"></div>
      
      <div className="mt-4 flex flex-col items-center">
        <div className="relative group cursor-pointer overflow-hidden rounded-lg">
          {/* The Sticker Image */}
          <img 
            src={imageUrl} 
            alt="Generated Sticker" 
            className="w-64 h-64 object-contain drop-shadow-2xl transform transition-transform duration-300 group-hover:scale-105"
          />
          
          {/* Shine effect overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </div>
        
        <p className="text-gray-400 text-xs font-mono mt-4 text-center">
           PREMIUM GLOSSY FINISH • {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};