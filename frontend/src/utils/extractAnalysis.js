function isAnalysisObject(x) {
  return !!(x && typeof x === "object" && x.meta && x.overview && Array.isArray(x.mostPlayedChampions));
}

function cleanJsonLikeString(input) {
  let s = String(input ?? "").trim();

  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    try { s = JSON.parse(s); } catch {
        //skip
    }
  }

  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, "");
  return s;
}

function parseJsonLikeString(input) {
  const cleaned = cleanJsonLikeString(input);
  const tryParse = (text) => {
    const v = JSON.parse(text);
    if (typeof v === "string" && v.trim().startsWith("{")) {
      return JSON.parse(v);
    }
    return v;
  };

  try {
    return tryParse(cleaned);
  } catch {
    const s2 = cleaned.replace(/,(\s*[}\]])/g, "$1");
    return tryParse(s2);
  }
}

export function extractAnalysis(input) {
  if (input == null) throw new Error("No analysis input");

  if (isAnalysisObject(input)) return input;

  if (typeof input === "object" && typeof input.raw === "string") {
    const obj = parseJsonLikeString(input.raw);
    if (isAnalysisObject(obj)) return obj;
    throw new Error("Parsed RAW but result is not a valid analysis object.");
  }

  if (typeof input === "string") {
    const obj = parseJsonLikeString(input);
    if (isAnalysisObject(obj)) return obj;
    throw new Error("String parsed but result is not a valid analysis object.");
  }

  try {
    const obj = JSON.parse(JSON.stringify(input));
    if (isAnalysisObject(obj)) return obj;
  } catch {
    //skip
  }
  throw new Error("Could not coerce analysis input.");
}
