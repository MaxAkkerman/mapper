// Core data model for the visual data mapper.
// A "SchemaNode" describes the shape of either the source data (e.g. form state)
// or the target data (e.g. a request body) as a tree of typed fields.

export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'object'
  | 'array'
  | 'null'
  | 'any';

export interface SchemaNode {
  /** Full dot-path from the tree root. Array nodes' *item* representation
   *  has a path ending in "[]", e.g. "products[]" or "products[].sku". */
  path: string;
  /** Last path segment, used as the display label. */
  key: string;
  type: FieldType;
  optional?: boolean;
  /** Present when type === 'object'. */
  children?: SchemaNode[];
  /** Present when type === 'array': describes the shape of one item. */
  itemNode?: SchemaNode;
  /** Example value, used for live preview / type inference display. */
  sample?: unknown;
  /** True for fields added by the user in the UI (not present in the
   * source/target example) — e.g. free-form fields inside an otherwise
   * empty request-body object. */
  custom?: boolean;
}

/** A reference to a single field in the source tree (relative to current scope). */
export interface SourceRef {
  path: string;
}

export type TransformSpec =
  | { kind: 'identity' }
  | { kind: 'builtin'; handlerId: string; params?: Record<string, unknown> }
  | { kind: 'custom'; handlerId: string } // resolved against customHandlers registry (safe, no eval)
  | { kind: 'inline'; code: string }; // ad-hoc JS, evaluated with `new Function` (power users)

export type FieldMappingKind = 'value' | 'loop';

export interface FieldMapping {
  id: string;
  /** Target schema path this mapping fills in. For loop mappings this is the
   *  array node's path (ending in "[]"). */
  targetPath: string;
  kind: FieldMappingKind;
  /** One or more source fields feeding this target field. Loop mappings have
   *  exactly one source: the array being iterated. */
  sources: SourceRef[];
  /** Combination / conversion applied to `sources`. Required when there is more
   *  than one source; optional (defaults to identity) for a single source. */
  transform?: TransformSpec;
  /** For loop mappings: nested mappings evaluated once per array item, with
   *  source/target paths relative to the item shape. */
  children?: FieldMapping[];
}

export interface MappingConfig {
  version: 1;
  mappings: FieldMapping[];
}

export interface HandlerParamDef {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  options?: { value: string; label: string }[];
  default?: unknown;
  placeholder?: string;
}

export interface TransformHandler {
  id: string;
  label: string;
  description?: string;
  /** Source field types this handler accepts. */
  appliesTo: FieldType[];
  minSources?: number; // default 1
  maxSources?: number; // default 1 ('Infinity' sentinel via large number)
  params?: HandlerParamDef[];
  run: (values: unknown[], params: Record<string, unknown>) => unknown;
}

export interface CustomHandlerDef {
  id: string;
  label: string;
  description?: string;
  appliesTo: FieldType[];
  minSources?: number;
  maxSources?: number;
  run: (values: unknown[]) => unknown;
}
