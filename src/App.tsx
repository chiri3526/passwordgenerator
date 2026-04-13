import { type FormEvent, useEffect, useState } from "react";
import { type User } from "firebase/auth";
import {
  deleteHistoryItem,
  deletePreset,
  isFirebaseConfigured,
  loginWithEmail,
  loginWithGoogle,
  logout,
  registerWithEmail,
  savePasswordHistory,
  savePreset,
  subscribeToAuth,
  subscribeToHistory,
  subscribeToPresets,
  updateHistoryNote,
  updatePresetName
} from "./lib/firebase";
import { generatePasswords } from "./lib/passwords";
import {
  symbolOptions,
  type GeneratedPassword,
  type PasswordConfig,
  type PasswordHistoryItem,
  type Preset
} from "./types";
import passwordGeneratorLogo from "./assets/password-generator-logo.png";

const HOME_PATH = "/";
const APP_PATH = "/generator";
const STATUS_MESSAGE_TIMEOUT_MS = 4000;

const defaultConfig: PasswordConfig = {
  length: 16,
  count: 8,
  includeUppercase: true,
  includeLowercase: true,
  includeNumbers: true,
  selectedSymbols: ["-", "_", "!"],
  prefix: "",
  excludeSimilarChars: true
};

const samplePresets = [
  { name: "標準", config: { ...defaultConfig, length: 14, count: 6 } },
  { name: "強力", config: { ...defaultConfig, length: 24, count: 10, selectedSymbols: [...symbolOptions] } },
  { name: "数字なし", config: { ...defaultConfig, includeNumbers: false, length: 18 } }
];

