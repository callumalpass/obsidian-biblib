/**
 * Type-safe interface for Zotero-to-CSL mappings loaded from JSON
 */
import mappingsJson from './zotero-mappings.json';

export type ZoteroItemType = keyof typeof mappingsJson.zoteroTypesToCsl;
export type CslTargetType = typeof mappingsJson.zoteroTypesToCsl[ZoteroItemType];

export type ConverterType = 'TYPE' | 'DATE' | 'CREATORS' | 'TAGS';

export interface FieldMapping {
  source: string;
  target: string;
  converter?: ConverterType;
  whenItemType?: string[];
  zoteroOnly?: boolean;
  extraField?: boolean;
}

export interface ZoteroMappings {
  zoteroTypesToCsl: Record<string, string>;
  extraFieldsToCsl: Record<string, string>;
  preserveCaseFields: string[];
  fieldMappings: FieldMapping[];
}

// Export the typed mappings
export const ZOTERO_MAPPINGS: ZoteroMappings = mappingsJson as ZoteroMappings;

// Convenience exports for direct access
export const ZOTERO_TYPES_TO_CSL = ZOTERO_MAPPINGS.zoteroTypesToCsl;
export const EXTRA_FIELDS_CSL_MAP = ZOTERO_MAPPINGS.extraFieldsToCsl;
export const PRESERVE_CASE_FIELDS = ZOTERO_MAPPINGS.preserveCaseFields;
export const FIELD_MAPPINGS = ZOTERO_MAPPINGS.fieldMappings;
