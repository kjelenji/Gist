import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleGenAI } from '@google/genai';
import { detectObjectsInImage } from './locate_objects_spatially.js';
import { generateDrawingsForObjects } from './generate_drawing.js';
import { generateStoryFromObjects } from './generate_story.js';
import { loadMemory, saveMemory } from './memory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = 'AIzaSyDvstYbpu_WDnQfDFR6w_AfsOebRU9B8XA';

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

let gameState = {
  // card-game state
  levelData: null,
  imageBase64: '',
  imageMimeType: 'image/jpeg',
  // legacy fields kept for old endpoints
  objects: [],
  riddles: [],
  story: '',
  poeticNames: {},
  originalImagePath: ''
};

// Serve the original puzzle image
app.get('/api/image', (req, res) => {
  // Prefer in-memory base64 (from browser upload)
  if (gameState.imageBase64) {
    const buf = Buffer.from(gameState.imageBase64, 'base64');
    res.set('Content-Type', gameState.imageMimeType);
    return res.send(buf);
  }
  // Fallback: serve from file path
  if (!gameState.originalImagePath) {
    return res.status(404).json({ error: 'No image loaded yet' });
  }
  const imagePath = path.resolve(__dirname, gameState.originalImagePath);
  if (!fs.existsSync(imagePath)) {
    return res.status(404).json({ error: 'Image file not found' });
  }
  res.sendFile(imagePath);
});

// Generate a full mystery (theme + 6 cards + riddles) from an uploaded image
// Replaces bare control characters (newlines, tabs, etc.) that appear inside
// JSON string values — they make JSON.parse throw "Unterminated string".
function sanitiseJsonString(raw) {
  const CTRL = { '\n': '\\n', '\r': '\\r', '\t': '\\t' };
  let inString  = false;
  let escaped   = false;
  let out       = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (escaped) { out += ch; escaped = false; continue; }
    if (ch === '\\') { out += ch; escaped = true; continue; }
    if (ch === '"') { inString = !inString; out += ch; continue; }
    if (inString && CTRL[ch]) { out += CTRL[ch]; continue; }
    out += ch;
  }
  return out;
}

