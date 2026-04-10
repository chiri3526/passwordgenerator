export const symbolOptions = ["-", "_", "/", "*", "+", ".", ",", "!", "@", "#", "$", "%", "^", "&", "?", "=", "~", ":", ";"] as const;

export type AllowedSymbol = (typeof symbolOptions)[number];

export type PasswordConfig = {
  length: number;
  count: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  selectedSymbols: AllowedSymbol[];
  prefix: string;
  excludeSimilarChars: boolean;
};

export type Preset = {
  id: string;
  userId: string;
  name: string;
  config: PasswordConfig;
  createdAt?: string;
  updatedAt?: string;
};

export type PasswordHistoryItem = {
  id: string;
  userId: string;
  password: string;
  configSnapshot: PasswordConfig;
  note: string;
  createdAt?: string;
};

export type GeneratedPassword = {
  id: string;
  value: string;
  note: string;
  saved: boolean;
};
