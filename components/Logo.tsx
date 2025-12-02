
import React from 'react';

export const Logo: React.FC = () => {
  return (
    <div className="flex items-center gap-2 select-none">
      <div className="text-white text-right leading-none flex flex-col items-end justify-center">
        <div className="text-[10px] uppercase tracking-widest font-light text-gray-400 mb-[2px]">Now</div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tracking-tight text-white">Get</span>
          <span className="text-2xl font-light text-white">Design</span>
        </div>
        <div className="text-[10px] text-brand-green tracking-wide mt-[2px]">www.getdesign.cloud</div>
      </div>
      {/* Play Button Icon */}
      <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-lg ml-1">
        <path d="M8 8 L32 20 L8 32 Z" fill="#7bc143" stroke="#7bc143" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
};