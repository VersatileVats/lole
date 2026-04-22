(async () => {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });

  const source = new URL(location.href).searchParams.get("clickSource");

  // called to dismiss youtube's preview mode by pressing ESC key
  if (source === "autoViaBgdSript") {
    chrome.action.setPopup({ popup: "popup.html" });
    chrome.tabs.sendMessage(tab.id, {
      action: "completeEscapeForYoutube",
    });
    return setTimeout(() => window.close(), 5);
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: "getLocation",
    });

    if (response.location == "defaultLandingPage") {
      chrome.runtime.sendMessage({ message: "openPage" }).then((response) => {
        window.close();
      });
    }
  } catch (err) {
    chrome.runtime.sendMessage({ message: "openPage" }).then((response) => {
      window.close();
    });
  }

  // giving sometime to do the processing
  // directly using: window.close will not do anything (quick timeout)
  setTimeout(() => window.close(), 5);
})();
