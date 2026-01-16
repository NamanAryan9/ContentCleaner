// ============================================
// 🔑 ADD YOUR GROQ API KEY HERE (Optional but recommended)
// Get free key from: https://console.groq.com/keys
// ============================================
const GROQ_API_KEY = ""; // Paste your key between the quotes like: "gsk_xxxxxxxxxxxxx"


document.getElementById('cleanBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  const btn = document.getElementById('cleanBtn');
  
  try {
    btn.disabled = true;
    btn.textContent = 'Cleaning...';
    statusDiv.textContent = 'Processing...';
    statusDiv.className = '';
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: cleanContent
    });
    
    const count = result[0].result;
    
    statusDiv.textContent = `✓ Removed ${count} element(s)`;
    statusDiv.className = 'success';
    btn.textContent = 'Clean Page Now';
    btn.disabled = false;
    
  } catch (error) {
    statusDiv.textContent = `✗ Error: ${error.message}`;
    statusDiv.className = 'error';
    btn.textContent = 'Clean Page Now';
    btn.disabled = false;
  }
});

function cleanContent() {
  const elements = document.querySelectorAll('[data-testid="content-integrity-instructions"]');
  elements.forEach(el => el.remove());
  return elements.length;
}

async function ensureContentScript(tabId) {
  try {
    // Try to ping the content script
    await chrome.tabs.sendMessage(tabId, { action: "PING" });
  } catch (error) {
    // If it fails, inject the content script manually
    console.log("Content script not found, injecting...");
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });
    // Wait a bit for it to load
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

async function getQuestions() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Make sure content script is loaded
  await ensureContentScript(tab.id);

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id, { action: "GET_QUESTIONS" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

async function askAI(questions) {
  const numQuestions = questions.length;
  
  const prompt = questions.map(
    (q, i) =>
      `Question ${i + 1}: ${q.question}\nOptions:\n${q.options.map((opt, idx) => `${idx + 1}. ${opt}`).join("\n")}`
  ).join("\n\n");

  console.log("Sending to AI:", prompt);

  // Try multiple free APIs in order
  const apis = [];
  
  // If user added Groq API key, try it first (fastest and most reliable)
  if (GROQ_API_KEY && GROQ_API_KEY.length > 10) {
    apis.push({
      name: "Groq (Your API Key)",
      call: async () => {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { 
                role: "system", 
                content: `You are answering exactly ${numQuestions} multiple choice questions. Respond with ONLY the answers in format QuestionNumber:OptionNumber, one per line. Example: 1:2 means Question 1, Option 2. Do NOT add any extra text or questions beyond the ${numQuestions} provided.` 
              },
              { role: "user", content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 200
          })
        });
        
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(`Groq: ${err.error?.message || res.status}`);
        }
        const data = await res.json();
        console.log("Groq response:", data);
        return data.choices?.[0]?.message?.content;
      }
    });
  }
  
  // Free APIs (fallback options)
  apis.push(
    {
      name: "DeepInfra (Free)",
      call: async () => {
        const res = await fetch("https://api.deepinfra.com/v1/openai/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "meta-llama/Meta-Llama-3-8B-Instruct",
            messages: [
              { 
                role: "system", 
                content: `Answer exactly ${numQuestions} MCQs. Format: QuestionNumber:OptionNumber. Do NOT make up extra questions.` 
              },
              { role: "user", content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 200
          })
        });
        
        if (!res.ok) throw new Error(`DeepInfra: ${res.status}`);
        const data = await res.json();
        console.log("DeepInfra response:", data);
        return data.choices?.[0]?.message?.content;
      }
    },
    {
      name: "HuggingFace",
      call: async () => {
        const res = await fetch("https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inputs: `Answer EXACTLY ${numQuestions} multiple choice questions. Format: QuestionNumber:OptionNumber (e.g., 1:2). Do NOT make up extra questions.\n\n${prompt}\n\nAnswers (${numQuestions} only):`,
            parameters: {
              max_new_tokens: 200,
              temperature: 0.1,
              return_full_text: false
            },
            options: { wait_for_model: true }
          })
        });
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          if (errorData.error?.includes("loading")) {
            throw new Error("Model loading, try again in 20s");
          }
          throw new Error(`HuggingFace: ${res.status}`);
        }
        
        const data = await res.json();
        console.log("HuggingFace response:", data);
        
        if (data.error) throw new Error(data.error);
        
        return data[0]?.generated_text || data.generated_text || JSON.stringify(data);
      }
    }
  );

  let lastError = null;

  // Try each API until one works
  for (const api of apis) {
    try {
      console.log(`Trying ${api.name}...`);
      const result = await api.call();
      if (result && result.trim()) {
        console.log(`✅ ${api.name} succeeded!`);
        return result;
      }
    } catch (err) {
      console.warn(`❌ ${api.name} failed:`, err.message);
      lastError = err;
      // Wait 2 seconds before trying next API
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // If all failed, provide helpful error message
  throw new Error(
    lastError?.message?.includes("loading") 
      ? "AI models are loading. Please wait 20 seconds and try again." 
      : "All AI services are busy. Please try again in a minute or add a Groq API key for reliable access."
  );
}

function parseAnswers(text, maxQuestions) {
  console.log("Parsing AI response:", text);
  
  const lines = text
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);
  
  const answers = [];
  
  for (const line of lines) {
    // Match patterns like "1:2" or "1: 2" or "Question 1: Option 2"
    const match = line.match(/(\d+)\s*[:.\-]\s*(\d+)/);
    if (match) {
      const qNum = Number(match[1]);
      const optNum = Number(match[2]);
      
      // Only accept answers for questions that actually exist
      if (qNum >= 1 && qNum <= maxQuestions) {
        answers.push({
          qIndex: qNum - 1,  // Convert to 0-based index
          answerIndex: optNum  // Keep as 1-based for highlighting
        });
      } else {
        console.warn(`Ignoring answer for question ${qNum} (only ${maxQuestions} questions exist)`);
      }
    }
  }
  
  console.log(`Parsed ${answers.length} valid answers out of ${maxQuestions} questions`);
  return answers;
}

