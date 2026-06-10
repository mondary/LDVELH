const fs = require("fs");
const path = require("path");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

const PDF_DIR = path.join(__dirname, "..", "src", "assets", "pdf");
const READERS_DIR = path.join(__dirname, "..", "src", "data", "readers");
const PAGE_MAP_DIR = path.join(__dirname, "..", "src", "data", "pagemaps");

if (!fs.existsSync(PAGE_MAP_DIR)) fs.mkdirSync(PAGE_MAP_DIR, { recursive: true });
if (!fs.existsSync(READERS_DIR)) fs.mkdirSync(READERS_DIR, { recursive: true });

function findPDFs(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findPDFs(full));
    else if (entry.name.toLowerCase().endsWith(".pdf")) results.push(full);
  }
  return results.sort();
}

function extractChoiceLabel(text, toNum) {
  const patterns = [
    new RegExp(
      `((?:Si vous|Si tu|Si vous pouvez|Si vous décidez|Si vous souhaitez|Si vous préférez|Si vous disposez|Si vous possédez|Si vous avez|Si vous choisissez|Si vous optez|Si vous utilisez|Si vous réussissez|Si vous voulez)[^.!?:;]*?rendez[- ]vous\\s+(?:au|à)\\s*${toNum})`,
      "i"
    ),
    new RegExp(
      `((?:Si vous|Si tu)[^.!?:;]*?(?:au|à)\\s*${toNum})`,
      "i"
    ),
    new RegExp(
      `((?:Allez-vous|Voulez-vous|Préférez-vous|Décidez-vous|Pouvez-vous|Avez-vous)[^.!?:;]*?(?:au|à)\\s*${toNum})`,
      "i"
    ),
    new RegExp(
      `((?:acceptez|accepter|refusez|refuser|utiliser|employer|choisissez|décidez|partez|fuyez|attaquez|ouvrez|entrez|prenez|sortez|montez|descendez|nagez|continuez|avancez|retournez|allez|suivez|explorez|examinez|boire|manger|dormir|attendre|rester|combattre|parler|donner|poser|frapper|lancer|tirer|appeler|cacher|grimper|sauter|passer|essayer|tenter)[^.!?:;]*?(?:au|à|vers)\\s*${toNum})`,
      "i"
    ),
    new RegExp(
      `((?:rendez[- ]vous|reportez[- ]vous|dirigez[- ]vous|tournez|retournez)\\s+(?:au|à|en|vers)?\\s*(?:paragraphe\\s+)?${toNum})`,
      "i"
    ),
  ];

  for (const re of patterns) {
    const m = re.exec(text);
    if (m && m[1]) {
      let label = m[1].trim();
      label = label.replace(/\s+/g, " ").trim();
      label = label.replace(/,\s*$/, "").trim();
      if (label.length > 5 && label.length < 200) return label;
    }
  }
  return "Rendez-vous au " + toNum;
}

