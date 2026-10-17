"use client";

import { DEFAULT_FONT_SIZE, type Shape } from "@whiteboard/shared";
import type Konva from "konva";
import { useCallback, useEffect, useRef, useState } from "react";
import { Ellipse, Group, Layer, Rect, Stage, Transformer } from "react-konva";
import type * as Y from "yjs";
import {
  boxFromPoints,
  boxesIntersect,
  screenToWorld,
  shapeBounds,
  type Box,
  type Point,
} from "@/lib/geometry";
import type { Awareness } from "@/lib/presence";
import { useShapeIds } from "@/lib/yjs/hooks";
import {
  createShape,
  deleteShapes,
  updateShape,
  updateShapes,
} from "@/lib/yjs/mutations";
import { getOrder, getShapes } from "@/lib/yjs/schema";
import { beginGesture, endGesture } from "@/lib/yjs/undo";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  useEditor,
  type Camera,
  type Tool,
} from "@/stores/editor";
import {
  CANVAS_FONT,
  PenPath,
  ShapeRenderer,
  TEXT_LINE_HEIGHT,
} from "./ShapeRenderer";

const DEFAULT_BOX = { width: 120, height: 80 };
const DEFAULT_TEXT_WIDTH = 240;
const CLICK_DISTANCE = 4; // screen px: below this, a drag counts as a click
const MOVE_WRITE_INTERVAL = 30; // ms between Y.Doc writes while dragging
const CURSOR_INTERVAL = 50; // ms between cursor (awareness) updates
const ACCENT = "#1971c2";

type Gesture =
  | { kind: "pan"; startScreen: Point; startCamera: Camera }
  | {
      kind: "move";
      startScreen: Point;
      startWorld: Point;
      origins: Map<string, Point>;
      lastWrite: number;
      moved: boolean;
      clickedId: string;
    }
  | { kind: "marquee"; startWorld: Point; additive: boolean; base: string[] }
  | {
      kind: "create";
      type: "rect" | "ellipse";
      startScreen: Point;
      startWorld: Point;
    }
  | { kind: "pen"; origin: Point; points: number[] };

type Preview =
  | { kind: "marquee"; box: Box }
  | { kind: "rect" | "ellipse"; box: Box }
  | { kind: "pen"; origin: Point; points: number[] };

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));
const round = (v: number) => Math.round(v * 100) / 100;

function readShape(doc: Y.Doc, id: string): Shape | null {
  return (getShapes(doc).get(id)?.toJSON() as Shape | undefined) ?? null;
}

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable)
  );
}

/** Zooms to `zoom`, keeping the world point under `screen` fixed. */
function zoomAt(camera: Camera, screen: Point, zoom: number): Camera {
  const next = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
  const world = screenToWorld(screen, camera);
  return {
    x: screen.x - world.x * next,
    y: screen.y - world.y * next,
    zoom: next,
  };
}

/**
 * `readOnly` (viewers): pan and zoom only. The sync server enforces it too.
 * `awareness`: where this user's cursor is published for others.
 */
type Props = {
  doc: Y.Doc;
  userId: string;
  readOnly?: boolean;
  awareness?: Awareness;
  /** My undo history (not for viewers). */
  undoManager?: Y.UndoManager;
};

