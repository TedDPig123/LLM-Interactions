import fs from "fs-extra";
import path from "path";
import csv from "csv-parser";
import xlsx from "xlsx";
import sharp from "sharp";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

const openai = new OpenAI({ apiKey:"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"});
const anthropic = new Anthropic({ apiKey:"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"});

const OUTPUT_DIR = "outputs";
const QUERY_FILE = "query_data_205.xlsx";
const FITNESS_FILE = "workout_fitness_tracker_data.csv";
const NOTE_FILE = path.join(OUTPUT_DIR, "Note.txt");

const delay = ms => new Promise(res => setTimeout(res, ms));

function sanitize(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

function formatPromptBlock(queryRow, fitnessRow) {
  const queryBlock = `=== USER QUERY ===
Query: ${queryRow.query}
Activity: ${queryRow.activity}
Related to Activity: ${queryRow.relatedToActivity}
Time: ${queryRow.time}`;

  const fitnessBlock = `=== SELECTED FITNESS DATA ===
${Object.entries(fitnessRow)
  .map(([k, v]) => `${k}: ${v}`)
  .join("\n")}`;

  const modelPrompt = `=== FULL PROMPT SENT TO MODEL ===
You are a data visualization expert specializing in smartwatch health interfaces. You will be given a single row of personal health data and a user query:

User Query: ${queryRow.query}

Personal Health Data:
${Object.entries(fitnessRow)
  .map(([k, v]) => `${k}: ${v}`)
  .join("\n")}

Your task is to:
1. Determine the most appropriate visualization mode for the insight, choosing from:
   - Donut chart
   - Bar chart  
   - Icon-based chart
   - Text-only with color/icon emphasis

2. Generate a single compact SVG suitable for a smartwatch screen (approximately 360x360 pixels). The SVG must be:
   - Visually clear and glanceable
   - Optimized for small screens
   - Aesthetically pleasing, with components contrasting the background
   - Self-contained (no external styles or dependencies)
   - Labeled with meaningful titles, units, or icons where appropriate
   - In the style of a visual that would be seen on a smartwatch

Focus on the user's perspective: What is most relevant for them to know at a glance right now?

Please respond with only the SVG code, starting with <svg and ending with </svg>.`;

  return { queryBlock, fitnessBlock, modelPrompt };
}

function extractSVG(text) {
  const match = text.match(/<svg[\s\S]*<\/svg>/i);
  return match ? match[0] : null;
}

async function convertSVGtoPNG(svgPath, pngPath) {
  const svgBuffer = await fs.readFile(svgPath);
  await sharp(svgBuffer).resize(360, 360).png().toFile(pngPath);
}

async function readCSV(filepath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filepath)
      .pipe(csv())
      .on("data", data => results.push(data))
      .on("end", () => resolve(results))
      .on("error", reject);
  });
}

async function generateSVGWithModel(model, prompt, retries = 3) {
  const delay = ms => new Promise(res => setTimeout(res, ms));

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (model === "openai") {
        const res = await openai.chat.completions.create({
          model: "gpt-4",
          temperature: 0.7,
          messages: [{ role: "user", content: prompt }],
        });
        return res.choices[0].message.content;
      } else if (model === "claude") {
        const res = await anthropic.messages.create({
          model: "claude-opus-4-20250514",
          temperature: 0.7,
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        });
        return res.content[0].text;
      }
    } catch (err) {
      const errorMessage = err?.error?.message || err.message || "Unknown error";
      if (model === "claude" && errorMessage.includes("Overloaded") && attempt < retries) {
        const backoff = 1000 * Math.pow(2, attempt); // 2s, 4s, 8s...
        console.warn(`[!] Claude overloaded. Retrying in ${backoff / 1000}s... (Attempt ${attempt})`);
        await delay(backoff);
        continue;
      } else {
        throw err;
      }
    }
  }

  throw new Error(`${model.toUpperCase()} failed after ${retries} attempts`);
}

// async function generateSVGWithModel(model, prompt) {
//   if (model === "openai") {
//     const res = await openai.chat.completions.create({
//       model: "gpt-4",
//       temperature: 0.7,
//       messages: [{ role: "user", content: prompt }],
//     });
//     return res.choices[0].message.content;
//   } else if (model === "claude") {
//     const res = await anthropic.messages.create({
//       model: "claude-opus-4-20250514",
//       temperature: 0.7,
//       max_tokens: 2000,
//       messages: [{ role: "user", content: prompt }],
//     });
//     return res.content[0].text;
//   }
// }

async function main() {
  const [,, startArg, endArg] = process.argv;
  const startRow = parseInt(startArg);
  const endRow = parseInt(endArg);

  if (isNaN(startRow) || isNaN(endRow) || startRow < 1 || endRow < startRow) {
    console.error("Usage: node generate_from_xlsx.js <startRow> <endRow>");
    process.exit(1);
  }

  await fs.ensureDir(path.join(OUTPUT_DIR, "openai"));
  await fs.ensureDir(path.join(OUTPUT_DIR, "claude"));

  const logStream = fs.createWriteStream(NOTE_FILE, { flags: "a" });

  const workbook = xlsx.readFile(QUERY_FILE);
  const sheet = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  const fitnessData = await readCSV(FITNESS_FILE);

  let counter = 1;

  for (let i = startRow - 1; i < endRow; i++) {
    const row = sheet[i];
    const fitnessRow = fitnessData[Math.floor(Math.random() * fitnessData.length)];
    const { queryBlock, fitnessBlock, modelPrompt } = formatPromptBlock(row, fitnessRow);

    const folderNum = String(counter).padStart(3, "0");
    const folderName = `${folderNum}_${sanitize(row.query)}`;

    for (const model of ["openai", "claude"]) {
      try {
        const outputFolder = path.join(OUTPUT_DIR, model, folderName);
        await fs.ensureDir(outputFolder);

        const fullPrompt = `${queryBlock}\n\n${fitnessBlock}\n\n${modelPrompt}`;
        const response = await generateSVGWithModel(model, modelPrompt);
        const svg = extractSVG(response);

        if (!svg) throw new Error("No valid SVG generated");

        const svgPath = path.join(outputFolder, "result.svg");
        const pngPath = path.join(outputFolder, "result.png");
        const promptPath = path.join(outputFolder, "prompt.txt");

        await fs.writeFile(svgPath, svg);
        await fs.writeFile(promptPath, fullPrompt);
        await convertSVGtoPNG(svgPath, pngPath);

        logStream.write(`[✓] ${model.toUpperCase()} - Row ${i + 1} → ${folderName}\n`);
      } catch (err) {
        logStream.write(`[X] ${model.toUpperCase()} - Row ${i + 1} FAILED: ${err.message}\n`);
      }
    }

    counter++;
    await delay(500);
  }

  logStream.end();
  console.log("Done. Check outputs folder.");
}

main();
