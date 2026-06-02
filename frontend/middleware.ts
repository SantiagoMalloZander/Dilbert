import { proxy } from "./src/proxy";

export const runtime = "edge";

export function middleware(request: Parameters<typeof proxy>[0]) {
  return proxy(request);
}

export const config = {
  // Skip Next internals, the favicon, and any request for a static asset with a
  // file extension (svg/png/woff/css/js/landing.html…). Those don't need auth
  // and were needlessly running the (Oregon-bound) middleware on every page.
  matcher: [
    "/((?!_next/static|_next/image|_next/data|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|otf|css|js|map|txt|xml|html)$).*)",
  ],
};
