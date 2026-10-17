import type { Shape } from "@whiteboard/shared";
import { getStroke } from "perfect-freehand";
import type { Camera } from "@/stores/editor";

export type Point = { x: number; y: number };
export type Box = { x: number; y: number; width: number; height: number };

// Screen = world * zoom + camera offset.
export function screenToWorld(p: Point, camera: Camera): Point {
  return {
    x: (p.x - camera.x) / camera.zoom,
    y: (p.y - camera.y) / camera.zoom,
  };
}

export function worldToScreen(p: Point, camera: Camera): Point {
  return { x: p.x * camera.zoom + camera.x, y: p.y * camera.zoom + camera.y };
}

/** A box from two corner points, in any drag direction. */
export function boxFromPoints(a: Point, b: Point): Box {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export function boxesIntersect(a: Box, b: Box): boolean {
  return (
    a.x <= b.x + b.width &&
    b.x <= a.x + a.width &&
    a.y <= b.y + b.height &&
    b.y <= a.y + a.height
  );
}

export function unionBoxes(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null;
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export const PEN_SIZE = 6;

/** World-space bounding box of a shape. */
export function shapeBounds(shape: Shape): Box {
  if (shape.type !== "pen") {
    return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
  }
  const xs = shape.points.filter((_, i) => i % 2 === 0);
  const ys = shape.points.filter((_, i) => i % 2 === 1);
  const pad = PEN_SIZE / 2;
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: shape.x + minX - pad,
    y: shape.y + minY - pad,
    width: Math.max(...xs) - minX + PEN_SIZE,
    height: Math.max(...ys) - minY + PEN_SIZE,
  };
}

/** SVG path data for a pen stroke. `points` is flat [x1, y1, x2, y2, …]. */
export function penPath(points: number[]): string {
  const input: number[][] = [];
  for (let i = 0; i + 1 < points.length; i += 2)
    input.push([points[i]!, points[i + 1]!]);
  const outline = getStroke(input, {
    size: PEN_SIZE,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  });
  const first = outline[0];
  if (!first) return "";
  // Smooth quadratic curve through the outline's midpoints.
  const d: (string | number)[] = ["M", first[0], first[1], "Q"];
  outline.forEach(([x0, y0], i) => {
    const [x1, y1] = outline[(i + 1) % outline.length]!;
    d.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  });
  d.push("Z");
  return d.join(" ");
}
