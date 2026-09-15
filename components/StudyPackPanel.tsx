"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type PackContent = {
  orientation_letter?: string;
  summary?: {
    thesis?: string;
    key_ideas?: string[];
    misconception?: string;
    self_test?: string[];
  };
  concept_cards?: Array<{
    term?: string;
    intuition?: string;
    formal_relation?: string;
    misconception?: string;
    locator?: string;
  }>;
  infographic?: {
    title?: string;
    nodes?: Array<{ id?: string; label?: string; note?: string }>;
    edges?: Array<{ from?: string; to?: string; label?: string }>;
    narrative?: string;
  };
  practice?: {
    recall?: string[];
    derive?: string[];
    apply?: string[];
  };
  checklist?: string[];
};

type StudyPack = {
  id: string;
  version: number;
  content: PackContent;
  source_locators: string[];
  provider: string;
  model: string | null;
  grounding_status: string;
  generation_ms: number | null;
  created_at: string;
};

export default function StudyPackPanel({
  readingUnitId,
  unitTitle,
}: {
  readingUnitId: string;
  unitTitle: string;
}) {
  const [pack, setPack] = useState<StudyPack | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [section, setSection] = useState<
    "letter" | "summary" | "cards" | "map" | "practice" | "checklist"
  >("summary");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const { data, error: loadError } = await supabase.rpc("sds_latest_study_pack", {
        p_reading_unit_id: readingUnitId,
      });

      if (!active) return;
      if (loadError) setError(loadError.message);
      else setPack(((data || [])[0] as StudyPack | undefined) || null);
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [readingUnitId]);

  async function generate() {
    setBusy(true);
    setError("");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Tu sesión expiró. Vuelve a ingresar.");

      const response = await fetch("/api/study-pack", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ readingUnitId }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo generar el Study Pack.");
      }

      setPack(payload.pack as StudyPack);
      setSection("summary");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo generar el Study Pack.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="study-pack-loading">Buscando tu Study Pack…</div>;
  }

  if (!pack) {
    return (
      <section className="study-pack-empty">
        <div>
          <p className="eyebrow dark">AI STUDY PACK</p>
          <h4>Convierte esta lectura en material de estudio.</h4>
          <p>
            SÓCRATES recuperará la evidencia de la fuente y construirá carta,
            resumen, cards, mapa, práctica y checklist. El resultado quedará
            guardado para esta unidad.
          </p>
        </div>
        <button className="primary-button" disabled={busy} onClick={() => void generate()}>
          {busy ? "Construyendo pack…" : "Generar Study Pack →"}
        </button>
        {error ? <div className="error-banner">{error}</div> : null}
      </section>
    );
  }

  const content = pack.content || {};

  return (
    <section className="study-pack">
      <div className="study-pack-heading">
        <div>
          <p className="eyebrow dark">PERSISTENT STUDY PACK · V{pack.version}</p>
          <h4>{unitTitle}</h4>
          <p>
            {pack.provider === "vercel-ai-gateway" ? "AI live" : "Evidence fallback"}
            {" · "}
            {pack.grounding_status}
            {pack.generation_ms ? ` · ${pack.generation_ms} ms` : ""}
          </p>
        </div>
        <button className="text-button" disabled={busy} onClick={() => void generate()}>
          {busy ? "Regenerando…" : "Regenerar"}
        </button>
      </div>

      <div className="study-pack-tabs">
        {([
          ["letter", "Carta"],
          ["summary", "Resumen"],
          ["cards", "Cards"],
          ["map", "Mapa"],
          ["practice", "Práctica"],
          ["checklist", "Checklist"],
        ] as const).map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={section === value ? "active" : ""}
            onClick={() => setSection(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="study-pack-body">
        {section === "letter" ? (
          <p className="study-letter">{content.orientation_letter || "Sin carta."}</p>
        ) : null}

        {section === "summary" ? (
          <div className="study-summary">
            <div className="study-feature">
              <strong>Tesis</strong>
              <p>{content.summary?.thesis || "—"}</p>
            </div>
            <ListBlock title="Ideas clave" items={content.summary?.key_ideas} />
            <div className="study-feature">
              <strong>Confusión a evitar</strong>
              <p>{content.summary?.misconception || "—"}</p>
            </div>
            <ListBlock title="Self-test" items={content.summary?.self_test} />
          </div>
        ) : null}

        {section === "cards" ? (
          <div className="study-card-grid">
            {(content.concept_cards || []).map((card, index) => (
              <article className="study-concept-card" key={`${card.term}-${index}`}>
                <span>{card.locator || "Source"}</span>
                <h5>{card.term || `Concepto ${index + 1}`}</h5>
                <strong>Intuición</strong>
                <p>{card.intuition || "—"}</p>
                <strong>Relación formal</strong>
                <p>{card.formal_relation || "—"}</p>
                <strong>Error frecuente</strong>
                <p>{card.misconception || "—"}</p>
              </article>
            ))}
          </div>
        ) : null}

        {section === "map" ? (
          <div className="study-map">
            <h5>{content.infographic?.title || "Mapa conceptual"}</h5>
            <div className="study-map-nodes">
              {(content.infographic?.nodes || []).map((node, index) => (
                <span key={node.id || index}>
                  <b>{node.label || node.id || `N${index + 1}`}</b>
                  <small>{node.note || ""}</small>
                </span>
              ))}
            </div>
            <div className="study-map-edges">
              {(content.infographic?.edges || []).map((edge, index) => (
                <p key={index}>
                  {edge.from} <b>→</b> {edge.to} · {edge.label}
                </p>
              ))}
            </div>
            <p>{content.infographic?.narrative || ""}</p>
          </div>
        ) : null}

        {section === "practice" ? (
          <div className="study-practice-grid">
            <ListBlock title="Recall" items={content.practice?.recall} />
            <ListBlock title="Derive / Reason" items={content.practice?.derive} />
            <ListBlock title="Apply / Transfer" items={content.practice?.apply} />
          </div>
        ) : null}

        {section === "checklist" ? (
          <div className="study-pack-checklist">
            {(content.checklist || []).map((item, index) => (
              <div key={index}>
                <span>□</span>
                <p>{item}</p>
              </div>
            ))}
            <small>
              Este checklist es material de estudio. El checklist operativo de la
              misión, debajo, es el que registra evidencia y dispara revisiones.
            </small>
          </div>
        ) : null}
      </div>

      {pack.source_locators?.length ? (
        <div className="study-pack-sources">
          <strong>Evidence locators</strong>
          <div>
            {pack.source_locators.map((locator) => (
              <span key={locator}>{locator}</span>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <div className="error-banner">{error}</div> : null}
    </section>
  );
}

function ListBlock({ title, items }: { title: string; items?: string[] }) {
  return (
    <div className="study-list-block">
      <strong>{title}</strong>
      <ol>
        {(items || []).map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ol>
    </div>
  );
}
