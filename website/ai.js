// --- Elements ---
const output = document.getElementById("ai-output");
const vault = document.getElementById("ai-playground");
const fileInput = document.getElementById("file-input");
const errorDiv = document.getElementById("aiFileErrorDiv");
const uploadPrompt = document.getElementById("upload-prompt");
const activeView = document.getElementById("active-ai-view");
const resetBtn = document.getElementById("reset-playground");
const generalPromptInput = document.getElementById("general-prompt");
const outputLangSelect = document.getElementById("output-lang");

// --- Constants & State ---
const ALLOWED_LANGUAGES = ["en", "fr", "hi"];
const langMap = { en: "English", fr: "French", hi: "Hindi" };
let loadedText = ""; // Variable is defined globally
window.detectedLang = "";
window.currentFile = null;

// --- UI Helpers ---

window.switchTab = (tabName, e) => {
  document
    .querySelectorAll(".tab-content")
    .forEach((t) => (t.style.display = "none"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById(`tab-${tabName}`).style.display = "block";
  if (e) e.currentTarget.classList.add("active");
};

function setBusy(isBusy) {
  if (isBusy) {
    vault.classList.add("playground-busy");
    errorDiv.classList.remove("show");
  } else {
    vault.classList.remove("playground-busy");
  }
}

function showError(msg) {
  errorDiv.innerText = msg;
  errorDiv.classList.add("show");
  output.innerText = "Error occurred. Check the message below 👇";
}

// --- Logic Functions ---

async function detectAndValidate(text) {
  try {
    const detector = await LanguageDetector.create();
    const results = await detector.detect(text);
    const topResult = results[0];

    if (!topResult || !ALLOWED_LANGUAGES.includes(topResult.detectedLanguage)) {
      const langCode = topResult
        ? topResult.detectedLanguage.toUpperCase()
        : "Unknown";
      throw new Error(
        `Unsupported Language: ${langCode}. Only English, French, and Hindi are supported.`,
      );
    }

    window.detectedLang = topResult.detectedLanguage;
    document.getElementById("display-type").innerText =
      langMap[window.detectedLang];
    return true;
  } catch (err) {
    showError(err.message);
    activeView.style.display = "none";
    uploadPrompt.style.display = "block";
    return false;
  }
}

async function runAI(type, options = {}) {
  const api = type === "Prompt" ? LanguageModel : self[type];
  if (!api) throw new Error(`${type} API not found.`);

  const availability = await api.availability(options);
  if (availability === "no") throw new Error(`${type} is not supported.`);

  // Define multimodal schema for the Prompt API
  const creationOptions =
    type === "Prompt"
      ? {
          expectedInputs: [
            { type: "text", languages: ["en"] },
            { type: "image" },
          ],
          expectedOutputs: [{ type: "text", languages: ["en"] }],
        }
      : options;

  return await api.create({
    ...creationOptions,
    monitor(m) {
      m.addEventListener("downloadprogress", (e) => {
        const p = Math.round((e.loaded / e.total) * 100);
        const fill = document.getElementById("progress-fill");
        if (fill) fill.style.width = `${p}%`;
      });
    },
  });
}

async function interactWithAI(userPrompt) {
  setBusy(true);
  try {
    const session = await runAI("Prompt");

    // Build parts using type/value structure
    const contentParts = [
      { type: "text", value: userPrompt || "Analyze this file." },
    ];

    if (window.currentFile) {
      if (window.currentFile.type.startsWith("image/")) {
        contentParts.push({ type: "image", value: window.currentFile });
      } else if (loadedText) {
        contentParts.push({
          type: "text",
          value: `\n\nContext: ${loadedText}`,
        });
      }
    }

    // Pass an array containing the message object
    const response = await session.prompt([
      {
        role: "user",
        content: contentParts,
      },
    ]);

    await processAndDisplay(response);
  } catch (err) {
    showError(err.message);
  } finally {
    setBusy(false);
  }
}

async function processAndDisplay(rawText, format = "markdown") {
  const targetLang = outputLangSelect.value;
  let finalContent = rawText;

  // 1. Handle Translation
  if (targetLang !== "en") {
    try {
      const translator = await runAI("Translator", {
        sourceLanguage: "en",
        targetLanguage: targetLang,
      });
      finalContent = await translator.translate(rawText);

      /** * FIX: Cleanup AI-added spaces around Markdown
       * Matches ** word ** and converts to **word**
       */
      finalContent = finalContent
        .replace(/\*\*\s+(.*?)\s+\*\*/g, "**$1**") // Bold
        .replace(/\*\s+(.*?)\s+\*/g, "*$1*") // Italics
        .replace(/^#+\s+/gm, (match) => match.trim() + " "); // Headers
    } catch (err) {
      console.warn("Translation failed, using original.");
    }
  }

  // 2. Render to UI
  if (format === "markdown" && typeof marked !== "undefined") {
    // Ensure the output container is treated as HTML
    output.innerHTML = marked.parse(finalContent);
  } else {
    output.innerText = finalContent;
  }
}

// --- Event Handlers ---

async function handleFile(file) {
  if (!file) return;
  window.currentFile = file;
  errorDiv.classList.remove("show");

  if (file.type.startsWith("image/")) {
    document.getElementById("display-name").innerText = file.name;
    document.getElementById("display-type").innerText = "IMAGE";
    uploadPrompt.style.display = "none";
    activeView.style.display = "block";
    resetBtn.style.display = "block";
    window.detectedLang = "en";
  } else {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      setBusy(true);
      const isValid = await detectAndValidate(text);
      setBusy(false);
      if (isValid) {
        loadedText = text; // Populates global loadedText
        document.getElementById("display-name").innerText = file.name;
        uploadPrompt.style.display = "none";
        activeView.style.display = "block";
        resetBtn.style.display = "block";
      }
    };
    reader.readAsText(file);
  }
}

uploadPrompt.onclick = () => fileInput.click();
fileInput.onchange = (e) => handleFile(e.target.files[0]);

vault.ondragover = (e) => {
  e.preventDefault();
  vault.style.background = "#eee";
};
vault.ondragleave = () => (vault.style.background = "#f9f9f9");
vault.ondrop = (e) => {
  e.preventDefault();
  handleFile(e.dataTransfer.files[0]);
};

resetBtn.onclick = () => {
  activeView.style.display = "none";
  resetBtn.style.display = "none";
  uploadPrompt.style.display = "block";
  errorDiv.classList.remove("show");
  output.innerText = "Click an action above to start...";
  fileInput.value = "";
  window.currentFile = null;
  loadedText = "";
};

// --- Button Listeners ---

document.getElementById("btn-ask-general").onclick = () => {
  const query = generalPromptInput.value;
  if (!query) return showError("Please type a question first.");
  interactWithAI(query);
};

document.getElementById("btn-summarize").onclick = async () => {
  if (window.currentFile && window.currentFile.type.startsWith("image/")) {
    await interactWithAI(
      "Describe this image and summarize any text or context found within.",
    );
    return;
  }

  setBusy(true);
  try {
    output.innerText = "Processing document...";
    const options = {
      type: document.getElementById("sum-type").value,
      length: document.getElementById("sum-length").value,
      format: "markdown",
    };

    const model = await runAI("Summarizer", options);
    const MAX_CHUNK_SIZE = 15000;
    let finalSummary = "";

    if (loadedText.length > MAX_CHUNK_SIZE) {
      const chunks = [];
      for (let i = 0; i < loadedText.length; i += MAX_CHUNK_SIZE) {
        chunks.push(loadedText.substring(i, i + MAX_CHUNK_SIZE));
      }
      const chunkSummaries = await Promise.all(
        chunks.map(async (chunk, index) => {
          output.innerText = `Summarizing part ${index + 1}/${chunks.length}...`;
          return await model.summarize(chunk);
        }),
      );
      finalSummary = await model.summarize(chunkSummaries.join("\n\n"));
    } else {
      finalSummary = await model.summarize(loadedText);
    }
    await processAndDisplay(finalSummary, "markdown");
  } catch (err) {
    showError(err.message);
  } finally {
    setBusy(false);
  }
};

document.getElementById("btn-translate").onclick = async () => {
  const targetLang = outputLangSelect.value;

  if (window.currentFile && window.currentFile.type.startsWith("image/")) {
    await interactWithAI(
      `Extract and translate all text found in this image into ${langMap[targetLang]}.`,
    );
    return;
  }

  if (targetLang === window.detectedLang) {
    showError(`File is already in ${langMap[window.detectedLang]}.`);
    return;
  }

  setBusy(true);
  try {
    output.innerText = "Checking language packs...";
    const translator = await runAI("Translator", {
      sourceLanguage: window.detectedLang,
      targetLanguage: targetLang,
    });
    output.innerText = await translator.translate(loadedText);
  } catch (err) {
    showError(err.message);
  } finally {
    setBusy(false);
  }
};
