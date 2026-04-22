const defaultLandingPage = "https://versatilevats.com/lole";

function openBookmarks(urls) {
  let tabIds = [];

  // exit if there are no links to open
  if (urls.length == 0) return;

  // Function to create a group and add tabs to it
  function groupTabs(tabIds) {
    chrome.tabs.group({ tabIds }, (groupId) => {
      chrome.tabGroups.update(
        groupId,
        { title: "LoLé Bookmarks", color: "blue", collapsed: true },
        () => {
          chrome.tabs.update(tabIds[0], { active: true }, (tab) => {});
          chrome.tabGroups.move(groupId, { index: -1 });
        },
      );
    });
  }

  // Create each tab and collect their IDs
  urls.forEach((url) => {
    chrome.tabs.create({ url: url, active: false }, (tab) => {
      tabIds.push(tab.id);

      // When all tabs are opened, group them
      if (tabIds.length === urls.length) {
        groupTabs(tabIds);
      }
    });
  });
}

async function gatherSinglePageBookmarks() {
  const data = await chrome.storage.local.get(["entirePage"]);
  const bookmarkedPages = data.entirePage;
  if (bookmarkedPages) {
    let urls = [];
    Object.values(bookmarkedPages).forEach((item) => {
      if (Array.isArray(item)) {
        item.forEach((page) => {
          if (page.pageUrl) urls.push(page.pageUrl);
        });
      } else if (item && item.pageUrl) {
        urls.push(item.pageUrl);
      }
    });
    if (urls.length > 0) openBookmarks(urls);
    else
      chrome.notifications.create({
        type: "basic",
        iconUrl: "../resources/logo_128.png",
        title: "",
        message:
          "You have not bookmarked any single page. Use this feature, once you have some bookmarked pages",
      });
  }
}

function enableFocusMode() {
  chrome.tabs.query({}, function (tabs) {
    const logiTabs = tabs.filter((tab) => tab.url.includes("logitech"));
    if (logiTabs.length == 0) {
      chrome.notifications.create({
        type: "basic",
        title: "",
        iconUrl: "../resources/logo_128.png",
        message: `First, open some Logitech-related pages, and only then, you can use Focus Mode`,
      });
    } else {
      const tabIds = logiTabs.map((tab) => tab.id);

      // Create a group for all the Logitech tabs in the new window and name it "Focus Mode"
      chrome.tabs.group({ tabIds: tabIds }, function (groupId) {
        chrome.tabGroups.update(
          groupId,
          {
            title: "Focus mode for Logitech",
            collapsed: true,
            color: "green",
          },
          () => {
            chrome.tabs.update(tabIds[0], { active: true }, (tab) => {});
            chrome.tabGroups.move(groupId, { index: -1 });
          },
        );
      });
    }
  });
}

function openPage(pageToOpen, scroll = null) {
  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    // 1. Check if the page is already open
    let existingTab = tabs.find(
      (t) => t.url.replace(/\/$/, "") === pageToOpen.replace(/\/$/, ""),
    );

    if (existingTab) {
      chrome.tabs.update(existingTab.id, { active: true }, () => {
        if (scroll) {
          setTimeout(() => {
            chrome.tabs.sendMessage(existingTab.id, {
              scroll,
              context: "bookmarkThings",
            });
          }, 150);
        }
      });
      return;
    }

    // 2. Identify ALL empty tabs
    const emptyTabs = tabs.filter(
      (t) =>
        t.url === "chrome://newtab/" || t.url === "about:blank" || t.url === "",
    );

    if (emptyTabs.length > 0) {
      // Use the first one for our page
      const tabToUse = emptyTabs[0];
      chrome.tabs.update(
        tabToUse.id,
        { url: pageToOpen, active: true },
        (tab) => {
          handleScrollOnLoad(tab.id, scroll);
        },
      );

      // Delete all the OTHER empty tabs
      const tabsToRemove = emptyTabs.slice(1).map((t) => t.id);
      if (tabsToRemove.length > 0) {
        chrome.tabs.remove(tabsToRemove);
      }
    } else {
      // 3. No empty tabs at all, create a new one
      chrome.tabs.create({ url: pageToOpen }, (newTab) => {
        handleScrollOnLoad(newTab.id, scroll);
      });
    }
  });
}

