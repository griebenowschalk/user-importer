import { expect } from "vitest";
import { describe, it } from "vitest";
import { changes } from "@/localisation/changes";
import { fields } from "@/localisation/fields";

describe("localisation", () => {
  it("should return the correct localisation for the given key", () => {
    expect(changes.trimmed).toBe("Trimmed the value");
    expect(changes.caseChanged).toBe("Changed the case of the value");
    expect(changes.normalized).toBe("Normalized the value");
    expect(changes.customHook).toBe("Custom hook applied");
    expect(changes.rowHook.mobileNumber).toBe("for phone number clean up");
    expect(changes.rowHook.workPhoneNumber).toBe("for phone number clean up");
    expect(changes.rowHook.email).toBe("for email clean up");
  });

  it("should return the correct localisation for the given key", () => {
    expect(fields.employeeId_description).toBe(
      "ID of the employee. Needs to be unique, lowercase, and contain only letters and numbers."
    );
    expect(fields.firstName_description).toBe("First Name of the employee.");
    expect(fields.lastName_description).toBe("Last Name of the employee.");
    expect(fields.email_description).toBe("Email of the employee.");
    expect(fields.startDate_description).toBe("Start Date of the employee.");
    expect(fields.department_description).toBe("Department of the employee.");
    expect(fields.division_description).toBe("Division of the employee.");
    expect(fields.position_description).toBe("Position of the employee.");
    expect(fields.region_description).toBe("Region of the employee.");
  });
});
