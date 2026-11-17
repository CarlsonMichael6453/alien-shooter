/** Stop the mobile browser from scrolling, zooming, or selecting while the game is open. */
export function installWebGestureLock(): () => void {
  const previousOverflow = document.documentElement.style.overflow;
  const targets = [document.documentElement, document.body, document.getElementById('root')].filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  );
  const snapshots = targets.map((element) => ({
    element,
    touchAction: element.style.touchAction,
    overflow: element.style.overflow,
    overscrollBehavior: element.style.overscrollBehavior,
    userSelect: element.style.userSelect,
    background: element.style.background,
  }));

  for (const element of targets) {
    element.style.touchAction = 'none';
    element.style.overflow = 'hidden';
    element.style.overscrollBehavior = 'none';
    element.style.userSelect = 'none';
    element.style.background = '#070B14';
    element.style.setProperty('-webkit-user-select', 'none');
    element.style.setProperty('-webkit-touch-callout', 'none');
    element.style.setProperty('-webkit-tap-highlight-color', 'transparent');
  }
  document.documentElement.style.overflow = 'hidden';

  let viewport = document.querySelector('meta[name="viewport"]');
  const createdViewport = !viewport;
  const previousViewport = viewport?.getAttribute('content') ?? null;
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    document.head.appendChild(viewport);
  }
  viewport.setAttribute(
    'content',
    'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
  );

  const block = (event: Event) => {
    if (event.cancelable) event.preventDefault();
  };
  document.addEventListener('gesturestart', block, { passive: false });
  document.addEventListener('gesturechange', block, { passive: false });
  document.addEventListener('gestureend', block, { passive: false });

  return () => {
    document.documentElement.style.overflow = previousOverflow;
    for (const snap of snapshots) {
      snap.element.style.touchAction = snap.touchAction;
      snap.element.style.overflow = snap.overflow;
      snap.element.style.overscrollBehavior = snap.overscrollBehavior;
      snap.element.style.userSelect = snap.userSelect;
      snap.element.style.background = snap.background;
    }
    if (viewport) {
      if (createdViewport) viewport.remove();
      else if (previousViewport != null) viewport.setAttribute('content', previousViewport);
    }
    document.removeEventListener('gesturestart', block);
    document.removeEventListener('gesturechange', block);
    document.removeEventListener('gestureend', block);
  };
}
