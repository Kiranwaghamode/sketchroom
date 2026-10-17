import { z } from "zod";

/** The 6-color palette (PLAN.md section 6.2). */
export const COLORS = [
  { name: "Black", value: "#1e1e1e" },
  { name: "Red", value: "#e03131" },
  { name: "Blue", value: "#1971c2" },
  { name: "Green", value: "#2f9e44" },
  { name: "Yellow", value: "#f08c00" },
  { name: "Purple", value: "#9c36b5" },
] as const;

export type Color = (typeof COLORS)[number]["value"];

export const DEFAULT_COLOR: Color = COLORS[0].value;
export const DEFAULT_FONT_SIZE = 20;

export const SHAPE_TYPES = ["rect", "ellipse", "text", "pen"] as const;
export const ShapeTypeSchema = z.enum(SHAPE_TYPES);
export type ShapeType = z.infer<typeof ShapeTypeSchema>;

export const ColorSchema = z.enum(
  COLORS.map((c) => c.value) as [Color, ...Color[]],
);

const base = {
  id: z.string().min(1),
  x: z.number(), // world coordinates
  y: z.number(),
  color: ColorSchema,
  createdBy: z.string().min(1), // userId
};

const box = {
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
};

export const RectShapeSchema = z.object({
  ...base,
  ...box,
  type: z.literal("rect"),
});

export const EllipseShapeSchema = z.object({
  ...base,
  ...box,
  type: z.literal("ellipse"),
});

export const TextShapeSchema = z.object({
  ...base,
  ...box,
  type: z.literal("text"),
  text: z.string(),
  fontSize: z.number().positive().default(DEFAULT_FONT_SIZE),
});

export const PenShapeSchema = z.object({
  ...base,
  type: z.literal("pen"),
  /** Flat [x1, y1, x2, y2, …], relative to x/y. */
  points: z.array(z.number()),
});

export const ShapeSchema = z.discriminatedUnion("type", [
  RectShapeSchema,
  EllipseShapeSchema,
  TextShapeSchema,
  PenShapeSchema,
]);

export type RectShape = z.infer<typeof RectShapeSchema>;
export type EllipseShape = z.infer<typeof EllipseShapeSchema>;
export type TextShape = z.infer<typeof TextShapeSchema>;
export type PenShape = z.infer<typeof PenShapeSchema>;
export type Shape = z.infer<typeof ShapeSchema>;