function formatDate(value?: string) {
  if (!value) return "保存日時なし";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function getCompactEmailLabel(email?: string | null) {
  if (!email) return "Google User";
  const [localPart, domain] = email.split("@");
  if (!domain) return email;

  const compactLocal = localPart.length > 10 ? `${localPart.slice(0, 4)}...${localPart.slice(-2)}` : localPart;
  return `${compactLocal}@${domain}`;
}

function getUserBadgeLabel(user: User) {
  const source = user.email?.trim() || user.displayName?.trim() || "User";
  const char = [...source][0];
  return (char ?? "U").toUpperCase();
}

function syncPath(path: string) {
  if (window.location.pathname !== path) {
    window.history.replaceState({}, "", path);
  }
}

type AuthScreenProps = {
  authMode: "login" | "register";
  email: string;
  password: string;
  errorMessage: string;
  loadingAuth: boolean;
  onAuthModeChange: (mode: "login" | "register") => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onGoogleLogin: () => Promise<void>;
};

function AuthScreen({
  authMode,
  email,
  password,
  errorMessage,
  loadingAuth,
  onAuthModeChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onGoogleLogin
}: AuthScreenProps) {
  return (
    <div className="auth-shell">
      <div className="card auth-simple-panel">
        <div className="auth-simple-header">
          <img
            className="auth-logo"
            src={passwordGeneratorLogo}
            alt="PasswordGenerator"
          />
        </div>

        {!isFirebaseConfigured ? (
          <div className="notice-box">`.env` に Firebase 設定がないため、ログイン機能は現在無効です。</div>
        ) : null}
        {loadingAuth ? <p className="panel-caption">認証状態を確認しています...</p> : null}
        {errorMessage ? <div className="error-box">{errorMessage}</div> : null}

        <form className="auth-form" onSubmit={(event) => void onSubmit(event)}>
          <div className="mode-switch" role="tablist" aria-label="認証モード切り替え">
            <button
              type="button"
              className={authMode === "login" ? "tab-button active" : "tab-button"}
              onClick={() => onAuthModeChange("login")}
            >
              ログイン
            </button>
            <button
              type="button"
              className={authMode === "register" ? "tab-button active" : "tab-button"}
              onClick={() => onAuthModeChange("register")}
            >
              新規登録
            </button>
          </div>

          <label className="field">
            <span>メールアドレス</span>
            <input
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="field">
            <span>パスワード</span>
            <input
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="6文字以上"
              minLength={6}
              required
            />
          </label>

          <button type="submit" className="primary-button full-width" disabled={!isFirebaseConfigured}>
            {authMode === "login" ? "メールでログイン" : "メールで登録"}
          </button>

          <button
            type="button"
            className="secondary-button full-width"
            onClick={() => void onGoogleLogin()}
            disabled={!isFirebaseConfigured}
          >
            Google でログイン
          </button>
        </form>
      </div>
    </div>
  );
}

type AppScreenProps = {
  config: PasswordConfig;
  generatedPasswords: GeneratedPassword[];
  presets: Preset[];
  history: PasswordHistoryItem[];
  presetName: string;
  statusMessage: string;
  errorMessage: string;
  pendingSaveId: string | null;
  historyDrafts: Record<string, string>;
  user: User;
  onConfigChange: <K extends keyof PasswordConfig>(key: K, value: PasswordConfig[K]) => void;
  onToggleSymbol: (symbol: (typeof symbolOptions)[number]) => void;
  onGenerate: () => void;
  onPresetNameChange: (value: string) => void;
  onSavePreset: () => Promise<void>;
  onSaveHistory: (item: GeneratedPassword) => Promise<void>;
  onCopy: (value: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onHistoryDraftChange: (id: string, value: string) => void;
  onUpdateHistory: (id: string) => Promise<void>;
  onDeleteHistory: (id: string) => Promise<void>;
  onRenamePreset: (preset: Preset) => Promise<void>;
  onDeletePreset: (id: string) => Promise<void>;
  onApplyPreset: (config: PasswordConfig) => void;
  onGeneratedNoteChange: (id: string, value: string) => void;
};

function AppScreen({
  config,
  generatedPasswords,
  presets,
  history,
  presetName,
  statusMessage,
  errorMessage,
  pendingSaveId,
  historyDrafts,
  user,
  onConfigChange,
  onToggleSymbol,
  onGenerate,
  onPresetNameChange,
  onSavePreset,
  onSaveHistory,
  onCopy,
  onLogout,
  onHistoryDraftChange,
  onUpdateHistory,
  onDeleteHistory,
  onRenamePreset,
  onDeletePreset,
  onApplyPreset,
  onGeneratedNoteChange
}: AppScreenProps) {
  const compactEmail = getCompactEmailLabel(user.email);
  const userBadge = getUserBadgeLabel(user);

  return (
    <div className="app-shell">
      <header className="workspace-header">
        <div className="workspace-title">
          <img className="workspace-logo" src={passwordGeneratorLogo} alt="Password Generator" />
        </div>

        <div className="account-inline" aria-label="ログイン中のアカウント">
          <div className="account-chip">
            <span className="account-avatar" aria-hidden="true">
              {userBadge}
            </span>
            <div className="account-meta">
              <span className="account-state">ログイン中</span>
              <strong title={user.email ?? "Google User"}>{compactEmail}</strong>
            </div>
          </div>
          <button type="button" className="secondary-button account-logout" onClick={() => void onLogout()}>
            ログアウト
          </button>
        </div>
      </header>

      <div className="status-banner-area">
        {statusMessage ? <div className="status-box">{statusMessage}</div> : null}
        {errorMessage ? <div className="error-box">{errorMessage}</div> : null}
      </div>

      <main className="dashboard-layout">
        <section className="main-column">
          <section className="card generator-card">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Generator</p>
                <h2>生成設定</h2>
              </div>
              <button type="button" className="primary-button" onClick={onGenerate}>
                パスワードを生成
              </button>
            </div>

            <div className="settings-section">
              <div className="settings-heading">
                <h3>基本設定</h3>
                <p>文字数や生成数などの基本条件を先に決めます。</p>
              </div>
              <div className="field-grid">
                <label className="field">
                  <span>文字数</span>
                  <input
                    type="number"
                    min={2}
                    max={40}
                    value={config.length}
                    onChange={(event) => onConfigChange("length", Number(event.target.value))}
                  />
                </label>

                <label className="field">
                  <span>生成数</span>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={config.count}
                    onChange={(event) => onConfigChange("count", Number(event.target.value))}
                  />
                </label>
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-heading">
                <h3>文字種</h3>
                <p>必要な文字カテゴリを選び、読み間違えやすい文字の除外もここで調整します。</p>
              </div>
              <div className="toggle-grid">
                <label className="choice-item">
                  <input
                    type="checkbox"
                    checked={config.includeUppercase}
                    onChange={(event) => onConfigChange("includeUppercase", event.target.checked)}
                  />
                  <div>
                    <strong>大文字を含める</strong>
                    <span>ABC などの英大文字を利用します。</span>
                  </div>
                </label>
                <label className="choice-item">
                  <input
                    type="checkbox"
                    checked={config.includeLowercase}
                    onChange={(event) => onConfigChange("includeLowercase", event.target.checked)}
                  />
                  <div>
                    <strong>小文字を含める</strong>
                    <span>abc などの英小文字を利用します。</span>
                  </div>
                </label>
                <label className="choice-item">
                  <input
                    type="checkbox"
                    checked={config.includeNumbers}
                    onChange={(event) => onConfigChange("includeNumbers", event.target.checked)}
                  />
                  <div>
                    <strong>数字を含める</strong>
                    <span>0-9 を加えて強度を高めます。</span>
                  </div>
                </label>
                <label className="choice-item">
                  <input
                    type="checkbox"
                    checked={config.excludeSimilarChars}
                    onChange={(event) => onConfigChange("excludeSimilarChars", event.target.checked)}
                  />
                  <div>
                    <strong>紛らわしい文字を除外</strong>
                    <span>見分けにくい文字を除外します。</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-heading">
                <h3>記号</h3>
                <p>使いたい記号だけを選択して、用途に合うルールへ調整します。</p>
              </div>
              <div className="symbol-grid">
                {symbolOptions.map((symbol) => {
                  const checked = config.selectedSymbols.includes(symbol);

                  return (
                    <label key={symbol} className={checked ? "symbol-pill is-selected" : "symbol-pill"}>
                      <input type="checkbox" checked={checked} onChange={() => onToggleSymbol(symbol)} />
                      <span>{symbol}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-heading">
                <h3>クイックプリセット</h3>
                <p>よく使う条件へすぐ切り替えられるよう、代表的な設定を用意しています。</p>
              </div>
              <div className="sample-row">
                {samplePresets.map((sample) => (
                  <button key={sample.name} type="button" className="ghost-button" onClick={() => onApplyPreset(sample.config)}>
                    {sample.name}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="card result-card">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Results</p>
                <h2>生成結果</h2>
              </div>
              <span className="panel-chip">{generatedPasswords.length} items</span>
            </div>

            {generatedPasswords.length === 0 ? (
              <p className="empty-state">条件を設定してパスワードを生成してください。</p>
            ) : (
              <div className="result-list">
                {generatedPasswords.map((item) => (
                  <article key={item.id} className="result-item">
                    <div className="result-topline">
                      <span className="result-label">Generated password</span>
                      <span className={item.saved ? "saved-badge" : "saved-badge pending"}>
                        {item.saved ? "保存済み" : "未保存"}
                      </span>
                    </div>
                    <code>{item.value}</code>
                    <textarea
                      value={item.note}
                      onChange={(event) => onGeneratedNoteChange(item.id, event.target.value)}
                      placeholder="保存時に残すメモ"
                      rows={2}
                    />
                    <div className="result-actions">
                      <button type="button" className="ghost-button" onClick={() => void onCopy(item.value)}>
                        コピー
                      </button>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => void onSaveHistory(item)}
                        disabled={item.saved || pendingSaveId === item.id}
                      >
                        {item.saved ? "保存済み" : pendingSaveId === item.id ? "保存中..." : "履歴へ保存"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>

        <aside className="side-column">
          <section className="card preset-card">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Presets</p>
                <h2>プリセット保存</h2>
              </div>
            </div>

            <div className="preset-save no-top-gap">
              <label className="field">
                <span>現在の設定を保存</span>
                <input
                  type="text"
                  value={presetName}
                  onChange={(event) => onPresetNameChange(event.target.value)}
                  placeholder="社内標準"
                />
              </label>
              <button type="button" className="primary-button full-width" onClick={() => void onSavePreset()}>
                プリセットを保存
              </button>
            </div>

            {presets.length === 0 ? (
              <p className="empty-state">保存済みプリセットはまだありません。</p>
            ) : (
              <div className="stack-list">
                {presets.map((preset) => (
                  <article key={preset.id} className="stack-item">
                    <div>
                      <h3>{preset.name}</h3>
                      <p className="panel-caption">
                        {preset.config.length}文字 / {preset.config.count}件 / 記号 {preset.config.selectedSymbols.join(" ") || "なし"}
                      </p>
                    </div>
                    <div className="stack-actions">
                      <button type="button" className="ghost-button" onClick={() => onApplyPreset(preset.config)}>
                        適用
                      </button>
                      <button type="button" className="ghost-button" onClick={() => void onRenamePreset(preset)}>
                        名前変更
                      </button>
                      <button type="button" className="ghost-button danger" onClick={() => void onDeletePreset(preset.id)}>
                        削除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="card history-card">
            <div className="section-heading">
              <div>
                <p className="section-kicker">History</p>
                <h2>保存履歴</h2>
              </div>
            </div>

            {history.length === 0 ? (
              <p className="empty-state">保存された履歴はまだありません。</p>
            ) : (
              <div className="stack-list">
                {history.map((item) => (
                  <article key={item.id} className="stack-item history-item">
                    <div className="history-meta">
                      <code>{item.password}</code>
                      <p className="panel-caption">{formatDate(item.createdAt)}</p>
                      <p className="panel-caption">
                        設定: {item.configSnapshot.length}文字 / {item.configSnapshot.count}件 / Prefix {item.configSnapshot.prefix || "なし"}
                      </p>
                    </div>

                    <textarea
                      rows={2}
                      value={historyDrafts[item.id] ?? item.note}
                      onChange={(event) => onHistoryDraftChange(item.id, event.target.value)}
                    />

                    <div className="stack-actions">
                      <button type="button" className="ghost-button" onClick={() => void onCopy(item.password)}>
                        コピー
                      </button>
                      <button type="button" className="primary-button" onClick={() => void onUpdateHistory(item.id)}>
                        メモ保存
                      </button>
                      <button type="button" className="ghost-button danger" onClick={() => void onDeleteHistory(item.id)}>
                        削除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}

export default function App() {
  const [config, setConfig] = useState<PasswordConfig>(defaultConfig);
  const [generatedPasswords, setGeneratedPasswords] = useState<GeneratedPassword[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [history, setHistory] = useState<PasswordHistoryItem[]>([]);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [presetName, setPresetName] = useState("");
  const [statusMessage, setStatusMessage] = useState("生成条件を調整してパスワードを作成してください。");
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [pendingSaveId, setPendingSaveId] = useState<string | null>(null);
  const [historyDrafts, setHistoryDrafts] = useState<Record<string, string>>({});

  useEffect(
    () =>
      subscribeToAuth((nextUser) => {
        setUser(nextUser);
        setLoadingAuth(false);
      }),
    []
  );

  useEffect(() => {
    if (loadingAuth) return;
    syncPath(user ? APP_PATH : HOME_PATH);
  }, [loadingAuth, user]);

  useEffect(() => {
    if (!statusMessage) return undefined;

    const timeoutId = window.setTimeout(() => {
      setStatusMessage("");
    }, STATUS_MESSAGE_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [statusMessage]);

  useEffect(() => {
    if (!user) {
      setPresets([]);
      setHistory([]);
      setHistoryDrafts({});
      return undefined;
    }

    const unsubscribePresets = subscribeToPresets(user.uid, setPresets);
    const unsubscribeHistory = subscribeToHistory(user.uid, (items) => {
      setHistory(items);
      setHistoryDrafts((current) => {
        const next = { ...current };
        items.forEach((item) => {
          next[item.id] = next[item.id] ?? item.note;
        });
        return next;
      });
    });

    return () => {
      unsubscribePresets();
      unsubscribeHistory();
    };
  }, [user]);

  function updateConfig<K extends keyof PasswordConfig>(key: K, value: PasswordConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function toggleSymbol(symbol: (typeof symbolOptions)[number]) {
    setConfig((current) => ({
      ...current,
      selectedSymbols: current.selectedSymbols.includes(symbol)
        ? current.selectedSymbols.filter((entry) => entry !== symbol)
        : [...current.selectedSymbols, symbol]
    }));
  }

  function handleGenerate() {
    setErrorMessage("");
    const result = generatePasswords(config);

    if (result.error) {
      setGeneratedPasswords([]);
      setErrorMessage(result.error);
      setStatusMessage("生成条件を見直してください。");
      return;
    }

    setGeneratedPasswords(result.passwords);
    setStatusMessage(`${result.passwords.length}件のパスワードを生成しました。`);
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    try {
      if (authMode === "login") {
        await loginWithEmail(email, password);
        setStatusMessage("ログインしました。");
      } else {
        await registerWithEmail(email, password);
        setStatusMessage("アカウントを作成しました。");
      }
      setPassword("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "認証に失敗しました。");
    }
  }

  async function handleGoogleLogin() {
    setErrorMessage("");
    try {
      await loginWithGoogle();
      setStatusMessage("Google でログインしました。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Google ログインに失敗しました。");
    }
  }

  async function handleLogout() {
    setErrorMessage("");
    try {
      await logout();
      setGeneratedPasswords([]);
      setStatusMessage("ログアウトしました。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ログアウトに失敗しました。");
    }
  }

  async function handleSavePreset() {
    if (!user) {
      setErrorMessage("プリセット保存にはログインが必要です。");
      return;
    }

    if (!presetName.trim()) {
      setErrorMessage("プリセット名を入力してください。");
      return;
    }

    setErrorMessage("");
    try {
      await savePreset(user.uid, presetName.trim(), config);
      setPresetName("");
      setStatusMessage("プリセットを保存しました。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "プリセット保存に失敗しました。");
    }
  }

  async function handleSaveHistory(item: GeneratedPassword) {
    if (!user) {
      setErrorMessage("履歴保存にはログインが必要です。");
      return;
    }

    setPendingSaveId(item.id);
    setErrorMessage("");

    try {
      await savePasswordHistory(user.uid, item.value, config, item.note);
      setGeneratedPasswords((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, saved: true } : entry))
      );
      setStatusMessage("履歴を保存しました。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "履歴保存に失敗しました。");
    } finally {
      setPendingSaveId(null);
    }
  }

  async function handleCopy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatusMessage("クリップボードにコピーしました。");
    } catch {
      setErrorMessage("コピーに失敗しました。");
    }
  }

  async function handleRenamePreset(preset: Preset) {
    const nextName = window.prompt("新しいプリセット名", preset.name);
    if (!nextName || !nextName.trim()) return;

    try {
      await updatePresetName(preset.id, nextName.trim());
      setStatusMessage("プリセット名を更新しました。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "プリセット名の更新に失敗しました。");
    }
  }

  async function handleDeletePreset(id: string) {
    try {
      await deletePreset(id);
      setStatusMessage("プリセットを削除しました。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "プリセット削除に失敗しました。");
    }
  }

  async function handleUpdateHistory(id: string) {
    try {
      await updateHistoryNote(id, historyDrafts[id] ?? "");
      setStatusMessage("メモを保存しました。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "メモ保存に失敗しました。");
    }
  }

  async function handleDeleteHistory(id: string) {
    try {
      await deleteHistoryItem(id);
      setStatusMessage("履歴を削除しました。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "履歴削除に失敗しました。");
    }
  }

  if (!user) {
    return (
      <AuthScreen
        authMode={authMode}
        email={email}
        password={password}
        errorMessage={errorMessage}
        loadingAuth={loadingAuth}
        onAuthModeChange={setAuthMode}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={handleAuthSubmit}
        onGoogleLogin={handleGoogleLogin}
      />
    );
  }

  return (
    <AppScreen
      config={config}
      generatedPasswords={generatedPasswords}
      presets={presets}
      history={history}
      presetName={presetName}
      statusMessage={statusMessage}
      errorMessage={errorMessage}
      pendingSaveId={pendingSaveId}
      historyDrafts={historyDrafts}
      user={user}
      onConfigChange={updateConfig}
      onToggleSymbol={toggleSymbol}
      onGenerate={handleGenerate}
      onPresetNameChange={setPresetName}
      onSavePreset={handleSavePreset}
      onSaveHistory={handleSaveHistory}
      onCopy={handleCopy}
      onLogout={handleLogout}
      onHistoryDraftChange={(id, value) => setHistoryDrafts((current) => ({ ...current, [id]: value }))}
      onUpdateHistory={handleUpdateHistory}
      onDeleteHistory={handleDeleteHistory}
      onRenamePreset={handleRenamePreset}
      onDeletePreset={handleDeletePreset}
      onApplyPreset={setConfig}
      onGeneratedNoteChange={(id, value) =>
        setGeneratedPasswords((current) =>
          current.map((entry) => (entry.id === id ? { ...entry, note: value } : entry))
        )
      }
    />
  );
}