async function extractFromPDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const doc = await pdfjsLib.getDocument(new Uint8Array(dataBuffer)).promise;
  const numPages = doc.numPages;

  const paragraphs = [];
  const pageMap = {};
  const introLines = [];
  let currentParaId = null;
  let currentLines = [];
  let foundFirstPara = false;

  for (let pageIdx = 1; pageIdx <= numPages; pageIdx++) {
    const page = await doc.getPage(pageIdx);
    const content = await page.getTextContent();
    const items = content.items;

    const linesByY = {};
    for (const item of items) {
      const y = Math.round(item.transform[5]);
      if (!linesByY[y]) linesByY[y] = [];
      linesByY[y].push({
        x: item.transform[4],
        str: item.str,
        fontSize: item.transform[0],
      });
    }

    const sortedYs = Object.keys(linesByY)
      .map(Number)
      .sort((a, b) => b - a);

    for (const y of sortedYs) {
      const lineItems = linesByY[y].sort((a, b) => a.x - b.x);
      const fullText = lineItems.map((i) => i.str).join(" ").trim();
      const firstX = lineItems[0].x;

      if (!fullText) continue;

      const nonEmpty = lineItems.filter((i) => i.str.trim());
      const standaloneNum =
        nonEmpty.length === 1 && /^\d{1,3}$/.test(nonEmpty[0].str.trim());
      const rightAlignedNum = firstX > 250 && standaloneNum;

      if (rightAlignedNum) {
        const num = parseInt(fullText.trim());
        if (num >= 1 && num <= 500) {
          if (!foundFirstPara && num === 1) foundFirstPara = true;
          if (currentParaId !== null && currentLines.length > 0) {
            paragraphs.push({
              id: currentParaId,
              lines: currentLines,
              pageNum: pageMap[currentParaId] || 0,
            });
          }
          currentParaId = num;
          currentLines = [];
          if (!pageMap[num]) pageMap[num] = pageIdx;
          continue;
        }
      }

      if (foundFirstPara) {
        if (currentParaId !== null) {
          currentLines.push(fullText);
        }
      } else {
        introLines.push({ text: fullText, page: pageIdx, x: firstX, fontSize: lineItems[0].fontSize });
      }
    }
  }

  if (currentParaId !== null && currentLines.length > 0) {
    paragraphs.push({
      id: currentParaId,
      lines: currentLines,
      pageNum: pageMap[currentParaId] || 0,
    });
  }

  const intro = buildIntro(introLines);

  const sections = [];
  for (const para of paragraphs) {
    let text = para.lines.join(" ").trim();
    text = text.replace(/\s{2,}/g, " ");
    text = text.replace(/\s([,;:!?])/g, "$1");
    text = text.replace(/\( /g, "(");
    text = text.replace(/ \)/g, ")");
    if (text.length < 15) continue;

    const choices = [];
    const choiceRegex =
      /(?:rendez[- ]vous|aller|tournez|retournez|reportez[- ]vous|dirigez[- ]vous|rendez\.vous)\s+(?:au|à|en|vers)?\s*(?:paragraphe\s+)?(\d{1,3})/gi;
    let m;
    const seen = new Set();
    while ((m = choiceRegex.exec(text)) !== null) {
      const to = parseInt(m[1]);
      if (to >= 1 && to <= 500 && !seen.has(to)) {
        seen.add(to);
        choices.push({ to, label: extractChoiceLabel(text, to) });
      }
    }

    if (choices.length === 0) {
      const simpleChoice = /(?:rendez[- ]vous|aller|aller à|tournez|retournez)\s+(?:au|à)?\s*(\d{1,3})[.\s,;]?/gi;
      while ((m = simpleChoice.exec(text)) !== null) {
        const to = parseInt(m[1]);
        if (to >= 1 && to <= 500 && !seen.has(to)) {
          seen.add(to);
          choices.push({ to, label: "Aller au " + to });
        }
      }
    }

    if (choices.length === 0 && seen.size === 0) {
      const turnTo =
        /\b(?:turn to|go to)\s+(?:paragraph\s+)?(\d{1,3})/gi;
      while ((m = turnTo.exec(text)) !== null) {
        const to = parseInt(m[1]);
        if (to >= 1 && to <= 500 && !seen.has(to)) {
          seen.add(to);
          choices.push({ to, label: "Turn to " + to });
        }
      }
    }

    sections.push({
      id: para.id,
      text: text,
      choices: choices,
    });
  }

  sections.sort((a, b) => a.id - b.id);

  return { sections, pageMap, intro };
}

