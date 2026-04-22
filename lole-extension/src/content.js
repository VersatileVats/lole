const defaultLandingPage = "https://versatilevats.com/lole";
const refreshDuration = 10000;

async function chrome_profiles(result) {
  const existingOverlay = document.getElementById("lole-profile-overlay");
  if (existingOverlay) {
    existingOverlay.style.opacity = "0";
    setTimeout(() => {
      existingOverlay.remove();
      document.body.style.overflow = ""; // Restore original background scroll
    }, 300);
    return;
  }

  // 1. Fetch current email from storage to identify the active profile
  const storageData = await chrome.storage.local.get("email");
  const currentEmail = storageData.email || "";

  const profiles = result.data || [];

  // Find the current profile based on the first email matching the stored email
  let currentProfile =
    profiles.find(
      (p) =>
        p.mails &&
        p.mails.length > 0 &&
        p.mails[0].mailAddress === currentEmail,
    ) || profiles[0]; // Fallback to first if no match

  // ==========================================
  //   Sort ONLY the current profile's emails
  // ==========================================
  if (currentProfile && currentProfile.mails) {
    try {
      const response = await chrome.runtime.sendMessage({
        message: "getOrderedGoogleAccounts",
      });

      const orderedEmails = (response.gmailAccounts || []).map((e) =>
        e.toLowerCase().trim(),
      );

      currentProfile.mails.sort((a, b) => {
        const emailA = (a.mailAddress || "").toLowerCase().trim();
        const emailB = (b.mailAddress || "").toLowerCase().trim();

        let indexA = orderedEmails.indexOf(emailA);
        let indexB = orderedEmails.indexOf(emailB);

        // If no match found, treat as 999 to push to the end
        if (indexA === -1) indexA = 999;
        if (indexB === -1) indexB = 999;

        return indexA - indexB;
      });
    } catch (err) {
      console.error("Failed to sort emails:", err);
    }
  }
  // ==========================================

  // State
  let activeView = "MAILS"; // "MAILS" or "PROFILES"

  // 2. Create the Overlay Container
  const overlay = document.createElement("div");
  overlay.id = "lole-profile-overlay";

  // Prevent background scrolling
  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  // 3. Inject Styles (Scoped to this overlay)
  const style = document.createElement("style");
  style.textContent = `
    #lole-profile-overlay {
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(15, 15, 15, 0.95);
      backdrop-filter: blur(8px);
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: white;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .lole-header {
      position: relative;
      width: 100%;
      max-width: 80vw;
      padding: 2rem 2rem 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
      box-sizing: border-box;
    }
    /* Toggle Switch */
    .lole-toggle {
      display: flex;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 30px;
      padding: 4px;
      cursor: pointer;
    }
    .lole-toggle-btn {
      padding: 8px 24px;
      border-radius: 26px;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.3s ease;
    }
    .lole-toggle-btn.active {
      background: #0d6efd; /* Matches your extension's green accent */
      color: white;
      box-shadow: 0 4px 12px rgba(13, 110, 253, 0.4);
    }
    /* Close Button */
    .lole-close {
      cursor: pointer;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      border-radius: 50%;
      width: 40px; 
      height: 40px;
      display: flex; 
      align-items: center; 
      justify-content: center;
      transition: all 0.3s ease;
      overflow: hidden; /* Keeps the nudge contained */
    }

    .lole-close span {
      color: white;
      font-size: 32px; /* Increased size for better visibility */
      font-family: Arial, sans-serif;
      line-height: 1; /* Reset line-height to prevent vertical stacking issues */
      
      /* THE FIX: Most fonts need a 1px-2px downward nudge to look centered */
      transform: translateY(1px); 
      display: block;
    }
    
    .lole-close:hover {
      background: rgba(255, 50, 50, 0.8);
      transform: rotate(90deg);
    }

    /* Content Area */
    .lole-content {
      width: 80vw;
      max-width: 85vw; /* Slightly wider to comfortably fit 4 cards like your screenshot */
      padding: 1rem 2rem 2rem 2rem;
      box-sizing: border-box;
      flex-grow: 1; 
      overflow-y: auto; 
      animation: scaleUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
      
      /* New flex rules for centering */
      display: flex;
      flex-direction: column;
    }

    .lole-content::before,
    .lole-content::after {
      content: "";
      margin: auto;
    }

    .lole-content::-webkit-scrollbar {
      width: 6px;
    }
    .lole-content::-webkit-scrollbar-track {
      background: transparent;
    }
    .lole-content::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 10px;
    }
    .lole-content::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    /* Cards Grid */
    .lole-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-top: 2rem;
    }
    .lole-card {
      position: relative; /* CRITICAL: Anchors the absolute badge */
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 2.5rem 1.5rem 1.5rem 1.5rem; /* Increased top padding so the avatar doesn't overlap the badge */
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      transition: transform 0.2s, background 0.2s;
    }
    .lole-card:hover {
      background: rgba(255, 255, 255, 0.1);
      transform: translateY(-5px);
    }
    .lole-profile-card.clickable {
      cursor: pointer;
    }
    .lole-profile-card.clickable:hover {
      border-color: #00E676;
    }

    .lole-avatar {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
      margin: 0; /* CRITICAL: Clears the old margin so the box-shadow doesn't stretch */
      display: block;
    }
    .lole-title { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
    .lole-subtitle { font-size: 13px; color: #aaa; word-break: break-all;}
    
    // for redacting the email
    .lole-email-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 4px;
    }
    
    .lole-copy-icon {
      width: 14px;
      height: 14px;
      cursor: pointer;
      opacity: 0.5;
      transition: all 0.2s ease;
    }
    
    .lole-copy-icon:hover {
      opacity: 1;
      transform: scale(1.2);
      filter: brightness(1.5);
    }

    .lole-badge {
      position: absolute; /* Takes it out of the flex flow */
      top: 12px;
      left: 12px;
      margin: 0; /* Clear previous margins */
      background: rgba(34, 139, 34, 0.2);
      color: #a5cfa5;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 10px; /* Slightly smaller for a sleek pill look */
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    @keyframes scaleUp {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    /* Quick Links Container */
    .lole-quick-links {
      position: absolute;
      top: 12px;
      right: 12px;
      display: flex;
      gap: 6px;
    }
    
    /* Individual Icon Buttons */
    .lole-quick-link {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      text-decoration: none;
    }
    
    .lole-quick-link:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: scale(1.1);
    }
    
    .lole-quick-link img {
      width: 14px;
      height: 14px;
    }

    /* Clickable Avatar */
    .lole-avatar-link {
      display: block;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      text-decoration: none; /* Kills any default link underlines */
      margin-bottom: 1rem;   /* Moved here from the image */
      transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); /* Gives a nice subtle "bounce" */
    }
    
    .lole-avatar-link:hover {
      transform: scale(1.08);
      /* Using a solid 'spread' with no blur creates a clean, modern ring effect */
      box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.15); 
    }
  `;
  overlay.appendChild(style);

  // 4. Build Header (Toggle + Close)
  const header = document.createElement("div");
  header.className = "lole-header";

  const toggleContainer = document.createElement("div");
  toggleContainer.className = "lole-toggle";

  const btnMails = document.createElement("div");
  btnMails.className = "lole-toggle-btn active";
  btnMails.innerText = "Mails";

  const btnProfiles = document.createElement("div");
  btnProfiles.className = "lole-toggle-btn";
  btnProfiles.innerText = "Profiles";

  toggleContainer.appendChild(btnMails);
  toggleContainer.appendChild(btnProfiles);

  const closeBtn = document.createElement("button");
  closeBtn.className = "lole-close";
  closeBtn.innerHTML = "<span>&times;</span>";

  header.appendChild(toggleContainer);
  header.appendChild(closeBtn);
  overlay.appendChild(header);

  // 5. Content Container
  const contentArea = document.createElement("div");
  contentArea.className = "lole-content";
  overlay.appendChild(contentArea);

  // 6. Render Logic
  function render() {
    contentArea.innerHTML = ""; // Clear existing

    const heading = document.createElement("h2");
    heading.style.margin = "0 0 8px 0";

    const subHeading = document.createElement("p");
    subHeading.style.color = "#aaa";
    subHeading.style.margin = "0";

    const grid = document.createElement("div");
    grid.className = "lole-grid";

    if (activeView === "MAILS") {
      heading.innerText = `Accounts in ${currentProfile?.profileName || "Browser"}`;
      heading.style.color = "white";
      subHeading.innerText = "Emails currently signed into this session.";

      const mailsToShow = (currentProfile?.mails || []).slice(0, 10);

      // Helper to redact emails
      const redactEmail = (email) => {
        if (!email || !email.includes("@")) return email;
        const [name, domain] = email.split("@");
        if (name.length <= 4) return `${name.substring(0, 2)}***@${domain}`;
        return `${name.substring(0, 2)}***${name.substring(name.length - 2)}@${domain}`;
      };

      mailsToShow.forEach((mail, index) => {
        const card = document.createElement("div");
        card.className = "lole-card";

        // 1. Clickable Avatar
        let avatarHTML = `
          <a href="https://myaccount.google.com/u/${index}" target="_blank" class="lole-avatar-link" title="Manage Google Account">
            <img src="${mail.pictureUrl}" class="lole-avatar" onerror="this.src='https://img.icons8.com/color/60/google-logo.png'">
          </a>
        `;

        // 2. Quick Links
        let quickLinksHTML = `
          <div class="lole-quick-links">
            <a href="https://mail.google.com/mail/u/${index}/#inbox" target="_blank" class="lole-quick-link" title="Open Gmail">
              <img src="https://img.icons8.com/color/48/gmail-new.png" alt="Gmail">
            </a>
            <a href="https://drive.google.com/drive/u/${index}/" target="_blank" class="lole-quick-link" title="Open Drive">
              <img src="https://img.icons8.com/color/48/google-drive--v2.png" alt="Drive">
            </a>
          </div>
        `;

        // 3. Assemble Card with Redacted Email & Copy Icon
        const redactedEmail = redactEmail(mail.mailAddress);

        card.innerHTML = `
          ${quickLinksHTML}
          ${avatarHTML}
          <div class="lole-title">${mail.mailName}</div>
          <div class="lole-subtitle lole-email-row">
            <span>${redactedEmail}</span>
            <img src="https://img.icons8.com/material-rounded/24/ffffff/copy.png" class="lole-copy-icon" title="Copy original email" alt="Copy">
          </div>
          ${index === 0 ? `<div class="lole-badge">Default</div>` : ""}
        `;

        // 4. Attach Clipboard Event Listener securely
        const copyBtn = card.querySelector(".lole-copy-icon");
        copyBtn.onclick = async (e) => {
          e.stopPropagation(); // Prevents triggering any parent click events
          try {
            await navigator.clipboard.writeText(mail.mailAddress);

            // Brief visual feedback (turns icon to a green checkmark momentarily)
            const originalSrc = copyBtn.src;
            copyBtn.src =
              "https://img.icons8.com/material-rounded/24/4caf50/checkmark.png";
            setTimeout(() => {
              copyBtn.src = originalSrc;
            }, 1200);
          } catch (err) {
            console.error("Clipboard copy failed:", err);
          }
        };

        grid.appendChild(card);
      });
    } else {
      heading.innerText = "Browser Profiles";
      heading.style.color = "white";
      subHeading.innerText = "Select a profile to launch its instance.";

      profiles.forEach((profile) => {
        const isCurrent = profile.profilePath === currentProfile?.profilePath;
        const card = document.createElement("div");
        card.className = `lole-card lole-profile-card ${!isCurrent ? "clickable" : ""}`;

        // Grab the primary email's avatar for the profile card if available
        const primaryPic =
          profile.mails && profile.mails.length > 0
            ? profile.mails[0].pictureUrl
            : "https://img.icons8.com/fluency/60/user-male-circle--v1.png";

        card.innerHTML = `
          <div style="width: 60px; height: 60px; margin-bottom: 1rem;">
            <img src="${primaryPic}" class="lole-avatar" onerror="this.src='https://img.icons8.com/fluency/60/user-male-circle--v1.png'">
          </div>
          <div class="lole-title">${profile.profileName}</div>
          <div class="lole-subtitle">${profile.mails ? profile.mails.length : 0} linked email(s)</div>
          ${isCurrent ? `<div class="lole-badge" style="background: rgba(255,255,255,0.2); color: white;">Current </div>` : ""}
        `;

        if (!isCurrent) {
          card.onclick = () => {
            chrome.runtime.sendMessage({
              action: "OPEN_PROFILE",
              profilePath: profile.profilePath,
            });

            // Optional: Provide instant visual feedback
            card.style.transform = "scale(0.95)";
            card.style.opacity = "0.7";
          };
        }
        grid.appendChild(card);
      });
    }

    contentArea.appendChild(heading);
    contentArea.appendChild(subHeading);
    contentArea.appendChild(grid);
  }

  // 7. Event Listeners
  btnMails.onclick = () => {
    if (activeView === "MAILS") return;
    activeView = "MAILS";
    btnMails.classList.add("active");
    btnProfiles.classList.remove("active");
    render();
  };

  btnProfiles.onclick = () => {
    if (activeView === "PROFILES") return;
    activeView = "PROFILES";
    btnProfiles.classList.add("active");
    btnMails.classList.remove("active");
    render();
  };

  const closeOverlay = () => {
    overlay.style.opacity = "0";
    setTimeout(() => {
      overlay.remove();
      document.body.style.overflow = originalOverflow; // Restore scroll
    }, 300);
  };

  closeBtn.onclick = closeOverlay;

  // Close on Escape key
  const escListener = (e) => {
    if (e.key === "Escape") {
      closeOverlay();
      document.removeEventListener("keydown", escListener);
    }
  };
  document.addEventListener("keydown", escListener);

  // 8. Inject and Animate
  document.body.appendChild(overlay);
  render();

  // Trigger fade in
  requestAnimationFrame(() => {
    overlay.style.opacity = "1";
  });
}

