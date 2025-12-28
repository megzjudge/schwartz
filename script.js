(function () {
  function initPinchGuard() {
    // Prefer your actual snapping scroll container here.
    // If you don't have one, fall back to the document scroller.
    const scroller =
      document.querySelector(".scroll-sections") ||
      document.scrollingElement ||
      document.documentElement;

    let pinching = false;

    document.addEventListener(
      "touchstart",
      (e) => {
        const img = e.target.closest(".pinch-image");
        if (!img) return;

        if (e.touches && e.touches.length > 1) {
          pinching = true;
          scroller.classList.add("no-snap");
        }
      },
      { passive: true }
    );

    document.addEventListener(
      "touchmove",
      (e) => {
        if (!pinching) return;

        // Only block moves that started on the image; pinch gestures create tiny scroll deltas
        e.preventDefault();
        e.stopPropagation();
      },
      { passive: false }
    );

    document.addEventListener(
      "touchend",
      (e) => {
        if (pinching && (!e.touches || e.touches.length < 2)) {
          pinching = false;
          scroller.classList.remove("no-snap");
        }
      },
      { passive: true }
    );

    document.addEventListener(
      "touchcancel",
      () => {
        if (!pinching) return;
        pinching = false;
        scroller.classList.remove("no-snap");
      },
      { passive: true }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPinchGuard);
  } else {
    initPinchGuard();
  }
})();
