import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';

const genAI = new GoogleGenerativeAI('AIzaSyCug211miDvG-NT_nwyr7hIJuPnUVQiJHA');

async function detectObjectsInImage(imagePath) {
  const imageBytes = fs.readFileSync(imagePath).toString('base64');
  const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const response = await model.generateContent([
    { inlineData: { data: imageBytes, mimeType } },
    'Detect all distinct objects in this image. ' +
    'Return ONLY a valid JSON array with no markdown. ' +
    'Each element must have exactly two keys: ' +
    '"label" (string name of the object) and ' +
    '"bbox" (array [ymin, xmin, ymax, xmax] as integers 0-1000).'
  ]);

  let jsonText = response.response.text();

  // 1. Strip markdown fences
  jsonText = jsonText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // 2. Extract just the [...] array in case Gemini wraps it in prose
  const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
  if (arrayMatch) jsonText = arrayMatch[0];

  // 3. Smart/curly quotes → straight quotes
  jsonText = jsonText.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");

  // 4. Remove literal control characters (tab, newline, CR, etc.) that are
  //    invalid inside JSON string values — replace with a space
  jsonText = jsonText.replace(/[\x00-\x1F\x7F]/g, (ch, offset) => {
    // Preserve newlines/spaces that are structural (between tokens), not inside strings.
    // Simplest safe approach: replace all with space; JSON.parse tolerates whitespace between tokens.
    return ' ';
  });

  // 5. Trailing commas before ] or }
  jsonText = jsonText.replace(/,\s*([\]\}])/g, '$1');

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    console.error('Raw Gemini response:\n', response.response.text());
    throw new SyntaxError(`Failed to parse object detection JSON: ${e.message}`);
  }

  // Normalize key names in case Gemini uses variants
  return parsed.map(obj => ({
    label: obj.label || obj.name || obj.object || 'Unknown',
    bbox: obj.bbox || obj.box || obj.bounding_box || obj.boundingBox || null
  }));
}

export { detectObjectsInImage };