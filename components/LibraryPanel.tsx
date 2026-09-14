"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Course } from "@/lib/types";

type Resource = {
  id: string;
  slug: string;
  institution: "MIT" | "Stanford" | "Harvard" | string;
  course_code: string | null;
  course_title: string;
  title: string;
  description: string;
  url: string;
  resource_type: string;
  access_type: "open_full" | "free" | "free_audit" | "benchmark_only";
  level: "foundation" | "intermediate" | "advanced" | "graduate";
  provider: string;
  source_year: string | null;
  learning_role: string;
  license_note: string | null;
  featured: boolean;
};

type ResourceCourse = {
  resource_id: string;
  course_id: string;
  priority: number;
  role: "core" | "recommended" | "extension" | "benchmark";
  rationale: string;
};

const ACCESS_LABEL: Record<Resource["access_type"], string> = {
  open_full: "Open / material completo",
  free: "Gratis",
  free_audit: "Audit / modalidad gratuita",
  benchmark_only: "Benchmark de sílabo",
};

const LEVEL_LABEL: Record<Resource["level"], string> = {
  foundation: "Foundation",
  intermediate: "Intermediate",
  advanced: "Advanced",
  graduate: "Graduate",
};

const INSTITUTIONS = ["Todos", "MIT", "Stanford", "Harvard"] as const;

