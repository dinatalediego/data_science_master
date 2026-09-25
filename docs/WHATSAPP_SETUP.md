# Configurar el tutor de SÓCRATES DS en WhatsApp

El producto usa WhatsApp Cloud API, la tabla de evidencia de SÓCRATES DS y tres pasadas programadas al día. Las respuestas se guardan al llegar; la corrección formativa sale en la próxima pasada, así que no requiere conversación en tiempo real.

## 1. Activar WhatsApp Business

En Meta for Developers, crea o elige una app con WhatsApp Cloud API y agrega un número empresarial. Suscribe el webhook al campo messages.

Configura esta URL de callback después de publicar los cambios:

    https://socrates-ds.vercel.app/api/whatsapp/webhook

El token de verificación de Meta debe coincidir con WHATSAPP_VERIFY_TOKEN. El backend valida las notificaciones con la firma X-Hub-Signature-256 y META_APP_SECRET.

Cada píldora proactiva inicia con una plantilla de WhatsApp aprobada. Crea la plantilla socrates_pildora_v1 en español con este texto y tres variables de cuerpo:

    Hola {{1}}. Píldora de SÓCRATES DS · {{2}}:

    {{3}}

    Respóndeme aquí con tu idea. Puedes pausar cuando quieras respondiendo PAUSAR.

Variable 1 es el saludo, 2 el curso y 3 el reto. Meta debe aprobar la plantilla antes de habilitar los envíos. La categoría final la define Meta al revisar la plantilla.

## 2. Configurar Vercel

Añade estas variables como secretos del entorno Production del proyecto socrates-ds. Configura Preview también si quieres probarlo ahí.

| Variable | Uso |
|---|---|
| SUPABASE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY | Acceso servidor para vincular teléfonos y guardar evidencia; nunca usar en el navegador |
| CRON_SECRET | Protege el despachador de mensajes |
| WHATSAPP_TOKEN | Token de acceso de Meta |
| WHATSAPP_PHONE_NUMBER_ID | ID del número empresarial de WhatsApp |
| WHATSAPP_DISPLAY_PHONE | Número visible para que puedas abrir/agregar el chat |
| WHATSAPP_VERIFY_TOKEN | Texto compartido para verificar el callback |
| META_APP_SECRET | Validar firma del webhook |
| WHATSAPP_GRAPH_VERSION | Versión activa de Graph API, formato vNN.0 |
| WHATSAPP_TEMPLATE_NAME | Nombre aprobado; por defecto socrates_pildora_v1 |
| WHATSAPP_TEMPLATE_LANGUAGE | Idioma exacto aprobado; por defecto es |

La app ya contiene la URL y la publishable key de Supabase. Si el entorno de Vercel no tiene una clave de servidor, genera una secret key en Supabase y agrégala como SUPABASE_SECRET_KEY.

## 3. Aplicar y vincular

Ejecuta la migración supabase/migrations/0014_whatsapp_tutor.sql sobre el proyecto de Supabase conectado. Luego publica la versión de Vercel que incluye este cambio.

En SÓCRATES DS, abre WhatsApp → elige 1, 2 o 3 pasadas diarias → genera el código → abre el chat con el tutor y envía VINCULAR <código>. El código vence en diez minutos. Escribe PAUSAR para detener envíos y CONTINUAR para retomarlos.

## Horarios

Las pasadas son a las 11:00, 13:00 y 17:00 de Lima. La de las 13:00 conserva el ejercicio de variable objetivo y predictores, pero cambia el caso de negocio; las otras rotan entre los siete cursos. La opción de una píldora usa las 13:00; dos usan 13:00 y 17:00; tres usan las tres. El tutor no envía un caso nuevo si hay una pregunta de los últimos siete días pendiente, ni durante una clase según el horario de SÓCRATES.

Vercel Cron usa UTC y, en el plan Hobby, puede ejecutar una tarea diaria con una variación de hasta 59 minutos. Cada respuesta se evalúa frente a la guía explícita de su concepto. Cuando el evaluador tiene confianza suficiente, la evidencia alimenta la dimensión de dominio y la cola de repaso; siempre se etiqueta como formativa y no oficial.

## Mensajes y privacidad

Las tablas nuevas mantienen el número y las respuestas detrás de RLS. El navegador solo puede leer filas del usuario autenticado; escrituras, webhooks y llamadas a Meta ocurren en rutas servidoras. El código de emparejamiento se guarda como hash y se consume al vincular. El consentimiento se confirma cuando envías el código por WhatsApp. Texto PAUSAR detiene los envíos. En esta primera versión las respuestas deben ser texto; no se procesan notas de voz ni archivos.
