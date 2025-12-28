(function () {
  const root = document.documentElement;
  const scroller =
    document.querySelector(".scroll-sections") ||
    document.scrollingElement ||
    document.documentElement;

  let pinching = false;

  const onTouchStart = (e) => {
    const img = e.target.closest(".pinch-image");
    if (!img) return;

    // Only engage for an actual pinch (2+ fingers)
    if (e.touches && e.touches.length >= 2) {
      pinching = true;

      // If you have scroll-snap, disable it while pinching
      scroller.classList.add("no-snap");
    }
  };

  const onTouchMove = (e) => {
    if (!pinching) return;

    // This is the key: block scrolling while pinch is active
    e.preventDefault();
    e.stopPropagation();
  };

  const endPinchIfNeeded = (e) => {
    // If fewer than 2 touches remain, pinch is over
    if (!e.touches || e.touches.length < 2) {
      pinching = false;
      scroller.classList.remove("no-snap");
    }
  };

  document.addEventListener("touchstart", onTouchStart, { passive: true });

  // Must be passive:false or preventDefault will be ignored
  document.addEventListener("touchmove", onTouchMove, { passive: false });

  document.addEventListener("touchend", endPinchIfNeeded, { passive: true });
  document.addEventListener("touchcancel", endPinchIfNeeded, { passive: true });

  // Safety: when a second finger is added after starting with one finger
  document.addEventListener(
    "touchstart",
    (e) => {
      if (pinching) return;
      const img = e.target.closest(".pinch-image");
      if (!img) return;
      if (e.touches && e.touches.length >= 2) {
        pinching = true;
        scroller.classList.add("no-snap");
      }
    },
    { passive: true }
  );
})();