async function highlightAnswers(answers, questions) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Make sure content script is loaded
  await ensureContentScript(tab.id);

  // Show answers in a modal popup
  await new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, {
      action: "SHOW_ANSWERS",
      answers: answers,
      questions: questions
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Show answers error:", chrome.runtime.lastError);
      }
      resolve();
    });
  });

  // Also try to highlight on the page (if possible)
  for (const ans of answers) {
    await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, {
        action: "HIGHLIGHT",
        qIndex: ans.qIndex,
        answerIndex: ans.answerIndex
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("Highlight error:", chrome.runtime.lastError);
        }
        resolve();
      });
    });
  }
}

document.getElementById("aiBtn").addEventListener("click", async () => {
  const statusDiv = document.getElementById("status");
  const btn = document.getElementById("aiBtn");

  try {
    btn.disabled = true;
    statusDiv.textContent = "🔍 Scanning page...";
    statusDiv.className = '';
    
    const questions = await getQuestions();

    if (!questions || questions.length === 0) {
      statusDiv.textContent = "❌ No questions found.";
      statusDiv.className = 'error';
      btn.disabled = false;
      return;
    }

    console.log(`Found ${questions.length} questions on page`);
    statusDiv.textContent = `🤖 Asking AI about ${questions.length} question(s)...`;
    const aiText = await askAI(questions);

    console.log("AI raw response:", aiText);

    const answers = parseAnswers(aiText, questions.length);
    
    if (answers.length === 0) {
      statusDiv.textContent = "⚠️ Could not parse AI answers.";
      statusDiv.className = 'error';
      btn.disabled = false;
      return;
    }

    statusDiv.textContent = `✨ Highlighting ${answers.length} answer(s)...`;
    await highlightAnswers(answers, questions);

    statusDiv.textContent = `✅ Highlighted ${answers.length} answer(s)!`;
    statusDiv.className = 'success';
    btn.disabled = false;
    
  } catch (err) {
    console.error("Error:", err);
    statusDiv.textContent = `❌ Error: ${err.message}`;
    statusDiv.className = 'error';
    btn.disabled = false;
  }
});