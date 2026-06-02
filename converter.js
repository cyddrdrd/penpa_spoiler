const PENPA_BASE = "https://swaroopg92.github.io/penpa-edit/";
const TINYURL_EXPANDER_WORKER = "https://tinyurl-expand.cyddrdrd.workers.dev/";


async function expandShortUrlIfNeeded(url) {
  url = url.trim();

  const match = url.match(/tinyurl\.com\/(.+)/i);

  if (!match) {
    return url;
  }

  const apiUrl = TINYURL_EXPANDER_WORKER + "?url=" + encodeURIComponent(url);

  const response = await fetch(apiUrl);

  if (!response.ok) {
    throw new Error("Could not expand TinyURL. Please paste the full Penpa URL instead.");
  }

  const data = await response.json();

  if (!data.success || !data.longurl) {
    throw new Error(
      "TinyURL expansion failed: " +
      (data.error || "unknown error")
    );
  }

  const expanded = data.longurl;

  if (!expanded.includes("p=") || !expanded.includes("a=")) {
    throw new Error(
      "TinyURL was expanded, but the expanded URL does not contain both p= and a=. " +
      "The TinyURL may not be an answer-check Penpa link."
    );
  }

  return expanded;
}


function parsePenpaParams(url) {
  url = url.trim();

  let paramText;

  if (url.includes("#")) {
    paramText = url.split("#", 2)[1].trim();
  } else if (url.includes("?")) {
    paramText = url.split("?", 2)[1].trim();
  } else {
    throw new Error("URL has neither # fragment nor ? query parameters.");
  }

  const params = {};

  for (const part of paramText.split("&")) {
    if (!part) continue;

    const eq = part.indexOf("=");

    if (eq === -1) {
      params[decodeURIComponent(part)] = "";
    } else {
      const key = part.slice(0, eq);
      const value = part.slice(eq + 1);

      // Important:
      // Do NOT replace '+' with spaces.
      // Penpa base64 payload uses literal '+'
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    }
  }

  return params;
}


function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}


function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }

  return btoa(binary);
}


function inflateRawB64(b64) {
  const compressed = base64ToBytes(b64);
  const decompressed = pako.inflateRaw(compressed);
  return new TextDecoder("utf-8").decode(decompressed);
}


function deflateRawB64(text) {
  const input = new TextEncoder().encode(text);
  const compressed = pako.deflateRaw(input, { level: 9 });
  return bytesToBase64(compressed);
}


function jsString(x) {
  return JSON.stringify(String(x));
}


function normalizeAnswer(answer) {
  while (answer.length < 6) {
    answer.push([]);
  }

  return answer;
}


function answerSurfaceEntries(items) {
  const out = [];

  for (const item of items) {
    const parts = String(item).split(",");
    const cell = parts[0];
    const style = parts.length >= 2 ? parts[1] : "3";

    out.push(`${jsString(cell)}:${style}`);
  }

  return out;
}


function answerSegmentEntries(items) {
  const out = [];

  for (const item of items) {
    const parts = String(item).split(",");

    if (parts.length < 3) continue;

    const p1 = parts[0];
    const p2 = parts[1];
    let style = parts[2];

    if (style === "1") {
      style = "3";
    }

    out.push(`${jsString(p1 + "," + p2)}:${style}`);
  }

  return out;
}


function answerNumberEntries(items) {
  const out = [];

  for (const item of items) {
    const parts = String(item).split(",");

    if (parts.length < 2) continue;

    const cell = parts[0];
    const value = parts[1];
    const style = parts.length >= 3 ? parts[2] : "10";

    out.push(`${jsString(cell)}:[${jsString(value)},${style},${jsString("1")}]`);
  }

  return out;
}


function buildAnswerObject(answer) {
  answer = normalizeAnswer(answer);

  const zS = answerSurfaceEntries(answer[0]).join(",");
  const zL = answerSegmentEntries(answer[1]).join(",");
  const zE = answerSegmentEntries(answer[2]).join(",");
  const zW = answerSegmentEntries(answer[3]).join(",");
  const zN = answerNumberEntries(answer[4]).join(",");

  return (
    "{" +
    "zR:{z_:[]}," +
    "zU:{z_:[]}," +
    "z8:{z_:[]}," +
    `zS:{${zS}},` +
    `zN:{${zN}},` +
    "z1:{}," +
    "zY:{}," +
    "zT:[]," +
    "z3:[]," +
    "zD:[]," +
    "z0:[]," +
    "z5:[]," +
    `zL:{${zL}},` +
    `zE:{${zE}},` +
    `zW:{${zW}},` +
    "zC:{}," +
    "z4:{}," +
    "z6:[]," +
    "z7:[]" +
    "}"
  );
}


