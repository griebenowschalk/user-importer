import { describe, it, expect } from "vitest";
import {
  trimValue,
  normalizeCase,
  normalizeBasic,
  getColumnWidth,
  toRegex,
  escapeRegex,
  getOptionSet,
  checkIfExcel,
  cn,
  groupErrorsByRow,
  groupChangesByRow,
  getGroupedFieldError,
  getGroupedFieldChange,
  getGroupedFieldMessages,
  checkValidNumberCore,
  numberUpdate,
} from "@/lib/utils";
import {
  CleaningChange,
  CleaningRule,
  GroupedRowError,
  ValidationError,
} from "@/types/index";
import { Row } from "@tanstack/react-table";

describe("utils", () => {
  it("trimValue works for modes", () => {
    const testString = "  a b  ";
    expect(trimValue(testString, "both")).toBe("a b");
    expect(trimValue(testString, "left")).toBe("a b  ");
    expect(trimValue(testString, "right")).toBe("  a b");
    expect(trimValue(testString, "normalizeSpaces")).toBe("a b");
    expect(trimValue(testString, "noop")).toBe(testString);

    expect(trimValue(null as unknown as string, "both")).toBeNull();
  });

  it("normalizeCase lower/upper/none", () => {
    const testString = "AbC";
    expect(normalizeCase(testString, "lower")).toBe("abc");
    expect(normalizeCase(testString, "upper")).toBe("ABC");
    expect(normalizeCase(testString, "none")).toBe(testString);
    expect(normalizeCase(null as unknown as string, "lower")).toBeNull();
  });

  it("normalizeBasic date serial and formats", () => {
    expect(
      normalizeBasic(
        1,
        {
          type: "date",
          normalize: { toISODate: true },
        } as unknown as CleaningRule,
        "startDate"
      )
    ).toBe("1899-12-31");
    expect(
      normalizeBasic(
        "2021-07-05",
        {
          type: "date",
          normalize: { toISODate: true },
        } as unknown as CleaningRule,
        "startDate"
      )
    ).toBe("2021-07-05");
    expect(
      normalizeBasic(
        "07/05/2021",
        {
          type: "date",
          normalize: { toISODate: true },
        } as unknown as CleaningRule,
        "startDate"
      )
    ).toBe("2021-07-05");
  });

  it("normalizeBasic phoneDigitsOnly cleans and prefixes +", () => {
    const rule = {
      type: "phone",
      normalize: { phoneDigitsOnly: true },
    } as unknown as CleaningRule;
    expect(normalizeBasic("001234", rule, "mobileNumber")).toBe("+1234");
    expect(normalizeBasic("01234", rule, "mobileNumber")).toBe("+1234");
    expect(normalizeBasic("123-45", rule, "mobileNumber")).toBe("+12345");
    expect(
      normalizeBasic(null as unknown as string, rule, "mobileNumber")
    ).toBeNull();
  });

  it("normalizeBasic country toISO3", () => {
    const rule = {
      type: "country",
      normalize: { toISO3: true },
    } as unknown as CleaningRule;
    expect(normalizeBasic("U S A", rule, "country")).toBe("USA");
    expect(normalizeBasic("u s a", rule, "country")).toBe("USA");
    expect(
      normalizeBasic(null as unknown as string, rule, "country")
    ).toBeNull();
  });

  it("normalizeBasic toEmployeeId", () => {
    const rule = {
      type: "id",
      normalize: { toEmployeeId: true },
    } as unknown as CleaningRule;
    expect(normalizeBasic("12345!*^", rule, "employeeId")).toBe("12345");
    expect(normalizeBasic("A12345", rule, "employeeId")).toBe("a12345");
    expect(
      normalizeBasic(null as unknown as string, rule, "employeeId")
    ).toBeNull();
  });

  it("getColumnWidth heuristics", () => {
    expect(getColumnWidth("emailAddress")).toBe(200);
    expect(getColumnWidth("language")).toBe(80);
    expect(getColumnWidth("FirstName")).toBe(120);
    expect(getColumnWidth("random" as string)).toBe(150);
  });

  it("escapeRegex and toRegex", () => {
    const escaped = escapeRegex("a+b*c?");
    expect(escaped).toBe("a\\+b\\*c\\?");
    expect(toRegex("hello").test("say hello world")).toBe(true);
    expect(toRegex("/h.*o/i").test("HELLO")).toBe(true);
    expect(toRegex("test", true).test("atestb")).toBe(false);
    expect(toRegex("test", true).test("test")).toBe(true);
  });

  it("getOptionSet", () => {
    const rule = {
      type: "checkbox",
      options: { "1": "One", "2": "Two" },
    } as unknown as CleaningRule;
    expect(getOptionSet(rule)).toEqual(new Set(["One", "Two"]));
  });

  it("checkIfExcel", () => {
    expect(checkIfExcel("test.xlsx")).toBeTruthy();
    expect(checkIfExcel("test.xls")).toBeTruthy();
    expect(checkIfExcel("test.csv")).toBeFalsy();
    expect(checkIfExcel("test.json")).toBeFalsy();
  });

  it("test cn function", () => {
    expect(cn("test", "test2")).toBe("test test2");
  });

  it("Group Errors By Row", () => {
    const errors = [
      { row: 1, field: "name", message: "Name is required" },
      { row: 1, field: "email", message: "Email is required" },
      { row: 2, field: "name", message: "Name is required" },
      { row: 2, field: "email", message: "Email is required" },
    ] as unknown as ValidationError[];
    expect(groupErrorsByRow(errors)).toEqual([
      {
        row: 1,
        fields: [
          { field: "name", messages: ["Name is required"], value: undefined },
          { field: "email", messages: ["Email is required"], value: undefined },
        ],
      },
      {
        row: 2,
        fields: [
          { field: "name", messages: ["Name is required"], value: undefined },
          { field: "email", messages: ["Email is required"], value: undefined },
        ],
      },
    ]);

    expect(
      getGroupedFieldError(groupErrorsByRow(errors), "name", true, {
        index: 1,
      } as Row<Record<string, unknown>>)
    ).toEqual({
      fields: [
        { field: "name", messages: ["Name is required"], value: undefined },
        { field: "email", messages: ["Email is required"], value: undefined },
      ],
      row: 2,
    });
  });

  it("groupChangesByRow", () => {
    const changes = [
      { row: 1, field: "name", originalValue: "John", cleanedValue: "John" },
      {
        row: 1,
        field: "email",
        originalValue: "john@example.com",
        cleanedValue: "john@example.com",
      },
      { row: 2, field: "name", originalValue: "Jane", cleanedValue: "Jane" },
      {
        row: 2,
        field: "email",
        originalValue: "jane@example.com",
        cleanedValue: "jane@example.com",
      },
    ] as unknown as CleaningChange[];
    expect(groupChangesByRow(changes)).toEqual([
      {
        row: 1,
        fields: [
          { field: "name", messages: [undefined], value: "John" },
          { field: "email", messages: [undefined], value: "john@example.com" },
        ],
      },
      {
        row: 2,
        fields: [
          { field: "name", messages: [undefined], value: "Jane" },
          { field: "email", messages: [undefined], value: "jane@example.com" },
        ],
      },
    ]);

    expect(
      getGroupedFieldChange(groupChangesByRow(changes), "name", {
        index: 1,
      } as Row<Record<string, unknown>>)
    ).toEqual({
      fields: [
        { field: "name", messages: [undefined], value: "John" },
        { field: "email", messages: [undefined], value: "john@example.com" },
      ],
      row: 1,
    });
  });

  it("getGroupedFieldMessages", () => {
    const errors = {
      row: 1,
      fields: [
        {
          field: "name",
          messages: ["Name is required", "Name is too long"],
          value: undefined,
        },
      ],
    } as unknown as GroupedRowError;
    expect(getGroupedFieldMessages(errors, "name")).toBe(
      "Name is required\n Name is too long"
    );
  });

  it("checkValidNumberCore", () => {
    let result = checkValidNumberCore("ZAF", "+27662121190");
    expect(result.callingCode).toBe("27");
    expect(result.numberCallingCode).toBe("27");
    expect(result.valid).toBe(true);
    result = checkValidNumberCore("NLD", "+27662121190");
    expect(result.callingCode).toBe("31");
    expect(result.numberCallingCode).toBe("27");
    expect(result.valid).toBe(true);
  });

  it("numberUpdate", () => {
    let result = numberUpdate("mobileNumber", "+27662121190", "ZAF", "27");
    expect(result.newNumber).toBe("+27662121190");
    expect(result.error).toStrictEqual({
      field: "mobileNumber",
      message:
        "Invalid number. The phone number needs to start with + followed by the country code and be the correct length. In this case the country code is 27",
    });
    result = numberUpdate("mobileNumber", "+27662121190", "NLD", "31");
    expect(result.newNumber).toBe("+27662121190");
    expect(result.error).toStrictEqual({
      field: "mobileNumber",
      message:
        "Invalid number. The phone number needs to start with + followed by the country code and be the correct length. In this case the country code is 31",
    });
  });
});