// Reusable helper to wait for load completion before scrolling
function handleScrollOnLoad(tabId, scroll) {
  if (!scroll) return;

  const listener = (updatedTabId, changeInfo) => {
    if (updatedTabId === tabId && changeInfo.status === "complete") {
      chrome.tabs.onUpdated.removeListener(listener);
      // Ensure the content script has a moment to initialize
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { scroll, context: "bookmarkThings" });
      }, 200);
    }
  };
  chrome.tabs.onUpdated.addListener(listener);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "serverCall") {
    serverCall(request.data, request.endpoint).then(sendResponse);
    return true;
  }
  if (request.action === "fetchImage") {
    fetch(request.url)
      .then((r) => r.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => sendResponse({ dataUrl: reader.result });
        reader.readAsDataURL(blob);
      })
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (request.message === "getOrderedGoogleAccounts") {
    getOrderedGoogleAccounts().then((accounts) => {
      sendResponse({ gmailAccounts: accounts });
    });
    return true;
  }
  if (request.action === "takeSnip") {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      sendResponse({ dataUrl });
    });
    return true;
  }
  if (request.action === "OPEN_PROFILE") {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "OPEN_PROFILE",
          profilePath: request.profilePath,
        }),
      );
    } else {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "../resources/logo_128.png",
        title: "",
        message:
          "You are not connected to the Logitech Plugin's websocket! Restart the browser/check Logi Options+ app",
      });
    }
    return true;
  }

  // --- SYNCHRONOUS ACTIONS (Do not return true) ---

  if (request.message == "contextDuplicacy") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "../resources/logo_128.png",
      title: "🚫 Duplicate Entity!",
      message: "You have bookmarked this particular entity already.",
    });
  } else if (request.message == "saved") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "../resources/logo_128.png",
      title: "🎉 Saved!",
      message: "The entity has been saved successfully",
    });
  }
  // to inform the user about the wrong view link
  else if (request.message == "wrongViewLink") {
    chrome.tabs.remove(sender.tab.id);
    chrome.notifications.create({
      type: "basic",
      iconUrl: "../resources/logo_128.png",
      title: "🚫 Wrong share ID!",
      message: "This is a wrong share ID, provide a correct one",
    });
  }
  // for successful copying of share link
  else if (request.message == "shareLinkCopied") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "../resources/logo_128.png",
      title: "🥳 Share link copied!",
      message:
        "Data synced! Now your friend can see your saved stuff in his/her own browser",
    });
  }
  // problem in generating the share link
  else if (request.message == "shareLinkError") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "../resources/logo_128.png",
      title: "🚫 Wrong share ID!",
      message: "Some error occured! Try again to sync",
    });
  }
  // error in deleting the files
  else if (request.message == "deleteFileError") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "../resources/logo_128.png",
      title: "🚫 Some error occured!",
      message: request.errorMessage || "Couldn't delete the file, try again",
    });
  }
  // to separate logitech tabs into a new window and group them under "Focus Mode"
  else if (request.message == "startFocusMode") {
    enableFocusMode();
  }
  // open/shift to the landing/particular page
  else if (request.message == "openPage") {
    openPage(
      request.customPage ? request.customPage : defaultLandingPage,
      request.scroll ? request.scroll : null,
    );
  }
  // to initmate the user about how to proceed on the youtube page
  else if (request.message == "youtubeTutorial") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "../resources/logo_128.png",
      title: "Youtube autoplay ✨",
      message: "Hover over any video to see the magic!",
    });
  }
  // went to the watch page when "Youtube Magic" was enabled
  else if (request.message == "dismissYTMagicForWatchPage") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "../resources/logo_128.png",
      title: "🚫 Youtube magic disabled ✨",
      message: "It can't run on watch pages!",
    });
  }
  // setting the right zoom
  else if (request.action === "scaleUp") {
    chrome.tabs.setZoom(sender?.tab?.id, request.targetZoom);
  }
  // for changing the extension title (on hover)
  else if (request.action === "changeTitle") {
    chrome.action.setTitle({
      title: request?.newTitle ?? "NA",
      tabId: sender.tab.id,
    });
  }
  // being called after ESC is pressed on the youtube page
  else if (request.action === "openPopup") {
    chrome.action.setPopup({
      popup: "popup.html?clickSource=autoViaBgdSript",
    });

    chrome.action.openPopup();
  }
});

