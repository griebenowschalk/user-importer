import "@testing-library/jest-dom/vitest";

// jsdom pointer events polyfills for Radix UI components
if (!(HTMLElement.prototype as any).hasPointerCapture) {
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    value: () => false,
    configurable: true,
  });
}
if (!(HTMLElement.prototype as any).releasePointerCapture) {
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
    value: () => {},
    configurable: true,
  });
}
if (!(Element.prototype as any).scrollIntoView) {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    value: () => {},
    configurable: true,
  });
}

// ResizeObserver mock for jsdom
if (!(global as any).ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (global as any).ResizeObserver =
    ResizeObserverMock as unknown as typeof ResizeObserver;
}