// overwriting the default text fragments' behaviour of browsers
async function highlightText(textToBeFound, highlightColor) {
  if (!textToBeFound) return;

  const searchText = textToBeFound.replace(/\s+/g, " ").trim().toLowerCase();

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false,
  );

  let nodes = [];
  let combinedText = "";

  let node;
  while ((node = walker.nextNode())) {
    if (
      ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(
        node.parentNode.tagName,
      )
    )
      continue;

    nodes.push({
      node: node,
      start: combinedText.length,
      end: combinedText.length + node.textContent.length,
    });
    combinedText += node.textContent;
  }

  const lowerCombined = combinedText.toLowerCase();
  const matchIndex = lowerCombined.indexOf(searchText);

  if (matchIndex === -1) {
    return;
  }

  const matchEnd = matchIndex + searchText.length;
  const overlappingNodes = nodes.filter(
    (entry) => entry.end > matchIndex && entry.start < matchEnd,
  );

  overlappingNodes.forEach((entry, index) => {
    const node = entry.node;
    const relativeStart = Math.max(0, matchIndex - entry.start);
    const relativeEnd = Math.min(
      node.textContent.length,
      matchEnd - entry.start,
    );

    const partToHighlight = node.textContent.substring(
      relativeStart,
      relativeEnd,
    );
    const before = node.textContent.substring(0, relativeStart);
    const after = node.textContent.substring(relativeEnd);

    const span = document.createElement("span");
    const isFirst = index === 0;
    const isLast = index === overlappingNodes.length - 1;

    const leftRadius = isFirst ? "4px" : "0px";
    const rightRadius = isLast ? "4px" : "0px";
    const leftPadding = isFirst ? "4px" : "0px";
    const rightPadding = isLast ? "4px" : "0px";

    span.setAttribute("lole-data-highlighted", "true");

    span.style.cssText = `
      background: ${highlightColor}; 
      border-radius: ${leftRadius} ${rightRadius} ${rightRadius} ${leftRadius}; 
      padding: 0 ${rightPadding} 0 ${leftPadding};
      display: inline;
      margin: 0;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
    `;

    span.textContent = partToHighlight;

    const fragment = document.createDocumentFragment();
    if (before) fragment.appendChild(document.createTextNode(before));
    fragment.appendChild(span);
    if (after) fragment.appendChild(document.createTextNode(after));

    node.parentNode.replaceChild(fragment, node);
  });
}

const LOGI_PRODUCTS = [
  {
    name: "MX Master 4",
    tagline: "The Ultimate Masterpiece",
    url: "https://www.logitech.com/en-us/shop/p/mx-master-4.910-007559",
    images: [
      chrome.runtime.getURL("resources/logi_products/master4-1.webp"),
      chrome.runtime.getURL("resources/logi_products/master4-2.webp"),
      chrome.runtime.getURL("resources/logi_products/master4-3.webp"),
      chrome.runtime.getURL("resources/logi_products/master4-4.webp"),
    ],
    features: [
      "8K DPI Tracking",
      "Quiet Click technology",
      "MagSpeed Scrolling",
      "Logi Bolt compatible",
    ],
    color: "#00E676",
  },
  {
    name: "Creative Console",
    tagline: "Your Flow, Infinite",
    url: "https://www.logitech.com/en-us/products/keyboards/mx-creative-console.html",
    images: [
      chrome.runtime.getURL("resources/logi_products/cc-1.webp"),
      chrome.runtime.getURL("resources/logi_products/cc-2.webp"),
      chrome.runtime.getURL("resources/logi_products/cc-3.webp"),
      chrome.runtime.getURL("resources/logi_products/cc-4.webp"),
    ],
    features: [
      "Analog Precision Dial",
      "9 Customizable LCD Keys",
      "Dedicated Encoders",
      "Native Adobe Integration",
    ],
    color: "#00b8ff",
  },
];

function showLogiOverlay() {
  // Prevent running on background/inactive tabs
  if (document.visibilityState !== "visible" || !document.hasFocus()) {
    return;
  }

  const existing = document.getElementById("logi-overlay");
  if (existing) {
    if (existing.dataset.intervalId)
      clearInterval(parseInt(existing.dataset.intervalId));
    existing.remove();
    document.body.style.overflow = "";
    return;
  }

  let currentIndex = 0;
  let innerIndex = 0;
  let rotationTimer;
  document.body.style.overflow = "hidden";

  const overlay = document.createElement("div");
  overlay.id = "logi-overlay";
  overlay.classList.add("timer-running");

  const closeOverlay = () => {
    stopRotation();
    if (overlay.dataset.intervalId)
      clearInterval(parseInt(overlay.dataset.intervalId));
    document.removeEventListener("keydown", handleEscKey);
    overlay.remove();
    document.body.style.overflow = "";
  };

  const handleEscKey = (e) => {
    if (e.key === "Escape") closeOverlay();
  };
  document.addEventListener("keydown", handleEscKey);

  const style = document.createElement("style");
  style.textContent = `
    /* Injecting local font */
    @font-face {
      font-family: 'NunitoLocal';
      src: url('${chrome.runtime.getURL("resources/Nunito-VariableFont_wght.ttf")}') format('truetype');
      font-weight: normal;
      font-style: normal;
    }

    /* Applying font to every HTML element of the overlay */
    #logi-overlay, 
    #logi-overlay *, 
    #logi-overlay h1, 
    #logi-overlay p, 
    #logi-overlay div, 
    #logi-overlay button {
      font-family: 'NunitoLocal', sans-serif !important;
      -webkit-font-smoothing: antialiased;
      box-sizing: border-box !important;
      text-transform: none !important;
      line-height: normal !important;
    }

    #logi-overlay {
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(10, 10, 10, 0.6);
      backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
      z-index: 2147483647; color: white;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.5s ease;
    }

    .logi-share {
      position: absolute; top: 40px; left: 40px;
      cursor: pointer; opacity: 0.4; transition: 0.3s;
      font-size: 35px !important;
    }
    .logi-share:hover { opacity: 1; transform: scale(1.1); color: var(--accent-color); }

    .logi-close {
      position: absolute; top: 40px; right: 40px; cursor: pointer; opacity: 0.4;
      transition: 0.3s; font-size: 60px !important; line-height: 1 !important;
    }
    .logi-close:hover { opacity: 1; transform: rotate(90deg); color: #ff4444; }

    #logi-overlay::after {
      content: ""; position: absolute; bottom: 0; left: 0;
      height: 4px; background: var(--accent-color);
      width: 0%; transition: background 0.5s ease;
    }
    #logi-overlay.timer-running::after { animation: logiProgress 8s linear infinite; }
    @keyframes logiProgress { from { width: 0%; } to { width: 100%; } }

    .logi-carousel-wrapper {
      width: 80vw !important; max-width: 1200px !important;
      margin: 0 auto !important; display: flex; align-items: center;
      gap: 5rem; transition: all 0.5s ease; padding: 40px;
    }
    .logi-changing { opacity: 0; transform: scale(0.95); filter: blur(5px); }
    .logi-image-side { flex: 1.5 !important; display: flex; justify-content: center; align-items: center; min-height: 500px; }
    .logi-product-img {
      max-height: 550px !important; width: auto !important; max-width: 100% !important;
      filter: drop-shadow(0 40px 60px rgba(0,0,0,0.8));
      transition: opacity 0.4s ease-in-out, transform 0.4s ease;
      object-fit: contain;
    }
    .img-fade-out { opacity: 0; transform: scale(0.92) translateY(10px); }
    .logi-info-side { flex: 1; }
    .logi-name { font-size: 64px !important; font-weight: 800 !important; margin: 0; color: white !important;}
    .logi-tagline { font-size: 22px !important; color: var(--accent-color); margin-bottom: 1.5rem; text-transform: uppercase; letter-spacing: 2px; transition: color 0.5s; font-weight: 700; }
    .logi-controls { position: absolute; bottom: 60px; display: flex; align-items: center; gap: 30px; }
    .logi-nav-btn {
      background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
      color: white; width: 50px; height: 50px; border-radius: 50%;
      cursor: pointer; font-size: 20px; transition: 0.3s;
      display: flex; align-items: center; justify-content: center;
    }
    .logi-nav-btn:hover { background: white; color: black; transform: scale(1.1); }
    .logi-counter { font-size: 1.2rem; font-weight: 400; letter-spacing: 4px; opacity: 0.6; }
  `;
  document.head.appendChild(style);

  function render() {
    const p = LOGI_PRODUCTS[currentIndex];
    overlay.style.setProperty("--accent-color", p.color || "#00E5FF");

    overlay.innerHTML = `
      <div class="logi-share" title="View Product Page">↗</div>
      <div class="logi-close" title="Close Overlay">&times;</div>
      <div class="logi-carousel-wrapper">
        <div class="logi-image-side">
          <img src="${p.images[innerIndex]}" class="logi-product-img" id="main-product-image">
        </div>
        <div class="logi-info-side">
          <h1 class="logi-name">${p.name}</h1>
          <p class="logi-tagline">${p.tagline}</p>
          <div class="logi-features">
            ${p.features.map((f) => `<div style="margin-bottom:10px; opacity:0.8;">• ${f}</div>`).join("")}
          </div>
        </div>
      </div>
      <div class="logi-controls">
        <button class="logi-nav-btn" id="logi-prev">❮</button>
        <div class="logi-counter">${currentIndex + 1} / ${LOGI_PRODUCTS.length}</div>
        <button class="logi-nav-btn" id="logi-next">❯</button>
      </div>
    `;

    overlay.querySelector(".logi-share").onclick = (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({
        message: "openPage",
        customPage: p.url,
      });
    };

    const wrapper = overlay.querySelector(".logi-carousel-wrapper");
    wrapper.onmouseenter = stopRotation;
    wrapper.onmouseleave = startRotation;

    overlay.querySelector(".logi-close").onclick = closeOverlay;
    overlay.querySelector("#logi-prev").onclick = (e) => {
      e.stopPropagation();
      currentIndex =
        (currentIndex - 1 + LOGI_PRODUCTS.length) % LOGI_PRODUCTS.length;
      innerIndex = 0;
      resetRotation();
      render();
    };
    overlay.querySelector("#logi-next").onclick = (e) => {
      e.stopPropagation();
      next();
    };
  }

  function cycleInnerImage() {
    const p = LOGI_PRODUCTS[currentIndex];
    const imgElement = document.getElementById("main-product-image");
    if (!imgElement) return;
    imgElement.classList.add("img-fade-out");
    setTimeout(() => {
      innerIndex++;
      if (innerIndex >= p.images.length) {
        innerIndex = 0;
        next();
      } else {
        imgElement.src = p.images[innerIndex];
        imgElement.classList.remove("img-fade-out");
      }
    }, 400);
  }

  function next() {
    const wrapper = overlay.querySelector(".logi-carousel-wrapper");
    if (!wrapper) return;
    wrapper.classList.add("logi-changing");
    setTimeout(() => {
      currentIndex = (currentIndex + 1) % LOGI_PRODUCTS.length;
      innerIndex = 0;
      render();
    }, 400);
  }

  const startRotation = () => {
    stopRotation();
    overlay.classList.add("timer-running");
    rotationTimer = setInterval(cycleInnerImage, 2000);
    overlay.dataset.intervalId = rotationTimer;
  };

  const stopRotation = () => {
    clearInterval(rotationTimer);
    overlay.classList.remove("timer-running");
  };

  const resetRotation = () => {
    stopRotation();
    setTimeout(startRotation, 50);
  };

  document.body.appendChild(overlay);
  render();
  startRotation();
  requestAnimationFrame(() => (overlay.style.opacity = "1"));
}

let inactivityTimer;

function isVideoPlaying() {
  const videos = document.querySelectorAll("video");
  for (let video of videos) {
    if (!video.paused && !video.ended && video.readyState > 2) {
      return true;
    }
  }
  return false;
}

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);

  // Only set the timer if the overlay isn't already visible
  if (!document.getElementById("logi-overlay")) {
    inactivityTimer = setTimeout(() => {
      /* THE TRIPLE CHECK:
               1. Is this tab currently focused?
               2. Is there NO video playing?
               3. Is the overlay still NOT there? (Double check for safety)
            */
      if (document.hasFocus() && !isVideoPlaying()) {
        showLogiOverlay();
      } else {
        // If not focused or video is playing, check again in 1 minute
        resetInactivityTimer();
      }
    }, 60000);
  }
}

// Activity Listeners
["mousedown", "mousemove", "keydown", "scroll", "touchstart"].forEach(
  (event) => {
    window.addEventListener(event, resetInactivityTimer, { passive: true });
  },
);

// Start the check
resetInactivityTimer();

const setupStorageValues = async () => {
  let values = await chrome.storage.local.get().then((data) => data);

  // the values are not present in the storage
  if (
    values.entirePage == undefined &&
    values.specificText == undefined &&
    values.image == undefined
  ) {
    chrome.storage.local.set({
      entirePage: [],
      specificText: [],
      image: [],
      skipLandingPage: false,
      highlightColor: "#a5cfa5",
    });
  }
  // values are all set
  else {
    let sharedViewSpecificText = await chrome.storage.session
      .get()
      .then((data) => data);
    let storagePlaces = [values.specificText];

    if (sharedViewSpecificText?.shareData?.specificText != undefined) {
      storagePlaces.push(sharedViewSpecificText.shareData.specificText);
    }

    storagePlaces.forEach((storages) => {
      Object.entries(storages).forEach(([key, value]) => {
        if (
          value.pageUrl === location.href ||
          value.pageUrl + "/" === location.href
        ) {
          // giving the time for the page load
          setTimeout(() => {
            highlightText(
              decodeURIComponent(value.text),
              values.highlightColor,
            );
          }, 2000);
        }
      });
    });
  }
};

