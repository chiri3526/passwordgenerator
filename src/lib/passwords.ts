import { type GeneratedPassword, type PasswordConfig } from "../types";

const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const NUMBERS = "23456789";
const SIMILAR_CHARS = new Set(["I", "l", "1", "O", "0"]);

function randomIndex(length: number) {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % length;
}

function filterSimilarCharacters(value: string, shouldFilter: boolean) {
  if (!shouldFilter) {
    return value;
  }

  return Array.from(value)
    .filter((char) => !SIMILAR_CHARS.has(char))
    .join("");
}

function getCharacterPools(config: PasswordConfig) {
  const pools: string[] = [];

  if (config.includeUppercase) {
    pools.push(filterSimilarCharacters(UPPERCASE, config.excludeSimilarChars));
  }

  if (config.includeLowercase) {
    pools.push(filterSimilarCharacters(LOWERCASE, config.excludeSimilarChars));
  }

  if (config.includeNumbers) {
    pools.push(filterSimilarCharacters(NUMBERS, config.excludeSimilarChars));
  }

  if (config.selectedSymbols.length > 0) {
    pools.push(config.selectedSymbols.join(""));
  }

  return pools.filter(Boolean);
}

function sampleFromPool(pool: string) {
  return pool[randomIndex(pool.length)];
}

function shuffle(value: string) {
  const chars = value.split("");

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const next = randomIndex(i + 1);
    [chars[i], chars[next]] = [chars[next], chars[i]];
  }

  return chars.join("");
}

function validateConfig(config: PasswordConfig) {
  if (config.length < 2 || config.length > 40) {
    return "文字数は2〜40文字で指定してください。";
  }

  if (config.count < 1 || config.count > 1000) {
    return "生成個数は1〜1000件で指定してください。";
  }

  if (config.prefix.length > config.length) {
    return "先頭文字が文字数を超えています。";
  }

  const pools = getCharacterPools(config);
  if (pools.length === 0) {
    return "少なくとも1種類の文字セットを選択してください。";
  }

  return null;
}

export function generatePasswords(config: PasswordConfig): {
  passwords: GeneratedPassword[];
  error: string | null;
} {
  const validationError = validateConfig(config);
  if (validationError) {
    return { passwords: [], error: validationError };
  }

  const pools = getCharacterPools(config);
  const aggregatePool = pools.join("");
  const passwords: GeneratedPassword[] = [];

  for (let index = 0; index < config.count; index += 1) {
    const requiredChars = pools.map((pool) => sampleFromPool(pool));
    const remainingLength = config.length - config.prefix.length;
    const randomLength = Math.max(remainingLength - requiredChars.length, 0);
    const randomChars = Array.from({ length: randomLength }, () => sampleFromPool(aggregatePool));
    const body = shuffle([...requiredChars, ...randomChars].join("")).slice(0, remainingLength);
    const value = `${config.prefix}${body}`.slice(0, config.length);

    passwords.push({
      id: `${Date.now()}-${index}-${value}`,
      value,
      note: "",
      saved: false
    });
  }

  return { passwords, error: null };
}

export function getPasswordStrength(config: PasswordConfig) {
  let score = 0;

  if (config.includeUppercase) score += 1;
  if (config.includeLowercase) score += 1;
  if (config.includeNumbers) score += 1;
  if (config.selectedSymbols.length > 0) score += 2;
  if (config.length >= 12) score += 2;
  if (config.length >= 20) score += 2;
  if (config.excludeSimilarChars) score += 1;

  if (score <= 3) return "ベーシック";
  if (score <= 6) return "ストロング";
  return "アトリエ級";
}
