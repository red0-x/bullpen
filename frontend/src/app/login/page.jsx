"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { errorText } from "@/lib/api";

export default function LoginPage() {
  const { user, login, register } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace("/properties/");
    }
  }, [user, router]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const isReg = mode === "register";
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <section className="hidden lg:flex flex-col justify-between p-12 border-r-[1.5px] border-line">
        <div className="flex items-center gap-3">
          <img src="/mascot/pup-head.webp" alt="Bullpup puppy" className="h-12 w-12 rounded-xl border-[1.5px] border-line" />
          <span className="font-head text-3xl">Bullpup</span>
        </div>
        <div className="animate-rise">
          <img src="/mascot/pup-glove.webp" alt="Bullpup puppy holding a glove" className="w-72 rounded-card border-[1.5px] border-line" />
          <h1 className="mt-8 text-5xl lg:text-6xl text-espresso max-w-lg">Always a backup in the bullpen.</h1>
          <p className="mt-4 text-lg text-cocoa max-w-md">A ranked bench of contractors for every property, so a no-show never ruins a check-in.</p>
        </div>
        <p className="text-sm text-cocoa">For hosts with 1 to 5 rentals.</p>
      </section>

      <section className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src="/mascot/pup-head.webp" alt="Bullpup puppy" className="h-12 w-12 rounded-xl border-[1.5px] border-line" />
            <span className="font-head text-3xl">Bullpup</span>
          </div>
          <form onSubmit={submit} className="card p-6 sm:p-8 animate-rise" data-testid="auth-form">
            <h2 className="text-3xl text-espresso">{isReg ? "Make your bench" : "Welcome back"}</h2>
            <p className="mt-1 text-cocoa">{isReg ? "Create a host account in seconds." : "Log in to see your properties."}</p>
            <div className="mt-6 flex flex-col gap-4">
              {isReg && (
                <label className="flex flex-col gap-1.5 text-sm font-semibold">
                  Your name
                  <input className="field" value={form.name} onChange={set("name")} required autoComplete="name" data-testid="register-name-input" />
                </label>
              )}
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Email
                <input className="field" type="email" value={form.email} onChange={set("email")} required autoComplete="email" data-testid="login-email-input" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Password
                <input className="field" type="password" value={form.password} onChange={set("password")} required minLength={isReg ? 8 : undefined}
                  autoComplete={isReg ? "new-password" : "current-password"} data-testid="login-password-input" />
                {isReg && <span className="text-xs font-normal text-cocoa">At least 8 characters.</span>}
              </label>
              {error && <p className="badge badge-warn !rounded-field !text-sm !py-2 whitespace-normal" role="alert" data-testid="auth-error">{error}</p>}
              <button className="btn btn-primary w-full mt-2" disabled={busy} data-testid="login-submit-button">
                {busy ? "One sec…" : isReg ? "Create account" : "Log in"}
              </button>
            </div>
            <button type="button" className="btn-link mt-4" onClick={() => { setMode(isReg ? "login" : "register"); setError(""); }} data-testid="auth-toggle-mode-button">
              {isReg ? "Already have an account? Log in" : "New here? Create an account"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