setupStorageValues();

let pageLocation = location.href;

async function handleRefreshTimer(isEnabled) {
  // 1. Always fetch the ID to see if a timer is currently live on THIS page
  const { refreshID } = await chrome.storage.local.get("refreshID");

  if (!isEnabled) {
    // Kill the active timer and tell storage we are done
    if (refreshID) clearTimeout(refreshID);
    await chrome.storage.local.remove(["refreshID", "isRefreshEnabled"]);
  } else {
    // Save the enabled state
    await chrome.storage.local.set({ isRefreshEnabled: true });
  }

  // 2. Update Icon Visuals
  const icon = document.querySelector("#refreshIcon");
  if (icon) {
    icon.style.filter = isEnabled ? "grayscale(0)" : "grayscale(100%)";
  }

  // 3. Start timer if enabled
  if (isEnabled) {
    // Clear any existing timer on this page instance before starting a new one
    if (refreshID) clearTimeout(refreshID);

    let refreshTimeout = setTimeout(async () => {
      const iframe = document.querySelector("iframe");
      const currentSrc = iframe?.getAttribute("src");

      // Only reload if iframe is idle
      if (currentSrc === "" || !currentSrc) {
        // IMPORTANT: We set the flag so the NEXT page knows to start its own timer
        await chrome.storage.local.set({ refreshID: "reloading" });
        window.location.reload();
      } else {
        // If busy, we don't reload, but we should restart the timer for the next check
        handleRefreshTimer(true);
      }
    }, refreshDuration);

    // Track the current page's timeout ID
    await chrome.storage.local.set({ refreshID: refreshTimeout });
  }
}

async function setSkipAndRefresh() {
  const viewId = new URLSearchParams(window.location.search);
  const view = viewId.get("view");
  if (view !== null) return; // Exit if in a specific view

  // 1. Handle Skip Landing Page Logic
  const { skipLandingPage } = await chrome.storage.local.get("skipLandingPage");
  const skipIcon = document.querySelector("#skipLandingPage");
  if (skipIcon) {
    skipIcon.style.filter = `grayscale(${skipLandingPage ? "0" : "100"}%)`;
  }

  // 2. Handle Refresh Resume Logic
  const { isRefreshEnabled } =
    await chrome.storage.local.get("isRefreshEnabled");

  if (isRefreshEnabled) {
    // Resuming: We call handleRefreshTimer(true) to restart the logic properly
    // This ensures the icon turns green and the setTimeout starts fresh
    handleRefreshTimer(true);
  } else {
    const refreshIcon = document.querySelector("#refreshIcon");
    if (refreshIcon) refreshIcon.style.filter = "grayscale(100%)";
  }
}

function throwNotification(notificationType, message) {
  window.dispatchEvent(
    new CustomEvent("SHOW_NOTIFICATION", {
      detail: {
        notificationType,
        message,
      },
    }),
  );
}

function openAISettingsPage(chromePage) {
  chrome.runtime.sendMessage({
    message: "openPage",
    customPage: chromePage,
  });
}

const getPath = (urlStr) => {
  try {
    const url = new URL(urlStr, window.location.origin);
    return url.pathname.replace(/\/$/, "");
  } catch (e) {
    return urlStr;
  }
};

