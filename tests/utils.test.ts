/**
 * Tests for Utility Functions
 */

import {
  generateId,
  sleep,
  retryWithBackoff,
  chunk,
  deepClone,
  calculatePercentage,
  formatDateOnly,
  daysBetween,
  isValidEmail,
  sanitizeString,
  groupBy,
  pick,
  omit,
  flattenObject,
  standardDeviation,
  percentile,
} from '../src/utils';

describe('Utility Functions', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).not.toBe(id2);
    });

    it('should use prefix when provided', () => {
      const id = generateId('test');

      expect(id.startsWith('test_')).toBe(true);
    });

    it('should generate valid format', () => {
      const id = generateId('play');

      expect(id).toMatch(/^play_[a-z0-9]+_[a-f0-9]+$/);
    });
  });

  describe('sleep', () => {
    it('should wait for specified time', async () => {
      const start = Date.now();
      await sleep(100);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first try', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        return 'success';
      };

      const result = await retryWithBackoff(fn);

      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 2) throw new Error('Retry');
        return 'success';
      };

      const result = await retryWithBackoff(fn, 3, 10);

      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should throw after max retries', async () => {
      const fn = async () => {
        throw new Error('Always fails');
      };

      await expect(retryWithBackoff(fn, 2, 10)).rejects.toThrow('Always fails');
    });
  });

  describe('chunk', () => {
    it('should split array into chunks', () => {
      const arr = [1, 2, 3, 4, 5];
      const chunks = chunk(arr, 2);

      expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('should handle empty array', () => {
      const chunks = chunk([], 2);

      expect(chunks).toEqual([]);
    });

    it('should handle chunk size larger than array', () => {
      const chunks = chunk([1, 2], 5);

      expect(chunks).toEqual([[1, 2]]);
    });
  });

  describe('deepClone', () => {
    it('should create a deep copy', () => {
      const original = { a: 1, b: { c: 2 } };
      const cloned = deepClone(original);

      cloned.b.c = 3;

      expect(original.b.c).toBe(2);
      expect(cloned.b.c).toBe(3);
    });
  });

  describe('calculatePercentage', () => {
    it('should calculate percentage correctly', () => {
      expect(calculatePercentage(25, 100)).toBe(25);
      expect(calculatePercentage(1, 4)).toBe(25);
    });

    it('should handle zero total', () => {
      expect(calculatePercentage(10, 0)).toBe(0);
    });
  });

  describe('formatDateOnly', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date('2024-01-15T12:30:00Z');
      const formatted = formatDateOnly(date);

      expect(formatted).toBe('2024-01-15');
    });
  });

  describe('daysBetween', () => {
    it('should calculate days between dates', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-11');

      expect(daysBetween(date1, date2)).toBe(10);
    });

    it('should work regardless of order', () => {
      const date1 = new Date('2024-01-11');
      const date2 = new Date('2024-01-01');

      expect(daysBetween(date1, date2)).toBe(10);
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.org')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should remove dangerous characters', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
    });

    it('should remove javascript protocol', () => {
      expect(sanitizeString('javascript:void(0)')).toBe('void(0)');
    });

    it('should trim whitespace', () => {
      expect(sanitizeString('  hello world  ')).toBe('hello world');
    });
  });

  describe('groupBy', () => {
    it('should group items by key', () => {
      const items = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 },
      ];

      const grouped = groupBy(items, (item) => item.type);

      expect(grouped['a'].length).toBe(2);
      expect(grouped['b'].length).toBe(1);
    });
  });

  describe('pick', () => {
    it('should pick specified keys', () => {
      const obj = { a: 1, b: 2, c: 3 };
      const picked = pick(obj, ['a', 'c']);

      expect(picked).toEqual({ a: 1, c: 3 });
    });
  });

  describe('omit', () => {
    it('should omit specified keys', () => {
      const obj = { a: 1, b: 2, c: 3 };
      const omitted = omit(obj, ['b']);

      expect(omitted).toEqual({ a: 1, c: 3 });
    });
  });

  describe('flattenObject', () => {
    it('should flatten nested objects', () => {
      const obj = { a: { b: { c: 1 } }, d: 2 };
      const flattened = flattenObject(obj);

      expect(flattened).toEqual({ 'a.b.c': 1, d: 2 });
    });
  });

  describe('standardDeviation', () => {
    it('should calculate standard deviation', () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      const std = standardDeviation(values);

      expect(std).toBeCloseTo(2, 0);
    });

    it('should return 0 for empty array', () => {
      expect(standardDeviation([])).toBe(0);
    });
  });

  describe('percentile', () => {
    it('should calculate percentile', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      expect(percentile(values, 50)).toBe(5);
      expect(percentile(values, 90)).toBe(9);
    });

    it('should return 0 for empty array', () => {
      expect(percentile([], 50)).toBe(0);
    });
  });
});
