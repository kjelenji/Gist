import { detectObjectsInImage } from './locate_objects_spatially.js';
import { generateDrawingsForObjects } from './generate_drawing.js';
import { startRiddleGame } from './riddle.js';
import { generateStoryFromObjects } from './generate_story.js';
import { generateRiddleForImage } from './riddle.js';

/**
 * Complete GIST Pipeline:
 * 1. Load initial image
 * 2. Detect objects in the image
 * 3. Generate individual drawings for each object
 * 4. Option: Generate a story connecting the objects
 * 5. Play interactive riddle game with the generated images
 * 6. Reveal original image after all riddles are solved
 */

async function runCompleteGistPipeline(initialImagePath) {
  try {
    console.log('🖼️  Starting GIST Interactive Puzzle Pipeline...\n');

    // Step 1: Detect objects in the initial image
    console.log(`📍 Step 1: Detecting objects in ${initialImagePath}...`);
    const detectedObjects = await detectObjectsInImage(initialImagePath);
    console.log(`✅ Found ${detectedObjects.length} objects\n`);

    // Step 2: Generate drawings (descriptions) for each detected object
    console.log('🎨 Step 2: Generating individual image descriptions...');
    const generatedImages = await generateDrawingsForObjects(detectedObjects);
    console.log(`✅ Generated ${generatedImages.length} descriptions\n`);

    // Generate riddles for each image
    const riddles = [];
    for (const img of generatedImages) {
      const riddleText = await generateRiddleForImage(img.label);
      riddles.push({ label: img.label, description: img.description, riddle: riddleText });
    }

    // Generate the story
    const story = await generateStoryFromObjects(generatedImages);

    const gameData = {
      riddles: riddles,
      story: story,
      originalImagePath: initialImagePath
    };

    console.log('\nCOPY THIS JSON DATA INTO game.html\n');
    console.log(JSON.stringify(gameData, null, 2));
    console.log('\nEND OF JSON DATA\n');

  } catch (error) {
    console.error('❌ Error in pipeline:', error);
    process.exit(1);
  }
}

// Run the pipeline with your initial image
const initialImage = process.argv[2] || 'your_initial_puzzle_image.jpg';
runCompleteGistPipeline(initialImage);
