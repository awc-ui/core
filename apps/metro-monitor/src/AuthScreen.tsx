import {
  t,
  formatNumber as fmt,
  getLocale,
  localizedMessage,
} from "./i18n.mjs";
import { useEffect, useRef, useState } from "react";
import {
  MdButton,
  MdCard,
  MdCheckbox,
  MdIconButton,
  MdOtpField,
  MdTextField,
  MdTooltip,
} from "@awc-ui/react";
import { Brand, Icon, NetworkMap } from "./App";
import { stations } from "./model.mjs";
import {
  DemoAuth,
  DEMO_CODE,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_RECOVERY,
} from "./auth.mjs";
import { LanguageChoice } from "./LanguageChoice";
import { useLocale } from "./useLocale";
import { normalizeDigits, countLabel } from "./i18n.mjs";
export type User = { name: string; email: string };
const auth = new DemoAuth();
export function Auth({
  onAuthenticated,
}: {
  onAuthenticated: (user: User) => void;
}) {
  const language = useLocale();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [screen, setScreen] = useState<"login" | "signup" | "mfa">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [enroll, setEnroll] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [notice, setNotice] = useState("");
  const [theme, setTheme] = useState(
    document.documentElement.dataset.theme || "light",
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const attempt = useRef(0);
  useEffect(() => {
    heading.current?.focus();
    document.title =
      t(
        screen === "login"
          ? "Sign in"
          : screen === "signup"
            ? "Create account"
            : "Verify identity",
      ) + " · Metro pulse";
    return () => {};
  }, [screen, recovery, language]);
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);
  useEffect(
    () => () => {
      attempt.current++;
      auth.cancel();
    },
    [],
  );
  const change = (next: "login" | "signup") => {
    attempt.current++;
    auth.cancel();
    setScreen(next);
    setError("");
    setNotice("");
    setBusy(false);
    setCode("");
    setRecovery(false);
    setPassword("");
    setConfirm("");
    setPasswordVisible(false);
    setConfirmVisible(false);
  };
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const id = ++attempt.current;
    setError("");
    setNotice("");
    setBusy(true);
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (screen === "mfa") {
        const user = auth.verify(String(values.code || ""), recovery);
        if (id === attempt.current) onAuthenticated(user);
        return;
      }
      const challenge =
        screen === "signup"
          ? await auth.signup({
              name: String(values.name || ""),
              email: String(values.email || ""),
              password: String(values.password || ""),
              confirm: String(values.confirm || ""),
            })
          : await auth.signin(
              String(values.email || ""),
              String(values.password || ""),
            );
      if (id !== attempt.current) return;
      setEnroll(challenge.enroll);
      setEmail(challenge.user.email);
      setCode("");
      setScreen("mfa");
      setCountdown(30);
      setPassword("");
      setConfirm("");
    } catch (err) {
      if (id === attempt.current)
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
        );
    } finally {
      if (id === attempt.current) setBusy(false);
    }
  };
  const demo = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError("");
    setNotice("Demo credentials filled. Continue to sign in.");
  };
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("metro-theme", next);
    } catch {}
  };
  return (
    <div className="auth-shell">
      <section className="auth-story">
        <Brand />
        <div className="auth-story-main">
          <span className="auth-kicker">
            <span />
            {t("Central metro · Operations control")}
          </span>
          <h2>
            {t("A clear view.")}
            <br />
            {t("A moving city.")}
          </h2>
          <p>
            {t(
              "One place to monitor every station, understand passenger flow, and keep your network moving.",
            )}
          </p>
          <MdCard variant="outlined" className="auth-network">
            <div className="card-heading">
              <span className="auth-map-title">
                <Icon name="hub" />
                {t("Central metro")}
              </span>
              <span className="auth-demo-label">{t("Simulated network")}</span>
            </div>
            <NetworkMap rows={stations} line="all" compact />
            <div className="auth-network-footer">
              <span>{countLabel(15, "stations")}</span>
              <span>{t("{count} connected lines", { count: fmt(3) })}</span>
              <span>
                <Icon name="sensors" />
                {t("Network online")}
              </span>
            </div>
          </MdCard>
          <div className="auth-feature-row">
            <span>
              <Icon name="monitoring" />
              {t("Station telemetry")}
            </span>
            <span>
              <Icon name="verified_user" />
              {t("MFA flow")}
            </span>
            <span>
              <Icon name="warning" />
              {t("Incident response")}
            </span>
          </div>
        </div>
        <div className="auth-story-footer">
          <span>Metro pulse</span>
          <span>{t("Powered by awc-ui")}</span>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-top">
          <LanguageChoice compact />
          <span className="environment-badge">{t("Interactive showcase")}</span>
          <MdTooltip text={t("Toggle appearance")}>
            <MdIconButton
              icon={theme === "dark" ? "light_mode" : "dark_mode"}
              aria-label={t("Toggle appearance")}
              onMdClick={toggleTheme}
            />
          </MdTooltip>
        </div>
        <div className={`auth-form-wrap auth-form-wrap--${screen}`}>
          <div className="auth-mobile-brand">
            <Brand />
          </div>
          <div className="auth-form-icon">
            <Icon
              name={
                screen === "mfa"
                  ? "shield_lock"
                  : screen === "signup"
                    ? "person_add"
                    : "login"
              }
            />
          </div>
          <div className="auth-step-label">
            {screen === "mfa"
              ? t("Step 2 of 2 · Verify identity")
              : t("Step 1 of 2 · Account access")}
          </div>
          <h1 ref={heading} tabIndex={-1}>
            {screen === "mfa"
              ? recovery
                ? t("Use a recovery code")
                : enroll
                  ? t("Set up verification")
                  : t("Verify it’s you")
              : screen === "signup"
                ? t("Create your account")
                : t("Welcome back")}
          </h1>
          <p className="auth-subtitle">
            {screen === "mfa"
              ? recovery
                ? t("Enter your eight-character demo recovery code.")
                : enroll
                  ? t(
                      "Enter the six-digit demo code to finish setting up your account.",
                    )
                  : t(
                      "Enter the six-digit demo code to continue to your workspace.",
                    )
              : screen === "signup"
                ? t("Join your metro operations workspace.")
                : t("Sign in to your metro operations workspace.")}
          </p>
          <form
            key={`${screen}-${recovery}`}
            onSubmit={submit}
            onInvalidCapture={(event) => {
              event.preventDefault();
              setError(
                screen === "mfa"
                  ? recovery
                    ? "Enter all eight characters."
                    : "Enter all six digits."
                  : "Please complete the required fields with valid values.",
              );
              (
                event.target as HTMLElement & { setFocus?: () => Promise<void> }
              ).setFocus?.();
            }}
            className="auth-form"
          >
            {screen !== "mfa" && (
              <div
                className={`auth-fields${screen === "signup" ? " auth-fields--signup" : ""}`}
              >
                {screen === "signup" && (
                  <MdTextField
                    variant="outlined"
                    name="name"
                    label={t("Full name")}
                    autocomplete="name"
                    required
                    value={name}
                    onMdInput={(e) => {
                      setName(e.detail);
                      setError("");
                    }}
                  />
                )}
                <MdTextField
                  variant="outlined"
                  name="email"
                  label={t("Work email")}
                  type="email"
                  className="code-direction"
                  autocomplete="username"
                  required
                  value={email}
                  onMdInput={(e) => {
                    setEmail(e.detail);
                    setError("");
                  }}
                />
                <MdTextField
                  variant="outlined"
                  name="password"
                  label={t("Password")}
                  type={passwordVisible ? "text" : "password"}
                  autocomplete={
                    screen === "signup" ? "new-password" : "current-password"
                  }
                  passwordToggle={false}
                  minLength={screen === "signup" ? 12 : 1}
                  required
                  value={password}
                  supportingText={
                    screen === "signup"
                      ? t(
                          "Use at least 12 characters. Choose a demo-only password.",
                        )
                      : ""
                  }
                  onMdInput={(e) => {
                    setPassword(e.detail);
                    setError("");
                  }}
                >
                  <MdIconButton
                    slot="trailing-icon"
                    icon={passwordVisible ? "visibility_off" : "visibility"}
                    aria-label={
                      passwordVisible ? t("Hide password") : t("Show password")
                    }
                    onMdClick={() => setPasswordVisible((v) => !v)}
                  />
                </MdTextField>
                {screen === "signup" && (
                  <>
                    <MdTextField
                      variant="outlined"
                      name="confirm"
                      label={t("Confirm password")}
                      type={confirmVisible ? "text" : "password"}
                      autocomplete="new-password"
                      passwordToggle={false}
                      required
                      value={confirm}
                      error={Boolean(confirm && password !== confirm)}
                      errorText={t("Passwords do not match")}
                      onMdInput={(e) => {
                        setConfirm(e.detail);
                        setError("");
                      }}
                    >
                      <MdIconButton
                        slot="trailing-icon"
                        icon={confirmVisible ? "visibility_off" : "visibility"}
                        aria-label={
                          confirmVisible
                            ? t("Hide password")
                            : t("Show password")
                        }
                        onMdClick={() => setConfirmVisible((v) => !v)}
                      />
                    </MdTextField>
                    <label className="auth-consent">
                      <MdCheckbox
                        name="demoConsent"
                        value="accepted"
                        required
                        aria-label={t(
                          "I understand this creates a temporary demo account",
                        )}
                      />
                      <span>
                        {t(
                          "I understand this creates a temporary demo account.",
                        )}
                      </span>
                    </label>
                  </>
                )}
              </div>
            )}
            {screen === "mfa" && (
              <>
                <div className="verify-account">
                  <MdIconButton
                    icon="mail"
                    aria-label={t("Account email")}
                    disabled
                  />
                  <span>{email}</span>
                </div>
                <MdOtpField
                  className={`auth-otp${recovery ? " auth-otp--recovery" : ""}`}
                  label={recovery ? t("Recovery code") : t("Verification code")}
                  name="code"
                  length={recovery ? DEMO_RECOVERY.length : DEMO_CODE.length}
                  validationType={recovery ? "alphanumeric" : "none"}
                  inputMode={recovery ? "text" : "numeric"}
                  cellLabelTemplate={t("Character {index} of {length}")}
                  transform={recovery ? "uppercase" : "none"}
                  groupSize={recovery ? 4 : 3}
                  required
                  incompleteLabel={
                    recovery
                      ? t("Enter all eight characters.")
                      : t("Enter all six digits.")
                  }
                  valueMissingLabel={t("Enter your code to continue.")}
                  value={code}
                  error={Boolean(error)}
                  errorText={localizedMessage(error)}
                  reserveSupportingSpace
                  onMdInput={(e) => {
                    const normalized = recovery
                      ? e.detail
                      : normalizeDigits(e.detail).replace(/[^0-9]/g, "");
                    (e.currentTarget as HTMLElement & { value: string }).value =
                      normalized;
                    setCode(normalized);
                    setError("");
                  }}
                />
                <div className="demo-code">
                  <div>
                    <Icon name="science" />
                    <span>
                      {recovery
                        ? t("Demo recovery code")
                        : t("Demo verification code")}
                    </span>
                  </div>
                  <strong dir="ltr">
                    {recovery ? DEMO_RECOVERY : DEMO_CODE}
                  </strong>
                  <small>
                    {recovery
                      ? t("One use per account in this session.")
                      : t("For this showcase only · Expires in 5 minutes")}
                  </small>
                </div>
              </>
            )}
            {error && screen !== "mfa" && (
              <p className="form-error" role="alert">
                <Icon name="error" />
                {localizedMessage(error)}
              </p>
            )}
            {notice && (
              <p className="form-notice" role="status">
                {localizedMessage(notice)}
              </p>
            )}
            <MdButton
              variant="filled"
              type="submit"
              fullWidth
              size="md"
              loading={busy}
            >
              {screen === "mfa"
                ? t("Verify & continue")
                : screen === "signup"
                  ? t("Create account")
                  : t("Sign in")}
            </MdButton>
            {screen === "login" && (
              <MdButton
                variant="outlined"
                fullWidth
                size="md"
                icon="science"
                onMdClick={demo}
              >
                {t("Use demo credentials")}
              </MdButton>
            )}
            {screen === "mfa" && (
              <>
                <div className="mfa-secondary">
                  {!recovery && (
                    <MdButton
                      variant="text"
                      disabled={countdown > 0}
                      onMdClick={() => {
                        try {
                          auth.resend();
                          setCountdown(30);
                          setCode("");
                          setError("");
                          setNotice(
                            "Demo code refreshed. No email or SMS was sent.",
                          );
                        } catch (err) {
                          setError((err as Error).message);
                        }
                      }}
                    >
                      {countdown > 0
                        ? t("Refresh code in {seconds}s", {
                            seconds: fmt(countdown),
                          })
                        : t("Refresh demo code")}
                    </MdButton>
                  )}
                  <MdButton
                    variant="text"
                    onMdClick={() => {
                      setRecovery((v) => !v);
                      setCode("");
                      setError("");
                      setNotice("");
                    }}
                  >
                    {recovery
                      ? t("Use verification code")
                      : t("Use a recovery code")}
                  </MdButton>
                </div>
                <MdButton
                  variant="text"
                  icon="arrow_back"
                  mirrorIcon
                  onMdClick={() => change("login")}
                >
                  {t("Back to sign in")}
                </MdButton>
              </>
            )}
          </form>
          {screen !== "mfa" && (
            <p className="auth-alternate">
              {screen === "signup"
                ? t("Already have an account?")
                : t("New to Metro pulse?")}{" "}
              <a
                href={screen === "signup" ? "#/login" : "#/signup"}
                onClick={(e) => {
                  e.preventDefault();
                  change(screen === "signup" ? "login" : "signup");
                }}
              >
                {screen === "signup" ? t("Sign in") : t("Create an account")}
              </a>
            </p>
          )}
          <div className="auth-disclaimer">
            <Icon name="info" />
            <p>
              {t(
                "This showcase uses simulated accounts and MFA. Accounts last until you reload the page. No real credentials or station systems are connected.",
              )}
            </p>
          </div>
        </div>
        <div className="auth-bottom">
          <span>
            <Icon name="lock" />
            {t("Demo access · No real identity service")}
          </span>
          <span>AWC UI</span>
        </div>
      </section>
    </div>
  );
}