function buildIntro(introLines) {
  if (!introLines.length) return [];

  const fullText = introLines
    .map((l) => l.text)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s([,;:!?])/g, "$1")
    .replace(/\( /g, "(")
    .replace(/ \)/g, ")")
    .trim();

  if (fullText.length < 30) return [];

  const SECTION_HEADINGS = [
    { re: /^(?:comment jouer|les r[eé]gles|r[eé]gles du jeu|mode d'emploi|comment utiliser)/i, kicker: "Règles" },
    { re: /^(?:r[eé]sum[eé]|prologue|pr[eé]ambule)/i, kicker: "Histoire" },
    { re: /^(?:[eé]quipement|votre [eé]quipement|le mat[eé]riel)/i, kicker: "Équipement" },
    { re: /^(?:combat|les combats|r[eé]solution des combats|affrontement)/i, kicker: "Combat" },
    { re: /^(?:habilet[eé]|comp[eé]tences?|disciplines?|pouvoirs?|magies?|techniques?|la volont[eé]|l'endurance|les caract[eé]ristiques)/i, kicker: "Caractéristiques" },
    { re: /^(?:table de hasard|table al[eé]atoire|tables?)/i, kicker: "Tables" },
    { re: /^(?:mission|votre mission|but du jeu|objectif)/i, kicker: "Mission" },
    { re: /^(?:feuille d'aventure|fiche|personnage|cr[eé]ation)/i, kicker: "Personnage" },
    { re: /^(?:conseils?|notes? importantes?)/i, kicker: "Conseils" },
    { re: /^(?:r[eé]partition|possession|nourriture|argent|objets)/i, kicker: "Équipement" },
    { re: /^(?:possibilit[eé]s? de fuite|la fuite)/i, kicker: "Combat" },
  ];

  const sentences = fullText.split(/(?<=[.!?:])\s+/);
  const cards = [];
  let currentCard = null;
  let currentLen = 0;
  const MAX_CARD_LEN = 2500;

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed || trimmed.length < 3) continue;

    let matchedHeading = null;
    for (const sh of SECTION_HEADINGS) {
      if (sh.re.test(trimmed)) {
        matchedHeading = sh;
        break;
      }
    }

    const isTitleLike = trimmed.length < 60 && (matchedHeading || /^[A-ZÀÂÉÈÊËÎÏÔÙÛÜÆŒ]/.test(trimmed));

    if (matchedHeading && isTitleLike) {
      if (currentCard && currentCard.text.length > 10) {
        cards.push(currentCard);
      }
      currentCard = { kicker: matchedHeading.kicker, title: trimmed.replace(/[.:]+$/, ""), text: "" };
      currentLen = 0;
    } else if (currentCard && currentLen + trimmed.length > MAX_CARD_LEN) {
      currentCard.text += (currentCard.text ? " " : "") + trimmed;
      cards.push(currentCard);
      currentCard = { kicker: currentCard.kicker, title: "", text: "" };
      currentLen = 0;
    } else if (currentCard) {
      currentCard.text += (currentCard.text ? " " : "") + trimmed;
      currentLen += trimmed.length;
    } else {
      currentCard = { kicker: "Introduction", title: "", text: trimmed };
      currentLen = trimmed.length;
    }
  }

  if (currentCard && currentCard.text.length > 10) {
    cards.push(currentCard);
  }

  if (cards.length === 0 && fullText.length > 30) {
    const words = fullText.split(" ");
    const CHUNK_SIZE = 2000;
    let chunk = "";
    for (const w of words) {
      if (chunk.length + w.length + 1 > CHUNK_SIZE && chunk) {
        cards.push({ kicker: "Introduction", title: "", text: chunk.trim() });
        chunk = "";
      }
      chunk += (chunk ? " " : "") + w;
    }
    if (chunk.trim()) cards.push({ kicker: "Introduction", title: "", text: chunk.trim() });
  }

  for (const card of cards) {
    if (card.text.length > 3000) {
      card.text = card.text.substring(0, 3000) + "…";
    }
  }

  return cards;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[àáâä]/g, "a")
    .replace(/[éèêë]/g, "e")
    .replace(/[ïî]/g, "i")
    .replace(/[ôö]/g, "o")
    .replace(/[ùûü]/g, "u")
    .replace(/ç/g, "c")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/-{2,}/g, "-");
}

function extractTitle(fileName) {
  let name = fileName.replace(/\.pdf$/i, "");
  name = name.replace(/^\d+\s*[-–—]\s*/, "");
  name = name.replace(/^\d+\s+/, "");
  name = name.replace(/^LDVELH\s+/i, "");
  return name.trim();
}

function extractBookId(fileName, dirName) {
  const series = slugify(dirName.replace(/^LDVELH\s*[-–—]\s*PDF\s*[-–—]\s*/i, ""));
  const title = slugify(extractTitle(fileName));
  return series + "-" + title;
}

async function processPDF(filePath) {
  const { sections, pageMap, intro } = await extractFromPDF(filePath);
  const fileName = path.basename(filePath);
  const dirName = path.basename(path.dirname(filePath));
  const relPath = "/" + path.relative(path.join(__dirname, "..", "src"), filePath).split(path.sep).join("/");

  const bookId = extractBookId(fileName, dirName);
  const title = extractTitle(fileName);

  return {
    bookId,
    title,
    pdf: relPath,
    sections,
    pageMap,
    intro,
    numSections: sections.length,
  };
}

async function main() {
  const pdfs = findPDFs(PDF_DIR);
  console.log(`Found ${pdfs.length} PDFs to process.\n`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < pdfs.length; i++) {
    const filePath = pdfs[i];
    const name = path.basename(filePath);
    try {
      const result = await processPDF(filePath);

      if (result.numSections < 10) {
        skipped++;
        console.log(
          `[${i + 1}/${pdfs.length}] SKIP ${name} (${result.numSections} sections - too few)`
        );
        continue;
      }

      const readerData = {
        bookId: result.bookId,
        title: result.title,
        subtitle: "",
        pdf: result.pdf,
        intro: result.intro && result.intro.length > 0 ? result.intro : undefined,
        sections: result.sections,
      };

      const readerFile = path.join(READERS_DIR, result.bookId + ".json");
      fs.writeFileSync(readerFile, JSON.stringify(readerData, null, 2), "utf-8");

      if (Object.keys(result.pageMap).length > 0) {
        const mapFile = path.join(PAGE_MAP_DIR, result.bookId + ".json");
        fs.writeFileSync(mapFile, JSON.stringify(result.pageMap, null, 2), "utf-8");
      }

      success++;
      console.log(
        `[${i + 1}/${pdfs.length}] OK ${name} → ${result.numSections} sections, ${Object.keys(result.pageMap).length} page mappings`
      );
    } catch (err) {
      failed++;
      console.log(`[${i + 1}/${pdfs.length}] ERR ${name}: ${err.message}`);
    }
  }

  console.log(`\nDone: ${success} succeeded, ${failed} failed, ${skipped} skipped`);
}

main().catch(console.error);
