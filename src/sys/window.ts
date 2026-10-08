export const kWindowEventKeyUp = 'keyup';
export const kWindowEventKeyDown = 'keydown';
export const kWindowEventPointerDown = 'pointerdown';
export const kWindowEventPointerUp = 'pointerup';
export const kWindowEventClick = 'click';
export const kWindowEventResize = 'resize';
export const kWindowEventFocus = 'focus';
export const kWindowEventBlur = 'blur';

export const windowAddEventListener = <K extends keyof WindowEventMap>(
  type: K, listener: (this: Window, ev: WindowEventMap[K]) => any, options?: boolean | AddEventListenerOptions
) => {
  window.addEventListener(type, listener, options);
};

export const windowRemoveEventListener = <K extends keyof WindowEventMap>(
  type: K, listener: (this: Window, ev: WindowEventMap[K]) => any, options?: boolean | EventListenerOptions
) => {
  window.removeEventListener(type, listener, options);
};

export const windowIsMobile = () => {
  // Prefer the modern high-entropy hint when available.
  const mobileHint = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile;
  if (typeof mobileHint === 'boolean') return mobileHint;

  // Fallback to classic user-agent detection for older browsers.
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) return true;

  // Treat touch-first, small-screen devices as mobile-like.
  return navigator.maxTouchPoints > 0 && Math.min(window.innerWidth, window.innerHeight) <= 900;
};
