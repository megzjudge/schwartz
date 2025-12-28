(function () {
  const scroller =
    document.querySelector(".scroll-sections") ||
    document.scrollingElement ||
    document.documentElement;

  // Add a small tolerance because some browsers report 0.999 / 1.001
  const EPS = 0.01;

  function isZoomed() {
    if (!window.visualViewport) return false;
    return Math.abs(window.visualViewport.scale - 1) > EPS;
  }

  function syncZoomState() {
    scroller.classList.toggle("zoomed", isZoomed());
  }

  // Initial
  syncZoomState();

  // visualViewport fires on pinch-zoom changes
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncZoomState);
    window.visualViewport.addEventListener("scroll", syncZoomState);
  }

  // Fallback events (some Android browsers)
  window.addEventListener("resize", syncZoomState);
})();
