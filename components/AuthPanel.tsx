"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  onAuthenticated: () => void;
};

export default function AuthPanel({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("");

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setStatus("Acceso correcto.");
        onAuthenticated();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;

        if (data.session) {
          setStatus("Cuenta creada. Bienvenido a SÓCRATES DS.");
          onAuthenticated();
        } else {
          setStatus(
            "Cuenta creada. Revisa tu correo si Supabase solicita confirmación antes de iniciar sesión."
          );
          setMode("signin");
        }
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo autenticar.");
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
        <div className="auth-tabs">
          <button
            className={mode === "signin" ? "active" : ""}
            onClick={() => setMode("signin")}
            type="button"
          >
            Ingresar
          </button>
          <button
            className={mode === "signup" ? "active" : ""}
            onClick={() => setMode("signup")}
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

          {status ? <p className="form-status">{status}</p> : null}
        </form>

        <p className="microcopy">
          Tus datos de aprendizaje se guardan en tablas SÓCRATES aisladas por RLS.
          La clave pública del cliente no otorga acceso administrativo.
        </p>
      </section>
    </main>
  );
}
