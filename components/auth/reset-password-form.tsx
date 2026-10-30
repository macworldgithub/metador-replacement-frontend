"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, type FormEvent } from "react";
import { verifyResetToken, resetPassword } from "@/lib/auth";
import { Icon } from "@/components/icon";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [initialError, setInitialError] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setInitialError("Missing or invalid reset token. Please request a new password reset link.");
      return;
    }

    verifyResetToken(token)
      .then((res) => {
        setTokenValid(true);
        if (res.email) setUserEmail(res.email);
      })
      .catch((err) => {
        setTokenValid(false);
        setInitialError(err instanceof Error ? err.message : "This reset link is invalid or has expired.");
      })
      .finally(() => {
        setVerifying(false);
      });
  }, [token]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    const newErrors: typeof errors = {};
    if (!password) {
      newErrors.password = "Please enter a new password.";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters long.";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your new password.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setBusy(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Failed to reset password. The link may have expired." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <aside className="auth-brand-panel">
        <Link href="/signin" className="auth-brand" aria-label="Booran Motor Group sign in">
          <span className="auth-logo">B<span /></span>
          <div>
            <strong>BOORAN<br />MOTOR GROUP</strong>
            <small>NEW-LEAD SMS PORTAL</small>
          </div>
        </Link>
        <div className="auth-brand-content">
          <span className="auth-eyebrow"><i /> CONNECTING THE CRANBOURNE ROOFTOPS</span>
          <h2>One conversation.<br />Every new lead.<br /><em>All in sequence.</em></h2>
          <p>Secure password recovery for authorised team members across Booran dealerships.</p>
          <div className="auth-rooftops">
            <span>Cranbourne Kia</span>
            <span>Cranbourne MG</span>
            <span>Geely Cranbourne</span>
          </div>
        </div>
        <footer className="auth-brand-footer">
          <span>BOORAN MOTOR GROUP</span>
          <span>Powered by OmniSuiteAI</span>
        </footer>
      </aside>

      <section className="auth-main">
        <div className="auth-mobile-brand">
          <span className="auth-logo">B<span /></span>
          <strong>Booran Motor Group</strong>
        </div>

        <div className="auth-card">
          {verifying ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <span className="spinner" style={{ width: 28, height: 28, margin: "0 auto 16px" }} />
              <p style={{ color: "var(--muted, #94a3b8)" }}>Verifying password reset link…</p>
            </div>
          ) : !tokenValid ? (
            <div className="auth-success" role="alert">
              <div className="auth-success-icon" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                <Icon name="alert" size={26} />
              </div>
              <span className="eyebrow">LINK EXPIRED OR INVALID</span>
              <h1>Cannot reset password</h1>
              <p>{initialError || "This password reset link is invalid or has already been used."}</p>
              <Link href="/forgot-password" className="btn primary auth-submit" style={{ marginTop: 20 }}>
                Request new reset link <Icon name="chevron" size={16} />
              </Link>
              <p className="auth-switch" style={{ marginTop: 16 }}>
                <Link href="/signin">← Back to sign in</Link>
              </p>
            </div>
          ) : success ? (
            <div className="auth-success" role="status">
              <div className="auth-success-icon">
                <Icon name="check" size={26} />
              </div>
              <span className="eyebrow">PASSWORD UPDATED</span>
              <h1>Password reset complete</h1>
              <p>Your password has been securely updated. You can now sign in to your Booran account with your new credentials.</p>
              <Link href="/signin" className="btn primary auth-submit" style={{ marginTop: 20 }}>
                Sign in to your account <Icon name="chevron" size={16} />
              </Link>
            </div>
          ) : (
            <>
              <span className="eyebrow">ACCOUNT RECOVERY</span>
              <h1>Create new password</h1>
              <p className="auth-description">
                {userEmail ? (
                  <>Setting a new password for <strong>{userEmail}</strong>.</>
                ) : (
                  "Please enter a strong new password for your Booran account."
                )}
              </p>

              <form onSubmit={handleSubmit} noValidate aria-busy={busy}>
                <fieldset disabled={busy}>
                  <div className="auth-field">
                    <label htmlFor="new-password">New password</label>
                    <div className="auth-password">
                      <input
                        id="new-password"
                        name="newPassword"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setErrors((cur) => ({ ...cur, password: undefined, form: undefined }));
                        }}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        required
                        aria-invalid={!!errors.password}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                          <circle cx="12" cy="12" r="3" />
                          {showPassword && <path d="m3 3 18 18" />}
                        </svg>
                      </button>
                    </div>
                    {errors.password && <span className="auth-field-error" role="alert">{errors.password}</span>}
                  </div>

                  <div className="auth-field">
                    <label htmlFor="confirm-new-password">Confirm new password</label>
                    <div className="auth-password">
                      <input
                        id="confirm-new-password"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setErrors((cur) => ({ ...cur, confirmPassword: undefined, form: undefined }));
                        }}
                        placeholder="Re-enter your new password"
                        autoComplete="new-password"
                        required
                        aria-invalid={!!errors.confirmPassword}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                          <circle cx="12" cy="12" r="3" />
                          {showConfirmPassword && <path d="m3 3 18 18" />}
                        </svg>
                      </button>
                    </div>
                    {errors.confirmPassword && <span className="auth-field-error" role="alert">{errors.confirmPassword}</span>}
                  </div>

                  {errors.form && (
                    <div className="auth-form-error" role="alert">
                      <Icon name="alert" size={16} />
                      {errors.form}
                    </div>
                  )}

                  <button className="btn primary auth-submit" type="submit" disabled={busy}>
                    {busy ? <span className="spinner" /> : null}
                    {busy ? "Updating password…" : "Reset password"}
                    {!busy && <Icon name="chevron" size={17} />}
                  </button>
                </fieldset>
              </form>

              <p className="auth-switch">
                <Link href="/signin">← Back to sign in</Link>
              </p>
            </>
          )}
        </div>

        <footer className="auth-main-footer">
          <Icon name="shield" size={13} /> Authorised Booran Motor Group users only
        </footer>
      </section>
    </main>
  );
}
