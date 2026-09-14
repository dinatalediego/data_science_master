"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  onAuthenticated: () => void;
};

function authMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");

  if (message.toLowerCase().includes("invalid login credentials")) {
    return "La cuenta existe, pero el email o la contraseña no coinciden. Usa “Olvidé mi contraseña” para recuperar el acceso.";
  }
  if (message.toLowerCase().includes("user already registered")) {
    return "Este correo ya tiene una cuenta. Ingresa o recupera tu contraseña.";
  }
  if (message.toLowerCase().includes("email rate limit")) {
    return "Se enviaron demasiados correos recientemente. Espera unos minutos e inténtalo otra vez.";
  }
  if (
    message.toLowerCase().includes("provider is not enabled") ||
    message.toLowerCase().includes("unsupported provider")
  ) {
    return "Google Sign-In todavía no está habilitado en Supabase. Activa el provider Google y vuelve a intentarlo.";
  }
  return message || "No se pudo autenticar.";
}

export default function AuthPanel({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  async function signInWithGoogle() {
    setBusy(true);
    setStatus("");

    try {
      const redirectTo =
        typeof window !== "undefined" ? window.location.origin : undefined;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (error) throw error;
    } catch (error) {
      setStatus(authMessage(error));
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("");

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;
        setStatus("Acceso correcto.");
        onAuthenticated();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { full_name: name.trim() || normalizedEmail.split("@")[0] },
            emailRedirectTo:
              typeof window !== "undefined" ? window.location.origin : undefined,
          },
        });
        if (error) throw error;

        if (data.session) {
          setStatus("Cuenta creada. Bienvenido a SÓCRATES DS.");
          onAuthenticated();
        } else {
          setStatus(
            "Solicitud recibida. Si el correo es nuevo, revisa tu bandeja para confirmar la cuenta. Si ya tenías cuenta, usa “Olvidé mi contraseña”."
          );
          setMode("signin");
        }
      }
    } catch (error) {
      setStatus(authMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function sendPasswordReset() {
    if (!normalizedEmail) {
      setStatus("Escribe primero el correo de tu cuenta.");
      return;
    }

    setBusy(true);
    setStatus("");

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo,
      });

      if (error) throw error;

      setStatus(
        "Te enviamos un correo para crear una nueva contraseña. Ábrelo en este mismo navegador y vuelve a SÓCRATES DS."
      );
    } catch (error) {
      setStatus(authMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function sendMagicLink() {
    if (!normalizedEmail) {
      setStatus("Escribe primero el correo de tu cuenta.");
      return;
    }

    setBusy(true);
    setStatus("");

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo:
            typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });

      if (error) throw error;

      setStatus(
        "Enviamos un enlace de acceso a tu correo. No necesitas recordar la contraseña para entrar."
      );
    } catch (error) {
      setStatus(authMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-hero">
        <div className="brand-mark">Σ</div>
        <p className="eyebrow">PERSONAL LEARNING CAMPUS</p>
        <h1>SÓCRATES DS</h1>
        <p className="hero-copy">
          No mide cuánto contenido consumes. Mide qué puedes recordar, explicar,
          resolver, aplicar y transferir.
        </p>

        <div className="evidence-ladder" aria-label="Escalera de evidencia">
          {["Seen", "Recall", "Explain", "Solve", "Apply", "Transfer", "Master"].map(
            (item, index) => (
              <span key={item}>
                {item}
                {index < 6 ? <b>→</b> : null}
              </span>
            )
          )}
        </div>
      </section>

      <section className="auth-card">
        <div className="google-auth-block">
          <div className="recommended-badge">RECOMENDADO</div>
          <button
            className="google-button"
            type="button"
            disabled={busy}
            onClick={() => void signInWithGoogle()}
          >
            <span className="google-mark" aria-hidden="true">G</span>
            Continuar con Google
          </button>
          <p>
            Usa tu cuenta Google principal. Así evitas depender de correos de
            recuperación para entrar al Campus.
          </p>
        </div>

        <div className="auth-divider"><span>o usa email y contraseña</span></div>

        <div className="auth-tabs">
          <button
            className={mode === "signin" ? "active" : ""}
            onClick={() => {
              setMode("signin");
              setStatus("");
            }}
            type="button"
          >
            Ingresar
          </button>
          <button
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setStatus("");
            }}
            type="button"
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={submit}>
          {mode === "signup" ? (
            <label>
              Nombre
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Diego"
                autoComplete="name"
              />
            </label>
          ) : null}

          <label>
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
              placeholder="tu@email.com"
              autoComplete="email"
            />
          </label>

          <label>
            Contraseña
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
              minLength={6}
              placeholder="••••••••"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </label>

          <button className="primary-button wide" disabled={busy} type="submit">
            {busy
              ? "Procesando…"
              : mode === "signin"
                ? "Entrar al Campus"
                : "Crear mi Campus"}
          </button>

          {mode === "signin" ? (
            <div className="auth-recovery">
              <button
                className="text-button"
                type="button"
                disabled={busy}
                onClick={() => void sendPasswordReset()}
              >
                Olvidé mi contraseña
              </button>
              <span>·</span>
              <button
                className="text-button"
                type="button"
                disabled={busy}
                onClick={() => void sendMagicLink()}
              >
                Enviarme enlace de acceso
              </button>
            </div>
          ) : null}

          {status ? <p className="form-status">{status}</p> : null}
        </form>

        <p className="microcopy">
          Google será la vía principal de acceso. Email/contraseña queda como método
          de respaldo. Tus datos de aprendizaje se guardan en tablas SÓCRATES
          aisladas por RLS.
        </p>
      </section>
    </main>
  );
}