function emptyPenpaObject() {
  return (
    "{" +
    "zR:{z_:[]}," +
    "zU:{z_:[]}," +
    "z8:{z_:[]}," +
    "zS:{}," +
    "zN:{}," +
    "z1:{}," +
    "zY:{}," +
    "zT:[]," +
    "z3:[]," +
    "zD:[]," +
    "z0:[]," +
    "z5:[]," +
    "zL:{}," +
    "zE:{}," +
    "zW:{}," +
    "zC:{}," +
    "z4:{}," +
    "z6:[]," +
    "z7:[]" +
    "}"
  );
}


function buildAnswerHistoryObject(answer) {
  answer = normalizeAnswer(answer);

  const ops = [];
  let counter = 1;

  for (const item of answer[0]) {
    const parts = String(item).split(",");
    const cell = parts[0];

    ops.push(`[zS,${cell},zO,${jsString("pu_a_col")},${counter}]`);
    counter += 1;
  }

  for (const item of answer[1]) {
    const parts = String(item).split(",");

    if (parts.length >= 2) {
      const key = parts[0] + "," + parts[1];
      ops.push(`[zL,${jsString(key)},zO,${jsString("pu_a_col")},0]`);
    }
  }

  for (const item of answer[2]) {
    const parts = String(item).split(",");

    if (parts.length >= 2) {
      const key = parts[0] + "," + parts[1];
      ops.push(`[zE,${jsString(key)},zO,${jsString("pu_a_col")},0]`);
    }
  }

  for (const item of answer[3]) {
    const parts = String(item).split(",");

    if (parts.length >= 2) {
      const key = parts[0] + "," + parts[1];
      ops.push(`[zW,${jsString(key)},zO,${jsString("pu_a_col")},0]`);
    }
  }

  for (const item of answer[4]) {
    const parts = String(item).split(",");

    if (parts.length >= 2) {
      const cell = parts[0];
      const value = parts[1];
      const style = parts.length >= 3 ? parts[2] : "10";
      const num = `[${jsString(value)},${style},${jsString("1")}]`;

      ops.push(`[zN,${cell},${num},${jsString("pu_a_col")},0]`);
    }
  }

  return (
    "{" +
    "zR:{z_:[]}," +
    "zU:{z_:[]}," +
    `z8:{z_:[${ops.join(",")}]},` +
    "zS:{}," +
    "zN:{}," +
    "z1:{}," +
    "zY:{}," +
    "zT:[]," +
    "z3:[]," +
    "zD:[]," +
    "z0:[]," +
    "z5:[]," +
    "zL:{}," +
    "zE:{}," +
    "zW:{}," +
    "zC:{}," +
    "z4:{}," +
    "z6:[]," +
    "z7:[]" +
    "}"
  );
}


function isPenpaObjectLine(line) {
  return (
    line.startsWith("{") &&
    line.includes("zS:{") &&
    line.includes("zN:{") &&
    line.includes("zL:{") &&
    line.includes("zE:{")
  );
}


function findProblemLine(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (isPenpaObjectLine(lines[i])) {
      return i;
    }
  }

  throw new Error("Could not find the problem object line.");
}


function findPenpaObjectLines(lines) {
  const indices = [];

  for (let i = 0; i < lines.length; i++) {
    if (isPenpaObjectLine(lines[i])) {
      indices.push(i);
    }
  }

  return indices;
}


function cleanSolvedupProgressInPlace(lines, problemIndex, answerObject) {
  /*
    For solvedup links, p= may contain solving progress.
    Do NOT insert/delete lines, because Penpa payloads are partly line-position based.

    Strategy:
      - keep the problem layer
      - overwrite the next line with the reconstructed answer layer
      - clear later progress/history/object layers in place
  */

  const answerIndex = problemIndex + 1;

  if (answerIndex >= lines.length) {
    lines.push(answerObject);
  } else {
    lines[answerIndex] = answerObject;
  }

  for (let i = answerIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    if (isPenpaObjectLine(line)) {
      lines[i] = emptyPenpaObject();
      continue;
    }

    if (
      line.includes("pu_q") ||
      line.includes("pu_a") ||
      line.includes("pu_a_col") ||
      line.includes("solvedup")
    ) {
      lines[i] = "x";
      continue;
    }
  }

  return answerIndex;
}


