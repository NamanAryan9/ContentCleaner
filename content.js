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
    
    // Detect question type: radio (single) vs checkbox (multiple)
    const firstInput = fieldset.querySelector('input[type="radio"], input[type="checkbox"]');
    const isMultipleChoice = firstInput && firstInput.type === 'checkbox';
    
    // Also check for keywords in question text
    const hasMultipleKeywords = /select all|choose all|mark all|which (are|of)/i.test(questionText);
    
    // Final decision: checkbox OR keywords indicate multiple choice
    const finalIsMultiple = isMultipleChoice || hasMultipleKeywords;
    
    fieldset.querySelectorAll('label').forEach(label => {
      const text = label.innerText.trim();
      if (text) options.push(text);
    });

    if (options.length >= 2) {
      questions.push({
        question: questionText,
        options,
        isMultipleChoice: finalIsMultiple
      });
      
      console.log(`Question: "${questionText.substring(0, 50)}..." - Type: ${finalIsMultiple ? 'MULTIPLE' : 'SINGLE'}`);
    }
  });

  // Method 2: Look for numbered questions with inputs
  if (questions.length === 0) {
    // Find all question containers
    const questionElements = document.querySelectorAll('[class*="question"], [role="group"]');
    
    questionElements.forEach((container, idx) => {
      const questionText = container.innerText?.split('\n')?.[0]?.trim();
      if (!questionText || questionText.length > 500) return;
      
      const options = [];
      const labels = container.querySelectorAll('label');
      
      labels.forEach(label => {
        const text = label.innerText.trim();
        if (text && text.length > 3 && text.length < 200) {
          options.push(text);
        }
      });
      
      if (options.length >= 2) {
        const firstInput = container.querySelector('input[type="radio"], input[type="checkbox"]');
        const isMultipleChoice = firstInput && firstInput.type === 'checkbox';
        const hasMultipleKeywords = /select all|choose all|mark all|which (are|of)/i.test(questionText);
        
        questions.push({
          question: questionText,
          options: options.slice(0, 6),
          isMultipleChoice: isMultipleChoice || hasMultipleKeywords
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
  const existingBackdrop = document.getElementById('ai-answers-backdrop');
  if (existingBackdrop) existingBackdrop.remove();

  // Create modal
  const modal = document.createElement('div');
  modal.id = 'ai-answers-modal';
  modal.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    z-index: 999999;
    width: 450px;
    max-height: 600px;
    overflow: hidden;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    cursor: move;
    user-select: none;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 20px;
    border-radius: 16px 16px 0 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: move;
  `;
  header.innerHTML = `
    <div>
      <h2 style="margin: 0; font-size: 20px;">🤖 AI Answers</h2>
      <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Drag me anywhere! • ${answers.length} questions</p>
    </div>
    <button id="close-modal" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 24px; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">×</button>
  `;

  const content = document.createElement('div');
  content.style.cssText = `
    padding: 20px;
    max-height: 500px;
    overflow-y: auto;
  `;

  answers.forEach((ans) => {
    const question = questions[ans.qIndex];
    if (!question) return;

    const item = document.createElement('div');
    item.style.cssText = `
      margin-bottom: 16px;
      padding: 14px;
      background: #f8f9fa;
      border-radius: 12px;
      border-left: 4px solid #22c55e;
    `;

    // Question header with type indicator
    const typeLabel = question.isMultipleChoice 
      ? '<span style="background: #f59e0b; color: white; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-left: 8px;">MULTIPLE</span>'
      : '<span style="background: #3b82f6; color: white; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-left: 8px;">SINGLE</span>';

    const questionHeader = `
      <div style="font-weight: bold; color: #1f2937; margin-bottom: 8px; font-size: 14px; display: flex; align-items: center; flex-wrap: wrap;">
        <span>Question ${ans.qIndex + 1}</span>
        ${typeLabel}
      </div>
    `;

    // Show full question text
    const questionText = `
      <div style="color: #4b5563; margin-bottom: 12px; font-size: 13px; line-height: 1.5; max-height: 100px; overflow-y: auto;">
        ${question.question}
      </div>
    `;

    // Display ALL correct answers with the actual option text
    const answersHTML = ans.answerIndices.map(answerIdx => {
      const answerText = question.options[answerIdx - 1];
      
      if (!answerText) {
        console.warn(`Option ${answerIdx} not found for question ${ans.qIndex + 1}`);
        return `
          <div style="background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%); color: white; padding: 10px 12px; border-radius: 8px; font-weight: 600; display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 6px;">
            <span style="font-size: 16px;">⚠️</span>
            <span>Option ${answerIdx} - ERROR: Not found!</span>
          </div>
        `;
      }
      
      // Truncate long option text
      const displayText = answerText.length > 80 
        ? answerText.substring(0, 80) + '...' 
        : answerText;
      
      return `
        <div style="background: linear-gradient(90deg, #4ade80 0%, #22c55e 100%); color: white; padding: 10px 12px; border-radius: 8px; font-weight: 600; display: flex; align-items: flex-start; gap: 8px; font-size: 12px; margin-bottom: 6px; line-height: 1.4;">
          <span style="font-size: 16px; flex-shrink: 0;">✓</span>
          <div>
            <div style="font-weight: bold; margin-bottom: 2px;">Option ${answerIdx}</div>
            <div style="font-weight: normal; opacity: 0.95;">${displayText}</div>
          </div>
        </div>
      `;
    }).join('');

    // Warning if some answers might be missing
    const totalOptions = question.options.length;
    const warningHTML = question.isMultipleChoice && ans.answerIndices.length === 1 
      ? `<div style="background: #fef3c7; color: #92400e; padding: 8px; border-radius: 6px; font-size: 11px; margin-top: 8px;">
          ⚠️ Only 1 answer shown, but this is a MULTIPLE choice question (${totalOptions} options total). AI might have missed some!
         </div>`
      : '';

    item.innerHTML = questionHeader + questionText + answersHTML + warningHTML;
    content.appendChild(item);
  });

  modal.appendChild(header);
  modal.appendChild(content);
  document.body.appendChild(modal);

  // Make it draggable
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  header.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

  function dragStart(e) {
    if (e.target.id === 'close-modal') return;
    
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;

    if (e.target === header || e.target.parentElement === header) {
      isDragging = true;
      modal.style.cursor = 'grabbing';
    }
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      xOffset = currentX;
      yOffset = currentY;

      setTranslate(currentX, currentY);
    }
  }

  function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
    modal.style.cursor = 'move';
  }

  function setTranslate(xPos, yPos) {
    modal.style.transform = `translate(${xPos}px, ${yPos}px)`;
  }

  // Close handlers
  const closeModal = () => {
    modal.remove();
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', dragEnd);
  };

  document.getElementById('close-modal').addEventListener('click', (e) => {
    e.stopPropagation();
    closeModal();
  });

  // ESC key to close
  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);

  // Add minimize button
  const minimizeBtn = document.createElement('button');
  minimizeBtn.innerHTML = '−';
  minimizeBtn.style.cssText = `
    background: rgba(255,255,255,0.2);
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 8px;
  `;
  
  let isMinimized = false;
  minimizeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isMinimized = !isMinimized;
    if (isMinimized) {
      content.style.display = 'none';
      modal.style.width = '250px';
      minimizeBtn.innerHTML = '+';
    } else {
      content.style.display = 'block';
      modal.style.width = '450px';
      minimizeBtn.innerHTML = '−';
    }
  });

  const closeBtn = header.querySelector('#close-modal');
  closeBtn.parentElement.insertBefore(minimizeBtn, closeBtn);
}

function highlightAnswer(qIndex, answerIndex) {
  const fieldsets = document.querySelectorAll('fieldset');
  const fs = fieldsets[qIndex];
  if (!fs) {
    console.error(`Fieldset not found at index ${qIndex}`);
    return;
  }

  const labels = fs.querySelectorAll('label');
  const targetIndex = answerIndex - 1;
  const target = labels[targetIndex];
  
  if (!target) {
    console.error(`Label not found at index ${targetIndex} in fieldset ${qIndex}`);
    return;
  }

  // Apply highlighting
  target.style.setProperty('background-color', '#4ade80', 'important');
  target.style.setProperty('background', 'linear-gradient(90deg, #4ade80 0%, #22c55e 100%)', 'important');
  target.style.setProperty('border', '3px solid #16a34a', 'important');
  target.style.setProperty('border-radius', '8px', 'important');
  target.style.setProperty('padding', '12px', 'important');
  target.style.setProperty('box-shadow', '0 4px 12px rgba(34, 197, 94, 0.4)', 'important');
  target.style.setProperty('font-weight', 'bold', 'important');
  target.style.setProperty('transition', 'all 0.3s ease', 'important');
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
  
  // Add checkmark
  if (!target.querySelector('.ai-checkmark')) {
    const checkmark = document.createElement('span');
    checkmark.className = 'ai-checkmark';
    checkmark.textContent = ' ✅';
    checkmark.style.fontSize = '1.2em';
    checkmark.style.marginLeft = '8px';
    target.appendChild(checkmark);
  }
  
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
  
  return true;
});