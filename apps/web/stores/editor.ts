import { DEFAULT_COLOR } from "@whiteboard/shared";
import { create } from "zustand";

// Local UI state. Never put any of this into the Y.Doc.

export type Tool = "select" | "rect" | "ellipse" | "text" | "pen";

export type Camera = { x: number; y: number; zoom: number };

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

type EditorState = {
  tool: Tool;
  color: string;
  selectedIds: string[];
  camera: Camera;
  setTool: (tool: Tool) => void;
  setColor: (color: string) => void;
  setSelection: (ids: string[]) => void;
  setCamera: (camera: Camera) => void;
};

export const useEditor = create<EditorState>()((set) => ({
  tool: "select",
  color: DEFAULT_COLOR,
  selectedIds: [],
  camera: { x: 0, y: 0, zoom: 1 },
  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  setSelection: (selectedIds) => set({ selectedIds }),
  setCamera: (camera) => set({ camera }),
}));
