"use client";

import type { Shape } from "@whiteboard/shared";
import { memo, useMemo } from "react";
import { Ellipse, Group, Path, Rect, Text } from "react-konva";
import type * as Y from "yjs";
import { penPath } from "@/lib/geometry";
import { useShape, useShapeIds } from "@/lib/yjs/hooks";

export const CANVAS_FONT =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
export const TEXT_LINE_HEIGHT = 1.25;
const STROKE_WIDTH = 2;

/** Same color at about 15% opacity, for shape fills. */
function lightFill(color: string) {
  return `${color}26`;
}

type Props = { doc: Y.Doc; hiddenId: string | null };

export function ShapeRenderer({ doc, hiddenId }: Props) {
  const ids = useShapeIds(doc);
  return ids.map((id) => (
    <ShapeNode key={id} doc={doc} id={id} hidden={id === hiddenId} />
  ));
}

const ShapeNode = memo(function ShapeNode({
  doc,
  id,
  hidden,
}: {
  doc: Y.Doc;
  id: string;
  hidden: boolean;
}) {
  const shape = useShape(doc, id);
  if (!shape) return null;
  // Every shape is a Group at (x, y), so moving and resizing work the same way for all types.
  return (
    <Group
      id={id}
      name="shape"
      x={shape.x}
      y={shape.y}
      opacity={hidden ? 0 : 1}
    >
      <ShapeBody shape={shape} />
    </Group>
  );
});

function ShapeBody({ shape }: { shape: Shape }) {
  switch (shape.type) {
    case "rect":
      return (
        <Rect
          width={shape.width}
          height={shape.height}
          stroke={shape.color}
          strokeWidth={STROKE_WIDTH}
          fill={lightFill(shape.color)}
          cornerRadius={4}
        />
      );
    case "ellipse":
      return (
        <Ellipse
          x={shape.width / 2}
          y={shape.height / 2}
          radiusX={shape.width / 2}
          radiusY={shape.height / 2}
          stroke={shape.color}
          strokeWidth={STROKE_WIDTH}
          fill={lightFill(shape.color)}
        />
      );
    case "text":
      return (
        <Text
          text={shape.text}
          width={shape.width}
          fontSize={shape.fontSize}
          fontFamily={CANVAS_FONT}
          lineHeight={TEXT_LINE_HEIGHT}
          fill={shape.color}
          wrap="word"
        />
      );
    case "pen":
      return <PenPath points={shape.points} color={shape.color} />;
  }
}

export function PenPath({
  points,
  color,
}: {
  points: number[];
  color: string;
}) {
  const data = useMemo(() => penPath(points), [points]);
  return <Path data={data} fill={color} />;
}