// handling the "landing page" interactions
if (getPath(pageLocation) === getPath(defaultLandingPage)) {
  const viewId = new URLSearchParams(window.location.search);
  const view = viewId.get("view");

  if (!document.querySelector("#notification")) {
    const fontScript = document.createElement("script");
    fontScript.src = chrome.runtime.getURL("src/aid.js");
    document.documentElement.appendChild(fontScript);
  }

  document.querySelectorAll("#AISettingsPage a").forEach((aiSettingPage) => {
    aiSettingPage.addEventListener("click", (e) => {
      e.preventDefault();
      openAISettingsPage(e.target.getAttribute("href"));
    });
  });

  // to open the notes webpage
  document.querySelector("#txtFile")?.addEventListener("click", () => {
    let customPage =
      typeof view !== "undefined" && view != null
        ? `${defaultLandingPage}/notes.html?view=${view}`
        : `${defaultLandingPage}/notes.html`;

    chrome.runtime.sendMessage({
      message: "openPage",
      customPage,
    });
  });

  // for the color picker thing
  const picker = document.getElementById("actualColorPicker");
  const preview = document.getElementById("colorPreview");

  // Converts Hex to RGBA and updates the span background
  function updatePreview(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    preview.style.background = hex;
  }

  (async () => {
    // checking the skip status & changing the UI accordingly
    const { skipLandingPage: skipValue } =
      await chrome.storage.local.get("skipLandingPage");

    // Map elements to their "On" and "Off" states
    const elements = [
      { id: "#landing-section", on: "flex", show: !skipValue },
      { id: "#proceedToMain", on: "block", show: !skipValue },
      { id: "#teamDetails", on: "block", show: !skipValue },
      { id: "#main-text", on: "block", show: skipValue },
    ];

    elements.forEach(({ id, on, show }) => {
      const el = document.querySelector(id);
      if (el) {
        el.style.display = show ? on : "none";
      }
    });

    // Reveal the container only after styles are applied
    // document.querySelector("body")?.classList.add("is-ready");

    chrome.storage.local.get("highlightColor", (data) => {
      const savedHex = data.highlightColor || "#a5cfa5";
      picker.value = savedHex;

      colorPreview.style.background = savedHex;

      // Apply the background color style to the span
      updatePreview(savedHex);
    });

    // disbaling the color-picker thing for shared view
    if (typeof view !== "undefined" && view != null) {
      document.getElementById("resetColor").style.display = "none";
      document.getElementById("actualColorPicker").style.disabled = true;

      if (picker) {
        picker.disabled = true;
        picker.style.pointerEvents = "none";
        picker.style.display = "none";
      }
    } else {
      // Update the preview as the user drags the slider
      picker.addEventListener("input", (e) => {
        updatePreview(e.target.value);
      });

      picker.addEventListener("change", (e) => {
        chrome.storage.local.set({ highlightColor: e.target.value });
      });

      const defaultHex = "#a5cfa5";

      document.getElementById("resetColor").addEventListener("click", () => {
        picker.value = defaultHex;
        preview.style.background = `${defaultHex}`;

        chrome.storage.local.set({ highlightColor: defaultHex });
      });
    }

    document
      .querySelector("#refreshIcon")
      .addEventListener("click", async (e) => {
        const { isRefreshEnabled } =
          await chrome.storage.local.get("isRefreshEnabled");

        const newState = !isRefreshEnabled;

        await chrome.storage.local.set({ isRefreshEnabled: newState });

        // Update UI and trigger the timer logic
        handleRefreshTimer(newState);
      });

    // attching the event listener to the skip icon
    document
      .querySelector("#skipLandingPage")
      .addEventListener("click", async (el) => {
        // Get current state from storage first for a "Source of Truth"
        const data = await chrome.storage.local.get("skipLandingPage");
        const isCurrentlySkipped = data.skipLandingPage || false;

        // Toggle the value
        const newState = !isCurrentlySkipped;
        await chrome.storage.local.set({ skipLandingPage: newState });

        // Update the UI using the new state
        el.target.style.filter = newState ? "grayscale(0)" : "grayscale(1)";
      });

    setSkipAndRefresh();
  })();

  // Event listener for Focus Mode
  document.querySelector("#focusMode").addEventListener("click", async () => {
    chrome.runtime.sendMessage({ message: "startFocusMode" });
  });

  const entirePageBookmarksList = document.querySelector(
    "#entirePageBookmarksList",
  );
  const entirePageBookmarksCount = document.querySelector(
    "#entirePageBookmarksCount",
  );

  const textBookmarksList = document.querySelector("#textBookmarksList");
  const textBookmarksCount = document.querySelector("#textBookmarksCount");

  textBookmarksList.innerHTML = "";
  entirePageBookmarksList.innerHTML = "";

  // Image Gallery functionality
  const populateImageGallery = async (refreshImages = false) => {
    document.querySelector("#teamDetails").style.display = "none";

    const imageGallery = document.getElementById("imageGallery");
    const nonImageGallery = document.getElementById("nonImageGallery");
    const counterEl = document.getElementById("carouselCounter");

    counterEl.textContent = "0 images";

    // Toggle the gallery
    if (refreshImages == false && imageGallery.style.display === "flex") {
      imageGallery.style.display = "none";
      nonImageGallery.style.display = "block";
      return;
    }

    // Get Data
    let data = await chrome.storage.local.get();

    // Share View logic
    if (typeof view !== "undefined" && view != null) {
      document.body.setAttribute("view", "share");
      data = await chrome.storage.session
        .get("shareData")
        .then((res) => res.shareData);

      if (data.error != undefined) {
        chrome.runtime.sendMessage({ message: "wrongViewLink" });
        return;
      }

      document.getElementById("deleteImage").style.pointerEvents = "none";
      document.getElementById("deleteImage").style.display = "none";
    }

    const carouselInner = document.getElementById("carouselInner");
    const modal = document.getElementById("myModal");
    const modalImg = document.getElementById("img01");

    carouselInner.innerHTML = "";

    let isFirst = true;
    const imageData = data["image"] || {};
    const totalImages = Object.keys(imageData).length;

    // Loop through and build slides
    for (let keys in imageData) {
      let itemDiv = document.createElement("div");
      itemDiv.classList.add("carousel-item");
      if (isFirst) {
        itemDiv.classList.add("active");
        isFirst = false;
      }

      // 1. THE WRAPPER: This keeps image + text centered without breaking the slide
      let contentWrapper = document.createElement("div");
      contentWrapper.style.display = "flex";
      contentWrapper.style.flexDirection = "column";
      contentWrapper.style.alignItems = "center";
      contentWrapper.style.justifyContent = "center";
      contentWrapper.style.minHeight = "450px";
      contentWrapper.style.padding = "0 40px";

      // 2. THE IMAGE
      let img = document.createElement("img");
      img.className = "image-carousel d-block";
      img.style.cursor = "pointer";
      img.style.maxWidth = "100%";
      img.style.maxHeight = "350px";
      img.style.borderRadius = "1rem";
      img.style.objectFit = "contain";
      img.src = imageData[keys]["imageUrl"];
      img.setAttribute("pageUrl", imageData[keys]["pageUrl"]);

      // 3. THE TEXT (Captions)
      let desc = document.createElement("p");
      desc.style.margin = "15px 0 0 0";
      desc.style.fontSize = "14px";
      desc.style.color = "#444";
      desc.style.textAlign = "center";
      desc.style.fontWeight = "500";
      desc.style.width = "100%";
      desc.innerText = imageData[keys]["altText"];

      img.onclick = function () {
        modal.style.display = "block";
        modalImg.src = this.src;

        modalImg.setAttribute("data-src", imageData[keys]["imageUrl"]);
        modalImg.setAttribute("data-scroll", imageData[keys]["scroll"]);

        chrome.runtime.sendMessage({
          message: "openPage",
          scroll: imageData[keys]["scroll"],
          customPage: this.getAttribute("pageUrl"),
        });
      };

      // Append to wrapper, then wrapper to slide
      contentWrapper.appendChild(img);
      contentWrapper.appendChild(desc);
      itemDiv.appendChild(contentWrapper);

      carouselInner.appendChild(itemDiv);
    }

    // Set Initial Counter Text
    if (totalImages > 0 && counterEl) {
      counterEl.style.display = "block";
      counterEl.innerText = `1 / ${totalImages}`;
    }

    // Switch Display
    imageGallery.style.display = "flex";
    nonImageGallery.style.display = "none";

    // This watches for the '.active' class moving between slides
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class"
        ) {
          const target = mutation.target;
          if (target.classList.contains("active")) {
            const allSlides = Array.from(
              carouselInner.querySelectorAll(".carousel-item"),
            );
            const currentIndex = allSlides.indexOf(target) + 1;
            if (counterEl) {
              counterEl.innerText = `${currentIndex} / ${totalImages}`;
            }
          }
        }
      });
    });

    // Start observing the carousel inner container
    observer.observe(carouselInner, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["class"],
    });

    document.getElementById("deleteImage").onclick = async function () {
      const modalImg = document.getElementById("img01");
      const targetSrc = modalImg.getAttribute("data-src");
      const targetScroll = modalImg.getAttribute("data-scroll");

      // Get current data - default to empty array instead of object
      const storage = await chrome.storage.local.get("image");
      let images = Array.isArray(storage.image)
        ? storage.image
        : Object.values(storage.image || {});

      // 1. Filter out the specific image
      const initialLength = images.length;
      const updatedImages = images.filter(
        (img) =>
          !(
            img.imageUrl === targetSrc &&
            String(img.scroll) === String(targetScroll)
          ),
      );

      if (updatedImages.length < initialLength) {
        // 2. Save the array DIRECTLY.
        // Chrome storage handles arrays perfectly, keeping indices sequential.
        await chrome.storage.local.set({ image: updatedImages });

        // 3. Cleanup UI
        document.getElementById("myModal").style.display = "none";

        // 4. Refresh the gallery
        populateImageGallery(true);
      }
    };
  };

  document
    .querySelector("#imageGalleryDiv")
    .addEventListener("click", () => populateImageGallery());
  document
    .querySelector("#imageParaBack")
    .addEventListener("click", () => populateImageGallery());

  // image close feature
  let span = document.getElementsByClassName("close")[0];

  span.onclick = function () {
    document.getElementById("myModal").style.display = "none";
  };

  const focusIcon = document.getElementById("focusMode");
  const galleryIcon = document.getElementById("galleryIcon");
  const refreshIcon = document.getElementById("refreshIcon");
  const skipLandingPageIcon = document.getElementById("skipLandingPage");

  galleryIcon.addEventListener("click", () => populateImageGallery());

  if (view != null) {
    [focusIcon, refreshIcon, skipLandingPageIcon].forEach((icons) => {
      icons.style.filter = "grayscale(100)";
      icons.style.pointerEvents = "none";
    });

    document.querySelector("#shareViewBookmark").style.display = "block";
  }

  const paintUI = async () => {
    let storageValues = await chrome.storage.local.get();

    // this is the SHARE link that someone else is viewing
    if (view != null) {
      document.body.setAttribute("view", "share");

      // extracting the data from the server for that view link
      storageValues = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            action: "serverCall",
            data: {},
            endpoint: `${defaultLandingPage}/server.php?code=${view}`,
          },
          (response) => {
            if (!response || response.status === "error") {
              resolve({
                status: "error",
                message: response?.message || "Internal Bridge Error",
              });
            } else {
              resolve(response.data || response);
            }
          },
        );
      });

      if (storageValues?.status === "error") {
        return chrome.runtime.sendMessage({ message: "wrongViewLink" });
      }

      await chrome.storage.session.set({
        shareData: storageValues,
      });
    }

    // setting up the UI for the file sharing things
    if (storageValues.docFile != undefined && storageValues.docFile != "") {
      document.querySelector("#docFile").style.filter = "grayscale(0%)";
      document
        .querySelector("#docFile")
        .setAttribute(
          "link",
          `${defaultLandingPage}/files/${storageValues.docFile}`,
        );
    }
    if (storageValues.pdfFile != undefined && storageValues.pdfFile != "") {
      document.querySelector("#pdfFile").style.filter = "grayscale(0%)";
      document
        .querySelector("#pdfFile")
        .setAttribute(
          "link",
          `${defaultLandingPage}/files/${storageValues.pdfFile}`,
        );
    }

    const shareDiv = document.getElementById("share");

    const share = async () => {
      const storageValues = await chrome.storage.local.get();
      await chrome.runtime.sendMessage(
        {
          action: "serverCall",
          data: storageValues,
          endpoint: `${defaultLandingPage}/server.php`,
        },
        async (response) => {
          console.log(response);
          // This is where you "hear" the response
          if (response.status === "error") {
            chrome.runtime.sendMessage({ message: "shareLinkError" });
          } else {
            console.log(response);

            await navigator.clipboard.writeText(
              `${defaultLandingPage}?view=${response.data.code}`,
            );

            chrome.runtime.sendMessage({ message: "shareLinkCopied" });
          }
        },
      );
    };

    const populateShareDiv = async () => {
      document.querySelector("#file-vault").style.display = "block";

      let img = document.createElement("img");
      img.width = "30";
      img.height = "30";
      img.alt = "share--v2";
      img.style.marginRight = "1rem";
      img.src = "https://img.icons8.com/fluency/30/share--v2.png";

      let div = document.createElement("div");
      div.style.textAlign = "justify";
      div.style.color = "black";
      div.textContent = `Share the current bookmarks with anyone`;

      shareDiv.appendChild(img);
      shareDiv.appendChild(div);

      shareDiv.style.cursor = "pointer";
      shareDiv.addEventListener("click", share);

      // enabling the file-vault for the share view
      if (view != null) {
        document.querySelector("#file-vault").style.display = "block";
      }
    };

    await populateShareDiv();

    // owner is seeing the page
    if (document.body.getAttribute("view") === "own") {
      shareDiv.style.display = "flex";
    } else {
      shareDiv.style.pointerEvents = "none";
      shareDiv.textContent =
        "Currently viewing someone else's bookmarks (Shared view)";
    }

    let entirePageCount = 0;
    let textPageCount = 0;

    // setting the UI for "entirePage" section
    for (let keys in storageValues["entirePage"]) {
      if (storageValues["entirePage"].length > 0) {
        entirePageCount++;

        let div = document.createElement("div");
        div.classList.add("d-flex");
        div.style.margin = "5px";
        div.setAttribute("type", "entirePage");

        div.setAttribute(
          "pageUrl",
          storageValues["entirePage"][keys]["pageUrl"],
        );
        div.setAttribute(
          "pageTitle",
          storageValues["entirePage"][keys]["pageTitle"],
        );

        if (document.body.getAttribute("view") == "own") {
          let img = document.createElement("img");
          img.width = "20";
          img.height = "20";
          img.src = "https://img.icons8.com/plasticine/20/filled-trash.png";
          img.style.marginRight = "5px";
          img.style.cursor = "pointer";

          img.addEventListener("click", async (e) => {
            let storageValues = await chrome.storage.local.get();

            storageValues[e.target.parentElement.getAttribute("type")] =
              storageValues[e.target.parentElement.getAttribute("type")].filter(
                (item) => {
                  return !(
                    item["pageUrl"] ==
                      e.target.parentElement.getAttribute("pageurl") &&
                    item["pageTitle"] ==
                      e.target.parentElement.getAttribute("pagetitle") &&
                    item["text"] == e.target.parentElement.getAttribute("text")
                  );
                },
              );

            await chrome.storage.local.set({
              entirePage: storageValues["entirePage"],
              specificText: storageValues["specificText"],
              image: storageValues["image"],
            });

            location.reload();
          });

          div.appendChild(img);
        }

        let a = document.createElement("a");
        a.textContent = `${entirePageCount}. ${storageValues["entirePage"][keys]["pageTitle"]}`;
        a.setAttribute("href", storageValues["entirePage"][keys]["pageUrl"]);
        a.style.textDecoration = "none";
        a.setAttribute("target", "_blank");

        div.appendChild(a);

        entirePageBookmarksList.appendChild(div);
      }
    }

    entirePageBookmarksCount.textContent = entirePageCount;

    if (entirePageCount == 0) {
      let div = document.createElement("div");
      div.classList.add("d-flex");
      div.style.justifyContent = "center";
      div.style.alignItems = "center";
      div.style.height = "100%";

      let img = document.createElement("img");
      img.width = "80";
      img.height = "80";
      img.src = "https://img.icons8.com/dotty/80/cancel-2.png";

      div.appendChild(img);
      entirePageBookmarksList.style.alignItems = "center";
      entirePageBookmarksList.appendChild(div);
    } else {
      entirePageBookmarksList.style.alignItems = "flex-start";
    }

    //  setting the UI for "specificText" section
    for (let keys in storageValues["specificText"]) {
      if (storageValues["specificText"].length > 0) {
        textPageCount++;

        let div = document.createElement("div");
        div.classList.add("d-flex");
        div.style.margin = "5px";
        div.setAttribute("type", "specificText");
        div.setAttribute("text", storageValues["specificText"][keys]["text"]);
        div.setAttribute(
          "pageUrl",
          storageValues["specificText"][keys]["pageUrl"],
        );
        div.setAttribute(
          "filter",
          storageValues["specificText"][keys]["saveFilter"],
        );
        div.setAttribute(
          "pageTitle",
          storageValues["specificText"][keys]["pageTitle"],
        );

        if (document.body.getAttribute("view") == "own") {
          let img = document.createElement("img");
          img.width = "20";
          img.height = "20";
          img.src = "https://img.icons8.com/plasticine/20/filled-trash.png";
          img.style.marginRight = "5px";
          img.style.cursor = "pointer";

          // adding the delete feature for the bookmarks
          img.addEventListener("click", async (e) => {
            let storageValues = await chrome.storage.local.get();

            storageValues[e.target.parentElement.getAttribute("type")] =
              storageValues[e.target.parentElement.getAttribute("type")].filter(
                (item) => {
                  return !(
                    item["pageUrl"] ==
                      e.target.parentElement.getAttribute("pageurl") &&
                    item["pageTitle"] ==
                      e.target.parentElement.getAttribute("pagetitle") &&
                    item["text"] == e.target.parentElement.getAttribute("text")
                  );
                },
              );
            await chrome.storage.local.set({
              entirePage: storageValues["entirePage"],
              specificText: storageValues["specificText"],
              image: storageValues["image"],
            });

            location.reload();
          });

          div.appendChild(img);
        }

        let a = document.createElement("a");
        a.innerHTML = `<span style="color: black">${textPageCount}. ${
          storageValues["specificText"][keys]["pageTitle"]
        }</span> (${decodeURIComponent(
          storageValues["specificText"][keys]["text"],
        ).substring(0, 20)}..)`;

        // creating the anchor tag to click upon
        a.setAttribute("href", storageValues["specificText"][keys]["pageUrl"]);
        a.setAttribute("scroll", storageValues["specificText"][keys]["scroll"]);
        a.style.textDecoration = "none";
        a.setAttribute("target", "_blank");

        div.appendChild(a);

        textBookmarksList.appendChild(div);
      }
    }

    textBookmarksCount.textContent = textPageCount;

    if (textPageCount == 0) {
      let div = document.createElement("div");
      div.classList.add("d-flex");
      div.style.justifyContent = "center";
      div.style.alignItems = "center";
      div.style.height = "100%";

      let img = document.createElement("img");
      img.width = "80";
      img.height = "80";
      img.src = "https://img.icons8.com/dotty/80/cancel-2.png";

      div.appendChild(img);
      textBookmarksList.style.alignItems = "center";
      textBookmarksList.appendChild(div);
    } else {
      textBookmarksList.style.alignItems = "flex-start";
    }

    // ensure that the smart search is trigerred
    [entirePageBookmarksList, textBookmarksList].forEach((list) => {
      list.querySelectorAll("a").forEach((anchor) => {
        anchor.addEventListener("click", async (e) => {
          e.preventDefault();
          chrome.runtime.sendMessage({
            message: "openPage",
            customPage: anchor.getAttribute("href"),
            scroll: anchor.getAttribute("scroll")
              ? anchor.getAttribute("scroll")
              : null,
          });
        });
      });
    });
  };

  // painting the UI
  paintUI();

  // Converting the file to a base64 string to send to the bgd script
  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });

  async function uploadFile(file) {
    const base64File = await fileToBase64(file);
    const { code } = await chrome.storage.local.get(["code"]);

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: "serverCall",
          endpoint: "uploadFile",
          data: {
            fileData: base64File,
            fileName: file.name,
            code: code || "default",
          },
        },
        (response) => {
          if (!response || response.status === "error") {
            resolve({
              status: "error",
              message: response?.message || "Upload failed",
            });
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  // handling the file upload
  document.querySelector("#file-drop").addEventListener("change", async (e) => {
    const fileErrorDiv = document.querySelector("#fileErrorDiv");

    var reader = new FileReader();
    reader.onload = async function () {
      var arrayBuffer = this.result;
      array = new Uint8Array(arrayBuffer);

      // disallowing files greater than the specified size
      if (e.target.files[0].size > 200000) {
        e.target.value = "";
        // fileErrorDiv.classList.remove("d-none");
        fileErrorDiv.classList.add("show");
        fileErrorDiv.textContent = "File size should be less than 200 kb";
        return;
      }

      // disallowing the files other than "pdf/doc/docx" format
      const file = e.target.files[0];
      const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
        "application/msword",
      ];

      if (!allowedTypes.includes(file.type)) {
        e.target.value = "";
        fileErrorDiv.classList.add("show");
        fileErrorDiv.textContent = "Only PDF, DOC, and DOCX files are allowed";
        return;
      }

      let values = await chrome.storage.local.get().then((data) => data);
      let fileType = "";

      if (e.target.files[0].type == "application/pdf") fileType = "pdfFile";
      else fileType = "docFile";

      if (values["docFile"] == undefined && values["pdfFile"] == undefined) {
        await chrome.storage.local.set({
          docFile: "",
          pdfFile: "",
        });

        values = {
          ...values,
          ...{
            docFile: "",
            pdfFile: "",
          },
        };
      }

      // checking whether a file was already uploaded or not?
      if (values[fileType] !== "") {
        // fileErrorDiv.classList.remove("d-none");
        fileErrorDiv.classList.add("show");
        fileErrorDiv.textContent = "Similar type of file already uploaded!";
        return;
      }

      const uploadResult = await uploadFile(e.target.files[0]);

      if (uploadResult.status === "error") {
        // fileErrorDiv.classList.remove("d-none");
        fileErrorDiv.classList.add("show");
        fileErrorDiv.textContent = "Server error! File upload failed";
      } else {
        document.querySelector(`#${fileType}`).style.filter = "grayscale(0%)";
        document
          .querySelector(`#${fileType}`)
          .setAttribute(
            "link",
            `${defaultLandingPage}/files/${uploadResult.data.fileName}`,
          );
        values[fileType] = uploadResult.data.fileName;
        await chrome.storage.local.set({
          docFile: values.docFile,
          pdfFile: values.pdfFile,
        });

        // fileErrorDiv.classList.add("d-none");
        fileErrorDiv.classList.remove("show");
      }

      e.target.value = "";
    };

    reader.readAsArrayBuffer(e.target.files[0]);
  });

  // handling the file deletion
  document.querySelector("#deleteFiles").addEventListener("click", async () => {
    let values = await chrome.storage.local.get();

    if (
      (values["docFile"] != undefined && values["docFile"] != "") ||
      (values["pdfFile"] != undefined && values["pdfFile"] != "")
    ) {
      await chrome.storage.local.set({
        docFile: "",
        pdfFile: "",
      });

      const requestDelete = (fileLink) => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage(
            {
              action: "serverCall",
              endpoint: "deleteFile",
              data: fileLink,
            },
            (response) => {
              if (!response || response.status === "error") {
                resolve({
                  status: "error",
                  message: response?.message || "Delete failed",
                });
              } else {
                resolve(response);
              }
            },
          );
        });
      };

      const fileSelectors = ["#docFile", "#pdfFile"];

      for (const selector of fileSelectors) {
        const element = document.querySelector(selector);
        const link = element?.getAttribute("link");

        if (link) {
          // Immediate Visual Feedback
          element.style.opacity = "0.5";

          const result = await requestDelete(link);

          if (result.status === "error") {
            // Revert opacity if delete failed
            element.style.opacity = "1";

            chrome.runtime.sendMessage({
              message: "deleteFileError",
              errorMessage: result.message,
            });
          } else {
            element.style.filter = "grayscale(100%)";
            element.style.opacity = "1";
            element.style.pointerEvents = "none";

            element.removeAttribute("link");
            element.removeAttribute("href");
          }
        }
      }
    }
  });

  // restricting the file upload functionality for shared views:
  document.querySelector("#initiateUploading").style.display = view
    ? "none"
    : "flex";
  document.querySelector("#file-vault").style.display = view ? "block" : "none";
  document.querySelector("#file-vault > div").style.display = view
    ? "none"
    : "block";
  document.querySelector("#file-vault div:last-of-type").style.display = view
    ? "block"
    : "block";
  document.querySelector("#deleteFiles").style.display = view
    ? "none"
    : "block";
}