export default function Canvas({
  doc,
  userId,
  readOnly = false,
  awareness,
  undoManager,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const spaceRef = useRef(false);
  const cursorRef = useRef<{
    lastSent: number;
    timer: number | null;
    latest: Point | null;
  }>({
    lastSent: 0,
    timer: null,
    latest: null,
  });

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);

  const tool = useEditor((s) => s.tool);
  const camera = useEditor((s) => s.camera);
  const selectedIds = useEditor((s) => s.selectedIds);
  const color = useEditor((s) => s.color);
  const shapeIds = useShapeIds(doc);

  // Pointer position relative to the canvas container.
  const toScreen = useCallback(
    (e: { clientX: number; clientY: number }): Point => {
      const rect = containerRef.current!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [],
  );

  // ---- Resize with the window ---------------------------------------------
  useEffect(() => {
    const el = containerRef.current!;
    const observer = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ---- Zoom (Ctrl/⌘ + wheel, trackpad pinch) and pan (wheel) --------------
  useEffect(() => {
    const el = containerRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); // stop browser zoom and page scroll
      const { camera, setCamera } = useEditor.getState();
      const scale = e.deltaMode === 1 ? 16 : 1; // Firefox may report lines
      if (e.ctrlKey || e.metaKey) {
        const delta = clamp(e.deltaY * scale, -20, 20);
        setCamera(
          zoomAt(camera, toScreen(e), camera.zoom * Math.exp(-delta * 0.01)),
        );
      } else {
        setCamera({
          ...camera,
          x: camera.x - e.deltaX * scale,
          y: camera.y - e.deltaY * scale,
        });
      }
    };
    // Safari reports trackpad pinch as gesture events instead of ctrl + wheel.
    let gestureStartZoom = 1;
    type GestureEvent = UIEvent & {
      scale: number;
      clientX: number;
      clientY: number;
    };
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gestureStartZoom = useEditor.getState().camera.zoom;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const g = e as GestureEvent;
      const { camera, setCamera } = useEditor.getState();
      setCamera(zoomAt(camera, toScreen(g), gestureStartZoom * g.scale));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGestureStart);
    el.addEventListener("gesturechange", onGestureChange);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
    };
  }, [toScreen]);

  // ---- Keyboard shortcuts ---------------------------------------------------
  useEffect(() => {
    const toolKeys: Record<string, Tool> = {
      v: "select",
      r: "rect",
      o: "ellipse",
      t: "text",
      p: "pen",
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const { selectedIds, setSelection, setTool } = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (e.key === " ") {
        e.preventDefault(); // don't scroll the page
        if (!spaceRef.current) {
          spaceRef.current = true;
          setSpaceDown(true);
        }
        return;
      }
      if (readOnly) return;
      if (mod && (key === "z" || key === "y")) {
        e.preventDefault();
        if (key === "y" || e.shiftKey) undoManager?.redo();
        else undoManager?.undo();
        return; // selected ids that no longer exist are dropped by the effect below
      }
      if (mod && key === "a") {
        e.preventDefault();
        setTool("select");
        setSelection(getOrder(doc).toArray());
        return;
      }
      if (mod || e.altKey) return;

      const nextTool = toolKeys[key];
      if (nextTool) {
        setTool(nextTool);
        if (nextTool !== "select") setSelection([]);
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedIds.length > 0
      ) {
        e.preventDefault();
        deleteShapes(doc, selectedIds);
        setSelection([]);
      } else if (e.key === "Escape") {
        setSelection([]);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") {
        spaceRef.current = false;
        setSpaceDown(false);
      }
    };
    const onBlur = () => {
      spaceRef.current = false;
      setSpaceDown(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [doc, readOnly, undoManager]);

  // ---- Keep the Transformer attached to the selected shapes ----------------
  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;
    const selected = new Set(editingId ? [] : selectedIds);
    const nodes = stage.find(
      (node: Konva.Node) => node.hasName("shape") && selected.has(node.id()),
    );
    transformer.nodes(nodes);
    // Pen strokes can be moved but not resized.
    const hasPen = selectedIds.some((id) => readShape(doc, id)?.type === "pen");
    transformer.resizeEnabled(!hasPen);
    transformer.getLayer()?.batchDraw();
  }, [doc, selectedIds, shapeIds, editingId]);

  // Remove ids from the selection when their shapes disappear.
  useEffect(() => {
    const { selectedIds, setSelection } = useEditor.getState();
    const existing = new Set(shapeIds);
    if (selectedIds.some((id) => !existing.has(id))) {
      setSelection(selectedIds.filter((id) => existing.has(id)));
    }
  }, [shapeIds]);

  // ---- Hit testing ----------------------------------------------------------
  function hitTest(screen: Point): {
    shapeId: string | null;
    onTransformer: boolean;
  } {
    const hit = stageRef.current?.getIntersection(screen);
    if (!hit) return { shapeId: null, onTransformer: false };
    if (hit.getParent()?.getClassName() === "Transformer") {
      return { shapeId: null, onTransformer: true };
    }
    const group = hit.findAncestor(".shape", true);
    return { shapeId: group ? group.id() : null, onTransformer: false };
  }

  // ---- Pointer gestures -------------------------------------------------------
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.target instanceof HTMLElement && e.target.tagName !== "CANVAS")
      return;
    if (e.button !== 0 && e.button !== 1) return;

    const { camera, tool, selectedIds, color, setSelection, setTool } =
      useEditor.getState();
    const screen = toScreen(e);
    const world = screenToWorld(screen, camera);

    // Viewers can only look around, so any drag pans.
    if (e.button === 1 || spaceRef.current || readOnly) {
      gestureRef.current = {
        kind: "pan",
        startScreen: screen,
        startCamera: camera,
      };
      setPanning(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (tool === "select") {
      const { shapeId, onTransformer } = hitTest(screen);
      if (onTransformer) return; // Konva handles resize handles itself
      if (shapeId) {
        if (e.shiftKey) {
          setSelection(
            selectedIds.includes(shapeId)
              ? selectedIds.filter((id) => id !== shapeId)
              : [...selectedIds, shapeId],
          );
          return;
        }
        const ids = selectedIds.includes(shapeId) ? selectedIds : [shapeId];
        if (ids !== selectedIds) setSelection(ids);
        const origins = new Map<string, Point>();
        for (const id of ids) {
          const shape = readShape(doc, id);
          if (shape) origins.set(id, { x: shape.x, y: shape.y });
        }
        beginGesture(undoManager); // the whole drag is one undo step
        gestureRef.current = {
          kind: "move",
          startScreen: screen,
          startWorld: world,
          origins,
          lastWrite: 0,
          moved: false,
          clickedId: shapeId,
        };
      } else {
        const base = e.shiftKey ? selectedIds : [];
        if (!e.shiftKey) setSelection([]);
        gestureRef.current = {
          kind: "marquee",
          startWorld: world,
          additive: e.shiftKey,
          base,
        };
      }
    } else if (tool === "rect" || tool === "ellipse") {
      gestureRef.current = {
        kind: "create",
        type: tool,
        startScreen: screen,
        startWorld: world,
      };
    } else if (tool === "pen") {
      gestureRef.current = { kind: "pen", origin: world, points: [0, 0] };
      setPreview({ kind: "pen", origin: world, points: [0, 0] });
    } else if (tool === "text") {
      e.preventDefault(); // keep focus for the textarea
      const id = createShape(doc, {
        type: "text",
        x: world.x,
        y: world.y - (DEFAULT_FONT_SIZE * TEXT_LINE_HEIGHT) / 2,
        width: DEFAULT_TEXT_WIDTH,
        height: DEFAULT_FONT_SIZE * TEXT_LINE_HEIGHT,
        text: "",
        fontSize: DEFAULT_FONT_SIZE,
        color: color as Shape["color"],
        createdBy: userId,
      });
      setTool("select");
      setSelection([id]);
      setEditingId(id);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  /** Publishes my cursor (world coordinates) at most every 50 ms, plus a trailing update. */
  function publishCursor(world: Point | null) {
    if (!awareness) return;
    const state = cursorRef.current;
    state.latest = world;
    if (world === null) {
      if (state.timer !== null) window.clearTimeout(state.timer);
      state.timer = null;
      awareness.setLocalStateField("cursor", null);
      return;
    }
    if (state.timer !== null) return; // a send is already scheduled
    const wait = Math.max(
      0,
      CURSOR_INTERVAL - (performance.now() - state.lastSent),
    );
    state.timer = window.setTimeout(() => {
      state.timer = null;
      state.lastSent = performance.now();
      awareness.setLocalStateField("cursor", state.latest);
    }, wait);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const { camera, setCamera, setSelection } = useEditor.getState();
    const screen = toScreen(e);
    const world = screenToWorld(screen, camera);
    publishCursor(world);

    const gesture = gestureRef.current;
    if (!gesture) return;

    switch (gesture.kind) {
      case "pan":
        setCamera({
          ...gesture.startCamera,
          x: gesture.startCamera.x + screen.x - gesture.startScreen.x,
          y: gesture.startCamera.y + screen.y - gesture.startScreen.y,
        });
        break;
      case "move": {
        const dist = Math.hypot(
          screen.x - gesture.startScreen.x,
          screen.y - gesture.startScreen.y,
        );
        if (!gesture.moved && dist < CLICK_DISTANCE) return;
        gesture.moved = true;
        const dx = world.x - gesture.startWorld.x;
        const dy = world.y - gesture.startWorld.y;
        // Move the Konva nodes right away for smooth feedback…
        const stage = stageRef.current!;
        for (const [id, origin] of gesture.origins) {
          stage
            .findOne((n: Konva.Node) => n.hasName("shape") && n.id() === id)
            ?.position({ x: origin.x + dx, y: origin.y + dy });
        }
        // …and write to the Y.Doc at most every 30 ms, all shapes in one transaction.
        const now = e.timeStamp;
        if (now - gesture.lastWrite >= MOVE_WRITE_INTERVAL) {
          gesture.lastWrite = now;
          writeMove(gesture, dx, dy);
        }
        break;
      }
      case "marquee": {
        const box = boxFromPoints(gesture.startWorld, world);
        setPreview({ kind: "marquee", box });
        const hits = shapesInBox(box);
        setSelection(
          gesture.additive ? [...new Set([...gesture.base, ...hits])] : hits,
        );
        break;
      }
      case "create":
        setPreview({
          kind: gesture.type,
          box: boxFromPoints(gesture.startWorld, world),
        });
        break;
      case "pen": {
        gesture.points.push(
          world.x - gesture.origin.x,
          world.y - gesture.origin.y,
        );
        setPreview({
          kind: "pen",
          origin: gesture.origin,
          points: [...gesture.points],
        });
        break;
      }
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture) return;
    gestureRef.current = null;
    setPreview(null);
    setPanning(false);
    const { camera, color, setSelection, setTool } = useEditor.getState();
    const screen = toScreen(e);
    const world = screenToWorld(screen, camera);

    switch (gesture.kind) {
      case "move": {
        if (gesture.moved) {
          // Always write the final position.
          writeMove(
            gesture,
            world.x - gesture.startWorld.x,
            world.y - gesture.startWorld.y,
          );
        } else {
          // A click (no drag) on a shape inside a multi-selection selects just that shape.
          setSelection([gesture.clickedId]);
        }
        endGesture(undoManager);
        break;
      }
      case "create": {
        const isClick =
          Math.hypot(
            screen.x - gesture.startScreen.x,
            screen.y - gesture.startScreen.y,
          ) < CLICK_DISTANCE;
        const box = isClick
          ? {
              x: gesture.startWorld.x - DEFAULT_BOX.width / 2,
              y: gesture.startWorld.y - DEFAULT_BOX.height / 2,
              ...DEFAULT_BOX,
            }
          : boxFromPoints(gesture.startWorld, world);
        const id = createShape(doc, {
          type: gesture.type,
          ...box,
          color: color as Shape["color"],
          createdBy: userId,
        });
        setTool("select");
        setSelection([id]);
        break;
      }
      case "pen": {
        if (gesture.points.length >= 2) {
          createShape(doc, {
            type: "pen",
            x: gesture.origin.x,
            y: gesture.origin.y,
            points: gesture.points,
            color: color as Shape["color"],
            createdBy: userId,
          });
        }
        break;
      }
    }
  }

  function writeMove(
    gesture: Extract<Gesture, { kind: "move" }>,
    dx: number,
    dy: number,
  ) {
    updateShapes(
      doc,
      [...gesture.origins].map(([id, origin]) => ({
        id,
        patch: { x: origin.x + dx, y: origin.y + dy },
      })),
    );
  }

  function shapesInBox(box: Box): string[] {
    const shapes = getShapes(doc);
    return getOrder(doc)
      .toArray()
      .filter((id) => {
        const shape = shapes.get(id)?.toJSON() as Shape | undefined;
        return shape && boxesIntersect(box, shapeBounds(shape));
      });
  }

  function onDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (readOnly || useEditor.getState().tool !== "select") return;
    const { shapeId } = hitTest(toScreen(e));
    if (shapeId && readShape(doc, shapeId)?.type === "text") {
      useEditor.getState().setSelection([shapeId]);
      setEditingId(shapeId);
    }
  }

  // ---- Resize (Transformer) ---------------------------------------------------
  function onTransformEnd() {
    const transformer = transformerRef.current!;
    const updates = transformer.nodes().flatMap((node) => {
      const shape = readShape(doc, node.id());
      if (!shape || shape.type === "pen") return [];
      const width = round(Math.max(4, shape.width * node.scaleX()));
      const height = round(Math.max(4, shape.height * node.scaleY()));
      node.scale({ x: 1, y: 1 });
      return [
        {
          id: shape.id,
          patch: { x: round(node.x()), y: round(node.y()), width, height },
        },
      ];
    });
    updateShapes(doc, updates);
    endGesture(undoManager);
  }

  // ---- Render -------------------------------------------------------------------
  const dotSpacing =
    20 * camera.zoom < 10 ? 100 * camera.zoom : 20 * camera.zoom;
  const cursor = panning
    ? "grabbing"
    : spaceDown
      ? "grab"
      : readOnly
        ? "grab"
        : tool === "select"
          ? "default"
          : tool === "text"
            ? "text"
            : "crosshair";

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none overflow-hidden bg-white select-none"
      style={{
        cursor,
        backgroundImage:
          "radial-gradient(circle, #d4d4d8 1px, transparent 1px)",
        backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
        backgroundPosition: `${camera.x}px ${camera.y}px`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => publishCursor(null)}
      onDoubleClick={onDoubleClick}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        x={camera.x}
        y={camera.y}
        scaleX={camera.zoom}
        scaleY={camera.zoom}
      >
        <Layer>
          <ShapeRenderer doc={doc} hiddenId={editingId} />

          {preview?.kind === "rect" && (
            <Rect
              {...preview.box}
              stroke={color}
              strokeWidth={2}
              dash={[6, 4]}
            />
          )}
          {preview?.kind === "ellipse" && (
            <Ellipse
              x={preview.box.x + preview.box.width / 2}
              y={preview.box.y + preview.box.height / 2}
              radiusX={preview.box.width / 2}
              radiusY={preview.box.height / 2}
              stroke={color}
              strokeWidth={2}
              dash={[6, 4]}
            />
          )}
          {preview?.kind === "pen" && (
            <PenPreview origin={preview.origin} points={preview.points} />
          )}
          {preview?.kind === "marquee" && (
            <Rect
              {...preview.box}
              stroke={ACCENT}
              strokeWidth={1}
              strokeScaleEnabled={false}
              fill={`${ACCENT}14`}
              listening={false}
            />
          )}

          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            flipEnabled={false}
            keepRatio={false}
            borderStroke={ACCENT}
            anchorStroke={ACCENT}
            anchorSize={8}
            anchorCornerRadius={2}
            ignoreStroke
            boundBoxFunc={(oldBox, newBox) =>
              Math.abs(newBox.width) < 4 || Math.abs(newBox.height) < 4
                ? oldBox
                : newBox
            }
            onTransformStart={() => beginGesture(undoManager)}
            onTransformEnd={onTransformEnd}
          />
        </Layer>
      </Stage>

      {editingId && (
        <TextEditor
          key={editingId}
          doc={doc}
          id={editingId}
          camera={camera}
          onDone={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function PenPreview({ origin, points }: { origin: Point; points: number[] }) {
  const color = useEditor((s) => s.color);
  return (
    <Group x={origin.x} y={origin.y} listening={false}>
      <PenPath points={points} color={color} />
    </Group>
  );
}

/** An HTML textarea over the canvas for typing into a text shape. */
function TextEditor({
  doc,
  id,
  camera,
  onDone,
}: {
  doc: Y.Doc;
  id: string;
  camera: Camera;
  onDone: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [initial] = useState(() => readShape(doc, id));
  const doneRef = useRef(false);

  useEffect(() => {
    const el = ref.current!;
    el.focus();
    el.select();
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  if (!initial || initial.type !== "text") return null;

  function commit() {
    if (doneRef.current) return;
    doneRef.current = true;
    const el = ref.current!;
    const text = el.value;
    if (text.trim() === "") {
      deleteShapes(doc, [id]);
    } else {
      updateShape(doc, id, { text, height: el.scrollHeight / camera.zoom });
    }
    onDone();
  }

  return (
    <textarea
      ref={ref}
      defaultValue={initial.text}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      onInput={(e) => {
        const el = e.currentTarget;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }}
      rows={1}
      spellCheck={false}
      className="absolute resize-none overflow-hidden border-none bg-transparent p-0 outline-1 outline-offset-2 outline-[#1971c2] outline-dashed"
      style={{
        left: camera.x + initial.x * camera.zoom,
        top: camera.y + initial.y * camera.zoom,
        width: initial.width * camera.zoom,
        fontSize: initial.fontSize * camera.zoom,
        lineHeight: TEXT_LINE_HEIGHT,
        fontFamily: CANVAS_FONT,
        color: initial.color,
        whiteSpace: "pre-wrap",
        overflowWrap: "break-word",
      }}
    />
  );
}
