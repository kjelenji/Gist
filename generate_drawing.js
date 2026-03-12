import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const METADATA_DIR = path.join(__dirname, 'generated_metadata');

const genAI = new GoogleGenerativeAI('AIzaSyCug211miDvG-NT_nwyr7hIJuPnUVQiJHA');

async function generateImagesFromDetectedObjects(detectedObjects) {
  const generatedImages = [];
  const uniqueObjects = new Set();
  const MAX_IMAGES = 6;

  for (const obj of detectedObjects) {
    if (generatedImages.length >= MAX_IMAGES) break;
    if (uniqueObjects.has(obj.label.toLowerCase())) continue;
    uniqueObjects.add(obj.label.toLowerCase());

    const prompt = `Describe a ${obj.label} in 1-2 vivid sentences as if a detective is examining it closely. Focus on its physical details and atmosphere.`;

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const response = await model.generateContent(prompt);
      const description = response.response.text().trim();

      if (description) {
        const safeLabel = obj.label.replace(/\s/g, '_').replace(/[^\w-]/g, '');
        const filename = `generated_${safeLabel}.json`;
        fs.mkdirSync(METADATA_DIR, { recursive: true });
        const filepath = path.join(METADATA_DIR, filename);
        fs.writeFileSync(filepath, JSON.stringify({
          label: obj.label,
          description,
          bbox: obj.bbox || null,
          timestamp: new Date().toISOString()
        }, null, 2));
        console.log(`Metadata written -> ${filepath}`);
        generatedImages.push({
          label: obj.label,
          filename: filepath,
          bbox: obj.bbox || null,
          description
        });
      }
    } catch (error) {
      console.error(`Error generating description for ${obj.label}:`, error);
    }
  }
  return generatedImages;
}

export async function generateDrawingsForObjects(detectedObjects) {
  return generateImagesFromDetectedObjects(detectedObjects);
}