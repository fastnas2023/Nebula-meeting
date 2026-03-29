import { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type VideoTileMode = 'grid' | 'fullscreen' | 'exiting';

type Props = {
  tileId: string;
  mode: VideoTileMode;
  portalTarget: HTMLElement | null;
  title: ReactNode;
  topLeftExtra?: ReactNode;
  topRightControls?: ReactNode;
  controlsAlwaysVisible?: boolean;
  compactMobile?: boolean;
  children: ReactNode;
};

export default function VideoTile({
  tileId,
  mode,
  portalTarget,
  title,
  topLeftExtra,
  topRightControls,
  controlsAlwaysVisible = false,
  compactMobile = false,
  children,
}: Props) {
  const window = (
    <div
      className={[
        compactMobile
          ? 'meeting-window relative bg-black overflow-hidden border border-gray-900 shadow-lg flex flex-col aspect-video max-h-[calc(100vh-160px)]'
          : 'meeting-window relative bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 shadow-xl flex flex-col group aspect-video max-h-[calc(100vh-160px)]',
        mode === 'fullscreen' ? 'meeting-window--fullscreen' : '',
        mode === 'exiting' ? 'meeting-window--exiting' : '',
      ].join(' ')}
      data-mode={mode}
      data-tile-id={tileId}
    >
      <div className={compactMobile
        ? 'absolute top-3 left-3 z-10 bg-black/70 px-2.5 py-1 rounded-md border border-white/10 flex items-center gap-2'
        : 'absolute top-4 left-4 z-10 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2'}
      >
        <span className="text-xs font-medium text-white">{title}</span>
        {topLeftExtra}
      </div>

      {topRightControls && (
        <div
          className={[
            compactMobile
              ? 'absolute top-3 right-3 z-20 flex gap-2'
              : 'absolute top-4 right-4 z-20 flex gap-2 transition-all',
            controlsAlwaysVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          ].join(' ')}
        >
          {topRightControls}
        </div>
      )}

      <div className={compactMobile
        ? 'flex-1 relative flex items-center justify-center bg-black overflow-hidden'
        : 'flex-1 relative flex items-center justify-center bg-gray-950 overflow-hidden'}
      >
        {children}
      </div>
    </div>
  );

  if ((mode === 'fullscreen' || mode === 'exiting') && portalTarget) {
    return (
      <>
        <div className={compactMobile
          ? 'relative bg-black overflow-hidden border border-gray-900 shadow-lg flex flex-col aspect-video max-h-[calc(100vh-160px)]'
          : 'relative bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 shadow-xl flex flex-col aspect-video max-h-[calc(100vh-160px)]'}
        />
        {createPortal(window, portalTarget)}
      </>
    );
  }

  return window;
}
