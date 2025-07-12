import express from "express";
import cors from "cors";
import fs from "fs";
import csv from "csv-parser";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(cors());
app.use(express.static("public"));
app.use(express.json());

function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (err) => reject(err));
  });
}

app.post("/generate", async (req, res) => {
  try {
    const {
      fields = [],
      prompt: userPrompt = "How much water did I drink today?",
      constraints = "",
      modelProvider = "openai", // or "anthropic"
      apiKey,
    } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: "API key is required" });
    }

    const data = await readCSV(path.join(__dirname, "workout_fitness_tracker_data.csv"));
    const randomRow = data[Math.floor(Math.random() * data.length)];

    const filteredRow = {};
    for (const field of fields) {
      if (randomRow.hasOwnProperty(field)) {
        filteredRow[field] = randomRow[field];
      }
    }

    const basePrompt = `
Given the following JSON data and user query, generate an SVG-based glanceable chart.

Data:
${JSON.stringify(filteredRow, null, 2)}

Query: "${userPrompt}"

Constraints:
${constraints}

Important:
- Do not include explanations, markdown, or comments.
- Use class chart-text for ALL text
- Use a width of 540px and a height of 540px
- Make sure that if it was shrunk down to 200x200 it would still be readable
- When dealing with text, ALWAYS specify the font size in the svg
- Provide SVG <title> and <desc> for accessibility.
`;

    let responseText = "";

    if (modelProvider === "anthropic") {
      const anthropic = new Anthropic({ apiKey });
      const completion = await anthropic.messages.create({
        model: "claude-opus-4-20250514",
        max_tokens: 2000,
        temperature: 0.7,
        messages: [
          { role: "user", content: basePrompt }
        ],
      });
      responseText = completion.content[0]?.text || "";
    } else {
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are an expert in data visualization and SVG design." },
          { role: "user", content: basePrompt },
        ],
      });
      responseText = completion.choices[0].message.content;
    }

    const svgMatch = responseText.match(/<svg[\s\S]*<\/svg>/i);
    const svgCode = svgMatch ? svgMatch[0] : "<!-- Invalid SVG Output -->";

    res.json({ row: filteredRow, svg: svgCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate SVG" });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
