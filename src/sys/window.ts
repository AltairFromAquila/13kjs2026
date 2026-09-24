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
