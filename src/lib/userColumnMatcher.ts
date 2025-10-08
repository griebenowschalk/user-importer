import { UserFieldMapping, User } from "../types";
import Fuse from "fuse.js";

class UserColumnMatcher {
  private static readonly FIELD_VARIATIONS: Record<keyof User, string[]> = {
    employeeId: [
      "employeeid",
      "employee id",
      "employee",
      "id",
      "emp id",
      "empid",
      "staff id",
      "staffid",
      "empno",
      "emp number",
    ],
    firstName: [
      "firstname",
      "first name",
      "first",
      "givenname",
      "given name",
      "given",
      "forename",
      "fore name",
    ],
    lastName: [
      "lastname",
      "last name",
      "last",
      "surname",
      "familyname",
      "family name",
      "family",
    ],
    email: ["email", "email address", "e-mail", "e mail", "mail", "emailaddr"],
    startDate: [
      "startdate",
      "start date",
      "start",
      "hiredate",
      "hire date",
      "hire",
      "employment date",
      "employmentdate",
    ],
    department: ["department", "dept", "team", "div", "unit", "section"],
    division: [
      "division",
      "div",
      "unit",
      "section",
      "business unit",
      "businessunit",
      "area",
    ],
    position: [
      "position",
      "jobtitle",
      "job title",
      "title",
      "role",
      "job",
      "job role",
      "jobrole",
    ],
    region: ["region", "area", "territory", "zone", "district"],
    mobileNumber: [
      "phone number",
      "mobilenumber",
      "mobile number",
      "mobile",
      "cell",
      "cellphone",
      "cell phone",
      "cellphone number",
    ],
    workPhoneNumber: [
      "workphonenumber",
      "work phone number",
      "work phone",
      "work cell",
      "workphone",
      "office phone",
      "officephone",
      "business phone",
    ],
    gender: ["gender", "sex", "biological sex"],
    country: ["country", "nation", "country code", "nationality"],
    city: ["city", "town", "municipality", "locality"],
    dateOfBirth: [
      "dateofbirth",
      "date of birth",
      "dob",
      "birthdate",
      "birth date",
      "birth",
      "born",
      "birth day",
    ],
    language: [
      "language",
      "lang",
      "preferred language",
      "preferredlanguage",
      "primary language",
      "primarylanguage",
    ],
  };
  private static _index: Map<string, keyof User> | null = null;
  private static _fuse: Fuse<{ field: keyof User; variation: string }> | null =
    null;

