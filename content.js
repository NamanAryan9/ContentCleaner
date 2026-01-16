function extractQuestions() {
  const questions = [];

  // Try multiple methods to find questions
  
  // Method 1: Fieldsets with legends (Coursera style)
  document.querySelectorAll('fieldset').forEach(fieldset => {
    const questionEl = fieldset.querySelector('legend');
    if (!questionEl) return;

    const questionText = questionEl.innerText.trim();
    if (!questionText) return;

    const options = [];
    fieldset.querySelectorAll('label').forEach(label => {
      const text = label.innerText.trim();
      if (text) options.push(text);
    });

    if (options.length >= 2) {
      questions.push({
        question: questionText,
        options
      });
    }
  });

  // Method 2: Look for numbered questions with radio buttons
  if (questions.length === 0) {
    const allText = document.body.innerText;
    const questionPattern = /^\d+\.\s+(.+?)$/gm;
    const matches = [...allText.matchAll(questionPattern)];
    
    matches.forEach((match, idx) => {
      const questionText = match[1].trim();
      const radioGroups = document.querySelectorAll('input[type="radio"]');
      
      // Find radio buttons near this question
      const nearbyOptions = [];
      document.querySelectorAll('label').forEach(label => {
        const text = label.innerText.trim();
        if (text && text.length > 3 && text.length < 200) {
          nearbyOptions.push(text);
        }
      });
      
      if (nearbyOptions.length >= 2) {
        questions.push({
          question: questionText,
          options: nearbyOptions.slice(0, 4) // Take first 4 options
        });
      }
    });
  }

  console.log('Extracted questions:', questions);
  return questions;
}

function showAnswersModal(answers, questions) {
  // Remove existing modal if any
  const existing = document.getElementById('ai-answers-modal');
  if (existing) existing.remove();

  // Create modal
  const modal = document.createElement('div');
  modal.id = 'ai-answers-modal';
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    z-index: 999999;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    border-radius: 16px 16px 0 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  header.innerHTML = `
    <h2 style="margin: 0; font-size: 24px;">🤖 AI Answers</h2>
    <button id="close-modal" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 24px; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>
  `;

  const content = document.createElement('div');
  content.style.cssText = 'padding: 20px;';

  answers.forEach((ans) => {
    const question = questions[ans.qIndex];
    if (!question) return;

    const answerText = question.options[ans.answerIndex - 1] || `Option ${ans.answerIndex}`;

    const item = document.createElement('div');
    item.style.cssText = `
      margin-bottom: 20px;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 12px;
      border-left: 4px solid #22c55e;
    `;

    item.innerHTML = `
      <div style="font-weight: bold; color: #1f2937; margin-bottom: 8px; font-size: 14px;">
        Question ${ans.qIndex + 1}
      </div>
      <div style="color: #4b5563; margin-bottom: 12px; font-size: 13px;">
        ${question.question}
      </div>
      <div style="background: linear-gradient(90deg, #4ade80 0%, #22c55e 100%); color: white; padding: 12px; border-radius: 8px; font-weight: bold; display: inline-flex; align-items: center; gap: 8px;">
        <span style="font-size: 18px;">✓</span>
        <span>Option ${ans.answerIndex}: ${answerText}</span>
      </div>
    `;

    content.appendChild(item);
  });

  modal.appendChild(header);
  modal.appendChild(content);

  // Add backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'ai-answers-backdrop';
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999998;
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  // Close handlers
  const closeModal = () => {
    modal.remove();
    backdrop.remove();
  };

  document.getElementById('close-modal').addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);

  // ESC key to close
  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);
}

function highlightAnswer(qIndex, answerIndex) {
  const fieldsets = document.querySelectorAll('fieldset');
  const fs = fieldsets[qIndex];
  if (!fs) {
    console.error(`Fieldset not found at index ${qIndex}`);
    return;
  }

  const labels = fs.querySelectorAll('label');
  // Convert 1-based answer number to 0-based array index
  const targetIndex = answerIndex - 1;
  const target = labels[targetIndex];
  
  if (!target) {
    console.error(`Label not found at index ${targetIndex} in fieldset ${qIndex}`);
    return;
  }

  // Apply multiple highlighting methods for visibility
  target.style.setProperty('background-color', '#4ade80', 'important');
  target.style.setProperty('background', 'linear-gradient(90deg, #4ade80 0%, #22c55e 100%)', 'important');
  target.style.setProperty('border', '3px solid #16a34a', 'important');
  target.style.setProperty('border-radius', '8px', 'important');
  target.style.setProperty('padding', '12px', 'important');
  target.style.setProperty('box-shadow', '0 4px 12px rgba(34, 197, 94, 0.4)', 'important');
  target.style.setProperty('font-weight', 'bold', 'important');
  target.style.setProperty('transition', 'all 0.3s ease', 'important');
  
  // Add animation
  target.style.setProperty('animation', 'pulse 2s infinite', 'important');
  
  // Inject keyframes if not already present
  if (!document.getElementById('highlight-animation')) {
    const style = document.createElement('style');
    style.id = 'highlight-animation';
    style.textContent = `
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.02); }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Add a checkmark emoji
  if (!target.querySelector('.ai-checkmark')) {
    const checkmark = document.createElement('span');
    checkmark.className = 'ai-checkmark';
    checkmark.textContent = ' ✅';
    checkmark.style.fontSize = '1.2em';
    checkmark.style.marginLeft = '8px';
    target.appendChild(checkmark);
  }
  
  // Scroll to the highlighted answer
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  console.log(`✅ Highlighted Q${qIndex + 1}, Option ${answerIndex}`);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "PING") {
    sendResponse({ status: "ok" });
    return true;
  }

  if (msg.action === "GET_QUESTIONS") {
    const questions = extractQuestions();
    console.log(`Found ${questions.length} questions`);
    sendResponse(questions);
    return true;
  }

  if (msg.action === "SHOW_ANSWERS") {
    showAnswersModal(msg.answers, msg.questions);
    sendResponse({ success: true });
    return true;
  }

  if (msg.action === "HIGHLIGHT") {
    highlightAnswer(msg.qIndex, msg.answerIndex);
    sendResponse({ success: true });
    return true;
  }
  
  return true; // Keep message channel open for async response
});