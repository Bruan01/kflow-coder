export interface ReadOnlyToolLimits {
  readonly maxPathLength: number;
  readonly defaultListEntries: number;
  readonly maxListEntries: number;
  readonly defaultReadLines: number;
  readonly maxReadLines: number;
  readonly maxFileBytes: number;
  readonly defaultSearchResults: number;
  readonly maxSearchResults: number;
  readonly maxSearchFiles: number;
  readonly maxPreviewLength: number;
}

export const defaultReadOnlyToolLimits: ReadOnlyToolLimits = {
  maxPathLength: 1024,
  defaultListEntries: 200,
  maxListEntries: 500,
  defaultReadLines: 200,
  maxReadLines: 500,
  maxFileBytes: 1024 * 1024,
  defaultSearchResults: 50,
  maxSearchResults: 200,
  maxSearchFiles: 2000,
  maxPreviewLength: 500,
};