  private static norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, "");

  /**
   * Index of the variations of the user fields by creating a map of the variations to the field names normalized.
   */
  private static get index() {
    if (!this._index) {
      const map = new Map<string, keyof User>();
      for (const field of Object.keys(
        UserColumnMatcher.FIELD_VARIATIONS
      ) as (keyof User)[]) {
        // Only index the canonical field name for exact matches; variations are fuzzy via Fuse
        map.set(UserColumnMatcher.norm(field), field);
      }
      this._index = map;
    }

    return this._index;
  }

  private static get fuse() {
    if (!this._fuse) {
      const items = [] as {
        field: keyof User;
        variation: string;
      }[];

      for (const [field, variations] of Object.entries(
        UserColumnMatcher.FIELD_VARIATIONS
      ) as [keyof User, string[]][]) {
        variations.forEach(v =>
          items.push({ field, variation: UserColumnMatcher.norm(v) })
        );
        items.push({ field, variation: UserColumnMatcher.norm(field) });
      }

      this._fuse = new Fuse(items, {
        keys: ["variation"],
        includeScore: true,
        threshold: 0.35,
        ignoreLocation: true,
        distance: 100,
        minMatchCharLength: 2,
      });
    }

    return this._fuse;
  }

  static analyzeHeaderQuality(headers: string[]): number {
    if (!headers || headers.length === 0) return 0;

    let quality = 0;

    // Check for empty/null headers
    const nonEmptyHeaders = headers.filter(
      h => h && h.toString().trim() !== ""
    );
    quality += nonEmptyHeaders.length * 2;

    // Check for duplicate headers
    const uniqueHeaders = new Set(
      nonEmptyHeaders.map(h => h.toString().toLowerCase())
    );
    quality += uniqueHeaders.size;

    // Penalize for empty headers
    quality -= (headers.length - nonEmptyHeaders.length) * 3;

    // Bonus for common header patterns (refined list)
    const commonHeaders = Object.values(
      UserColumnMatcher.FIELD_VARIATIONS
    ).flat();

    commonHeaders.forEach(common => {
      if (uniqueHeaders.has(common)) quality += 1;
    });

    return quality;
  }

  /**
   * Creates a user field mapping from a list of headers.
   * @param headers - The list of headers to create the mapping from.
   * @returns The user field mapping.
   */
  static createUserFieldMapping(headers: string[]): UserFieldMapping {
    const candidates = new Map<
      keyof User,
      { header: string; exact: boolean; score?: number }
    >();

    for (const header of headers) {
      if (!header || header.trim() === "") continue;

      const match = this.findBestUserFieldMatch(header);

      if (!match) continue;

      const current = candidates.get(match.field);
      if (!current) {
        candidates.set(match.field, {
          header,
          exact: match.exactMatch,
          score: match.score,
        });
        continue;
      }

      if (match.exactMatch && !current.exact) {
        candidates.set(match.field, {
          header,
          exact: match.exactMatch,
          score: match.score,
        });
      } else if (!match.exactMatch && !current.exact) {
        const currentScore = current.score ?? 1;
        const matchScore = match.score ?? 1;
        if (matchScore < currentScore) {
          candidates.set(match.field, {
            header,
            exact: match.exactMatch,
            score: match.score,
          });
        }
      }
    }

    const mapping: UserFieldMapping = {};
    for (const [field, candidate] of candidates) {
      mapping[candidate.header] = field;
    }

    return mapping;
  }

  /**
   * It maps a row object (e.g., from a CSV) to a partial User object using a header-to-field mapping, regardless of key order.
   * Example:
   * row = { "Email": "bob@example.com", "First Name": "Bob" }
   * mapping = { "First Name": "firstName", "Email": "email" }
   * Output: { firstName: "Bob", email: "bob@example.com" }
   * @param row - The row object to map to a User object.
   * @param mapping - The header-to-field mapping.
   * @returns The mapped User object.
   */
  static mapRowToUser(
    row: Record<string, unknown>,
    mapping: UserFieldMapping
  ): Partial<User> {
    const out: Partial<User> = {};
    for (const [src, field] of Object.entries(mapping)) {
      if (Object.prototype.hasOwnProperty.call(row, src)) {
        const value = row[src as keyof typeof row];
        if (value !== undefined) {
          out[field] = value as never;
        }
      }
    }
    return out;
  }

  static findBestUserFieldMatch(
    header: string
  ): { field: keyof User; exactMatch: boolean; score?: number } | null {
    const normalizedHeader = this.norm(header.trim());

    const exactMatch = this.index.get(normalizedHeader);
    if (exactMatch) {
      return { field: exactMatch, exactMatch: true };
    }

    const results = this.fuse.search(normalizedHeader);

    if (results.length > 0) {
      const bestMatch = results[0];
      return {
        field: bestMatch.item.field,
        exactMatch: false,
        score: bestMatch.score ?? undefined,
      };
    }

    return null;
  }

  static mappingIncludesHeader(mapping: UserFieldMapping, headers: string[]) {
    return {
      mapped: mapping, // "empId" → "employeeId"
      unmapped: headers.filter(header => !mapping[header]), // ["workCell"]
      allMappings: headers.reduce(
        (acc, header) => {
          acc[header] = mapping[header] || null; // "empId" → "employeeId", "workCell" → null
          return acc;
        },
        {} as Record<string, string | null>
      ),
    };
  }

  /**
   * Updates an existing mapping or adds a new one
   * @param currentMapping - Current mapping object
   * @param sourceHeader - Source header from file
   * @param targetField - Target User field (or null to remove mapping)
   * @returns Updated mapping
   */
  static updateMapping(
    currentMapping: Record<string, keyof User>,
    sourceHeader: string,
    targetField: keyof User | null
  ): Record<string, keyof User> {
    const newMapping = { ...currentMapping };

    if (targetField === null) {
      // Remove mapping
      delete newMapping[sourceHeader];
    } else {
      // Add or update mapping
      newMapping[sourceHeader] = targetField;
    }

    return newMapping;
  }

  /**
   * Gets available User fields for a specific header (excludes current mapping)
   * @param mapping - Current mapping
   * @param currentHeader - Header being mapped (to exclude its current mapping)
   * @returns Array of available User fields for this header
   */
  static getAvailableFieldsForHeader(
    mapping: Record<string, keyof User>,
    currentHeader: string
  ): (keyof User)[] {
    const currentField = mapping[currentHeader];
    const mappedFields = new Set(Object.values(mapping));

    // If this header is already mapped, include its current field as an option
    const availableFields = Object.values(mapping).filter(
      field => field !== currentField
    );

    // Add all unmapped fields
    const allUserFields: (keyof User)[] = Object.keys(
      UserColumnMatcher.FIELD_VARIATIONS
    ) as (keyof User)[];

    allUserFields.forEach(field => {
      if (!mappedFields.has(field)) {
        availableFields.push(field);
      }
    });

    return availableFields;
  }

  /**
   * Gets all available User fields that aren't currently mapped
   * @param mapping - Current mapping
   * @returns Array of unmapped User fields
   */
  static getUnmappedUserFields(
    mapping: Record<string, keyof User>
  ): (keyof User)[] {
    const mappedFields = new Set(Object.values(mapping));
    const allUserFields: (keyof User)[] = Object.keys(
      UserColumnMatcher.FIELD_VARIATIONS
    ) as (keyof User)[];

    return allUserFields.filter(field => !mappedFields.has(field));
  }
}

export default UserColumnMatcher;
