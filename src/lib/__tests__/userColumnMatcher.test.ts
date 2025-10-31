import { describe, it, expect } from "vitest";
import UserColumnMatcher from "@/lib/userColumnMatcher";

describe("UserColumnMatcher", () => {
  it("finds exact matches", () => {
    const m = UserColumnMatcher.findBestUserFieldMatch("email");
    expect(m).toMatchObject({ field: "email", exactMatch: true });
  });

  it("finds fuzzy matches for common variants", () => {
    const m = UserColumnMatcher.findBestUserFieldMatch("First Name");
    expect(m?.field).toBe("firstName");
    expect(m?.exactMatch).toBe(true);
  });

  it("creates field mapping from headers", () => {
    const headers = ["Emp ID", "First Name", "E-mail", "Unknown"];
    const mapping = UserColumnMatcher.createUserFieldMapping(headers);

    expect(Object.keys(mapping)).toEqual(
      expect.arrayContaining(["Emp ID", "First Name", "E-mail"])
    );
    expect(Object.values(mapping)).toEqual(
      expect.arrayContaining(["employeeId", "firstName", "email"])
    );
  });

  it("getAvailableFieldsForHeader", () => {
    const mapping = {
      "First Name": "firstName",
      Email: "email",
    } as const;
    const availableFields = UserColumnMatcher.getAvailableFieldsForHeader(
      mapping,
      "First Name"
    );
    expect(availableFields).toEqual([
      "email",
      "employeeId",
      "lastName",
      "startDate",
      "department",
      "division",
      "position",
      "region",
      "mobileNumber",
      "workPhoneNumber",
      "gender",
      "country",
      "city",
      "dateOfBirth",
      "language",
    ]);
  });

  it("getUnmappedUserFields", () => {
    const mapping = {
      "First Name": "firstName",
      Email: "email",
    } as const;
    const unmappedFields = UserColumnMatcher.getUnmappedUserFields(mapping);
    expect(unmappedFields).toEqual([
      "employeeId",
      "lastName",
      "startDate",
      "department",
      "division",
      "position",
      "region",
      "mobileNumber",
      "workPhoneNumber",
      "gender",
      "country",
      "city",
      "dateOfBirth",
      "language",
    ]);
  });

  it("analyzeHeaderQuality", () => {
    const headers = ["First Name", "Email", "Employee ID"];
    const quality = UserColumnMatcher.analyzeHeaderQuality(headers);
    expect(quality).toBe(12);
  });

  it("mappingIncludesHeader", () => {
    const mapping = {
      "First Name": "firstName",
      Email: "email",
    } as const;
    const headers = ["First Name", "Email", "Employee ID"];
    const result = UserColumnMatcher.mappingIncludesHeader(mapping, headers);
    expect(result.mapped).toEqual(mapping);
    expect(result.unmapped).toEqual(["Employee ID"]);
  });

  it("updateMapping", () => {
    const mapping = {
      "First Name": "firstName",
      Email: "email",
    } as const;
    let newMapping = UserColumnMatcher.updateMapping(
      mapping,
      "First Name",
      "lastName"
    );
    expect(newMapping).toEqual({
      "First Name": "lastName",
      Email: "email",
    });
    newMapping = UserColumnMatcher.updateMapping(mapping, "First Name", null);
    expect(newMapping).toEqual({
      Email: "email",
    });
  });

  it("findBestUserFieldMatch", () => {
    const match = UserColumnMatcher.findBestUserFieldMatch("First Name");
    expect(match?.field).toBe("firstName");
    expect(match?.exactMatch).toBe(true);
  });

  it("createUserFieldMapping", () => {
    const headers = ["Name", "Email", "Employeeid", "First Name", "Unknown"];
    const mapping = UserColumnMatcher.createUserFieldMapping(headers);
    expect(mapping).toEqual({
      Email: "email",
      Employeeid: "employeeId",
      "First Name": "firstName",
    });
  });
});
