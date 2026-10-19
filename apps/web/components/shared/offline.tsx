"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ConnectionStatus } from "@/lib/yjs/hooks";

/** The yellow strip under the top bar while offline (boards and documents). */
export function OfflineBanner() {
  return (
    <div className="shrink-0 border-b border-yellow-200 bg-yellow-50 px-4 py-1.5 text-center text-sm text-yellow-900">
      You&rsquo;re offline – changes are saved on this device and will sync when
      you&rsquo;re back online.
    </div>
  );
}

/** "Back online" once we reconnect after being offline and everything has synced. */
export function useBackOnlineToast(status: ConnectionStatus, saving: boolean) {
  const wasOffline = useRef(false);
  useEffect(() => {
    if (status === "offline") wasOffline.current = true;
    else if (status === "connected" && !saving && wasOffline.current) {
      wasOffline.current = false;
      toast.success("Back online – changes synced");
    }
  }, [status, saving]);
}
