import { CslDate, ParsedDate } from '../types/citation';

/**
 * Unified date parsing utility for consistent handling across the plugin.
 * Consolidates date parsing from citation-service, note-creation-service, and modals.
 *
 * Supported input formats:
 * - YYYY, YYYY-MM, YYYY-MM-DD (with dash or slash separators)
 * - CURRENT, CURREN, CURRENT_DATE markers (returns today's date)
 * - CSL date objects with date-parts
 * - Objects with raw property containing date string
 */
export class DateParser {
    /** Markers that indicate "today's date" */
    private static readonly CURRENT_MARKERS = ['CURRENT', 'CURREN', 'CURRENT_DATE'];

    /**
     * Parse any date input into a standardized ParsedDate result.
     *
     * @param input - Date string, CSL date object, or object with raw property
     * @returns ParsedDate with dateParts and individual year/month/day, or undefined
     */
    static parse(input: unknown): ParsedDate | undefined {
        if (input === null || input === undefined || input === '') {
            return undefined;
        }

        // Handle CURRENT markers (string form)
        if (typeof input === 'string') {
            if (this.isCurrentMarker(input)) {
                return this.getCurrentDate();
            }
            return this.parseString(input);
        }

        // Handle objects
        if (typeof input === 'object') {
            // Check for CSL date object with date-parts
            if (this.isCslDate(input)) {
                return this.parseCslDate(input);
            }

            // Check for object with 'raw' property
            if ('raw' in input && typeof (input as { raw: unknown }).raw === 'string') {
                const raw = (input as { raw: string }).raw;
                if (this.isCurrentMarker(raw)) {
                    return this.getCurrentDate();
                }
                return this.parseString(raw);
            }

            // Check for CURRENT_DATE object patterns
            if ('CURRENT_DATE' in input ||
                (input as object).constructor?.name === 'CURRENT_DATE' ||
                String(input).includes('CURRENT_DATE')) {
                return this.getCurrentDate();
            }
        }

        // Fallback: try to convert to string
        const str = String(input);
        if (str && str !== '[object Object]') {
            return this.parseString(str);
        }

        return { raw: str };
    }

    /**
     * Convert ParsedDate to CSL date format.
     *
     * @param parsed - ParsedDate object
     * @returns CslDate with date-parts or raw, or undefined
     */
    static toCslDate(parsed: ParsedDate | undefined): CslDate | undefined {
        if (!parsed) return undefined;

        if (parsed.dateParts && parsed.dateParts.length > 0) {
            return { 'date-parts': [parsed.dateParts] };
        }

        if (parsed.raw) {
            return { raw: parsed.raw };
        }

        return undefined;
    }

    /**
     * Extract individual year/month/day fields from CSL data.
     * Checks both issued['date-parts'] and direct year/month/day fields.
     *
     * @param cslData - Object potentially containing issued or year/month/day fields
     * @returns Object with year, month, day as strings (empty string if not present)
     */
    static extractFields(cslData: Record<string, unknown>): {
        year: string;
        month: string;
        day: string;
    } {
        // Try issued['date-parts'] first
        const issued = cslData.issued as CslDate | undefined;
        if (issued?.['date-parts']?.[0]) {
            const parts = issued['date-parts'][0];
            return {
                year: parts[0]?.toString() ?? '',
                month: parts[1]?.toString() ?? '',
                day: parts[2]?.toString() ?? ''
            };
        }

        // Fall back to direct year/month/day fields
        return {
            year: cslData.year?.toString() ?? '',
            month: cslData.month?.toString() ?? '',
            day: cslData.day?.toString() ?? ''
        };
    }

    /**
     * Format ParsedDate for form display (YYYY, YYYY-MM, or YYYY-MM-DD).
     *
     * @param parsed - ParsedDate object
     * @returns Formatted date string
     */
    static toFormString(parsed: ParsedDate | undefined): string {
        if (!parsed) return '';

        if (parsed.year) {
            let str = String(parsed.year);
            if (parsed.month) {
                str += `-${String(parsed.month).padStart(2, '0')}`;
                if (parsed.day) {
                    str += `-${String(parsed.day).padStart(2, '0')}`;
                }
            }
            return str;
        }

        if (parsed.dateParts && parsed.dateParts.length > 0) {
            let str = String(parsed.dateParts[0]);
            if (parsed.dateParts[1]) {
                str += `-${String(parsed.dateParts[1]).padStart(2, '0')}`;
                if (parsed.dateParts[2]) {
                    str += `-${String(parsed.dateParts[2]).padStart(2, '0')}`;
                }
            }
            return str;
        }

        return parsed.raw ?? '';
    }