// VeB Thing
// For the bookmark's watermark
const adminAccess = true;

const baseZIndex = 9999999;

function autoShareFeatureForReddit() {
  if (document.querySelector("#shareIcon")) return;

  let shareIcon = document.createElement("img");
  shareIcon.src = "https://img.icons8.com/fluency/48/share-3.png";
  shareIcon.setAttribute("id", "shareIcon");
  shareIcon.width = "32";
  shareIcon.height = "32";
  shareIcon.style.margin = "0";
  shareIcon.style.cursor = "pointer";
  shareIcon.style.borderRadius = "10px";

  let scrollIntervals = []; // Store all timeouts

  shareIcon.addEventListener("click", () => {
    shareIcon.style.border = "3px solid green";

    let scrollShares = document.body.getAttribute(
      "help-buddy-shareScrollEventID",
    );

    if (scrollShares) {
      shareIcon.style.border = "none";

      // Clear all timeouts
      scrollIntervals.forEach((timeout) => clearTimeout(timeout));
      scrollIntervals = []; // Reset the array

      document.body.removeAttribute("help-buddy-shareScrollEventID");
      return;
    }

    // Clicking the share button & auto-scrolling
    document.querySelectorAll("shreddit-post").forEach((post, index) => {
      let timeout = setTimeout(() => {
        let postShadow = post.shadowRoot;
        if (!postShadow) return;

        let shareButton = postShadow
          .querySelector("shreddit-post-share-button")
          ?.shadowRoot?.querySelector("button");

        if (shareButton) {
          let postPosition = post.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({
            top: postPosition + 120,
            behavior: "smooth",
          });

          setTimeout(() => {
            shareButton.click();

            setTimeout(() => {
              let firstMenuItem = postShadow
                .querySelector("shreddit-post-share-button")
                ?.shadowRoot?.querySelector("faceplate-menu li:first-child");

              firstMenuItem?.click();
            }, 500);
          }, 500);
        }
      }, index * 5000);

      scrollIntervals.push(timeout); // Store timeout ID
    });

    document.body.setAttribute("help-buddy-shareScrollEventID", "true");
  });

  let nav = document.querySelector("nav");
  nav.insertBefore(shareIcon, nav.children[2] || null);
}

/* Notes feature */
async function saveNotes(notesText) {
  const { code } = await chrome.storage.local.get("code");

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        action: "serverCall",
        endpoint: "saveNotes",
        data: {
          code: code,
          notes: notesText,
        },
      },
      (response) => {
        if (response && response.status === "success") {
          resolve(true);
        } else {
          throwNotification("error", "Failed to save notes");
          resolve(false);
        }
      },
    );
  });
}

async function fetchDecryptedNotes(view = null) {
  let { code } = await chrome.storage.local.get("code");

  code = typeof view !== "undefined" && view != null ? view : code;

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        action: "serverCall",
        endpoint: "sendNotes",
        data: { code: code },
      },
      (response) => {
        if (response && response.status === "success") {
          resolve(response.data.notes);
        } else {
          throwNotification("error", response?.message || "Unknown error");
          resolve(null);
        }
      },
    );
  });
}

