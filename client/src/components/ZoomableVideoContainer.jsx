import { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

const ZoomableVideoContainer = ({ children, initialZoom = 1, minZoom = 0.5, maxZoom = 3.0, step = 0.1 }) => {
  const [zoom, setZoom] = useState(initialZoom);
  const [isHovered, setIsHovered] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const containerRef = useRef(null);
  
  // Touch state
  const touchStartDist = useRef(null);
  const startZoom = useRef(1);

  const handleZoomIn = (e) => {
    e.stopPropagation();
    setZoom(prev => Math.min(Number((prev + step).toFixed(1)), maxZoom));
  };

  const handleZoomOut = (e) => {
    e.stopPropagation();
    setZoom(prev => Math.max(Number((prev - step).toFixed(1)), minZoom));
  };

  const handleReset = (e) => {
    e.stopPropagation();
    setZoom(initialZoom);
  };

  const handleDoubleClick = (e) => {
    if (isTouchDevice) return;
    e.stopPropagation();
    setZoom(prev => (prev > 1.0 ? 1.0 : 2.0)); // Toggle between 1x and 2x
  };

  // Touch Handlers for Pinch-to-Zoom
  const handleTouchStart = (e) => {
    if (isTouchDevice) return;
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      touchStartDist.current = dist;
      startZoom.current = zoom;
    }
  };

  const handleTouchMove = (e) => {
    if (isTouchDevice) return;
    if (e.touches.length === 2 && touchStartDist.current !== null) {
      e.preventDefault(); // Prevent page scroll while pinching
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      
      const scaleFactor = dist / touchStartDist.current;
      const newZoom = Math.min(Math.max(startZoom.current * scaleFactor, minZoom), maxZoom);
      
      setZoom(newZoom);
    }
  };

  const handleTouchEnd = () => {
    touchStartDist.current = null;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)')
      : null;

    const updateTouchMode = () => {
      const coarsePointer = !!mediaQuery?.matches;
      const touchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0;
      const nextIsTouch = coarsePointer || touchPoints > 0;
      setIsTouchDevice(nextIsTouch);
      if (nextIsTouch) {
        setZoom(1);
      }
    };

    updateTouchMode();
    mediaQuery?.addEventListener?.('change', updateTouchMode);

    return () => {
      mediaQuery?.removeEventListener?.('change', updateTouchMode);
    };
  }, []);

  // Prevent wheel scroll propagation when hovering
  useEffect(() => {
    const element = containerRef.current;
    if (!element || isTouchDevice) return;

    const onWheel = (e) => {
        // Only intercept if we are hovering
        if (isHovered) {
            e.preventDefault();
            
            // Normalize delta
            const delta = e.deltaY * -0.001 * 1.5; 
            
            setZoom(prev => {
                const newZoom = prev + delta;
                return Math.min(Math.max(newZoom, minZoom), maxZoom);
            });
        }
    };

    // Add non-passive event listener to prevent default scrolling
    element.addEventListener('wheel', onWheel, { passive: false });
    
    return () => {
        element.removeEventListener('wheel', onWheel);
    };
  }, [isHovered, minZoom, maxZoom, isTouchDevice]);

  if (isTouchDevice) {
    return (
      <div className="relative w-full h-full overflow-hidden">
        <div className="w-full h-full flex items-center justify-center">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative w-full h-full overflow-hidden group touch-none select-none"
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={handleDoubleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        className="w-full h-full origin-center flex items-center justify-center transition-transform duration-200 ease-out"
        style={zoom === 1 ? undefined : { transform: `scale(${zoom})`, willChange: 'transform' }}
      >
        {children}
      </div>
      
      {/* Controls Overlay */}
      <div 
        className={`absolute bottom-4 right-4 flex items-center gap-1 bg-black/60 backdrop-blur-sm p-1.5 rounded-lg border border-white/10 transition-all duration-300 z-20 ${
            (isHovered || zoom !== 1) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()} // Prevent click through
      >
         <span className="text-white text-[10px] font-mono font-medium px-2 min-w-[3rem] text-center select-none">
            {Math.round(zoom * 100)}%
         </span>
         
         <div className="w-px h-4 bg-white/20 mx-1"></div>

         <button 
            onClick={handleZoomOut} 
            className="p-1.5 hover:bg-white/20 rounded-md text-white transition-colors disabled:opacity-50"
            disabled={zoom <= minZoom}
            title="Zoom Out"
         >
            <ZoomOut size={14}/>
         </button>
         
         <button 
            onClick={handleReset} 
            className="p-1.5 hover:bg-white/20 rounded-md text-white transition-colors"
            title="Reset Zoom"
         >
            <RotateCcw size={14}/>
         </button>
         
         <button 
            onClick={handleZoomIn} 
            className="p-1.5 hover:bg-white/20 rounded-md text-white transition-colors disabled:opacity-50"
            disabled={zoom >= maxZoom}
            title="Zoom In"
         >
            <ZoomIn size={14}/>
         </button>
      </div>
    </div>
  );
};

export default ZoomableVideoContainer;
