(function () {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("__access")) {
      url.searchParams.delete("__access");
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
  } catch (error) {
    console.error("Secure access URL cleanup failed:", error);
  }
})();
