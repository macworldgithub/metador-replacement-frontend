"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { login, submitAuthPreview, validateAuth, requestPasswordReset, type AuthMode, type AuthValues, type AuthErrors } from "@/lib/auth";
import { Icon } from "@/components/icon";
import { safePortalDestination } from '@/lib/portal-routes';

const copy = {
  signin: { label: "WELCOME BACK", title: "Sign in to your workspace", description: "Continue your customer conversations across the Cranbourne rooftops.", button: "Sign in", pending: "Signing in…" },
  signup: { label: "JOIN YOUR TEAM", title: "Create your account", description: "Set up your details to join the Booran conversation portal.", button: "Create account", pending: "Creating account…" },
  forgot: { label: "ACCOUNT RECOVERY", title: "Forgot your password?", description: "Enter your work email and we’ll send you a link to reset your password.", button: "Send reset link", pending: "Sending link…" },
};

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [values, setValues] = useState<AuthValues>({ name: "", email: "", password: "", confirmPassword: "", rooftop: "" });
  const [errors, setErrors] = useState<AuthErrors>({});
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resetResult, setResetResult] = useState<{ message: string } | null>(null);
  const text = copy[mode];

  function update(field: keyof AuthValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const validation = validateAuth(mode, values);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    setBusy(true);
    try {
      if (mode === "signin") {
        await login(values.email, values.password);
        router.replace("/");
      } else if (mode === "forgot") {
        const result = await requestPasswordReset(values.email);
        setResetResult(result);
        setSuccess(true);
      } else {
        await submitAuthPreview(mode);
        setSuccess(true);
        setValues((current) => ({ ...current, password: "", confirmPassword: "" }));
      }
    } catch (cause) {
      setErrors({ form: cause instanceof Error ? cause.message : "We couldn’t complete your request. Please try again." });
    } finally { setBusy(false); }
  }

  return <main className="auth-page">
    <aside className="auth-brand-panel">
      <Link href="/signin" className="auth-brand" aria-label="Booran Motor Group sign in"><span className="auth-logo">B<span /></span><div><strong>BOORAN<br />MOTOR GROUP</strong><small>NEW-LEAD SMS PORTAL</small></div></Link>
      <div className="auth-brand-content"><span className="auth-eyebrow"><i /> CONNECTING THE CRANBOURNE ROOFTOPS</span><h2>One conversation.<br />Every new lead.<br /><em>All in sequence.</em></h2><p>Keep automated journeys, customer replies and staff SMS together in one shared thread.</p>
        <div className="auth-thread-preview" aria-hidden="true"><div className="auth-thread-top"><span className="auth-thread-avatar">OB</span><div><b>Olivia Bennett</b><small>Cranbourne Kia · Vehicle enquiry</small></div><span className="auth-thread-tag">New lead</span></div><div className="auth-preview-out"><span>Ack · Automated journey</span>Thanks for your enquiry. Would you like to arrange a test drive?<small>Delivered <Icon name="check" size={12} /></small></div><div className="auth-preview-in">Saturday morning would be perfect.<small>Customer reply · Just now</small></div><div className="auth-preview-status"><Icon name="pause" size={13} /> Journey paused · Ready for your team</div></div>
        <div className="auth-rooftops"><span>Cranbourne Kia</span><span>Cranbourne MG</span><span>Geely Cranbourne</span></div>
      </div>
      <footer className="auth-brand-footer"><span>BOORAN MOTOR GROUP</span><span>Powered by OmniSuiteAI</span></footer>
    </aside>
    <section className="auth-main"><div className="auth-mobile-brand"><span className="auth-logo">B<span /></span><strong>Booran Motor Group</strong></div><div className={`auth-card ${mode === "signup" ? "auth-card-signup" : ""}`}>
      {success ? <div className="auth-success" role="status"><div className="auth-success-icon"><Icon name={mode === "forgot" ? "message" : "check"} size={25} /></div><span className="eyebrow">{mode === "forgot" ? "CHECK YOUR EMAIL" : "DETAILS COMPLETED"}</span><h1>{mode === "forgot" ? "Password reset link sent" : "Your account details are ready"}</h1><p>{mode === "forgot" ? (resetResult?.message || `If an account exists for ${values.email.trim()}, a password reset link has been sent. Check your inbox and spam folder.`) : "Account creation is currently a frontend preview. Your Super Admin will assign your role and rooftop access when registration is connected."}</p>{mode === "signup" && <div className="auth-preview-notice">No account has been created in this preview.</div>}<Link href="/signin" className="btn primary auth-submit">Back to sign in <Icon name="chevron" size={16} /></Link><button className="auth-retry" onClick={() => setSuccess(false)}>{mode === "forgot" ? "Send to a different email" : "Update my details"}</button></div> : <>
        <span className="eyebrow">{text.label}</span><h1>{text.title}</h1><p className="auth-description">{text.description}</p>
        <form onSubmit={submit} noValidate aria-busy={busy}>
          <fieldset disabled={busy}>
            {mode === "signup" && <Field name="name" label="Full name" value={values.name} onChange={(v) => update("name", v)} error={errors.name} autoComplete="name" placeholder="Your full name" />}
            <Field name="email" label="Work email" type="email" value={values.email} onChange={(v) => update("email", v)} error={errors.email} autoComplete="email" placeholder="you@booran.com.au" />
            {mode !== "forgot" && <PasswordField name="password" label="Password" value={values.password} onChange={(v) => update("password", v)} error={errors.password} autoComplete={mode === "signup" ? "new-password" : "current-password"} hint={mode === "signup" ? "12+ characters, uppercase, lowercase and a number." : undefined} />}
            {mode === "signup" && <><PasswordField name="confirmPassword" label="Confirm password" value={values.confirmPassword} onChange={(v) => update("confirmPassword", v)} error={errors.confirmPassword} autoComplete="new-password" /><div className="auth-field"><label htmlFor="rooftop">Dealership</label><select id="rooftop" value={values.rooftop} onChange={(e) => update("rooftop", e.target.value)} aria-invalid={!!errors.rooftop} aria-describedby={errors.rooftop ? "rooftop-error" : undefined}><option value="">Select your dealership</option><option>Cranbourne Kia</option><option>Cranbourne MG</option><option>Geely Cranbourne</option></select>{errors.rooftop && <span id="rooftop-error" className="auth-field-error">{errors.rooftop}</span>}</div><div className="auth-access-note"><Icon name="shield" size={16} /><span>Your Super Admin assigns your role and rooftop access.</span></div></>}
            {mode === "signin" && <div className="auth-options"><span><Icon name="shield" size={14} /> Team access</span><Link href="/forgot-password">Forgot password?</Link></div>}
            {errors.form && <div className="auth-form-error" role="alert"><Icon name="alert" size={16} />{errors.form}</div>}
            <button className="btn primary auth-submit" type="submit" disabled={busy}>{busy ? <span className="spinner" /> : null}{busy ? text.pending : text.button}{!busy && <Icon name="chevron" size={17} />}</button>
          </fieldset>
        </form>
        <p className="auth-switch">{mode === "signin" ? <>New to the portal? <Link href="/signup">Create an account</Link></> : mode === "signup" ? <>Already have an account? <Link href="/signin">Sign in</Link></> : <Link href="/signin">← Back to sign in</Link>}</p>
        {mode === "signup" && <div className="auth-preview-notice">Frontend preview · Account creation will be connected to your identity service.</div>}
      </>}
    </div><footer className="auth-main-footer"><Icon name="shield" size={13} /> Authorised Booran Motor Group users only</footer></section>
  </main>;
}

