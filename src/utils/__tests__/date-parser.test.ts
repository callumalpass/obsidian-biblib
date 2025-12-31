import { DateParser } from '../date-parser';

describe('DateParser', () => {
    describe('parse', () => {
        describe('null and undefined handling', () => {
            it('should return undefined for null', () => {
                expect(DateParser.parse(null)).toBeUndefined();
            });

            it('should return undefined for undefined', () => {
                expect(DateParser.parse(undefined)).toBeUndefined();
            });

            it('should return undefined for empty string', () => {
                expect(DateParser.parse('')).toBeUndefined();
            });
        });

        describe('YYYY format', () => {
            it('should parse year only', () => {
                const result = DateParser.parse('2024');
                expect(result).toEqual({
                    dateParts: [2024],
                    year: 2024,
                    month: undefined,
                    day: undefined
                });
            });
        });

        describe('YYYY-MM format', () => {
            it('should parse year and month with dashes', () => {
                const result = DateParser.parse('2024-03');
                expect(result).toEqual({
                    dateParts: [2024, 3],
                    year: 2024,
                    month: 3,
                    day: undefined
                });
            });

            it('should parse year and month with slashes', () => {
                const result = DateParser.parse('2024/03');
                expect(result).toEqual({
                    dateParts: [2024, 3],
                    year: 2024,
                    month: 3,
                    day: undefined
                });
            });

            it('should handle single-digit month', () => {
                const result = DateParser.parse('2024-3');
                expect(result).toEqual({
                    dateParts: [2024, 3],
                    year: 2024,
                    month: 3,
                    day: undefined
                });
            });
        });

        describe('YYYY-MM-DD format', () => {
            it('should parse full date with dashes', () => {
                const result = DateParser.parse('2024-03-15');
                expect(result).toEqual({
                    dateParts: [2024, 3, 15],
                    year: 2024,
                    month: 3,
                    day: 15
                });
            });

            it('should parse full date with slashes', () => {
                const result = DateParser.parse('2024/03/15');
                expect(result).toEqual({
                    dateParts: [2024, 3, 15],
                    year: 2024,
                    month: 3,
                    day: 15
                });
            });

            it('should handle ISO datetime with time component', () => {
                const result = DateParser.parse('2024-03-15T10:30:00');
                expect(result).toEqual({
                    dateParts: [2024, 3, 15],
                    year: 2024,
                    month: 3,
                    day: 15
                });
            });
        });

        describe('CURRENT date markers', () => {
            it('should handle CURRENT marker', () => {
                const result = DateParser.parse('CURRENT');
                expect(result?.isCurrent).toBe(true);
                expect(result?.year).toBeGreaterThan(2020);
                expect(result?.month).toBeGreaterThanOrEqual(1);
                expect(result?.month).toBeLessThanOrEqual(12);
            });

            it('should handle CURREN marker', () => {
                const result = DateParser.parse('CURREN');
                expect(result?.isCurrent).toBe(true);
            });

            it('should handle CURRENT_DATE marker', () => {
                const result = DateParser.parse('CURRENT_DATE');
                expect(result?.isCurrent).toBe(true);
            });

            it('should handle lowercase current marker', () => {
                const result = DateParser.parse('current');
                expect(result?.isCurrent).toBe(true);
            });
        });

        describe('CSL date objects', () => {
            it('should parse CSL date with full date-parts', () => {
                const result = DateParser.parse({
                    'date-parts': [[2024, 3, 15]]
                });
                expect(result).toEqual({
                    dateParts: [2024, 3, 15],
                    year: 2024,
                    month: 3,
                    day: 15
                });
            });

            it('should parse CSL date with year only', () => {
                const result = DateParser.parse({
                    'date-parts': [[2024]]
                });
                expect(result).toEqual({
                    dateParts: [2024],
                    year: 2024,
                    month: undefined,
                    day: undefined
                });
            });

            it('should handle CSL date with string values', () => {
                const result = DateParser.parse({
                    'date-parts': [['2024', '3', '15']]
                });
                expect(result).toEqual({
                    dateParts: [2024, 3, 15],
                    year: 2024,
                    month: 3,
                    day: 15
                });
            });
        });

        describe('object with raw property', () => {
            it('should parse object with raw date string', () => {
                const result = DateParser.parse({ raw: '2024-03-15' });
                expect(result).toEqual({
                    dateParts: [2024, 3, 15],
                    year: 2024,
                    month: 3,
                    day: 15
                });
            });

            it('should handle CURRENT marker in raw property', () => {
                const result = DateParser.parse({ raw: 'CURRENT' });
                expect(result?.isCurrent).toBe(true);
            });
        });

        describe('invalid input', () => {
            it('should return raw for unparseable string', () => {
                const result = DateParser.parse('invalid date');
                expect(result).toEqual({ raw: 'invalid date' });
            });

            it('should return raw for partial date format', () => {
                const result = DateParser.parse('2024-');
                expect(result).toEqual({ raw: '2024-' });
            });
        });
    });

    describe('toCslDate', () => {
        it('should convert ParsedDate with dateParts to CslDate', () => {
            const result = DateParser.toCslDate({
                dateParts: [2024, 3, 15],
                year: 2024,
                month: 3,
                day: 15
            });
            expect(result).toEqual({
                'date-parts': [[2024, 3, 15]]
            });
        });

        it('should convert ParsedDate with raw to CslDate', () => {
            const result = DateParser.toCslDate({ raw: 'circa 2024' });
            expect(result).toEqual({ raw: 'circa 2024' });
        });

        it('should return undefined for undefined input', () => {
            expect(DateParser.toCslDate(undefined)).toBeUndefined();
        });
    });

    describe('extractFields', () => {
        it('should extract fields from issued date-parts', () => {
            const result = DateParser.extractFields({
                issued: { 'date-parts': [[2024, 3, 15]] }
            });
            expect(result).toEqual({
                year: '2024',
                month: '3',
                day: '15'
            });
        });

        it('should fall back to direct year/month/day fields', () => {
            const result = DateParser.extractFields({
                year: 2024,
                month: 3,
                day: 15
            });
            expect(result).toEqual({
                year: '2024',
                month: '3',
                day: '15'
            });
        });

        it('should handle missing fields', () => {
            const result = DateParser.extractFields({
                issued: { 'date-parts': [[2024]] }
            });
            expect(result).toEqual({
                year: '2024',
                month: '',
                day: ''
            });
        });

        it('should return empty strings for missing data', () => {
            const result = DateParser.extractFields({});
            expect(result).toEqual({
                year: '',
                month: '',
                day: ''
            });
        });
    });

    describe('toFormString', () => {
        it('should format full date', () => {
            const result = DateParser.toFormString({
                dateParts: [2024, 3, 15],
                year: 2024,
                month: 3,
                day: 15
            });
            expect(result).toBe('2024-03-15');
        });

        it('should format year and month', () => {
            const result = DateParser.toFormString({
                dateParts: [2024, 3],
                year: 2024,
                month: 3
            });
            expect(result).toBe('2024-03');
        });

        it('should format year only', () => {
            const result = DateParser.toFormString({
                dateParts: [2024],
                year: 2024
            });
            expect(result).toBe('2024');
        });

        it('should return raw string if no dateParts', () => {
            const result = DateParser.toFormString({ raw: 'circa 2024' });
            expect(result).toBe('circa 2024');
        });

        it('should return empty string for undefined', () => {
            expect(DateParser.toFormString(undefined)).toBe('');
        });

        it('should pad single-digit month and day', () => {
            const result = DateParser.toFormString({
                dateParts: [2024, 1, 5],
                year: 2024,
                month: 1,
                day: 5
            });
            expect(result).toBe('2024-01-05');
        });
    });

    describe('fromFields', () => {
        it('should build CslDate from year/month/day', () => {
            const result = DateParser.fromFields('2024', '3', '15');
            expect(result).toEqual({
                'date-parts': [[2024, 3, 15]]
            });
        });

        it('should build CslDate from year and month only', () => {
            const result = DateParser.fromFields('2024', '3');
            expect(result).toEqual({
                'date-parts': [[2024, 3]]
            });
        });

        it('should build CslDate from year only', () => {
            const result = DateParser.fromFields('2024');
            expect(result).toEqual({
                'date-parts': [[2024]]
            });
        });

        it('should return undefined for invalid year', () => {
            expect(DateParser.fromFields('')).toBeUndefined();
            expect(DateParser.fromFields('abc')).toBeUndefined();
        });

        it('should ignore invalid month', () => {
            const result = DateParser.fromFields('2024', '13');
            expect(result).toEqual({
                'date-parts': [[2024]]
            });
        });

        it('should ignore invalid day', () => {
            const result = DateParser.fromFields('2024', '3', '32');
            expect(result).toEqual({
                'date-parts': [[2024, 3]]
            });
        });
    });
});