    /**
     * Build a CslDate from separate year/month/day strings.
     *
     * @param year - Year string (required for valid date)
     * @param month - Month string (optional)
     * @param day - Day string (optional, requires month)
     * @returns CslDate object or undefined if year is empty
     */
    static fromFields(year: string, month?: string, day?: string): CslDate | undefined {
        const yearNum = parseInt(year, 10);
        if (isNaN(yearNum)) return undefined;

        const dateParts: number[] = [yearNum];

        if (month) {
            const monthNum = parseInt(month, 10);
            if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
                dateParts.push(monthNum);

                if (day) {
                    const dayNum = parseInt(day, 10);
                    if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
                        dateParts.push(dayNum);
                    }
                }
            }
        }

        return { 'date-parts': [dateParts] };
    }

    // --- Private helpers ---

    /**
     * Check if a string is a current date marker.
     */
    private static isCurrentMarker(str: string): boolean {
        return this.CURRENT_MARKERS.includes(str.toUpperCase());
    }

    /**
     * Get current date as ParsedDate.
     */
    private static getCurrentDate(): ParsedDate {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1; // JavaScript months are 0-indexed
        const day = now.getDate();

        return {
            dateParts: [year, month, day],
            isCurrent: true,
            year,
            month,
            day
        };
    }

    /**
     * Check if input is a CSL date object with date-parts.
     */
    private static isCslDate(input: unknown): input is CslDate {
        if (typeof input !== 'object' || input === null) return false;
        if (!('date-parts' in input)) return false;
        const dateParts = (input as CslDate)['date-parts'];
        return Array.isArray(dateParts) && dateParts.length > 0;
    }

    /**
     * Parse a CSL date object into ParsedDate.
     */
    private static parseCslDate(cslDate: CslDate): ParsedDate {
        const parts = cslDate['date-parts']?.[0];

        if (!parts || parts.length === 0) {
            return { raw: cslDate.raw ?? cslDate.literal };
        }

        const year = typeof parts[0] === 'number' ? parts[0] : parseInt(String(parts[0]), 10);
        const month = parts[1] !== undefined
            ? (typeof parts[1] === 'number' ? parts[1] : parseInt(String(parts[1]), 10))
            : undefined;
        const day = parts[2] !== undefined
            ? (typeof parts[2] === 'number' ? parts[2] : parseInt(String(parts[2]), 10))
            : undefined;

        const dateParts: number[] = [year];
        if (month !== undefined && !isNaN(month)) {
            dateParts.push(month);
            if (day !== undefined && !isNaN(day)) {
                dateParts.push(day);
            }
        }

        return {
            dateParts,
            year: isNaN(year) ? undefined : year,
            month: month !== undefined && !isNaN(month) ? month : undefined,
            day: day !== undefined && !isNaN(day) ? day : undefined
        };
    }

    /**
     * Parse a date string into ParsedDate.
     * Supports YYYY, YYYY-MM, YYYY-MM-DD with dash or slash separators.
     */
    private static parseString(dateStr: string): ParsedDate {
        if (!dateStr || typeof dateStr !== 'string') {
            return { raw: String(dateStr) };
        }

        // Strip time component if present (e.g., 2024-01-15T10:30:00)
        const datePart = dateStr.split('T')[0].trim();

        // Try to match YYYY, YYYY-MM, or YYYY-MM-DD (with dash or slash)
        const match = datePart.match(/^(\d{4})(?:[-/](\d{1,2}))?(?:[-/](\d{1,2}))?$/);

        if (!match) {
            return { raw: dateStr };
        }

        const year = parseInt(match[1], 10);
        if (isNaN(year)) {
            return { raw: dateStr };
        }

        const dateParts: number[] = [year];
        let month: number | undefined;
        let day: number | undefined;

        if (match[2]) {
            month = parseInt(match[2], 10);
            if (!isNaN(month) && month >= 1 && month <= 12) {
                dateParts.push(month);

                if (match[3]) {
                    day = parseInt(match[3], 10);
                    if (!isNaN(day) && day >= 1 && day <= 31) {
                        dateParts.push(day);
                    }
                }
            }
        }

        return {
            dateParts,
            year,
            month,
            day
        };
    }
}