// Generate a random scene image with Imagen and return it as base64
app.post('/api/generate-ai-image', async (req, res) => {
  try {
    const genAINew = new GoogleGenAI({ apiKey: API_KEY });
    const scenes = [
      'A misty harbour at dawn with fishing boats and seagulls',
      'A bustling market square in an old European town',
      'A dense jungle clearing with ancient stone ruins',
      'A cosy library filled with towering bookshelves and a fireplace',
      'A snowy mountain village at twilight with glowing windows',
      'A sun-drenched Mediterranean rooftop overlooking the sea',
      'A moonlit desert with sand dunes and a lone camel caravan',
      'A Victorian greenhouse filled with exotic tropical plants',
    ];
    const scene = scenes[Math.floor(Math.random() * scenes.length)];
    const imgRes = await genAINew.models.generateImages({
      model: 'imagen-4.0-fast-generate-001',
      prompt: `Realistic photograph: ${scene}. Rich detail, vibrant colours, high quality.`,
      config: { numberOfImages: 1, outputMimeType: 'image/jpeg' }
    });
    const generated = imgRes.generatedImages?.[0];
    if (!generated?.image?.imageBytes) {
      return res.status(500).json({ success: false, error: 'No image generated' });
    }
    const imageBase64 = generated.image.imageBytes;
    const mimeType = 'image/jpeg';
    // Store it so /api/image can serve it
    gameState.imageBase64   = imageBase64;
    gameState.imageMimeType = mimeType;
    res.json({ success: true, imageBase64, mimeType, scene });
  } catch (err) {
    console.error('AI image generation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/generate-mystery', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'No image data provided' });
    }

    gameState.imageBase64   = imageBase64;
    gameState.imageMimeType = mimeType || 'image/jpeg';

    // 1. Save image to a temp file so detectObjectsInImage can read it
    const tmpDir  = path.join(__dirname, 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpPath = path.join(tmpDir, `upload_${Date.now()}.jpg`);
    fs.writeFileSync(tmpPath, Buffer.from(imageBase64, 'base64'));

    // 2. Detect up to 6 distinct objects with precise bounding boxes
    let detectedObjects = [];
    try {
      const raw = await detectObjectsInImage(tmpPath);
      const seen = new Set();
      for (const obj of raw) {
        const key = (obj.label || '').toLowerCase().trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        detectedObjects.push(obj);
        if (detectedObjects.length === 6) break;
      }
      console.log(`Detected ${detectedObjects.length} objects:`, detectedObjects.map(o => o.label));
    } catch (detErr) {
      console.warn('Object detection failed, continuing without bboxes:', detErr.message);
    } finally {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }

    // 3. Load past mysteries from Firestore for memory context
    let memoryContext = '';
    try {
      const past = await loadMemory();
      if (past.length > 0) {
        memoryContext =
          '\n\nPAST MYSTERIES — do NOT repeat these themes or objects:\n' +
          past.map((m, i) =>
            `${i + 1}. Theme: "${m.theme}" | Objects: ${(m.objects || []).join(', ')}`
          ).join('\n');
      }
    } catch (_) {}

    // 4. Build the object list section of the prompt
    const objectList = detectedObjects.length > 0
      ? 'Use these EXACT detected objects as the 6 card subjects (preserve this order):\n' +
        detectedObjects.map((o, i) => `  Card ${i + 1}: "${o.label}"`).join('\n') + '\n\n'
      : '';

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt =
      `You are a mystery puzzle writer for a 2026 game app.\n` +
      `Look at this image and create a mystery puzzle. Write like a normal person texting in 2026 — short, clear, no drama.\n` +
      `No flowery language. No archaic words. No over-the-top descriptions. Just plain, direct English.\n\n` +
      `${objectList}` +
      `Return ONLY a single valid JSON object — no markdown, no extra text.\n\n` +
      `FIELDS:\n\n` +
      `"theme": 4-6 word mystery title. Keep it simple (e.g. "Who Took the Last Key").\n\n` +
      `"cards": 6 objects from the image. Each card:\n` +
      `  id: 1-6\n` +
      `  object_label: real name of the object — internal only\n` +
      `  name: a short nickname for the object (3-4 words) that hints at its role without naming it\n` +
      `  visual_description: one plain sentence about why this object matters to the mystery\n\n` +
      `"riddles": EXACTLY 5 riddles — one per card or card-pair. Every one of the 6 cards must appear in exactly one riddle.\n\n` +
      `  Design rule: pick any 4 cards as SOLO cards (one riddle each) and the remaining 2 as a SECRET PAIR (one shared riddle). Choose the pair that has the most interesting story connection.\n\n` +
      `  SOLO riddle (4 of these): correct_card_ids = [single card id]. The riddle is about that one object.\n` +
      `  PAIR riddle (1 of these): correct_card_ids = [two card ids]. The riddle connects both objects. The player must find and select both cards together.\n\n` +
      `  For every riddle:\n` +
      `  "text": 1-2 sentences. State one weird or suspicious detail you notice, then ask a direct question. Under 40 words. No poetic language.\n` +
      `  Bad: "The flame of the ancient taper flickered with eerie purpose..."\n` +
      `  Good: "The candle burned down on one side only. What was sitting next to it all night?"\n\n` +
      `  "answer_options": 4 choices (5-8 words each). All plausible. Only one correct.\n` +
      `  "correct_answer": copy one option exactly.\n` +
      `  "answer_explanation": one plain sentence — why that answer is right.\n\n` +
      `"story": Write this LAST, after you have designed all 5 riddles. 3-4 sentences. The story must use the correct answer from each riddle as a plot point — weave all 5 answers into one coherent mystery reveal. Plain language, no drama.\n\n` +
      `${memoryContext}\n\n` +
      `JSON shape (copy exactly — 5 riddles, ids 101–105):\n` +
      `{"theme":"","story":"","cards":[{"id":1,"object_label":"","name":"","visual_description":""}],"riddles":[{"id":101,"text":"","correct_card_ids":[1],"answer_options":["","","",""],"correct_answer":"","answer_explanation":""},{"id":102,"text":"","correct_card_ids":[2],"answer_options":["","","",""],"correct_answer":"","answer_explanation":""},{"id":103,"text":"","correct_card_ids":[3],"answer_options":["","","",""],"correct_answer":"","answer_explanation":""},{"id":104,"text":"","correct_card_ids":[4],"answer_options":["","","",""],"correct_answer":"","answer_explanation":""},{"id":105,"text":"","correct_card_ids":[5,6],"answer_options":["","","",""],"correct_answer":"","answer_explanation":""}]}`;

    const response = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { data: imageBase64, mimeType: gameState.imageMimeType } },
          { text: prompt }
        ]
      }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 8192, responseMimeType: 'application/json' }
    });

    let jsonText = response.response.text().trim();
    jsonText = jsonText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let levelData;
    try {
      levelData = JSON.parse(jsonText);
    } catch (parseErr) {
      console.error('JSON parse failed. Raw response:\n', response.response.text());
      throw new SyntaxError(`Failed to parse Gemini JSON: ${parseErr.message}`);
    }

    // 5. Merge precise bboxes from step 2 into the cards (matched by array index)
    if (detectedObjects.length > 0) {
      levelData.cards = (levelData.cards || []).map((card, i) => ({
        ...card,
        bbox: detectedObjects[i]?.bbox ?? null
      }));
    }

    gameState.levelData = levelData;
    gameState.story     = levelData.story || '';

    // 6. Generate illustrated drawings for each card using Gemini image generation
    gameState.cardDrawings = {};
    try {
      const genAINew = new GoogleGenAI({ apiKey: API_KEY });
      for (const card of levelData.cards) {
        try {
          const drawRes = await genAINew.models.generateContent({
            model: 'gemini-3.1-flash-image-preview',
            contents: [{ role: 'user', parts: [{ text:
              `Crosshatch pen illustration of a ${card.object_label}. ` +
              `Clean lines, slightly mysterious mood, isolated on plain white background. No text, no labels.`
            }] }],
            config: { responseModalities: ['IMAGE'] }
          });
          for (const part of drawRes.candidates[0].content.parts) {
            if (part.inlineData) {
              gameState.cardDrawings[card.id] = {
                data:     part.inlineData.data,
                mimeType: part.inlineData.mimeType
              };
              break;
            }
          }
          console.log(`Drew card ${card.id} (${card.object_label})`);
        } catch (drawErr) {
          console.warn(`Drawing failed for card ${card.id} (${card.object_label}):`, drawErr.message);
        }
        // Small pause between requests to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
      }
      console.log(`Generated drawings for ${Object.keys(gameState.cardDrawings).length}/${levelData.cards.length} cards`);
    } catch (drawErr) {
      console.warn('Card drawing generation skipped:', drawErr.message);
    }

    // 7. Persist to Firestore (non-blocking — failure doesn't break the game)
    saveMemory(levelData).catch(() => {});

    res.json({ success: true, levelData });
  } catch (error) {
    console.error('Error generating mystery:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve AI-generated card illustration by card ID
app.get('/api/card-image/:cardId', (req, res) => {
  const cardId  = parseInt(req.params.cardId, 10);
  const drawing = gameState.cardDrawings?.[cardId];
  if (!drawing) return res.status(404).json({ error: 'No drawing available for this card' });
  const buf = Buffer.from(drawing.data, 'base64');
  res.set('Content-Type', drawing.mimeType || 'image/png');
  res.send(buf);
});

// Start a new game — detects objects, generates story and ALL riddles up front
app.post('/api/start-game', async (req, res) => {
  try {
    const { imagePath } = req.body;
    const actualImagePath = imagePath || 'your_initial_puzzle_image.jpg';
    console.log(`🎮 Starting new game with image: ${actualImagePath}`);

    // 0. Clear metadata from the previous game
    const metadataDir = path.join(__dirname, 'generated_metadata');
    if (fs.existsSync(metadataDir)) {
      for (const file of fs.readdirSync(metadataDir)) {
        fs.unlinkSync(path.join(metadataDir, file));
      }
      console.log('🗑️  Cleared previous game metadata');
    }

    // 1. Detect objects with bounding boxes
    const detectedObjects = await detectObjectsInImage(actualImagePath);

    // 2. Generate descriptions (applies MAX_IMAGES=6 limit and deduplication)
    const generatedImages = await generateDrawingsForObjects(detectedObjects);

    // 3. Generate story from the actual image using vision
    const { story, poeticNames } = await generateStoryFromObjects(generatedImages, actualImagePath);

    // 4. Pre-generate riddles — each clue uses the object's poetic title from the story
    const genAI = new GoogleGenerativeAI(API_KEY);
    const riddleSystemInstruction =
      `You write riddle clues for a gothic mystery game. Rules you must never break:
` +
      `1. NEVER write the real name of the object — not once, not even partially.
` +
      `2. Refer to the object ONLY by its poetic title (given in the prompt).
` +
      `3. Write in the same eerie, fable-like voice as the story provided.
` +
      `4. The clue must describe what the object witnesses, holds, or signifies WITHIN the story's events — not generic properties.
` +
      `5. 2-3 sentences. Return ONLY the clue text — no labels, no quotes, no preamble.`;
    const riddleModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction: riddleSystemInstruction });

    const riddles = [];
    for (const img of generatedImages) {
      const poeticName = poeticNames?.[img.label] || poeticNames?.[img.label.toLowerCase()] || 'the mysterious presence';
      const prompt =
        `Story:\n"${story}"\n\n` +
        `The object whose real name is "${img.label}" appears in this story as "${poeticName}".\n\n` +
        `Write a 2-3 sentence riddle clue in the voice of this story. ` +
        `You may name it as "${poeticName}". The word "${img.label}" must NEVER appear in your response. ` +
        `Describe what it witnesses, holds, or signifies within the mystery.`;

      const response = await riddleModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.85, maxOutputTokens: 300 }
      });

      let riddle = response.response.text().trim();
      if (!riddle.endsWith('.') && !riddle.endsWith('?')) riddle += '.';
      riddles.push(riddle);
    }

    // Save game state
    gameState.objects = generatedImages;
    gameState.riddles = riddles;
    gameState.story = story;
    gameState.poeticNames = poeticNames;
    gameState.originalImagePath = actualImagePath;

    res.json({
      success: true,
      totalRiddles: generatedImages.length,
      message: `Game started! ${generatedImages.length} riddles to solve.`
    });
  } catch (error) {
    console.error('Error starting game:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get a pair of riddles (2 per page)
app.get('/api/riddle-pair/:pairIndex', (req, res) => {
  try {
    const pairIndex = parseInt(req.params.pairIndex);
    const total = gameState.objects.length;
    const totalPairs = Math.ceil(total / 2);
    const idx0 = pairIndex * 2;
    const idx1 = pairIndex * 2 + 1;

    if (idx0 >= total) {
      return res.status(400).json({ success: false, error: 'Pair index out of range' });
    }

    const obj0 = gameState.objects[idx0];
    const result = {
      success: true,
      pairIndex,
      totalPairs,
      progress: `Round ${pairIndex + 1} of ${totalPairs}`,
      first: {
        index: idx0,
        riddle: gameState.riddles[idx0],
        bbox: obj0.bbox
      }
    };

    if (idx1 < total) {
      const obj1 = gameState.objects[idx1];
      result.second = {
        index: idx1,
        riddle: gameState.riddles[idx1],
        bbox: obj1.bbox
      };
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check answer
app.post('/api/check-answer', (req, res) => {
  try {
    const { index, answer } = req.body;
    const obj = gameState.objects[index];
    const isCorrect = answer.toLowerCase().trim() === obj.label.toLowerCase().trim();
    res.json({
      success: true,
      isCorrect,
      answer: obj.label,
      message: isCorrect
        ? `✅ Correct! It was a ${obj.label}!`
        : `❌ The answer was: ${obj.label}`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get story and original image path
app.get('/api/story', (req, res) => {
  res.json({
    success: true,
    story: gameState.story,
    originalImage: gameState.originalImagePath
  });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`🎮 Game server running at http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Trying to reclaim it…`);
    // Wait briefly then retry — the old process may be shutting down
    setTimeout(() => {
      server.close();
      app.listen(PORT, () => {
        console.log(`🎮 Game server running at http://localhost:${PORT} (restarted)`);
      });
    }, 1500);
  } else {
    throw err;
  }
});

// Graceful shutdown — ensures port is released on Ctrl+C
process.on('SIGINT', () => { server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
