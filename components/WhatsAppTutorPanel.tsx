"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Settings = {
  connected: boolean;
  status: "pending" | "active" | "paused";
  frequency: number;
  phone: string | null;
  ready: boolean;
  senderPhone: string | null;
  templateName: string;
  slots: Array<{ count: number; times: string[] }>;
};

type PairingCode = {
  code: string;
  command: string;
  expiresAt: string;
  senderPhone: string | null;
};

type Props = { userId: string };

function frequencyText(value: number) {
  if (value === 0) return "Pausado";
  return value + (value === 1 ? " píldora al día" : " píldoras al día");
}

export default function WhatsAppTutorPanel({ userId }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [frequency, setFrequency] = useState(2);
  const [pairing, setPairing] = useState<PairingCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const request = useCallback(async (path: string, method = "GET", body?: unknown) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Vuelve a iniciar sesión en SÓCRATES DS.");
    const response = await fetch(path, {
      method,
      headers: {
        Authorization: "Bearer " + token,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "No se pudo completar la solicitud.");
    return payload;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await request("/api/whatsapp/settings");
      setSettings(payload as Settings);
      setFrequency(Number(payload.frequency || 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar WhatsApp.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void load();
  }, [load, userId]);

  async function createPairingCode() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = await request("/api/whatsapp/pairing", "POST");
      setPairing(payload as PairingCode);
      setNotice("Código listo. Envíalo desde WhatsApp antes de que pasen 10 minutos.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el código.");
    } finally {
      setBusy(false);
    }
  }

  async function saveFrequency() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request("/api/whatsapp/settings", "PATCH", { frequency });
      setNotice(frequency === 0 ? "Pausé el horario de envío." : "Guardé tu horario de " + frequencyText(frequency) + ".");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el horario.");
    } finally {
      setBusy(false);
    }
  }

  const senderPhone = pairing?.senderPhone || settings?.senderPhone || null;
  const whatsappLink = senderPhone && pairing
    ? "https://wa.me/" + senderPhone.replace(/\D/g, "") + "?text=" + encodeURIComponent(pairing.command)
    : null;
  const statusLabel = settings?.status === "active"
    ? "Conectado"
    : settings?.status === "paused"
      ? "Pausado en WhatsApp"
      : "Sin vincular";

  return (
    <section className="panel-stack whatsapp-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow dark">SÓCRATES EN WHATSAPP</p>
          <h2>Repasos breves que aparecen durante el día</h2>
          <p>
            A las 13:00 cambia el escenario de y y X; las otras pasadas rotan por los cursos de tu maestría. Responde
            por texto y el tutor guardará la evidencia, contrastará tu razonamiento
            con la guía del concepto y ajustará los repasos siguientes.
          </p>
        </div>
        <span className="status-badge">{statusLabel}</span>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}
      {notice ? <div className="notice-banner">{notice}</div> : null}

      {loading ? (
        <div className="card">Cargando preferencias…</div>
      ) : (
        <>
          {!settings?.ready ? (
            <article className="card whatsapp-setup-note">
              <p className="eyebrow dark">FALTA ACTIVAR EL CANAL</p>
              <h3>WhatsApp Business todavía no está conectado</h3>
              <p>
                El tutor ya tiene preparado el flujo de mensajes, respuestas y
                seguimiento. Para habilitarlo, hace falta conectar un número de
                WhatsApp Business de Meta y aprobar la plantilla que inicia cada
                píldora. No compartas claves de acceso por este chat.
              </p>
              <p className="muted">
                Cuando termine esa conexión, vuelve aquí para vincular tu WhatsApp
                personal y elegir el ritmo de los repasos.
              </p>
            </article>
          ) : null}

          <div className="whatsapp-grid">
            <article className="card whatsapp-card">
              <p className="eyebrow dark">1 · VINCULA TU CHAT</p>
              <h3>Este número quedará como tu tutor</h3>
              {settings?.connected ? (
                <p>
                  Tu WhatsApp {settings.phone || ""} está vinculado. Puedes
                  responder los casos desde ese chat. Para detener mensajes, escribe
                  PAUSAR; para retomarlos, CONTINUAR.
                </p>
              ) : (
                <p>
                  Genera un código de un solo uso y envíalo al número empresarial
                  del tutor. Ese mensaje confirma que quieres recibir los repasos.
                </p>
              )}
              <button
                className="primary-button"
                type="button"
                disabled={busy || !settings?.ready}
                onClick={() => void createPairingCode()}
              >
                {settings?.connected ? "Vincular otro número" : "Generar código de vínculo"}
              </button>
              {pairing ? (
                <div className="whatsapp-pairing">
                  <span>Tu mensaje de vínculo</span>
                  <strong>{pairing.command}</strong>
                  <small>Vence: {new Date(pairing.expiresAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</small>
                  {senderPhone ? <small>Número del tutor: {senderPhone}</small> : null}
                  {whatsappLink ? (
                    <a className="secondary-button" href={whatsappLink} target="_blank" rel="noreferrer">
                      Abrir chat de WhatsApp
                    </a>
                  ) : (
                    <p className="muted">
                      Guarda el número empresarial y envíale el texto de arriba.
                    </p>
                  )}
                </div>
              ) : null}
              {settings?.status === "paused" ? (
                <p className="muted">
                  La conversación sigue vinculada. En WhatsApp escribe CONTINUAR para
                  volver a recibir los mensajes.
                </p>
              ) : null}
            </article>

            <article className="card whatsapp-card">
              <p className="eyebrow dark">2 · ELIGE EL RITMO</p>
              <h3>Una píldora corta por pasada</h3>
              <p>
                Horario de referencia: hora de Lima. Si una pasada coincide con una
                clase, se omite para no interrumpirte. Si queda una pregunta sin
                responder, SÓCRATES espera antes de mandarte otra.
              </p>
              <label className="whatsapp-frequency">
                Píldoras al día
                <select
                  value={frequency}
                  onChange={(event) => setFrequency(Number(event.target.value))}
                  disabled={!settings?.connected}
                >
                  <option value={0}>Pausado</option>
                  <option value={1}>1 · 13:00</option>
                  <option value={2}>2 · 13:00 y 17:00</option>
                  <option value={3}>3 · 11:00, 13:00 y 17:00</option>
                </select>
              </label>
              <button
                className="secondary-button"
                type="button"
                disabled={busy || !settings?.connected}
                onClick={() => void saveFrequency()}
              >
                Guardar horario
              </button>
              <div className="whatsapp-note">
                La respuesta se guarda al llegar; el contraste formativo vuelve en
                una de las siguientes pasadas programadas. No es una conversación
                instantánea.
              </div>
            </article>
          </div>

          <article className="card whatsapp-template-card">
            <p className="eyebrow dark">EJEMPLO DE PÍLDORA</p>
            <h3>Un caso nuevo, una idea que recordar</h3>
            <p>
              “Llega un lead de una inmobiliaria. ¿Qué resultado futuro pondrías como
              y y qué dos campos disponibles al crear el lead usarías como X? ¿Qué
              dato tentador sería fuga de información?”
            </p>
            <small>
              La pasada de las 13:00 conserva el reto de y y X pero cambia el negocio. Las demás rotan entre los siete cursos y priorizan conceptos vencidos o con poca evidencia.
            </small>
          </article>
        </>
      )}
    </section>
  );
}