type FieldProps = { name: string; label: string; value: string; onChange: (value: string) => void; error?: string; autoComplete?: string; placeholder?: string; type?: string };

function Field({ name, label, value, onChange, error, autoComplete, placeholder, type = "text" }: FieldProps) {
  return <div className="auth-field"><label htmlFor={name}>{label}</label><input id={name} name={name} type={type} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} placeholder={placeholder} required aria-invalid={!!error} aria-describedby={error ? `${name}-error` : undefined} />{error && <span id={`${name}-error`} className="auth-field-error" role="alert">{error}</span>}</div>;
}

function PasswordField({ name, label, value, onChange, error, autoComplete, hint }: FieldProps & { hint?: string }) {
  const [visible, setVisible] = useState(false);
  return <div className="auth-field"><label htmlFor={name}>{label}</label><div className="auth-password"><input id={name} name={name} type={visible ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} placeholder={name === "confirmPassword" ? "Re-enter your password" : "Enter your password"} required aria-invalid={!!error} aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined} /><button type="button" onClick={() => setVisible(!visible)} aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-pressed={visible}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{visible && <path d="m3 3 18 18" />}</svg></button></div>{error ? <span id={`${name}-error`} className="auth-field-error" role="alert">{error}</span> : hint && <small id={`${name}-hint`} className="auth-field-hint">{hint}</small>}</div>;
}
