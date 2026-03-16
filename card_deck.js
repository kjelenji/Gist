import React, { useState } from 'react';

// Pass your AI-generated 'cards' array and the 'currentRiddle' object as props
const MysteryDeck = ({ cards, currentRiddle, onWin }) => {
  // Stores the IDs of the cards the player has clicked
  const [selectedCardIds, setSelectedCardIds] = useState([]);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const handleCardClick = (cardId) => {
    let newSelection;

    // 1. Toggle Logic: If card is already selected, remove it
    if (selectedCardIds.includes(cardId)) {
      newSelection = selectedCardIds.filter(id => id !== cardId);
      setSelectedCardIds(newSelection);
      setFeedbackMessage(""); // Clear feedback on deselect
      return; 
    }

    // 2. Add the new card to the selection array
    newSelection = [...selectedCardIds, cardId];
    
    // 3. UX Control: Prevent selecting more cards than the riddle requires
    const requiredCount = currentRiddle.correct_card_ids.length;
    if (newSelection.length > requiredCount) {
      // If they need 2 cards but click a 3rd, drop the oldest selection
      newSelection = newSelection.slice(1);
    }
    
    setSelectedCardIds(newSelection);

    // 4. Auto-Check Win Condition if they reached the required amount
    if (newSelection.length === requiredCount) {
      checkWinCondition(newSelection, currentRiddle.correct_card_ids);
    }
  };

  const checkWinCondition = (userSelection, correctAnswers) => {
    // Sort both arrays so [1, 2] matches [2, 1] perfectly
    const sortedUser = [...userSelection].sort();
    const sortedAnswers = [...correctAnswers].sort();

    // Check if every item in the arrays matches
    const isWin = sortedUser.every((val, index) => val === sortedAnswers[index]);

    if (isWin) {
      setFeedbackMessage("🎉 Correct! The Gist is revealed...");
      // Trigger your final story synthesis API call here!
      if (onWin) onWin(); 
    } else {
      setFeedbackMessage("❌ Not quite. The mystery deepens...");
      // Optional: Auto-clear their wrong guesses after a second
      setTimeout(() => setSelectedCardIds([]), 1500); 
    }
  };

  return (
    <div className="game-container">
      {/* Show the Riddle */}
      <h2>{currentRiddle.text}</h2>
      <p className="hint">Select {currentRiddle.correct_card_ids.length} card(s)</p>

      {/* Show Feedback */}
      {feedbackMessage && <h3 className="feedback">{feedbackMessage}</h3>}

      {/* Render the Cards */}
      <div className="card-grid" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {cards.map(card => {
          const isSelected = selectedCardIds.includes(card.id);
          return (
            <div 
              key={card.id} 
              onClick={() => handleCardClick(card.id)}
              style={{
                border: isSelected ? '4px solid #4CAF50' : '2px solid #ccc',
                padding: '20px',
                cursor: 'pointer',
                borderRadius: '8px',
                width: '150px',
                opacity: isSelected ? 1 : 0.7
              }}
            >
              <h4>{card.name}</h4>
              <p style={{ fontSize: '12px' }}>{card.visual_description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MysteryDeck;