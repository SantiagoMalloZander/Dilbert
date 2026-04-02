const GLOBAL_TOAST_EVENT = "dilbert:global-toast";

export type GlobalToastPayload = {
  tone?: "error" | "success";
  text: string;
};

export function emitGlobalToast(payload: GlobalToastPayload) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(GLOBAL_TOAST_EVENT, {
      detail: payload,
    })
  );
}

export function onGlobalToast(handler: (payload: GlobalToastPayload) => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<GlobalToastPayload>;
    if (customEvent.detail?.text) {
      handler(customEvent.detail);
    }
  };

  window.addEventListener(GLOBAL_TOAST_EVENT, listener);
  return () => window.removeEventListener(GLOBAL_TOAST_EVENT, listener);
}