// allows content scripts to access the session storage (using for the shared stuff)
chrome.storage.session.setAccessLevel({
  accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS",
});

/*
  VeB stuff:
  Includes stuff
*/

// utility function: to call content script message handlers
function runContentScript(action, extraDetails = {}) {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    // 1. Hard Guard: If no tab is found (e.g. system focus)
    if (!tab || !tab.id || !tab.url) return;

    // 2. Protocol Guard: These URLs NEVER support content scripts
    // This is the #1 reason for the "Receiving end does not exist" error
    const forbiddenProtocols = [
      "chrome:",
      "edge:",
      "about:",
      "chrome-extension:",
      "view-source:",
    ];
    const isForbidden = forbiddenProtocols.some((proto) =>
      tab.url.startsWith(proto),
    );

    // 3. Status Guard: Don't send if the page hasn't finished loading
    const isReady = tab.status === "complete";

    if (isForbidden || !isReady) {
      console.log("LoLé: Extension restricted on this page. Redirecting...");
      handleRestrictedPage();
      return;
    }

    // 4. Final Safety: Use a 'ping' to verify content script injection
    chrome.tabs.sendMessage(tab.id, { action: "ping" }, (response) => {
      // By checking lastError IMMEDIATELY, we satisfy the browser's error handling
      if (chrome.runtime.lastError) {
        handleRestrictedPage();
        return;
      }

      // Connection confirmed, proceed with the actual action
      chrome.tabs.sendMessage(tab.id, { action, ...extraDetails }, () => {
        if (chrome.runtime.lastError) return;
      });
    });
  });
}

function handleRestrictedPage() {
  // Check if we are already in the popup or background to avoid infinite loops;
  chrome.notifications.create({
    type: "basic",
    iconUrl: "../resources/logo_128.png",
    title: "🚫 Restricted Page!",
    message:
      "Browser's internal pages restricts the extension. On normal webpage, try again & everything will work just fine!",
  });

  openPage(defaultLandingPage);
}

const serverCall = async (data, endpoint) => {
  const requestOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    redirect: "follow",
  };

  try {
    let url = endpoint;

    if (endpoint === "deleteFile") {
      url = `${defaultLandingPage}/server.php?action=unlink&file=${encodeURIComponent(data)}`;
    }
    // upload the file
    else if (endpoint === "uploadFile") {
      url = `${defaultLandingPage}/server.php?action=uploadFile`;

      const blobResponse = await fetch(data.fileData);
      const fileBlob = await blobResponse.blob();

      let formdata = new FormData();

      formdata.append("uploadedFile", fileBlob, data.fileName);
      formdata.append("code", data.code);

      requestOptions.body = formdata;
      delete requestOptions.headers["Content-Type"];
    }
    // saving the notes
    else if (endpoint === "saveNotes") {
      url = `${defaultLandingPage}/server.php?action=saveNotes&code=${data.code}`;

      // Create FormData and append the notes
      const formdata = new FormData();
      formdata.append("notes", data.notes);

      requestOptions.body = formdata;
      delete requestOptions.headers["Content-Type"];
    }
    // for gettig the notes
    else if (endpoint === "sendNotes") {
      url = `${defaultLandingPage}/server.php?action=sendNotes&code=${data.code}`;
    }
    // creating the notes file when the extension is installed
    else if (endpoint === "createNoteFile") {
      url = `${defaultLandingPage}/server.php?action=createNoteFile&code=${encodeURIComponent(data.noteID)}`;
    }
    // for the standard shared view calls
    else {
      // for standard calls, include the body
      requestOptions.body = JSON.stringify(data);
    }

    // console.log("Making server call to:", url, "with options:", requestOptions);

    const response = await fetch(url, requestOptions);

    // check for HTTP errors
    if (!response.ok) {
      // Get the error message
      const errorJson = await response.json().catch(() => ({}));

      return {
        status: "error",
        message:
          errorJson.message || `Server responded with ${response.status}`,
      };
    }

    return {
      status: "success",
      data: await response.json(),
    };
  } catch (error) {
    return {
      status: "error",
      message: error?.message,
    };
  }
};

