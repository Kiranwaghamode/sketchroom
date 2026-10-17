"use client";

import { useEffect, useMemo, useRef } from "react";
import { worldToScreen, type Point } from "@/lib/geometry";
import type { Awareness, PresenceState } from "@/lib/presence";
import { useStore, type Store } from "@/lib/yjs/hooks";
import { useEditor } from "@/stores/editor";

/** Fraction of the remaining distance a cursor moves each frame (simple lerp). */
const SMOOTHING = 0.3;

type RemoteCursor = { clientId: number; name: string; color: string };

function remoteCursors(awareness: Awareness): RemoteCursor[] {
  const list: RemoteCursor[] = [];
  for (const [clientId, state] of awareness.getStates() as Map<
    number,
    PresenceState
  >) {
    if (clientId === awareness.clientID || !state.user || !state.cursor)
      continue;
    list.push({ clientId, name: state.user.name, color: state.user.color });
  }
  return list;
}

function cursorListStore(awareness: Awareness): Store<RemoteCursor[]> {
  let snapshot = remoteCursors(awareness);
  let key = JSON.stringify(snapshot);
  return {
    subscribe(onChange) {
      // Re-render only when cursors appear/disappear (not on every move).
      const handler = () => {
        const next = remoteCursors(awareness);
        const nextKey = JSON.stringify(next);
        if (nextKey === key) return;
        snapshot = next;
        key = nextKey;
        onChange();
      };
      handler();
      awareness.on("change", handler);
      return () => awareness.off("change", handler);
    },
    get: () => snapshot,
  };
}

/** Other people's cursors with name labels, drawn over the canvas. */
export function Cursors({ awareness }: { awareness: Awareness }) {
  const cursors = useStore(
    useMemo(() => cursorListStore(awareness), [awareness]),
  );
  const elements = useRef(new Map<number, HTMLDivElement>());

  useEffect(() => {
    const shown = new Map<number, Point>(); // smoothed world positions
    let frame = 0;
    const tick = () => {
      const camera = useEditor.getState().camera;
      const states = awareness.getStates() as Map<number, PresenceState>;
      for (const [clientId, el] of elements.current) {
        const target = states.get(clientId)?.cursor;
        if (!target) {
          shown.delete(clientId);
          continue;
        }
        const current = shown.get(clientId) ?? target;
        const next = {
          x: current.x + (target.x - current.x) * SMOOTHING,
          y: current.y + (target.y - current.y) * SMOOTHING,
        };
        shown.set(clientId, next);
        const screen = worldToScreen(next, camera);
        el.style.transform = `translate(${screen.x}px, ${screen.y}px)`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [awareness]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {cursors.map(({ clientId, name, color }) => (
        <div
          key={clientId}
          ref={(el) => {
            if (el) elements.current.set(clientId, el);
            else elements.current.delete(clientId);
          }}
          className="absolute top-0 left-0 will-change-transform"
          style={{ transform: "translate(-100px, -100px)" }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            className="drop-shadow-sm"
          >
            <path
              d="M2 1.5 L15.5 8.5 L9 10 L6.2 16.2 Z"
              fill={color}
              stroke="white"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="absolute top-4 left-3 rounded-md px-1.5 py-0.5 text-xs whitespace-nowrap text-white shadow-sm"
            style={{ backgroundColor: color }}
          >
            {name}
          </span>
        </div>
      ))}
    </div>
  );
}