// AR1 (autorun): for the extension's notes page
if (pageLocation.includes(`${defaultLandingPage}/notes.html`)) {
  chrome.runtime.sendMessage({
    action: "changeTitle",
    newTitle: "LoLé: Viewing your notes",
  });

  Object.assign(document.body.style, {
    color: "black",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    background: "white",
  });

  chrome.runtime.sendMessage({
    action: "scaleUp",
    targetZoom: document.documentElement.clientWidth > 1500 ? 1.1 : 1,
  });

  if (!document.querySelector("#notification")) {
    const fontScript = document.createElement("script");
    fontScript.src = chrome.runtime.getURL("src/aid.js");
    document.documentElement.appendChild(fontScript);
  }

  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = chrome.runtime.getURL("resources/logo_128.png");

  (async () => {
    const viewId = new URLSearchParams(window.location.search);
    const view = viewId.get("view");

    let notes = await fetchDecryptedNotes(view);
    if (notes == null) return;

    let defaultNotesHtml = `<h2>Getting Started with LoLé Notes</h2><p>Welcome to your enhanced notes experience! This dashboard transforms your raw thoughts into a structured, navigable workspace.</p><br><p><strong>How the Magic Happens:</strong></p><p>The green box above acts as your <em>Table of Contents</em>. It automatically detects <strong>Header (H2)</strong> to create new navigation points. Since this guide only uses one header at the top, it stays as a single point!</p><br><p><strong>Quick Controls:</strong></p><ul><li><strong>📝 Pencil Icon:</strong> Enters Edit Mode. Use the toolbar to style your text or add headers.</li><li><strong>💾 Save Icon:</strong> Syncs your changes securely to the server. We check for changes first to save your bandwidth!</li><li><strong>📋 Unzip Icon:</strong> Toggles between viewing a single section and the entire document at once by clicking at the top-left icon</li></ul><p><strong>Pro Tip:</strong> To create a new point in the list, simply type a title and set it to <strong>Heading 2</strong> in the editor. Everything you type below it will belong to that point until you create the next header!</p><p><br><em>Ready to clear this guide? Hit the pencil icon and start your own journey.</em></p><p><strong>Note:</strong> This guide is always visible and cannot be edited.</p>`;

    // --- Parsing logic ---
    const parseNotesToUI = (userNotes) => {
      let formatted = {};

      // 1. Always set the static guide
      formatted[1] = {
        visibleText: "🚀 Getting Started",
        toggleText: defaultNotesHtml,
      };

      if (!userNotes || userNotes.trim() === "" || userNotes === "<p><br></p>")
        return formatted;

      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = userNotes;
      const elements = Array.from(tempDiv.children);

      let currentInd = 1;

      elements.forEach((el) => {
        const isHeader = ["H2"].includes(el.tagName);
        const hasText = el.textContent.trim().length > 0;

        // Link Transformation Logic
        let processedHtml = el.outerHTML.replace(
          /(https?:\/\/[^\s"')]+)/g,
          (match) => {
            // If the URL is already inside an href attribute or an <a> tag, return it as is
            const index = el.outerHTML.indexOf(match);
            const before = el.outerHTML.substring(index - 6, index);
            if (before.includes("href=") || el.tagName === "A") return match;

            const linkText =
              match.length > 60 ? match.slice(0, 59) + "..." : match;
            return `<a href="${match}" target="_blank" style="display: inline-block; background: rgba(150,150,255,0.4); color: black; padding: 0 1px; border-radius: 4px;">${linkText}</a>`;
          },
        );

        if (isHeader) {
          if (hasText) {
            currentInd++;
            formatted[currentInd] = {
              visibleText: el.textContent.trim(),
              toggleText: processedHtml,
            };
          }
        } else {
          if (currentInd === 1) {
            if (hasText || el.querySelector("img")) {
              currentInd = 2;
              formatted[currentInd] = {
                visibleText: "My Notes",
                toggleText: `<h2>My Notes </h2>${processedHtml}`,
              };
            }
          } else if (formatted[currentInd]) {
            formatted[currentInd].toggleText += processedHtml;
          }
        }
      });

      // Cleanup: delete any points that ended up with ONLY a header and no body
      Object.keys(formatted).forEach((key) => {
        if (key > 1) {
          const content = formatted[key].toggleText;
          const tempCheck = document.createElement("div");
          tempCheck.innerHTML = content;
          if (
            tempCheck.textContent.trim().length === 0 &&
            !tempCheck.querySelector("img")
          ) {
            delete formatted[key];
          }
        }
      });

      return formatted;
    };

    let formattedText = parseNotesToUI(notes);

    // UI Setup (Green Box, Area, Icons)
    const navWrapper = document.createElement("div");
    Object.assign(navWrapper.style, {
      position: "relative",
      width: "450px",
      marginTop: "20px",
      display: "flex",
      alignItems: "center",
      margin: "auto",
    });

    const pointsDiv = document.createElement("div");
    pointsDiv.setAttribute("id", "pointsDiv");
    Object.assign(pointsDiv.style, {
      padding: "10px 40px 10px 20px",
      maxHeight: "150px",
      width: "100%",
      overflowY: "auto",
      borderRadius: "4px",
      border: "2px solid rgb(0, 200, 0)",
      background: "white",
    });

    const scrollContainer = document.createElement("div");
    Object.assign(scrollContainer.style, {
      position: "absolute",
      right: "10px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    });

    navWrapper.append(pointsDiv, scrollContainer);

    const detailsDiv = document.createElement("div");
    detailsDiv.setAttribute("id", "detailsDiv");
    Object.assign(detailsDiv.style, {
      width: "500px",
      margin: "auto",
      marginTop: "30px",
      lineHeight: "1.6",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      position: "relative", // Needed for absolute positioning of the handle
      paddingLeft: "15px",
    });

    // Container for the corner resizer components
    const resizerGroup = [];

    // 1. The Vertical Handle (Left Edge)
    const resizerVertical = document.createElement("div");
    resizerVertical.setAttribute("id", "resizer-vertical");
    Object.assign(resizerVertical.style, {
      width: "6px",
      height: "20px",
      position: "absolute",
      top: "0",
      left: "0",
      cursor: "ew-resize",
      zIndex: "100",
      background: "grey",
      borderRadius: "0 0 6px 6px",
    });
    resizerGroup.push(resizerVertical);

    // 2. The Horizontal Handle (Top Edge)
    const resizerHorizontal = document.createElement("div");
    resizerHorizontal.setAttribute("id", "resizer-horizontal");
    Object.assign(resizerHorizontal.style, {
      width: "20px",
      height: "6px",
      position: "absolute",
      top: "0",
      left: "0",
      cursor: "ew-resize",
      zIndex: "100",
      background: "grey",
      borderRadius: "0 6px 6px 0",
    });
    resizerGroup.push(resizerHorizontal);

    // 3. The Corner Block (The actual Angle)
    const resizerCorner = document.createElement("div");
    resizerCorner.setAttribute("id", "resizer-corner");
    Object.assign(resizerCorner.style, {
      width: "15px",
      height: "15px",
      position: "absolute",
      top: "0",
      left: "0",
      cursor: "ew-resize",
      zIndex: "101",
      background: "transparent",
      borderTop: "3px solid transparent",
      borderLeft: "3px solid transparent",
      transition: "border-color 0.2s",
    });
    resizerGroup.push(resizerCorner);

    // --- Width Resizer Logic ---
    let isResizing = false;

    // Attach mousedown to all three parts
    resizerGroup.forEach((el) => {
      el.addEventListener("mousedown", (e) => {
        isResizing = true;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "ew-resize";
      });
    });

    window.addEventListener("mousemove", (e) => {
      if (!isResizing) return;

      const centerX = window.innerWidth / 2;
      const distanceFromCenter = Math.abs(e.clientX - centerX);
      let newWidthPercent =
        ((distanceFromCenter * 2) / window.innerWidth) * 100;

      // Constrain
      newWidthPercent = Math.min(Math.max(newWidthPercent, 30), 95);
      const widthStr = `${newWidthPercent}%`;

      detailsDiv.style.width = widthStr;
    });

    window.addEventListener("mouseup", () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.userSelect = "auto";
        document.body.style.cursor = "default";
        chrome.storage.local.set({ preferredWidth: detailsDiv.style.width });
      }
    });

    const reattachResizers = () => {
      resizerGroup.forEach((el) => detailsDiv.appendChild(el));
    };

    const unzipIcon = document.createElement("img");
    unzipIcon.setAttribute("id", "unzipIcon");
    unzipIcon.src = "https://img.icons8.com/dusk/32/list.png";
    Object.assign(unzipIcon.style, {
      top: "10px",
      left: "5vw",
      width: "42px",
      padding: "2px",
      cursor: "pointer",
      position: "fixed",
      borderRadius: "10px",
      background: "rgba(200, 200, 200, 0.8)",
    });

    let showingAll = false;
    const resetUnzipState = () => {
      showingAll = false;
      unzipIcon.style.background = "rgba(200, 200, 200, 0.8)";
    };

    const renderPoints = (dataMap) => {
      pointsDiv.innerHTML = "";
      Object.entries(dataMap).forEach(([key, section]) => {
        let para = document.createElement("p");
        para.style.cssText =
          "cursor:pointer; margin: 8px 0; font-size: 0.95rem;";
        para.innerHTML = `<span style="padding: 2px 6px; border-radius: 4px;">${key}. ${section.visibleText}</span>`;
        para.onclick = () => {
          if (showingAll) resetUnzipState();
          detailsDiv.innerHTML = section.toggleText;
          reattachResizers();
          pointsDiv.querySelectorAll("span").forEach((s) => {
            s.style.background = "none";
            s.style.fontWeight = "normal";
          });
          const span = para.querySelector("span");
          span.style.background = "rgba(0, 200, 0, 0.4)";
          span.style.fontWeight = "bold";
        };
        pointsDiv.appendChild(para);
      });
    };

    renderPoints(formattedText);

    unzipIcon.addEventListener("click", async () => {
      if (!showingAll) {
        let fullViewHtml = "";
        const entries = Object.entries(formattedText);

        entries.forEach(([key, section], index) => {
          // 1. Process the header to add Underlining and Indexing
          // We wrap the content in a div to apply spacing
          let sectionHtml = `<div class="unzipped-section" style="margin-bottom: 30px;">`;

          // Use regex to find the first header tag (h1, h2, or h3) and inject the index + underline
          const indexedHeader = section.toggleText.replace(
            /<(h[1-3])(.*?)>(.*?)<\/\1>/i,
            `<$1 style='margin-bottom: 10px;'>${key < 10 ? "0" + key : key}. <span style='text-decoration: underline;'>$3</span></$1>`,
          );

          sectionHtml += indexedHeader;
          sectionHtml += `</div>`;

          // 2. Add a dotted HR between points (but not after the last one)
          if (index < entries.length - 1) {
            sectionHtml += `<hr style="border: none; border-top: 1.5px dashed green; margin: 40px 0; opacity: 0.3;">`;
          }

          fullViewHtml += sectionHtml;
        });

        detailsDiv.innerHTML = fullViewHtml;
        reattachResizers();
        unzipIcon.style.background = "rgba(100, 200, 100, 0.4)";

        // UI Feedback in the pointsDiv
        pointsDiv.querySelectorAll("span").forEach((s) => {
          s.style.background = "none";
          s.style.fontWeight = "bold";
        });

        showingAll = true;
      } else {
        resetUnzipState();
        if (pointsDiv.firstChild) pointsDiv.firstChild.click();
      }
    });

    const editIcon = document.createElement("img");
    const saveIcon = document.createElement("img");

    editIcon.setAttribute("id", "editIcon");
    saveIcon.setAttribute("id", "saveIcon");

    editIcon.src = "https://img.icons8.com/material-outlined/32/edit--v1.png";
    saveIcon.src = "https://img.icons8.com/material-outlined/32/save.png";
    [editIcon, saveIcon].forEach((icon) =>
      Object.assign(icon.style, {
        top: "10px",
        right: "5vw",
        width: "42px",
        padding: "2px",
        cursor: "pointer",
        position: "fixed",
        borderRadius: "10px",
        background: "rgba(200, 200, 200, 0.8)",
      }),
    );
    saveIcon.style.display = "none";

    let originalNotesSnapshot = "";

    editIcon.onclick = async () => {
      editIcon.style.display = "none";
      saveIcon.style.display = "block";

      let currentNotes = await fetchDecryptedNotes();
      // Normalizing for comparison
      originalNotesSnapshot =
        currentNotes === null || currentNotes === "<p><br></p>"
          ? ""
          : currentNotes;

      window.dispatchEvent(
        new CustomEvent("TRIGGER_EDIT_MODE", {
          detail: { html: originalNotesSnapshot },
        }),
      );
    };

    saveIcon.onclick = () =>
      window.dispatchEvent(new CustomEvent("REQUEST_SAVE_DATA"));

    window.addEventListener("SAVE_DATA_RESPONSE", async (e) => {
      const finalHtml = e.detail.html;
      const normalizedFinal =
        finalHtml === "<p><br></p>" || finalHtml.trim() === "" ? "" : finalHtml;

      if (normalizedFinal === originalNotesSnapshot) {
        throwNotification("error", "No changes detected");

        window.dispatchEvent(new CustomEvent("CLOSE_EDITOR"));
        editIcon.style.display = "block";
        saveIcon.style.display = "none";
        if (unzipIcon) unzipIcon.style.display = "flex";
        if (navWrapper) navWrapper.style.display = "flex";
        if (pointsDiv.firstChild) pointsDiv.firstChild.click();
        return;
      }

      if (await saveNotes(finalHtml)) {
        editIcon.style.display = "block";
        saveIcon.style.display = "none";
        window.dispatchEvent(new CustomEvent("CLOSE_EDITOR"));

        // Re-parse and update the list
        formattedText = parseNotesToUI(finalHtml);
        renderPoints(formattedText);

        if (unzipIcon) unzipIcon.style.display = "flex";
        if (navWrapper) navWrapper.style.display = "flex";
        if (pointsDiv.firstChild) pointsDiv.firstChild.click();

        throwNotification("success", "Saved successfully!");
      }
    });

    if (typeof view !== "undefined" && view != null) {
      document.body.append(
        navWrapper,
        detailsDiv,
        resizerVertical,
        resizerHorizontal,
        resizerCorner,
      );
    } else
      document.body.append(
        unzipIcon,
        editIcon,
        saveIcon,
        navWrapper,
        detailsDiv,
        resizerVertical,
        resizerHorizontal,
        resizerCorner,
      );

    chrome.storage.local.get("preferredWidth", (data) => {
      if (data.preferredWidth) {
        detailsDiv.style.width = data.preferredWidth;
      }
    });

    if (pointsDiv.firstChild) pointsDiv.firstChild.click();

    const style = document.createElement("style");
    style.textContent = `::-webkit-scrollbar { width: 2px; } ::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.1); border-radius: 10px; } #pointsDiv p { display: block; width: 100% !important; }`;
    document.head.appendChild(style);
  })();
}

// AR2: for the JSON BIN page
else if (pageLocation.includes("https://jsonbin.io/app")) {
  chrome.runtime.sendMessage({
    action: "changeTitle",
    newTitle: "LoLé: Changed the UI styling",
  });

  if (pageLocation.includes("app/bins")) {
    document.querySelector(".main-nav").parentElement.style.display = "none";
    document.querySelector(".board").style.width = "90vw";
  }
  document.querySelector("body").style.overflowX = "hidden";
}

// AR3: for reddit pages: add the share icon on reddit page to increase the "Sharing" achievement
else if (
  /^https:\/\/www\.reddit\.com\/(?:\?feed=home|r\/all)?\/?$/.test(pageLocation)
) {
  chrome.runtime.sendMessage({
    action: "changeTitle",
    newTitle: "LoLé: Do the share-task",
  });
  autoShareFeatureForReddit();
}

// captures the DOM changes on an already opened page
(function monitorURLChanges() {
  let previousUrl = window.location.href;

  const observer = new MutationObserver(() => {
    if (window.location.href !== previousUrl) {
      previousUrl = window.location.href;

      // going to the JSON bins page
      if (window.location.href.includes("https://jsonbin.io/app/bins")) {
        document.querySelector(".board").style.width = "90vw";
        document.querySelector(".main-nav").parentElement.style.display =
          "none";
        document.querySelector("body").style.overflowX = "hidden";
      }
      // moving back to the JSON bin dashboard (redo the changes)
      else if (window.location.href.includes("https://jsonbin.io/app/")) {
        document.querySelector(".main-nav").parentElement.style.display =
          "block";
      }
      // to append the auto share feature for the reddit pages
      else if (
        /^https:\/\/www\.reddit\.com\/(?:\?feed=home|r\/all)?\/?$/.test(
          window.location.href,
        )
      )
        autoShareFeatureForReddit();
    }

    // only required to add the UI stylings because event listeners are already attached
    if (
      /^https:\/\/www\.youtube\.com\/(?:results)?(?:\?.*)?$/.test(
        window.location.href,
      ) &&
      alterYTPage
    ) {
      if (!document.querySelector("#overlayMask")) {
        let overlayMask = document.createElement("div");

        Object.assign(overlayMask.style, {
          width: "100%",
          position: "fixed",
          zIndex: baseZIndex,
          visibility: "hidden",
          backdropFilter: "blur(2px)",
          background: "rgba(0, 0, 0, 0.5)",
        });

        const aidSection = document.createElement("div");
        aidSection.setAttribute("id", "aidSection");
        Object.assign(aidSection.style, {
          background: "rgba(200, 200, 200, 0.5)",
          borderRadius: "6px 0 0 6px",
          flexDirection: "column",
          visibility: "hidden",
          position: "absolute",
          display: "flex",
          height: "auto",
          padding: "4px",
          top: "15vh",
          right: "0",
        });

        aidSection.innerHTML = `
            <span class="icon-wrapper" data-info="Wrap/unwrap this info" style="background: rgba(200, 200, 200, 0.7); border-radius: 6px 0 0 6px">
                <img id="mainToggleIcon" src="${chrome.runtime.getURL(
                  "resources/logo_128.png",
                )}" width="50" height="50" style="transition: transform 0.6s; cursor: pointer;" />
            </span>
            <div id="extraIcons" style="display: flex; flex-direction: column; align-items: center; transition: opacity 0.6s; opacity: 1;">
                <span class="icon-wrapper" data-info="Esc: Disable LoLé" style="margin-top: 2vh">
                  <img id="mainToggleIcon" src="https://img.icons8.com/ios-filled/50/esc.png" width="50" height="50" style="transition: transform 0.6s; cursor: pointer;" />
                </span>
                <span class="icon-wrapper" data-info="M key: Toggle mute/unmute" style="margin-top: 2vh">
                    <img src="https://img.icons8.com/ios-filled/50/m-key.png" width="50" height="50" style="cursor: pointer; " />
                </span>
                <span class="icon-wrapper" data-info="C key: Toggle captions" style="margin-top: 2vh">
                    <img src="https://img.icons8.com/ios-filled/50/c-key.png" width="50" height="50" style="cursor: pointer;" />
                </span>
                <span class="icon-wrapper" data-info="P key: Pause/play" style="margin-top: 2vh">
                    <img src="https://img.icons8.com/ios-filled/50/p-key.png" width="50" height="50" style="cursor: pointer;" />
                </span>
                <span class="icon-wrapper" data-info="Left key: Rewind 5s" style="margin-top: 2vh">
                    <img src="https://img.icons8.com/sf-black/50/circled-left-2--v1.png" width="50" height="50" style="cursor: pointer;" />
                </span>
                <span class="icon-wrapper" data-info="Right key: Forward 5s" style="margin-top: 2vh">
                    <img src="https://img.icons8.com/sf-black/50/circled-right-2--v1.png" width="50" height="50" style="cursor: pointer;" />
                </span>
                <span class="icon-wrapper" data-info="Click here to snip the frame" style="margin-top: 2vh">
                    <img id="snipYT" src="https://img.icons8.com/sf-black/50/camera.png" width="50" height="50" style="cursor: pointer"/>
                </span>
            </div>
        `;

        function injectCustomTooltipCSS() {
          if (document.getElementById("aidSectionStyle")) return;

          const style = document.createElement("style");
          style.id = "aidSectionStyle";
          style.textContent = `
            .icon-wrapper {
              position: relative;
              display: inline-flex;
              align-items: center;
              justify-content: center;
            }

            .icon-wrapper:hover::after {
              content: attr(data-info);
              position: absolute;
              right: 125%; 
              top: 50%;
              transform: translateY(-50%);
              background: rgba(30, 30, 30, 0.95);
              color: white;
              font-size: 13px;
              white-space: nowrap;
              pointer-events: none;
              box-shadow: 0 4px 15px rgba(0,0,0,0.4);
              z-index: 10001;
              opacity: 0;
              padding: 4px;
              border-radius: 10px;
              animation: fadeInTooltip 0.2s forwards;
            }

            .icon-wrapper:hover::before {
              content: '';
              position: absolute;
              right: 115%;
              top: 50%;
              transform: translateY(-50%);
              border: 6px solid transparent;
              border-left-color: rgba(30, 30, 30, 0.95);
              pointer-events: none;
              z-index: 10001;
              opacity: 0;
              animation: fadeInTooltip 0.2s forwards;
            }

            @keyframes fadeInTooltip {
              to { opacity: 1; }
            }
          `;
          document.head.appendChild(style);
        }

        injectCustomTooltipCSS();

        let isCollapsed = false;

        async function getYTSnip(e) {
          const ytVideo = document.querySelector('video[src*="youtube"]');
          const ytRect = ytVideo.getBoundingClientRect();

          e.target.closest("span").classList.remove("icon-wrapper");

          ytVideo.pause();

          setTimeout(async () => {
            await downloadWatermarkedSnip({
              x: ytRect.left,
              y: ytRect.top,
              width: ytRect.width,
              height: ytRect.height,
            });

            e.target.closest("span").classList.add("icon-wrapper");

            ytVideo.play();
          }, 1000);
        }

        aidSection.addEventListener(
          "click",
          (e) => {
            // ALWAYS stop propagation here to protect the background stack
            e.stopPropagation();
            e.preventDefault();

            if (e.target.id === "snipYT" || e.target.closest("#snipYT")) {
              getYTSnip(e);
            } else {
              toggleControls();
            }
          },
          true,
        );

        // Move the logic into a named function for cleanliness
        function toggleControls() {
          const extraIcons = aidSection.querySelector("#extraIcons");
          const toggleIcon = aidSection.querySelector("#mainToggleIcon");

          if (!isCollapsed) {
            // collpase the lole info side-panel
            extraIcons.style.display = "none";
            toggleIcon.style.transform = "rotate(360deg)";
            aidSection.style.background = "rgba(100, 100, 100, 0.4)";
            isCollapsed = true;
          } else {
            // EXPAND
            extraIcons.style.display = "flex";
            toggleIcon.style.transform = "rotate(0deg)";
            aidSection.style.background = "rgba(100, 100, 100, 0.7)";
            isCollapsed = false;
          }
        }

        overlayMask.append(aidSection);

        const ytGuide = document.createElement("p");
        Object.assign(ytGuide.style, {
          background: "rgba(200, 200, 200, 0.5)",
          borderRadius: "6px",
          visibility: "hidden",
          position: "absolute",
          fontSize: "1.5rem",
          padding: "6px",
          top: "1vh",
          left: "1vw",
        });

        ytGuide.setAttribute("id", "ytGuide");

        ytGuide.innerHTML =
          "Move your cursor <b>here</b> or to the <b>bookmark bar</b> to exit the preview";

        ytGuide.addEventListener("mouseover", closeExpandedVideoPreview);

        overlayMask.appendChild(ytGuide);

        overlayMask.setAttribute("id", "overlayMask");
        document.body.append(overlayMask);
      }

      videoUIChange();
    }

    // youtube watch page Logic
    if (
      window.location.href.includes("www.youtube.com/watch") &&
      document.body.getAttribute("loleWorking")
    ) {
      if (typeof closeExpandedVideoPreview === "function")
        closeExpandedVideoPreview();
      if (typeof resetToDefaultVideoPreview === "function")
        resetToDefaultVideoPreview();
      chrome.runtime.sendMessage({
        message: "dismissYTMagicForWatchPage",
      });
    }
  });

  observer.observe(document, { subtree: true, childList: true });
})();

// for attaching the youtube lole info sidebar to the preview video tag
(async () => {
  const observer = new MutationObserver((mutations) => {
    // Check for the "New" Video Tag
    const video = document.querySelector('video[src*="youtube"]');
    const aidSection = document.querySelector("#aidSection");

    if (video && aidSection) {
      // Target the second video (the preview one)
      const previewVideo = video;

      // Move aidSection to the preview video's parent
      if (aidSection.parentElement !== previewVideo.parentElement)
        previewVideo.parentElement.appendChild(aidSection);
    }

    if (window.location.pathname.startsWith("/shorts")) {
      aidSection?.style.setProperty("visibility", "hidden");
    }
  });

  // observe document.body to see the new video tag being added
  observer.observe(document.body, {
    childList: true,
    attributes: true,
    subtree: true,
    attributeFilter: ["class"],
  });
})();

// for the youtube utility
let lastYTVideo = null;
let alterYTPage = false;

function closeExpandedVideoPreview() {
  if (!window.location.pathname.startsWith("/shorts"))
    document.body.style.overflow = "auto";

  if (lastYTVideo) {
    Object.assign(lastYTVideo.style, {
      zIndex: 0,
      width: "",
      height: "",
      top: "auto",
      left: "auto",
      marginLeft: "",
      background: "none",
      position: "relative",
      backdropFilter: "none",
    });

    lastYTVideo?.querySelector("#content")?.style.setProperty("width", "auto");

    lastYTVideo = null;
  }

  window.document.removeEventListener("keydown", attachYTCtrls);

  document
    .querySelector("#aidSection")
    ?.style.setProperty("visibility", "hidden");
  document.querySelector("#ytGuide")?.style.setProperty("visibility", "hidden");
}

// for toggling the mute & caption thing for youtube videos
function attachYTCtrls(e) {
  e.preventDefault();
  const activeVideo = document.querySelector('video[src*="youtube"]');

  if (e.key.toLowerCase() == "m")
    document.querySelector("button.ytmMuteButtonButton")?.click();
  else if (e.key.toLowerCase() == "c")
    document.querySelector("button.ytmClosedCaptioningButtonButton")?.click();
  else if (e.key.toLowerCase() == "p" || e.code === "Space") {
    if (activeVideo) {
      if (activeVideo.paused) activeVideo.play();
      else activeVideo.pause();
    }
  } else if (e.key === "ArrowLeft") {
    // Math.max ensures we don't go below 0 seconds
    activeVideo.currentTime = Math.max(0, activeVideo.currentTime - 10);
  } else if (e.key === "ArrowRight") {
    // Math.min ensures we don't exceed the total duration
    activeVideo.currentTime = Math.min(
      activeVideo.duration,
      activeVideo.currentTime + 10,
    );
  }
}

function maxVideoStreamQuality() {
  // to maximize the video quality
  const videoQuality = JSON.parse(localStorage.getItem("yt-player-quality"));
  if (
    !videoQuality ||
    Date.now() > videoQuality.expiration ||
    JSON.parse(videoQuality.data).quality < "1080"
  ) {
    // update only if video quality storage variable is missing/expired/less than the threshold
    localStorage.setItem(
      "yt-player-quality",
      JSON.stringify({
        data: JSON.stringify({ quality: 1080, previousQuality: 720 }),
        creation: Date.now(),
        expiration: Date.now() + 1000 * 60 * 60 * 24 * 365,
      }),
    );
  }
}

function revertPreviewToOriginal(hideAidSection = false) {
  if (hideAidSection && document.querySelector("#aidSection")) {
    document.querySelector("#aidSection").style.visibility = "hidden";
  }

  if (document.getElementById("widthStyle")) {
    // so that the preview don't show up above the header
    document.querySelector("ytd-video-preview").style.zIndex = 1;

    document.head.removeAttribute("changedUI");
    document.getElementById("widthStyle").remove();

    // placing the preview to it's original place
    document.querySelector("ytd-video-preview").style.removeProperty("top");
    document.querySelector("ytd-video-preview").style.removeProperty("left");
  }
}

function changeVideoPreview() {
  document
    .querySelector("#aidSection")
    ?.style.setProperty("visibility", "visible");

  // if the width changing-script is not injected
  if (!document.head.getAttribute("changedUI")) {
    const widthStyle = document.createElement("style");
    widthStyle.setAttribute("id", "widthStyle");
    widthStyle.textContent = `
        ytd-video-preview {
          --ytd-video-preview-height: 90vh !important;
          --ytd-video-preview-width: 90vw !important;
        }
      `;

    document.head.appendChild(widthStyle);
    document.head.setAttribute("changedUI", true);
  }
}

// Only create them once
const shortsHoverLogic = function (event) {
  if (!document.body.getAttribute("loleWorking")) {
    this.removeEventListener("mouseover", shortsHoverLogic);
    return;
  }
  revertPreviewToOriginal(true);
};

const relatedHoverLogic = function (event) {
  if (!document.body.getAttribute("loleWorking")) {
    this.removeEventListener("mouseover", relatedHoverLogic);
    return;
  }

  window.document.addEventListener("keydown", attachYTCtrls);

  changeVideoPreview();

  if (document.head.getAttribute("changedUI")) {
    const preview = document.querySelector("ytd-video-preview");
    if (preview) {
      preview.style.top = `${window.scrollY + window.innerHeight * 0.05}px`;
      preview.style.left = `5vw`;
    }
  }
};

function expandVideoPreview(e) {
  if (!document.body.getAttribute("loleWorking")) return;

  // "featured" section on the main page
  document
    .querySelectorAll("ytd-rich-grid-media .ytd-brand-video-shelf-renderer")
    .forEach((featuredDiv) => {
      // We check if it already has our listener to avoid duplicates
      if (!featuredDiv.dataset.hasHelpListener) {
        featuredDiv.addEventListener("mouseover", relatedHoverLogic);
        featuredDiv.dataset.hasHelpListener = "true"; // Flag it
      }
    });

  document
    .querySelectorAll(
      "grid-shelf-view-model.ytGridShelfViewModelHost .ytGridShelfViewModelGridShelfItem",
    )
    .forEach((shortsDiv) => {
      // We check if it already has our listener to avoid duplicates
      if (!shortsDiv.dataset.hasHelpListener) {
        shortsDiv.addEventListener("mouseover", shortsHoverLogic);
        shortsDiv.dataset.hasHelpListener = "true"; // Flag it
      }
    });

  // "People also search for" section on the results page
  document
    .querySelectorAll("ytd-grid-video-renderer.yt-horizontal-list-renderer")
    .forEach((otherVideos) => {
      if (!otherVideos.dataset.hasHelpListener) {
        otherVideos.addEventListener("mouseover", relatedHoverLogic);
        otherVideos.dataset.hasHelpListener = "true";
      }
    });

  /* 
    ytd-rich-item-renderer is for the main page videos
    ytd-video-renderer is for the search results page
    for the main page, the videos & reels were inside the "ytd-rich-item-renderer" tag,
    but for the "results" page, the reels aren't under the same tag 

    ytd-item-section-renderer is the tag for the shorts feed of results
  */

  const video = e.target.closest("ytd-video-renderer");
  const reel = e.target.closest("ytd-reel-shelf-renderer");

  const item = !window.location.href.includes("results?search_query")
    ? document.querySelector("ytd-rich-item-renderer")
      ? e.target.closest("ytd-rich-item-renderer")
      : video && reel
        ? video.compareDocumentPosition(reel) & Node.DOCUMENT_POSITION_PRECEDING
          ? reel
          : video
        : video || reel
    : video && reel
      ? video.compareDocumentPosition(reel) & Node.DOCUMENT_POSITION_PRECEDING
        ? reel
        : video
      : video || reel;

  // this is to "make the scroll" visible for the "search results" page
  // otherwise, user has to move the mouse out of the window to see the overflow
  if (
    window.location.href.includes("results?search_query") &&
    document.querySelector("ytd-video-preview").hasAttribute("hidden")
  )
    document.body.style.overflow = "auto";

  // if the mouse is outside the video element, it will be NULL
  if (
    item &&
    !item.querySelector("ytd-ad-slot-renderer") &&
    !item.querySelector("ytm-shorts-lockup-view-model-v2")
  ) {
    maxVideoStreamQuality();

    const yOffset = window.scrollY + window.innerHeight * 0.05;
    Object.assign(document.querySelector("ytd-video-preview").style, {
      left: "5vw",
      top: `${yOffset}px`,
      zIndex: baseZIndex + 1,
    });

    changeVideoPreview();

    // for the "results" page, do not change the preview thing
    if (
      document.querySelector("ytd-video-renderer") &&
      window.location.href.includes("results?search_query")
    ) {
      // not having the preview for shorts
      if (item.querySelector("ytd-thumbnail a").href.includes("/shorts")) {
        document.body.style.overflow = "auto";
        document
          .querySelector("#aidSection")
          ?.style.setProperty("visibility", "hidden");
        return revertPreviewToOriginal();
      }

      // hiding the scrollbar for the results page
      document.body.style.overflow = "hidden";

      document
        .querySelector("#aidSection")
        ?.style.setProperty("visibility", "visible");
      return window.document.addEventListener("keydown", attachYTCtrls);
    }

    document.body.style.overflow = "hidden";

    // this works only for the "main page"
    Object.assign(item.style, {
      top: 0,
      left: 0,
      marginLeft: 0,
      width: "100vw",
      height: "100vh",
      position: "fixed",
      zIndex: baseZIndex,
      backdropFilter: "blur(10px)",
      background: "rgba(255,255,255,0.3)",
    });

    Object.assign(item.querySelector(".ytd-rich-item-renderer").style, {
      width: "50%",
      margin: "auto",
      alignItems: "center",
    });

    maxVideoStreamQuality();

    lastYTVideo = item;

    window.document.addEventListener("keydown", attachYTCtrls);

    document
      .querySelector("#aidSection")
      ?.style.setProperty("visibility", "visible");
    document
      .querySelector("#ytGuide")
      ?.style.setProperty("visibility", "visible");
  } else if (item && item.querySelector("ytd-ad-slot-renderer"))
    revertPreviewToOriginal();
  // resetting styles for "shorts feed"
  else if (item && item.querySelector("ytm-shorts-lockup-view-model-v2"))
    revertPreviewToOriginal();
}

function escapeForDismissVideoPreview(e) {
  if (e.key === "Escape") {
    document.body.style.visibility = "hidden";

    closeExpandedVideoPreview();
    resetToDefaultVideoPreview();

    document.querySelector("ytd-video-preview").style.display = "none";

    // TRICK ⭐: doing this small display thing to make the cursor move away from the video
    setTimeout(() => {
      document.querySelector("ytd-video-preview").style.display = "";
      chrome.runtime.sendMessage({ action: "openPopup" });
    }, 10);
  }
}

// highlights & changes styling for video elements
function videoUIChange(runExtension = true) {
  // for youtube's main page
  if (
    document.querySelector("ytd-rich-item-renderer") &&
    !window.location.href.includes("results?search_query")
  ) {
    // Changing the UI style for the main page videos
    document.querySelectorAll("ytd-rich-item-renderer").forEach((el) => {
      if (
        !el.querySelector("ytm-shorts-lockup-view-model-v2") &&
        !el.querySelector("ytd-ad-slot-renderer")
      ) {
        Object.assign(el.style, {
          marginBottom: runExtension ? "5rem" : "",
        });
      }
    });
  }
  //removing the ads from the search results
  else {
    document
      .querySelectorAll("ytd-in-feed-ad-layout-renderer")
      .forEach((ads) => {
        ads?.remove();
      });
  }
}

// to reset the page & undo the extension effects
function resetToDefaultVideoPreview() {
  revertPreviewToOriginal();

  document.querySelector("#widthStyle")?.remove();
  document.removeEventListener("mouseover", expandVideoPreview);
  document.removeEventListener("keydown", escapeForDismissVideoPreview);
  document.removeEventListener("mouseleave", closeExpandedVideoPreview);

  // resetting the styles
  const preview = document.querySelector("ytd-video-preview");

  if (preview) {
    Object.assign(preview.style, {
      top: "",
      left: "",
      zIndex: 1,
    });
  }

  // to make the extension work next time
  document.body.removeAttribute("loleWorking");
  // to add the widthStyle the next time
  document.head.removeAttribute("changedUI");

  alterYTPage = false;
  videoUIChange(false);
}

// for the snip feature
function removeSnipOverlay() {
  const overlay = document.getElementById("snipOverlay");
  const label = document.getElementById("snipLabel");
  const cutout = overlay?.querySelector("div");

  [label, cutout, overlay].forEach((el) => {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  });
}

function escSnipOverlay(e) {
  if (e.key === "Escape") removeSnipOverlay();
}

// download snippets (enire page/custom ones)
async function downloadWatermarkedSnip(
  { x, y, width, height },
  entirePage = false,
) {
  chrome.runtime.sendMessage({ action: "takeSnip" }, async (response) => {
    if (!response || !response.dataUrl) {
      console.log("No image received");
      return;
    }

    const { dataUrl } = response;

    const img = new Image();
    img.onload = async () => {
      if (entirePage) {
        width = img.width;
        height = img.height;
        x = 0;
        y = 0;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      const dpr = window.devicePixelRatio;

      ctx.drawImage(
        img,
        entirePage ? 0 : x * dpr,
        entirePage ? 0 : y * dpr,
        entirePage ? img.width : width * dpr,
        entirePage ? img.height : height * dpr,
        0,
        0,
        width,
        height,
      );

      // give watermark only for non-admin users
      if (!adminAccess) {
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate(-Math.PI / 4);

        const style = document.createElement("style");
        style.textContent = `
        @font-face {
          font-family: 'comfortaa';
          src: url(${chrome.runtime.getURL(
            "resources/Comfortaa.ttf",
          )}) format('truetype');
        }
      `;
        document.head.appendChild(style);

        const baseSize = Math.min(width, height);
        const fontSize = Math.max(16, Math.floor(baseSize / 10));

        await document.fonts.load(`${fontSize}px 'comfortaa'`);

        ctx.font = `${fontSize}px comfortaa`;
        ctx.textAlign = "center";

        const lines = ["Snipped using", "lole"];

        // multiple instances of the watermark
        const positions = [
          // // bottom-left : center : top-right
          { x: -width / 2 + 100, y: -height / 2 + 100 },
          { x: 0, y: 0 },
          { x: width / 2 - 100, y: height / 2 - 100 },
        ];

        lines.forEach((line, i) => {
          const lineHeight = fontSize * 1.2;
          const textWidth = ctx.measureText(line).width;
          const padding = 6;
          const rectHeight = fontSize + 4;

          positions.forEach((pos) => {
            const y = pos.y + i * lineHeight;

            ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
            ctx.fillRect(
              pos.x - textWidth / 2 - padding,
              y - fontSize,
              textWidth + padding * 2,
              rectHeight,
            );

            ctx.fillStyle = "white";
            ctx.fillText(line, pos.x, y);
          });
        });

        ctx.restore();
      }

      const croppedData = canvas.toDataURL("image/png");

      // premium feature: coping the image to the clipboard
      canvas.toBlob((blob) => {
        const item = new ClipboardItem({ "image/png": blob });
        navigator?.clipboard?.write([item]);
      });

      const a = document.createElement("a");
      a.href = croppedData;
      a.download = "lole-snip.png";
      a.click();
    };

    img.src = dataUrl;
  });
}

// use AI to extract the alt while bookmarking the image
async function getImageAltText(srcUrl, ind) {
  const hasPromptAPI = "LanguageModel" in self;

  // the users who have enabled the Prompt API
  if (hasPromptAPI) {
    try {
      // 1. Get the Data URL from the background script
      const { dataUrl, error } = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: "fetchImage", url: srcUrl },
          resolve,
        );
      });

      if (error) throw new Error(error);

      // 2. CRITICAL: Convert Data URL back to a Blob
      const blobResponse = await fetch(dataUrl);
      const imageBlob = await blobResponse.blob();

      // 3. Initialize session with documented schema
      const session = await LanguageModel.create({
        expectedInputs: [
          { type: "text", languages: ["en"] },
          { type: "image" },
        ],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
      });

      // 4. Prompt the AI with the binary Blob
      description = await session.prompt([
        {
          role: "user",
          content: [
            { type: "text", value: "Give a 1-line caption for this image." },
            { type: "image", value: imageBlob },
          ],
        },
      ]);

      console.log(`Generated the caption via Prompt API -> ${description}`);

      session.destroy();
    } catch (err) {
      console.error("AI Captioning Failed:", err);
      description = "";
    }
  }
  // those who don't have Prompt API access
  else {
    const elements = document.querySelectorAll(
      'img, source, [style*="background-image"]',
    );
    let target = Array.from(elements).find(
      (el) =>
        (el.src && el.src === srcUrl) ||
        (el.srcset && el.srcset.includes(srcUrl)) ||
        (el.style.backgroundImage && el.style.backgroundImage.includes(srcUrl)),
    );

    if (!target) return { altText: "Element not found", imageUrl: srcUrl };

    // 1. Standard checks (alt, title, etc.)
    const findText = (el) => {
      return (
        el.getAttribute("alt") ||
        el.getAttribute("aria-label") ||
        el.getAttribute("title") ||
        el.getAttribute("data-description")
      );
    };
    let description = findText(target) || findText(target.parentElement);

    if (!description) {
      const figure = target.closest("figure");
      if (figure && figure.querySelector("figcaption")) {
        description = figure.querySelector("figcaption").innerText.trim();
      }
    }

    console.log(`Generated the caption from the UI -> ${description}`);
  }

  let { image } = await chrome.storage.local.get("image");
  image?.[ind] && (image[ind].altText = description);

  await chrome.storage.local.set({
    image,
  });
}