export default function LibraryPanel({ courses }: { courses: Course[] }) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [links, setLinks] = useState<ResourceCourse[]>([]);
  const [institution, setInstitution] = useState<(typeof INSTITUTIONS)[number]>("Todos");
  const [courseId, setCourseId] = useState("all");
  const [openOnly, setOpenOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      const [resourcesResult, linksResult] = await Promise.all([
        supabase
          .from("sds_external_resources")
          .select("*")
          .eq("active", true)
          .eq("official", true)
          .order("featured", { ascending: false })
          .order("institution")
          .order("title"),
        supabase
          .from("sds_external_resource_courses")
          .select("*")
          .order("priority"),
      ]);

      if (!active) return;

      const firstError = resourcesResult.error || linksResult.error;
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      setResources((resourcesResult.data || []) as Resource[]);
      setLinks((linksResult.data || []) as ResourceCourse[]);
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const courseById = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses]
  );

  const linksByResource = useMemo(() => {
    const map = new Map<string, ResourceCourse[]>();
    for (const link of links) {
      const existing = map.get(link.resource_id) || [];
      existing.push(link);
      map.set(link.resource_id, existing);
    }
    return map;
  }, [links]);

  const visible = useMemo(() => {
    return resources.filter((resource) => {
      if (institution !== "Todos" && resource.institution !== institution) {
        return false;
      }
      if (openOnly && resource.access_type === "benchmark_only") {
        return false;
      }
      if (
        courseId !== "all" &&
        !(linksByResource.get(resource.id) || []).some(
          (link) => link.course_id === courseId
        )
      ) {
        return false;
      }
      return true;
    });
  }, [resources, institution, openOnly, courseId, linksByResource]);

  const featured = visible.filter((resource) => resource.featured);
  const regular = visible.filter((resource) => !resource.featured);

  return (
    <section className="panel-stack">
      <div className="library-hero">
        <div>
          <p className="eyebrow">IVY+ / TOP-TIER LEARNING LIBRARY</p>
          <h2>Aprende tu curso con una segunda universidad al lado.</h2>
          <p>
            Curaduría oficial de MIT, Harvard y Stanford alineada a tus siete
            asignaturas. SÓCRATES enlaza el material original; no copia ni re-publica
            contenido universitario.
          </p>
        </div>
        <div className="library-count">
          <strong>{resources.length}</strong>
          <span>recursos oficiales</span>
          <small>{visible.length} visibles con tus filtros</small>
        </div>
      </div>

      <article className="library-filters card">
        <div className="institution-tabs" aria-label="Filtrar por universidad">
          {INSTITUTIONS.map((item) => (
            <button
              key={item}
              className={institution === item ? "active" : ""}
              onClick={() => setInstitution(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>

        <label>
          Relacionado con
          <select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            <option value="all">Todos mis cursos</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </label>

        <label className="library-toggle">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(event) => setOpenOnly(event.target.checked)}
          />
          Mostrar primero material realmente abierto/gratuito
        </label>
      </article>

      {error ? <div className="error-banner">{error}</div> : null}
      {loading ? <div className="card loading-card">Cargando biblioteca curada…</div> : null}

      {!loading && featured.length ? (
        <section>
          <div className="library-section-title">
            <div>
              <p className="eyebrow dark">START HERE</p>
              <h3>Selección prioritaria</h3>
            </div>
            <span>official sources only</span>
          </div>

          <div className="resource-grid featured-resources">
            {featured.map((resource) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                courseLinks={linksByResource.get(resource.id) || []}
                courseById={courseById}
              />
            ))}
          </div>
        </section>
      ) : null}

      {!loading && regular.length ? (
        <section>
          <div className="library-section-title">
            <div>
              <p className="eyebrow dark">EXTEND / BENCHMARK</p>
              <h3>Profundización y comparación curricular</h3>
            </div>
          </div>

          <div className="resource-grid">
            {regular.map((resource) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                courseLinks={linksByResource.get(resource.id) || []}
                courseById={courseById}
              />
            ))}
          </div>
        </section>
      ) : null}

      {!loading && !visible.length ? (
        <div className="empty-state card">
          No hay recursos para esta combinación. Amplía los filtros o habilita
          benchmarks de sílabo.
        </div>
      ) : null}

      <article className="library-policy card">
        <div>
          <p className="eyebrow dark">CURATION CONTRACT</p>
          <h3>Más material no significa más aprendizaje.</h3>
          <p>
            La biblioteca prioriza fuentes oficiales, acceso abierto/gratuito,
            correspondencia con tus conceptos y una acción cognitiva concreta.
            Benchmarks que solo muestran el sílabo se etiquetan claramente y no se
            presentan como cursos abiertos.
          </p>
        </div>
        <div className="policy-list">
          <span>1 · Fuente universitaria oficial</span>
          <span>2 · Relevancia para uno de tus 7 cursos</span>
          <span>3 · Acceso y nivel explícitos</span>
          <span>4 · Link al original, no copia</span>
        </div>
      </article>
    </section>
  );
}

function ResourceCard({
  resource,
  courseLinks,
  courseById,
}: {
  resource: Resource;
  courseLinks: ResourceCourse[];
  courseById: Map<string, Course>;
}) {
  const sortedLinks = courseLinks.slice().sort((a, b) => a.priority - b.priority);

  return (
    <article className="resource-card card">
      <div className="resource-card-top">
        <span className={`institution-badge ${resource.institution.toLowerCase()}`}>
          {resource.institution}
        </span>
        <span className="resource-level">{LEVEL_LABEL[resource.level]}</span>
      </div>

      <div className="resource-code">
        {resource.course_code || resource.provider}
        {resource.source_year ? <span> · {resource.source_year}</span> : null}
      </div>

      <h3>{resource.title}</h3>
      <p>{resource.description}</p>

      <div className="resource-role">
        <strong>Por qué está aquí</strong>
        <span>{resource.learning_role}</span>
      </div>

      {sortedLinks.length ? (
        <div className="resource-course-links">
          {sortedLinks.map((link) => {
            const course = courseById.get(link.course_id);
            if (!course) return null;
            return (
              <span key={link.course_id} title={link.rationale}>
                {link.role === "core" ? "★" : link.role === "benchmark" ? "◎" : "→"}{" "}
                {course.name}
              </span>
            );
          })}
        </div>
      ) : null}

      <div className="resource-footer">
        <div>
          <span className={`access-badge ${resource.access_type}`}>
            {ACCESS_LABEL[resource.access_type]}
          </span>
        </div>
        <a href={resource.url} target="_blank" rel="noreferrer">
          Abrir fuente oficial ↗
        </a>
      </div>
    </article>
  );
}
