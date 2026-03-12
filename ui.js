import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { detectObjectsInImage } from './locate_objects_spatially.js';
import { generateDrawingsForObjects } from './generate_drawing.js';
import { generateStoryFromObjects } from './generate_story.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = 'AIzaSyCug211miDvG-NT_nwyr7hIJuPnUVQiJHA';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let gameState = {
  objects: [],      // [{ label, bbox, description }, ...]
  riddles: [],      // pre-generated riddle strings, one per object
  story: '',
  poeticNames: {},  // { realLabel: 'poetic title', ... }
  originalImagePath: ''
};

// Serve the original puzzle image
app.get('/api/image', (req, res) => {
  if (!gameState.originalImagePath) {
    return res.status(404).json({ error: 'No game started yet' });
  }
  const imagePath = path.resolve(__dirname, gameState.originalImagePath);
  if (!fs.existsSync(imagePath)) {
    return res.status(404).json({ error: 'Image file not found' });
  }
  res.sendFile(imagePath);
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
app.listen(PORT, () => {
  console.log(`🎮 Game server running at http://localhost:${PORT}`);
});
