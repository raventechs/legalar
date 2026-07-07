// consultaLegal.js — legalAR v2.1
// Verificación de token via Firebase REST API (sin firebase-admin ni Service Account)

const SYSTEM_PROMPT = `Sos un asistente de orientación legal basado EXCLUSIVAMENTE en legislación de la República Argentina (Código Civil y Comercial, Código Penal, leyes nacionales, jurisprudencia de tribunales argentinos, etc).

Tu tarea: ante una consulta de una persona, devolver SIEMPRE y ÚNICAMENTE un objeto JSON (sin texto antes ni después, sin markdown, sin backticks) con esta forma exacta:

{
  "tema": "string breve, 3-6 palabras, el tema legal detectado",
  "respuesta_tecnica": "string, 120-220 palabras, en lenguaje jurídico técnico argentino, con referencias a artículos de ley y figuras jurídicas concretas",
  "respuesta_simple": "string, 100-180 palabras, la MISMA orientación pero en lenguaje cotidiano, sin jerga",
  "caso_referencia": "string, 60-120 palabras: un caso jurisprudencial real o ejemplo de aplicación típico en Argentina (si no estás seguro de un fallo específico, describí un caso-tipo, sin inventar nombres de fallos o partes que no existan)",
  "caso_referencia_url": "URL pública real y verificable (SAIJ, CSJN, InfoLEG) o string vacío si no estás seguro",
  "bibliografia": [{"texto": "referencia normativa o doctrinaria concreta", "url": "URL real si la conocés con certeza, sino vacío"}],
  "diagrama_mermaid": "sintaxis válida de Mermaid flowchart TD que resuma el proceso, o string vacío si no aplica",
  "diagrama_nota": "si diagrama_mermaid viene vacío, explicá brevemente por qué",
  "advertencia": "recordatorio corto de que esto es orientativo y no reemplaza a un abogado matriculado"
}

Reglas estrictas:
- Nunca afirmes un resultado garantizado de un caso judicial.
- No inventes números de expediente, fallos o URLs que no existan; si no estás seguro, dejá esos campos vacíos.
- El diagrama Mermaid debe ser sintácticamente válido.
- Responde siempre en español rioplatense.`;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Método no permitido" }) };

  try {
    // Verificar token con Firebase REST API (sin firebase-admin)
    const authHeader = event.headers.authorization || event.headers.Authorization || "";
    const idToken = authHeader.replace("Bearer ", "");
    if (!idToken) return { statusCode: 401, headers, body: JSON.stringify({ error: "Falta token de autenticación" }) };

    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_WEB_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!verifyRes.ok) return { statusCode: 401, headers, body: JSON.stringify({ error: "Token inválido" }) };

    const body = JSON.parse(event.body || "{}");
    const consulta = (body.consulta || "").trim();
    if (!consulta) return { statusCode: 400, headers, body: JSON.stringify({ error: "Falta el texto de la consulta" }) };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: consulta }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Error del API: " + JSON.stringify(data).slice(0, 300) }) };
    }

    const raw = data.content.map((b) => b.text || "").join("\n");
    let clean = raw.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start !== -1 && end !== -1) clean = clean.slice(start, end + 1);

    const parsed = JSON.parse(clean);
    return { statusCode: 200, headers, body: JSON.stringify(parsed) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message || "Error desconocido" }) };
  }
};
