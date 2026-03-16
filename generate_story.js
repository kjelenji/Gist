import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';

const genAI = new GoogleGenerativeAI('AIzaSyDvstYbpu_WDnQfDFR6w_AfsOebRU9B8XA');

async function generateStoryFromObjects(generatedImages, imagePath = null) {
  const objectLabels = generatedImages.map(img => img.label);

  const parts = [];

  if (imagePath) {
    try {
      const imageBytes = fs.readFileSync(imagePath).toString('base64');
      const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      parts.push({ inlineData: { data: imageBytes, mimeType } });
    } catch (e) {
      console.warn('Could not read image for story generation:', e.message);
    }
  }

  const systemInstruction = `You are a gothic mystery fiction writer. You output ONLY valid JSON — no markdown fences, no prose outside the JSON object.

Your response MUST be exactly this shape:
{
  "story": "<the mystery paragraph>",
  "poeticNames": {
    "<real label 1>": "<poetic title used in story>",
    "<real label 2>": "<poetic title used in story>"
  }
}

ABSOLUTE RULES for the story:
1. FORBIDDEN: writing any real object name from the input list. Every object MUST be disguised as a poetic title invented by you. Examples: "giraffe" -> "the Gentle Tall-Walker", "rabbit" -> "the Angel of the Warren", "knife" -> "the Silver Tongue of the Scullery", "book" -> "the Crimson Ledger". If you write ANY real label word, you have failed.
2. First sentence: pure atmospheric scene-setting only (light, air, weather, mood). No characters yet.
3. Central mystery: something is explicitly missing, displaced, or behaving strangely.
4. Every character (animal, person, figure) has an evocative invented proper name: "Professor Hoot", "Sister Vulpina", "Pip the mouse". NEVER write "the rabbit" or "a bird".
5. A directional clue pointing toward a hidden place, a secret passage, or an unresolved location.
6. Final sentence: unresolved tension (a sound heard, a gaze held, a door unopened).
7. Exactly ONE paragraph, 5-7 sentences, no line breaks inside it.

EXAMPLE VALID OUTPUT (study the structure and tone exactly):
{
  "story": "The sunlight filtered through the canopy like molten gold, but a shadow of unease hung over the Oakwood Parish as the forest choir began their silent prayer. Professor Hoot, perched atop the Hollow Stump, adjusted his spectacles and looked out at the congregation of monks and nuns, noting a glaring absence: the Gentle Tall-Walker was missing from his usual spot by the blue-furred brother. In his place lay a single, peculiar clue—a long, green stalk left leaning against a stump, pointing directly toward the treacherous Widow Willow's creek. While Sister Vulpina chanted from the Crimson Ledger, Pip the mouse noticed that the Angel of the Warren was hovering higher than usual, staring toward a deep, hidden fissure in the earth where a soft, rhythmic thumping echoed against the damp walls.",
  "poeticNames": {
    "giraffe": "the Gentle Tall-Walker",
    "rabbit": "the Angel of the Warren",
    "plant": "a long green stalk",
    "book": "the Crimson Ledger"
  }
}`;

  const taskPrompt = imagePath
    ? `The real object labels detected in this image are: ${objectLabels.join(', ')}.\n\n` +
      `Look at the image. Ground every atmospheric detail in what you actually see — the real location, lighting, colours, mood. ` +
      `Write the mystery story and return the JSON now. Every label MUST be disguised. Do not write ANY of these words in the story: ${objectLabels.join(', ')}.`
    : `The real object labels are: ${objectLabels.join(', ')}.\n\n` +
      `Write the mystery story and return the JSON now. Every label MUST be disguised. Do not write ANY of these words in the story: ${objectLabels.join(', ')}.`;

  parts.push({ text: taskPrompt });

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction });
    const response = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.95, maxOutputTokens: 900 }
    });

    let rawText = response.response.text().trim();
    rawText = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      console.warn('Story JSON parse failed, using raw text as story. Raw:\n', rawText);
      return { story: rawText, poeticNames: {} };
    }

    const story = parsed.story || rawText;
    const poeticNames = parsed.poeticNames || {};
    console.log('Generated Story:\n', story);
    console.log('Poetic name map:', poeticNames);
    return { story, poeticNames };
  } catch (error) {
    console.error('Error generating story:', error);
    return { story: 'Failed to generate story.', poeticNames: {} };
  }
}

export { generateStoryFromObjects };