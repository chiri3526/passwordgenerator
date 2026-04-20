import process from "node:process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function printUsage() {
  console.log(`
Usage:
  node scripts/migrate-password-history.mjs [--apply] [--batch-size=200]

Options:
  --apply            Firestore を実際に更新します。未指定時は dry-run です。
  --batch-size=NUM   1 バッチの最大更新件数。既定値は 200 です。
  --help             このヘルプを表示します。

Environment:
  GOOGLE_APPLICATION_CREDENTIALS
    または Firebase Admin SDK が利用できる実行環境を用意してください。

Behavior:
  - password_history から旧 schema の password を検出
  - passwordPreview / passwordLength / schemaVersion / migratedAt を追加
  - --apply 指定時のみ password を削除
`);
}

function parseArgs(argv) {
  const options = {
    apply: false,
    batchSize: 200
  };

  for (const arg of argv) {
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }

    if (arg === "--help") {
      printUsage();
      process.exit(0);
    }

    if (arg.startsWith("--batch-size=")) {
      const value = Number(arg.slice("--batch-size=".length));
      if (!Number.isInteger(value) || value <= 0 || value > 500) {
        throw new Error("--batch-size には 1 から 500 の整数を指定してください。");
      }
      options.batchSize = value;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function maskPassword(value) {
  if (!value) return "";
  if (value.length <= 2) return "*".repeat(value.length);
  if (value.length <= 6) return `${value[0]}${"*".repeat(value.length - 2)}${value.at(-1) ?? ""}`;
  return `${value.slice(0, 2)}${"*".repeat(Math.max(value.length - 4, 0))}${value.slice(-2)}`;
}

function readDotEnvProjectId() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return undefined;
  }

  const content = readFileSync(envPath, "utf8");
  const line = content
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("VITE_FIREBASE_PROJECT_ID=") || entry.startsWith("FIREBASE_PROJECT_ID="));

  if (!line) {
    return undefined;
  }

  const [, rawValue = ""] = line.split("=", 2);
  const value = rawValue.trim().replace(/^['"]|['"]$/g, "");
  return value || undefined;
}

async function loadAdminSdk() {
  try {
    const [{ applicationDefault, cert, getApps, initializeApp }, { FieldValue, getFirestore }] = await Promise.all([
      import("firebase-admin/app"),
      import("firebase-admin/firestore")
    ]);

    return { applicationDefault, cert, getApps, initializeApp, FieldValue, getFirestore };
  } catch (error) {
    throw new Error(
      "firebase-admin が見つかりません。`npm install firebase-admin` を実行してから再度お試しください。",
      { cause: error }
    );
  }
}

function resolveCredential({ applicationDefault, cert }) {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inline) {
    return cert(JSON.parse(inline));
  }

  return applicationDefault();
}

function resolveProjectId() {
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    readDotEnvProjectId()
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { applicationDefault, cert, getApps, initializeApp, FieldValue, getFirestore } = await loadAdminSdk();

  if (getApps().length === 0) {
    initializeApp({
      credential: resolveCredential({ applicationDefault, cert }),
      projectId: resolveProjectId()
    });
  }

  const db = getFirestore();
  const snapshot = await db.collection("password_history").get();

  let scanned = 0;
  let alreadyMigrated = 0;
  let candidates = 0;
  let updated = 0;
  let batchesCommitted = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    scanned += 1;
    const data = doc.data();
    const legacyPassword = typeof data.password === "string" ? data.password : "";
    const hasNewFields = typeof data.passwordPreview === "string" && typeof data.passwordLength === "number";

    if (!legacyPassword) {
      alreadyMigrated += 1;
      continue;
    }

    candidates += 1;

    const payload = {
      passwordPreview: hasNewFields ? data.passwordPreview : maskPassword(legacyPassword),
      passwordLength: hasNewFields ? data.passwordLength : legacyPassword.length,
      schemaVersion: 2,
      migratedAt: FieldValue.serverTimestamp()
    };

    if (options.apply) {
      batch.update(doc.ref, {
        ...payload,
        password: FieldValue.delete()
      });
      batchCount += 1;

      if (batchCount >= options.batchSize) {
        await batch.commit();
        updated += batchCount;
        batchesCommitted += 1;
        batch = db.batch();
        batchCount = 0;
      }
    } else {
      console.log(`[dry-run] ${doc.id}`, payload);
    }
  }

  if (options.apply && batchCount > 0) {
    await batch.commit();
    updated += batchCount;
    batchesCommitted += 1;
  }

  console.log("");
  console.log("Migration summary");
  console.log(`- scanned: ${scanned}`);
  console.log(`- candidates: ${candidates}`);
  console.log(`- already-migrated-or-empty: ${alreadyMigrated}`);
  console.log(`- mode: ${options.apply ? "apply" : "dry-run"}`);
  if (options.apply) {
    console.log(`- updated: ${updated}`);
    console.log(`- committed-batches: ${batchesCommitted}`);
  }
}

main().catch((error) => {
  console.error("");
  console.error("Migration failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