// message listener for the context menu actions (bookmarking things)
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.context === "bookmarkThings") {
    // handling the auto-scroll feature of saved-images
    if (request.scroll) {
      window.scrollTo({
        top: request.scroll,
        left: 0,
        behavior: "smooth",
      });
      return true;
    }

    let pageTitle = document.title;

    const storageValues = await chrome.storage.local.get();

    let newValues = storageValues;
    let pageLocation = location.href;

    let data = {
      pageTitle: pageTitle,
      pageUrl: request.data.pageUrl,
    };

    let index = "entirePage";

    // selected text and requested to save that
    if (request.message === "text") {
      data["text"] = encodeURIComponent(request.data.selectionText);
      data["scroll"] =
        window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        document.body.scrollTop;
      index = "specificText";
    } else if (request.message === "image") {
      data["scroll"] =
        window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        document.body.scrollTop;
      data["imageUrl"] = request.data.srcUrl;
      data["altText"] = request.data.altText;

      index = "image";
    }

    // checking for duplicacy
    if (index === "specificText") {
      for (let keys in newValues[index]) {
        if (
          newValues[index][keys].pageUrl === request.data.pageUrl &&
          newValues[index][keys].text ===
            encodeURIComponent(request.data.selectionText)
        ) {
          chrome.runtime.sendMessage({ message: "contextDuplicacy" });
          return "Already bookmarked!";
        }
      }
    } else if (index === "image") {
      for (let keys in newValues[index]) {
        if (
          newValues[index][keys].pageUrl === request.data.pageUrl &&
          newValues[index][keys].imageUrl === request.data.srcUrl
        ) {
          chrome.runtime.sendMessage({ message: "contextDuplicacy" });
          return "Already bookmarked!";
        }
      }
    } else {
      for (let keys in newValues[index]) {
        if (newValues[index][keys].pageUrl === request.data.pageUrl) {
          chrome.runtime.sendMessage({ message: "contextDuplicacy" });
          return "Already bookmarked!";
        }
      }
    }

    if (index === "image") {
      getImageAltText(data["imageUrl"], newValues[index].length);
      data.altText = "";
    }

    newValues[index][newValues[index].length] = data;
    await chrome.storage.local.set({
      entirePage: newValues.entirePage,
      specificText: newValues.specificText,
      image: newValues.image,
    });

    chrome.runtime.sendMessage({ message: "saved" });
  } else {
    // boolean to change the icon later
    pageLocation = location.href;

    // UR1 (utility run): send back the page location to popup.js
    if (request.action === "getLocation") {
      await makeTheExtensionWork(pageLocation, sendResponse);
    }

    // UR2: for the capture_screen thing
    else if (request.action === "prepareSnipArea") {
      // trigerred from the "action" contextmenu
      if (request.fullPageSnip) {
        downloadWatermarkedSnip({}, true);
        return;
      }

      // logic for particular page-area snippet
      let overlay = document.getElementById("snipOverlay");
      if (overlay) {
        removeSnipOverlay();
        return;
      }

      overlay = document.createElement("div");
      overlay.id = "snipOverlay";
      Object.assign(overlay.style, {
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        position: "fixed",
        cursor: "crosshair",
        zIndex: baseZIndex + 2,
        backdropFilter: "blur(4px)",
      });
      document.body.appendChild(overlay);

      // to exit fullscreen mode
      if (document.fullscreenElement && document.visibilityState === "visible")
        document.exitFullscreen();

      let snipCutout = null;
      let label = null;
      let startX = 0,
        startY = 0;

      document.addEventListener("keydown", escSnipOverlay, {
        once: true,
      });

      overlay.addEventListener("mousedown", async (e) => {
        if (snipCutout) snipCutout.remove();
        if (label) label.remove();

        startX = e.clientX;
        startY = e.clientY;

        snipCutout = document.createElement("div");
        Object.assign(snipCutout.style, {
          position: "absolute",
          borderRadius: "4px",
          pointerEvents: "none",
          backdropFilter: "none",
          zIndex: baseZIndex + 3,
          background: "transparent",
          border: "2px dashed rgba(34, 127, 232, 0.8)",
        });
        overlay.appendChild(snipCutout);

        label = document.createElement("div");
        label.setAttribute("id", "snipLabel");
        Object.assign(label.style, {
          color: "white",
          fontSize: "12px",
          padding: "2px 4px",
          borderRadius: "4px",
          position: "absolute",
          pointerEvents: "none",
          zIndex: baseZIndex + 4,
          background: "rgba(0, 0, 0, 0.6)",
        });
        overlay.appendChild(label);

        const move = (e) => {
          const x = Math.min(e.clientX, startX);
          const y = Math.min(e.clientY, startY);
          const w = Math.abs(e.clientX - startX);
          const h = Math.abs(e.clientY - startY);
          snipCutout.style.left = `${x}px`;
          snipCutout.style.top = `${y}px`;
          snipCutout.style.width = `${w}px`;
          snipCutout.style.height = `${h}px`;

          label.textContent = `${w} × ${h} px`;

          // place the label at the top left corner
          label.style.left = `${x + 5}px`;
          label.style.top = `${y + 5}px`;
        };

        const up = (e) => {
          document.removeEventListener("mousemove", move);
          document.removeEventListener("mouseup", up);
          const endX = e.clientX;
          const endY = e.clientY;
          const x = Math.min(startX, endX);
          const y = Math.min(startY, endY);
          const width = Math.abs(endX - startX);
          const height = Math.abs(endY - startY);

          snipCutout.style.backdropFilter = "none";
          snipCutout.style.background = "transparent";
          snipCutout.style.pointerEvents = "none";

          // cutout is very small (not processing it)
          if (width < 20 || height < 20) {
            snipCutout?.remove();
            label?.remove();
            overlay?.remove();
            return;
          }

          [label, overlay, snipCutout].forEach((el) => {
            if (el && el.parentNode) el.parentNode.removeChild(el);
          });

          // double frame flush + slight delay before capturing to ensure the overlays are removed
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setTimeout(() => {
                downloadWatermarkedSnip({ x, y, width, height });
              }, 30);
            });
          });
        };

        document.addEventListener("mousemove", move);
        document.addEventListener("mouseup", up);
      });
    }

    // UR3: for escaping the youtube preview
    else if (request.action === "completeEscapeForYoutube") {
      closeExpandedVideoPreview();
      resetToDefaultVideoPreview();

      document.body.style.visibility = "visible";
    }

    // UR4: for the logi plugin things
    else if (request.action === "chrome_profiles") {
      chrome_profiles(request);
    }

    // UR5: editing the notes via logitech plugin
    else if (request.action === "EDIT_NOTES") {
      if (
        pageLocation.includes(`${defaultLandingPage}/notes.html`) &&
        document.getElementById("editIcon")?.style.display != "none"
      )
        document.getElementById("editIcon").click();
    }

    // UR6: saving the notes via logitech plugin
    else if (request.action === "SAVE_NOTES") {
      if (
        pageLocation.includes(`${defaultLandingPage}/notes.html`) &&
        document.getElementById("saveIcon")?.style.display != "none"
      )
        document.getElementById("saveIcon").click();
    }

    // UR7: Logi overlay
    else if (request.action === "showLogiOverlay") {
      showLogiOverlay();
    }
  }

  return true;
});
