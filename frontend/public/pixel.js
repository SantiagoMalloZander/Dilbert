/* Meta Pixel — solo en páginas públicas (landing / comofunciona / precio).
   Para activarlo: pegá tu Pixel ID (15-16 dígitos) abajo y redeploy.
   Mientras esté vacío, no carga nada (queda inerte). */
(function () {
  var META_PIXEL_ID = ""; // <-- PEGAR EL PIXEL ID ACÁ

  if (!META_PIXEL_ID) return;

  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

  window.fbq("init", META_PIXEL_ID);
  window.fbq("track", "PageView");
})();