// registering the context menus (right-clicks)
chrome.runtime.onInstalled.addListener(() => {
  // selection item: saveSpecificText
  chrome.contextMenus.create({
    id: "saveSpecificText",
    title: "Bookmark specific text",
    contexts: ["selection"],
    documentUrlPatterns: ["https://*/*"],
  });

  // image item: saveImage
  chrome.contextMenus.create({
    id: "saveImage",
    title: "Save image",
    contexts: ["image"],
    documentUrlPatterns: ["https://*/*"],
  });

  // page item: savePage
  chrome.contextMenus.create({
    id: "savePage",
    title: "Bookmark entire page",
    contexts: ["page"],
    documentUrlPatterns: ["https://*/*"],
  });

  // action item: openNotes
  chrome.contextMenus.create({
    id: "openNotes",
    title: "Open notes",
    contexts: ["action"],
  });

  // action item: openBookmarks
  chrome.contextMenus.create({
    id: "openBookmarks",
    title: "Open bookmarks",
    contexts: ["action"],
  });

  // for the snip thing
  chrome.contextMenus.create({
    id: "fullPageSnip",
    title: "Take entire page snip",
    contexts: ["action", "page"],
    documentUrlPatterns: ["https://*/*"],
  });

  // action item: customSnip
  chrome.contextMenus.create({
    id: "customSnip",
    title: "Take custom snip of the page",
    contexts: ["action", "page"],
    documentUrlPatterns: ["https://*/*"],
  });
});

// even handler for full snip context
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const { menuItemId } = info;

  // Handle Snipping Actions
  if (menuItemId === "fullPageSnip" || menuItemId === "customSnip") {
    runContentScript("prepareSnipArea", {
      fullPageSnip: menuItemId === "fullPageSnip",
    });
    return;
  }

  if (menuItemId === "openNotes") {
    openPage(`${defaultLandingPage}/notes.html`);
  }

  // Handle Bookmark Opening
  if (menuItemId === "openBookmarks") {
    await gatherSinglePageBookmarks();
    return;
  }

  // Handle Saving/Messaging Content
  let message = "";
  if (menuItemId === "saveSpecificText") message = "text";
  else if (menuItemId === "saveImage") message = "image";
  else if (menuItemId === "savePage") message = "page";

  // grab the image alt text (if it is there)
  if (message === "image") {
    chrome.tabs.sendMessage(tab.id, {
      message,
      data: info,
      context: "bookmarkThings",
    });
  } else if (message !== "") {
    chrome.tabs.sendMessage(tab.id, {
      message,
      data: info,
      context: "bookmarkThings",
    });
  }
});

// command handler for the manifest
chrome.commands.onCommand.addListener((command) => {
  // for the snip thing
  if (command === "capture_screen") {
    runContentScript("prepareSnipArea", {
      fullPageSnip: false,
    });
  }
});

// generates a 31-36 character UUID
function generateUUID() {
  return ([1e7] + -1e3 + -4e3 + -8e2 + -1e11).replace(/[018]/g, (c) =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16),
  );
}

// on-install operations
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    const uniqueId = generateUUID();

    chrome.identity.getProfileUserInfo({ accountStatus: "ANY" }, (userInfo) => {
      chrome.storage.local.set({
        code: uniqueId,
        email: userInfo.email,
      });
    });

    // create the notes file
    serverCall({ noteID: uniqueId }, "createNoteFile");
  } else if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
  }
});

(async () => {
  console.log(
    "LanguageModel" in self,
    "Translator" in self,
    "LanguageDetector" in self,
    "Summarizer" in self,
  );
  console.log(await LanguageModel?.params());
})();

// for tracking the recent tab
let previousTabId = null;
let currentTabId = null;

// Track tab switching
chrome.tabs.onActivated.addListener((activeInfo) => {
  previousTabId = currentTabId;
  currentTabId = activeInfo.tabId;
});

// handle tab closure so you don't try to navigate to a ghost tab
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === previousTabId) {
    previousTabId = null;
  }
});

// for communication with the C# app via websockets
let socket;

