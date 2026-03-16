import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const genAI = new GoogleGenerativeAI('AIzaSyDvstYbpu_WDnQfDFR6w_AfsOebRU9B8XA');

function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

function askQuestion(rl, query) {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });
}

async function generateRiddleForImage(imageLabel) {
  try {
    const prompt = `Create a single, complete, clever riddle for the following object: ${imageLabel}. 
    The riddle must be ONE COMPLETE SENTENCE and should be challenging but solvable. 
    Do NOT state the object name directly.
    Return ONLY the complete riddle sentence, nothing else.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300
      }
    });

    let riddleText = response.response.text().trim();
    // Ensure it ends with a period if it doesn't already
    if (!riddleText.endsWith('.') && !riddleText.endsWith('?')) {
      riddleText += '.';
    }
    return riddleText;
  } catch (error) {
    console.error(`Error generating riddle for ${imageLabel}:`, error);
    return `What is a ${imageLabel}?`;
  }
}

async function playRiddleGame(generatedImages, originalImagePath) {
  const rl = createReadlineInterface();
  
  console.log('\n🎮 Welcome to the Image Riddle Game! 🎮\n');
  console.log(`You have ${generatedImages.length} riddles to solve!\n`);
  
  const correctAnswers = [];
  const totalRiddles = generatedImages.length;
  
  // Pair up images (2 images per riddle)
  for (let i = 0; i < generatedImages.length; i += 2) {
    const imageSet = [];
    const riddles = [];
    
    // Get up to 2 images for this round
    imageSet.push(generatedImages[i]);
    if (i + 1 < generatedImages.length) {
      imageSet.push(generatedImages[i + 1]);
    }
    
    console.log(`\n📸 Round ${Math.floor(i / 2) + 1}:`);
    console.log('Images loaded. Get ready for your riddles!\n');
    
    // Generate and present riddlefor each image in this set
    for (const image of imageSet) {
      const riddle = await generateRiddleForImage(image.label);
      console.log(`\nRiddle: ${riddle}`);
      
      let isCorrect = false;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (!isCorrect && attempts < maxAttempts) {
        const playerGuess = await askQuestion(rl, 'Your answer: ');
        
        if (playerGuess.toLowerCase() === image.label.toLowerCase()) {
          console.log(`✅ Correct! The answer was: ${image.label}`);
          correctAnswers.push(image.label);
          isCorrect = true;
        } else {
          attempts++;
          if (attempts < maxAttempts) {
            console.log(`❌ Incorrect. Try again! (${maxAttempts - attempts} attempts remaining)`);
          } else {
            console.log(`❌ Out of attempts! The correct answer was: ${image.label}`);
            correctAnswers.push(`${image.label} (hint used)`);
          }
        }
      }
    }
  }
  
  // Game complete - show final image
  console.log('\n You\'ve completed all the riddles! 🎉\n');
  console.log(`You correctly identified ${correctAnswers.length} out of ${totalRiddles} objects.\n`);
  
  console.log('📸 Here is the original image that all the objects came from:');
  console.log(`   ${originalImagePath}`);
  
  if (fs.existsSync(originalImagePath)) {
    console.log('\n✨ You can now view the original image to see how all these objects fit together!');
  }
  
  rl.close();
}

export async function startRiddleGame(generatedImages, originalImagePath) {
  await playRiddleGame(generatedImages, originalImagePath);
}

export { generateRiddleForImage };
