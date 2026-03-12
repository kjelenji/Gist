function puzzle(guess_part, guess, answer) {
  if (guess_part in hashmap) {
    guess.add(guess_part);
    hashmap.remove(guess_part);
  }

  if (guess === answer) {
    console.log("✅ Correct! You've solved the puzzle.");
  }
  else {
    let userInput = prompt("Guess again! Here's a clue: ");
    guess_part = userInput;
    //Generate a clue word for the answer and give user a chance to guess again
    const keys = Array.from(hashmap.keys());
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    if (hashmap.has(randomKey)) {
      const values = hashmap.get(randomKey);
      // Print each value in the array
      values.forEach(val => console.log(val));
    }
    puzzle(guess_part, guess, answer);
  }
}

function hashmap(part, clueWord) {
  const map = new Map();
  if (part in map) {
    map.get(part).push(clueWord)
  } else {
    map.set(part, [clueWord]);
  }
}

async function run() {

  try {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const ai = new GoogleGenerativeAI("AIzaSyCug211miDvG-NT_nwyr7hIJuPnUVQiJHA");


    const model = ai.getGenerativeModel({ 
      model: "gemini-3.1-pro-preview",
    });
  const resQ = await model.generateContent("Generate a trivia question.");
  const resA = await model.generateContent(`Generate an answer without restating the question in the answer for "${resQ.response.text()}"`);
  console.log(resQ.response.text());
  //separate words in answer into parts
  //hashmap: (part 1: clue word 1, clue word 2, clue word 3, clue word 4)
  //create a clue word for each part
  const answer = resA.response.text();
  answer.split(" ").forEach(async word => {
    let i = 0;
    while (i<4) {
       const clue = await model.generateContent(`Generate a clue word for the part "${word}" in the answer "${answer}"`);
       hashmap(word, clue.response.text());
       i++;
    }
  });
    //keep printing clue words until the answer is correctly guessed
    //ask user to input a guess for the answer
    let guess = new Set();
    let guess_part = String;
    puzzle(guess_part, guess, answer);
  } catch (error) {
    console.error("Error: " + error.message);
  }
  
}

run();