function connect() {
  socket = new WebSocket("ws://localhost:12345");

  socket.onopen = async () => {
    console.log("Connected to the Logi Plugin");

    chrome.identity.getProfileUserInfo(
      { accountStatus: "ANY" },
      function (userInfo) {
        // Fallback if not logged in
        let userEmail = userInfo.email || "Local Profile";

        // Send the email to C# instead of the unknown path
        socket.send(
          JSON.stringify({
            type: "ping",
            email: userEmail,
          }),
        );
      },
    );
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    const type = data?.type;
    console.log("Message from server:", data);

    switch (type) {
      /* ============================================= 
        invoking plugin's websocket server to get info  
      ============================================== */

      // Asks Chrome to bring the most recently used window of THIS profile to the front
      case "FOCUS_BROWSER":
        chrome.windows.getLastFocused(function (win) {
          // Clear the lastError to prevent the console warning
          if (chrome.runtime.lastError) {
            console.log("No focused window found, creating a new one.");
          }

          // If a window exists, bring it to the front
          if (win && win.id) {
            chrome.windows.update(win.id, {
              focused: true,
              state: "maximized",
            });
          }
          // If no window exists, force Chrome to open a new one for this profile!
          else {
            chrome.windows.create({ focused: true, state: "maximized" });
          }
        });
        break;

      case "FULL_PAGE_SNIP":
        runContentScript("prepareSnipArea", {
          fullPageSnip: true,
        });
        break;

      case "CUSTOM_PAGE_SNIP":
        runContentScript("prepareSnipArea", {
          fullPageSnip: false,
        });
        break;

      case "OPEN_NOTES":
        openPage(`${defaultLandingPage}/notes.html`);
        break;

      case "EDIT_NOTES":
        runContentScript("EDIT_NOTES");
        break;

      case "SAVE_NOTES":
        runContentScript("SAVE_NOTES");
        break;

      case "OPEN_SINGLE_PAGE_BOOKMARKS":
        gatherSinglePageBookmarks();
        break;

      case "FOCUS_MODE":
        enableFocusMode();
        break;

      case "LOGI_OVERLAY":
        runContentScript("showLogiOverlay");
        break;

      case "TOGGLE_PIN":
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (tab) {
          const newPinnedState = !tab.pinned;
          await chrome.tabs.update(tab.id, { pinned: newPinnedState });
        }
        break;

      case "OPEN_RECENT_TAB":
        if (!previousTabId) {
          chrome.notifications.create({
            type: "basic",
            iconUrl: "../resources/logo_128.png",
            title: "",
            message:
              "Could not navigate to recent tab. It may have been closed",
          });
          return;
        }

        try {
          // Switch focus back to the previous tab
          await chrome.tabs.update(previousTabId, { active: true });
        } catch (error) {
          // if tab was closed but onRemoved hadn't fired yet
          chrome.notifications.create({
            type: "basic",
            iconUrl: "../resources/logo_128.png",
            title: "",
            message:
              "Could not navigate to recent tab. It may have been closed",
          });
          previousTabId = null;
        }
        break;

      /* =================== 
        C# specific commands  
      ==================== */

      case "GET_CHROME_PROFILES":
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "GET_CHROME_PROFILES" }));
        } else {
          chrome.notifications.create({
            type: "basic",
            iconUrl: "../resources/logo_128.png",
            title: "",
            message:
              "You are not connected to the Logitech Plugin's websocket! Restart the browser/check Logi Options+ app",
          });
        }
        break;

      /* ============================================= 
        handling the results of the plugin interactions  
      ============================================== */
      case "CHROME_PROFILES_RESULT":
        runContentScript("chrome_profiles", data);
        break;

      default:
        break;
    }
  };

  socket.onclose = () => {
    console.log("Socket closed. Reconnecting...");
    setTimeout(connect, 3000); // auto-reconnect
  };
}

connect();

// Create an alarm every 20 seconds to keep the worker from hibernating
chrome.alarms.create("keepAlive", { periodInMinutes: 0.3 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAlive") {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      connect(); // Reconnect if closed
    } else {
      console.log("Checking the websocket connection");
    }
  }
});

// explicitly doing this, because sometimes Preefrence folder in Google Chrome do not give the properly arranged gmail accounts
async function getOrderedGoogleAccounts() {
  try {
    const html = await (
      await fetch("https://accounts.google.com/SignOutOptions")
    ).text();
    return [
      ...new Set(
        html
          .match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
          .filter((email) => !email.startsWith("account-")),
      ),
    ];
  } catch (error) {
    return [];
  }
}
