# Firestore History Migration

`password_history.password` に平文が残っている旧データを、新しい schema へ段階移行するためのメモです。

## 目的

- 旧 schema: `password`
- 新 schema: `passwordPreview`, `passwordLength`
- 追加メタデータ: `schemaVersion`, `migratedAt`

アプリ側は移行期間中、旧 `password` が残っていても一覧表示できる互換読み取りを維持しています。

## 事前準備

1. Firestore Export を取得する
2. 管理者資格情報を用意する
3. `firebase-admin` を追加する

```bash
npm install firebase-admin
```

Admin SDK の認証はどちらかを使います。

- `GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`
- `FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'`

## Dry Run

まずは更新対象だけ確認します。

```bash
node scripts/migrate-password-history.mjs
```

## 本番適用

確認後に実更新します。

```bash
node scripts/migrate-password-history.mjs --apply
```

必要なら 1 バッチの件数を調整できます。

```bash
node scripts/migrate-password-history.mjs --apply --batch-size=100
```

## 移行の流れ

1. アプリの互換読み取りを先にデプロイする
2. Dry Run で対象件数を確認する
3. `--apply` で `passwordPreview` と `passwordLength` を付与し、`password` を削除する
4. Firestore でサンプル確認する
5. 問題がなければ新ルールを本番反映する

## 更新内容

旧データに対して以下を設定します。

- `passwordPreview`: 平文をマスクした表示用文字列
- `passwordLength`: 元パスワード長
- `schemaVersion`: `2`
- `migratedAt`: サーバー時刻
- `password`: 削除

## 注意点

- Admin SDK 実行なので Firestore Security Rules はバイパスされます
- まず Dry Run で確認してから `--apply` を使ってください
- 平文削除後は元の値へ戻せないため、バックアップ取得を先に行ってください
