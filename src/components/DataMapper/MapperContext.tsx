import { createContext, useContext } from 'react';
import type { CustomHandlerDef, FieldMapping, FieldType, SchemaNode } from '../../types';

export type Side = 'source' | 'target';

export interface DragState {
  sourcePath: string;
  sourceNode: SchemaNode;
  x: number;
  y: number;
}

export interface MapperCtxValue {
  mode: 'drag' | 'click';
  setMode: (m: 'drag' | 'click') => void;
  scopeChain: string[];
  mappingsAtScope: FieldMapping[];
  expanded: Record<Side, Set<string>>;
  toggleExpanded: (side: Side, path: string) => void;
  registerAnchor: (side: Side, path: string, el: HTMLElement | null) => void;
  hover: { side: Side; path: string } | null;
  setHover: (h: { side: Side; path: string } | null) => void;
  pendingSource: string | null;
  setPendingSource: (p: string | null) => void;
  dragState: DragState | null;
  startDrag: (node: SchemaNode, e: React.PointerEvent) => void;
  dropTargetPath: string | null;
  setDropTargetPath: (p: string | null) => void;
  commitConnection: (sourceNode: SchemaNode, targetNode: SchemaNode) => void;
  removeConnectionSource: (targetPath: string, sourcePath: string) => void;
  removeConnectionAll: (targetPath: string) => void;
  openTransformFor: string | null;
  setOpenTransformFor: (p: string | null) => void;
  commitTransform: (targetPath: string, transform: import('../../types').TransformSpec) => void;
  findMappingForTarget: (targetPath: string) => FieldMapping | undefined;
  isSourceConnected: (sourcePath: string) => boolean;
  enterLoop: (targetNode: SchemaNode, label: string) => void;
  goToScope: (depth: number) => void;
  sourceRoot: SchemaNode;
  targetRoot: SchemaNode;
  customHandlers: Record<string, CustomHandlerDef>;
  mappedSourcePrefixes: Set<string>;
  mappedTargetPrefixes: Set<string>;
  searchSource: string;
  searchTarget: string;
  setSearchSource: (v: string) => void;
  setSearchTarget: (v: string) => void;
  bumpLayout: () => void;
  layoutVersion: number;
  getAnchorEl: (side: Side, path: string) => HTMLElement | null;
  addField: (side: Side, parentPath: string, key: string, type: FieldType) => void;
  removeField: (side: Side, path: string) => void;
  /** Autocomplete candidates for "+ Добавить поле" on the source tree at a
   * given parent path: fields present in `source` but not currently a live
   * child there (e.g. removed via 🗑), plus top-level keys of `context`. */
  getSourceFieldSuggestions: (parentPath: string) => { key: string; type: FieldType }[];
}

export const MapperContext = createContext<MapperCtxValue | null>(null);

export function useMapperCtx(): MapperCtxValue {
  const ctx = useContext(MapperContext);
  if (!ctx) throw new Error('useMapperCtx must be used within DataMapper');
  return ctx;
}
