"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Validando enlace seguro…");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function resolveSession() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data.session) {
        setReady(true);
        setStatus("Enlace validado. Crea una nueva contraseña.");
      } else {
        setStatus(
          "No encontramos una sesión de recuperación activa. Abre nuevamente el enlace recibido por correo."
        );
      }
    }

    void resolveSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        setReady(true);
        setStatus("Enlace validado. Crea una nueva contraseña.");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (password.length < 8) {
      setStatus("Usa una contraseña de al menos 8 caracteres.");
      return;
    }

    if (password !== confirm) {
      setStatus("Las contraseñas no coinciden.");
      return;
    }

    setBusy(true);
    setStatus("");

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setStatus("Contraseña actualizada. Ya puedes volver al Campus.");
      setPassword("");
      setConfirm("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo actualizar la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="recovery-shell">
      <section className="recovery-card">
        <div className="brand-mark recovery-brand">Σ</div>
        <p className="eyebrow dark">ACCOUNT RECOVERY</p>
        <h1>Nueva contraseña</h1>
        <p className="recovery-copy">
          Recupera tu acceso sin crear otra cuenta ni perder tu historial de aprendizaje.
        </p>

        <form onSubmit={submit}>
          <label>
            Nueva contraseña
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              minLength={8}
              required
              disabled={!ready}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
            />
          </label>

          <label>
            Confirmar contraseña
            <input
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              type="password"
              minLength={8}
              required
              disabled={!ready}
              autoComplete="new-password"
              placeholder="Repite la contraseña"
            />
          </label>

          <button className="primary-button wide" disabled={!ready || busy} type="submit">
            {busy ? "Actualizando…" : "Guardar nueva contraseña"}
          </button>
        </form>

        {status ? <p className="form-status">{status}</p> : null}

        <a className="recovery-link" href="/">
          Volver a SÓCRATES DS
        </a>
      </section>
    </main>
  );
}
