import { describe, expect, it } from "vitest";
import { generatePasswords } from "./passwords";
import { type PasswordConfig } from "../types";

const baseConfig: PasswordConfig = {
  length: 16,
  count: 4,
  includeUppercase: true,
  includeLowercase: true,
  includeNumbers: true,
  selectedSymbols: ["-", "_"],
  prefix: "AB",
  excludeSimilarChars: true
};

describe("generatePasswords", () => {
  it("generates the requested number of passwords with prefix", () => {
    const result = generatePasswords(baseConfig);

    expect(result.error).toBeNull();
    expect(result.passwords).toHaveLength(4);
    expect(result.passwords.every((item) => item.value.startsWith("AB"))).toBe(true);
    expect(result.passwords.every((item) => item.value.length === 16)).toBe(true);
  });

  it("returns an error when no character set is selected", () => {
    const result = generatePasswords({
      ...baseConfig,
      includeUppercase: false,
      includeLowercase: false,
      includeNumbers: false,
      selectedSymbols: []
    });

    expect(result.error).toBe("少なくとも1種類の文字セットを選択してください。");
    expect(result.passwords).toHaveLength(0);
  });
});