function insertOrReplaceAnswerLayer(lines, problemIndex, answerObject) {
  const objectLines = findPenpaObjectLines(lines);

  /*
    Normal full Penpa payload:
      first object line  = problem layer
      second object line = answer/solution layer

    If a second object layer already exists, replace that.
  */
  if (objectLines.length >= 2) {
    const secondObjectIndex = objectLines[1];
    lines[secondObjectIndex] = answerObject;
    return secondObjectIndex;
  }

  const nextIndex = problemIndex + 1;

  if (
    nextIndex < lines.length &&
    (
      lines[nextIndex].trim() === "" ||
      lines[nextIndex].trim() === "x" ||
      lines[nextIndex].trim() === "{}"
    )
  ) {
    lines[nextIndex] = answerObject;
    return nextIndex;
  }

  /*
    Do not overwrite a non-empty structural line.
    For ordinary non-solvedup payloads, inserting here has worked better.
  */
  lines.splice(nextIndex, 0, answerObject);
  return nextIndex;
}


function upgradeToolState(lines) {
  if (lines.length <= 2) return;

  if (lines[2].startsWith("{") && lines[2].includes("z9:")) {
    return;
  }

  let candidate = null;

  for (const line of lines) {
    if (
      line.startsWith("{") &&
      line.includes("z9:") &&
      line.includes("zQ:") &&
      line.includes("zA:")
    ) {
      candidate = line;
      break;
    }
  }

  if (candidate !== null) {
    candidate = candidate.replace(/z9:zA/, "z9:zQ");
    lines[2] = candidate;
  }
}


function addSolutionSuffixToTitle(lines) {
  if (!lines.length) return;

  const metadata = lines[0];

  const titleMarker = "Title: ";
  const authorMarker = ",Author:";

  const titleStart = metadata.indexOf(titleMarker);

  if (titleStart === -1) {
    const title = metadata.trim();

    if (title && !title.toLowerCase().endsWith("(solution)")) {
      lines[0] = metadata + " (solution)";
    }

    return;
  }

  const titleValueStart = titleStart + titleMarker.length;
  let titleEnd = metadata.indexOf(authorMarker, titleValueStart);

  if (titleEnd === -1) {
    titleEnd = metadata.indexOf(",", titleValueStart);

    if (titleEnd === -1) {
      titleEnd = metadata.length;
    }
  }

  const title = metadata.slice(titleValueStart, titleEnd);

  if (!title.trim()) return;

  if (title.trim().toLowerCase().endsWith("(solution)")) {
    return;
  }

  const newTitle = title + " (solution)";

  lines[0] =
    metadata.slice(0, titleValueStart) +
    newTitle +
    metadata.slice(titleEnd);
}


async function convertPenpaUrl(inputUrl) {
  inputUrl = await expandShortUrlIfNeeded(inputUrl);

  const params = parsePenpaParams(inputUrl);

  if (!("p" in params)) {
    throw new Error("Input URL has no p= payload.");
  }

  if (!("a" in params)) {
    throw new Error("Input URL has no a= answer-check payload.");
  }

  const pText = inflateRawB64(params["p"]);
  const aText = inflateRawB64(params["a"]);

  const answer = JSON.parse(aText);
  const lines = pText.split("\n");

  addSolutionSuffixToTitle(lines);
  upgradeToolState(lines);

  const problemIndex = findProblemLine(lines);
  const answerObject = buildAnswerObject(answer);

  let answerIndex;
  const isSolvedup = params["l"] === "solvedup";

  if (isSolvedup) {
    answerIndex = cleanSolvedupProgressInPlace(
      lines,
      problemIndex,
      answerObject
    );
  } else {
    answerIndex = insertOrReplaceAnswerLayer(
      lines,
      problemIndex,
      answerObject
    );
  }

  if (!isSolvedup) {
    for (let i = answerIndex + 1; i < lines.length; i++) {
      if (lines[i] === "x" && i > answerIndex + 5) {
        lines[i] = buildAnswerHistoryObject(answer);
        break;
      }
    }
  }

  const newPText = lines.join("\n");
  const newP = deflateRawB64(newPText);

  if (inflateRawB64(newP) !== newPText) {
    throw new Error("Compression/decompression round-trip failed.");
  }

  return `${PENPA_BASE}#m=edit&p=${newP}`;
}
