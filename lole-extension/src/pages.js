function processDiscordDate(discordId) {
  const DISCORD_EPOCH = 1420070400000n;
  const idBig = BigInt(discordId);
  const timestampMs = (idBig >> 22n) + DISCORD_EPOCH;
  const createdAt = new Date(Number(timestampMs));

  // 3) Format readable format
  const pad = (n) => n.toString().padStart(2, "0");

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const hours24 = createdAt.getHours();
  const minutes = createdAt.getMinutes();
  const isAM = hours24 < 12;
  const hours12 = hours24 % 12 || 12;

  const label =
    months[createdAt.getMonth()] +
    " " +
    createdAt.getDate() +
    ", " +
    createdAt.getFullYear() +
    " " +
    hours12 +
    ":" +
    pad(minutes) +
    " " +
    (isAM ? "AM" : "PM");

  return label;
}

// called from the content.js page
async function makeTheExtensionWork(pageLocation, sendResponse) {
  let extensionWillRun = false;

  // MR1: Edudel (filling up the marks & checking the box)
  if (
    pageLocation.includes("https://edustud.nic.in/DirectorateOfEducation.htm")
  ) {
    extensionWillRun = true;

    let usernameFrame = document.querySelector('frame[name="leftFrame"]');
    let usernameFrameDoc = null;

    usernameFrameDoc =
      usernameFrame.contentDocument || usernameFrame.contentWindow.document;

    const frame = document.querySelector('frame[name="mainFrame"]');
    let frameDoc = null;

    // Access the frame's document
    if (frame) {
      frameDoc = frame.contentDocument || frame.contentWindow.document;

      // when we are on the MARKS UPDATION page
      if (frameDoc.querySelector("#tblmarksdetails tbody")) {
        // only proceeding once the iframe is found (populated)
        const username = usernameFrame
          ? usernameFrameDoc
              .querySelector("#MainIndex1")
              .textContent.trim()
              .split(",")[1]
              .split("(")[0]
          : "teacher";

        // turn off the autocomplete feature
        frameDoc
          .querySelectorAll("input")
          .forEach((input) => (input.autocomplete = "off"));

        let inputs = frameDoc.querySelector("#tblmarksdetails tbody")
          .children[2];

        let marks = prompt(
          `👋 ${username}, enter the marks like this: 54 56 50 (separate them with spaces)\n\nA for absent, M for medical, L for late, S for sports`,
        );
        marks = marks && marks !== "" ? marks.split(" ") : [];

        const alreadySerializedStudents = inputs
          .querySelectorAll("table tr")[1]
          .querySelector("td")
          .innerHTML.trim()
          .split(">")[1]
          .trim();

        // putting in the checkmark, count, & marks
        Array.from(inputs.querySelectorAll("table tr")).forEach((el, ind) => {
          if (ind > 0) {
            // stopping double indexing & checking in
            if (!alreadySerializedStudents) {
              el.querySelector("td").innerHTML += `${ind}`;
              el.querySelector("td input").checked = true;
            }
            if (marks[ind - 1])
              el.querySelectorAll("td")[3].querySelector("input").value =
                marks[ind - 1];
          }
        });
      }

      // when we are on the Marks List page (have to take screenshot)
      else if (frameDoc.querySelector("form[name='form1']")) {
        Object.assign(frameDoc.querySelector("form[name='form1']").style, {
          width: "45vw",
          margin: "auto",
        });

        let marksTable = frameDoc.querySelector(
          "#form1 > p:nth-child(4) > table.Mistable",
        );

        const cells = marksTable.querySelectorAll("table td, table th");

        // Loop through and set the textAlignment
        cells.forEach((cell) => {
          cell.style.textAlign = "left";
        });
      }
    }
  }

  // MR2: OTTPlay page
  else if (pageLocation.includes("https://www.ottplay.com")) {
    if (document.body.getAttribute("helpBuddyEvent")) return;

    extensionWillRun = true;

    document.body.addEventListener("keydown", (e) => {
      document.body.setAttribute("helpBuddyEvent", true);
      if (e.key == "ArrowRight" && document.querySelector(".forwardBtn"))
        document.querySelector(".forwardBtn").click();
      else if (e.key == "ArrowLeft" && document.querySelector(".rewindBtn"))
        document.querySelector(".rewindBtn").click();
      // for space
      else if (
        e.key === " " &&
        (document.querySelector(".playBtn") ||
          document.querySelector(".pauseBtn"))
      )
        document.querySelector(".playBtn")
          ? document.querySelector(".playBtn").click()
          : document.querySelector(".pauseBtn").click();
      else if (
        (e.key == "F" || e.key == "f") &&
        (document.querySelector(".fullScreen") ||
          document.querySelector(".exitFullScreen"))
      )
        document.querySelector(".fullScreen")
          ? document.querySelector(".fullScreen").click()
          : document.querySelector(".exitFullScreen").click();
      else if (
        (e.key == "M" || e.key == "m") &&
        (document.querySelector(".volumeIcon") ||
          document.querySelector(".volumeMuteIcon"))
      )
        document.querySelector(".volumeIcon")
          ? document.querySelector(".volumeIcon").click()
          : document.querySelector(".volumeMuteIcon").click();
    });
  }

  // MR3: Auto-scrolling the reddit page
  else if (
    /^https:\/\/www\.reddit\.com(?:\/(?:\?feed=home|r\/all|r\/popular))?\/?$/.test(
      pageLocation,
    )
  ) {
    chrome.runtime.sendMessage({
      action: "changeTitle",
      newTitle: "LoLé: Can auto scroll the posts",
    });

    extensionWillRun = true;

    // script for utility
    if (!document.querySelector("#notification")) {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("src/aid.js");
      document.documentElement.appendChild(script);
    }

    // checking whether the scroll event is already there or not?
    if (document.body.getAttribute("help-buddy-scrollEventID")) {
      clearInterval(document.body.getAttribute("help-buddy-scrollEventID"));
      document.querySelector("#scrollDiv").style.background =
        "rgba(200, 0, 00, 0.3)";
      return document.body.removeAttribute("help-buddy-scrollEventID");
    }

    let scrollCount = document.querySelector("#scrollCount")
      ? Number(document.querySelector("#scrollCount").textContent)
      : 0;
    let totalPostsTraversed = document.querySelector("#totalPostsTraversed")
      ? Number(document.querySelector("#totalPostsTraversed").textContent)
      : 0;

    let nav, scrollCountDiv;

    if (!document.querySelector("#scrollDiv")) {
      nav = document.querySelector("nav");
      scrollCountDiv = document.createElement("div");
      scrollCountDiv.setAttribute("id", "scrollDiv");
      Object.assign(scrollCountDiv.style, {
        padding: "0 4px",
        borderRadius: "10px",
        background: "rgba(0, 200, 00, 0.3)",
      });
      // Insert as the second child
      nav.insertBefore(scrollCountDiv, nav.children[1] || null);
    } else scrollCountDiv = document.querySelector("#scrollDiv");

    document.querySelector("#scrollDiv").style.background =
      "rgba(0, 200, 00, 0.3)";

    let scrollEventID = setInterval(() => {
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth",
      });
      scrollCount++;
      let newPosts = document.querySelectorAll("shreddit-feed > article");
      totalPostsTraversed += newPosts.length;

      let articlesToRemove = document.querySelectorAll(
        "shreddit-feed > article",
      );

      // Remove all ad posts before processing new articles
      document
        .querySelectorAll("shreddit-ad-post")
        .forEach((ad) => ad.remove());

      // Remove all of the chats
      document
        .querySelectorAll("chat-feed-element-wrapper")
        .forEach((ad) => ad.remove());

      for (let i = 0; i < newPosts.length; i++) {
        if (articlesToRemove[i]) {
          let prevSibling = articlesToRemove[i].previousElementSibling;
          let nextSibling = articlesToRemove[i].nextElementSibling;

          if (prevSibling && prevSibling.tagName === "HR") {
            prevSibling.remove();
          }

          articlesToRemove[i].remove();

          if (nextSibling && nextSibling.tagName === "HR") {
            nextSibling.remove();
          }
        }
      }

      // append the same in the UI
      scrollCountDiv.innerHTML = `<span id="totalPostsTraversed"><b>${totalPostsTraversed}</b></span> posts after <span id="scrollCount"><b>${scrollCount}</b></span> scrolls`;

      // scrolling to the top to enure removal of previous posts
      window.scrollTo(0, 0);
    }, 7000);

    document.body.setAttribute("help-buddy-scrollEventID", scrollEventID);
  }

  // MR4: Enlarged youtube video autoplay
  else if (
    /^https:\/\/www\.youtube\.com\/(?:results|feed\/trending)?(?:\?.*)?$/.test(
      pageLocation,
    )
  ) {
    chrome.runtime.sendMessage({
      action: "changeTitle",
      newTitle: "LoLé: Youtube autoplay magic",
    });

    extensionWillRun = true;

    // to revert back the changes
    if (document.body.getAttribute("loleWorking")) {
      resetToDefaultVideoPreview();
      closeExpandedVideoPreview();
    }
    // apply the changes
    else {
      if (alterYTPage) return;

      chrome.runtime.sendMessage({ message: "youtubeTutorial" });

      // shutting down the ad thing
      document.querySelector("#masthead-ad .ytd-rich-grid-renderer") &&
        (document.querySelector(
          "#masthead-ad .ytd-rich-grid-renderer",
        ).style.display = "none");

      videoUIChange();

      document.addEventListener("mouseover", expandVideoPreview);
      document.addEventListener("mouseleave", closeExpandedVideoPreview);
      document.addEventListener("keydown", escapeForDismissVideoPreview);

      document.body.setAttribute("loleWorking", "true");

      alterYTPage = true;
    }
  }

  // MR5: Airtel GPON
  else if (pageLocation.includes("http://192.168.1.1/cgi-bin/indexmain.cgi")) {
    extensionWillRun = true;

    const iframe = document.getElementById("mainFrame");
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

    if (
      iframeDoc.querySelector(".indexTitlePosition") &&
      iframeDoc
        .querySelector(".indexTitlePosition")
        .textContent.toLowerCase()
        .includes("network map")
    ) {
      // Step 1: Traverse the devices' table
      const devicesTable = iframeDoc.querySelectorAll(
        ".table_frame table table table tr",
      );

      // changing the justification style
      iframeDoc.querySelectorAll("td.table_font").forEach((tableRows) => {
        tableRows.style.textAlign = "justify";
      });

      iframeDoc.querySelectorAll("td.top_font").forEach((headerRows) => {
        headerRows.style.textAlign = "justify";
      });

      const ownDevicesMAC = {
        // 2.4GHz::5GHz Mac Addresses : Device Name
        // "E6:B3:63:39:47:7D::8E:63:92:E1:B9:B2": "Motorola Fusion 1+",
        "F6:F6:00:FF:39:1B::FE:49:B8:AF:0A:4F": "Harshika's MacBook Pro",
        "F0:D7:93:9D:44:60::4E:92:B9:CA:64:8A": "Harshika's iPhone",
        "CA:CD:8F:5C:9A:A9::E2:FF:00:E4:2E:7A": "Samsung Galaxy F62",
        "4A:C0:B1:85:6D:EE::96:08:13:11:EE:7D": "One Plus Nord CE3",
        "50:85:21:B0:A9:1A::00:41:0E:99:B1:93": "Vishal's Desktop",
        "5C:BA:EF:D5:CC:C5::5C:BA:EF:D5:CC:C5": "Harshika's Dell",
        "E2:D4:50:CF:41:6E::C2:60:8A:10:C5:2D": "Realme Pad Mini",
        "98:2C:C6:11:B6:9A::98:2C:C6:11:B6:9A": "Airtel IPTV",
        "A2:D1:11:FF:70:91::7E:2F:13:60:81:98": "Poco M4 Pro",
        "DC:F5:05:FB:6A:21::DC:F5:05:FB:6A:21": "Shiv PC",
        "50:7B:91:7E:5D:9B::": "Qubo CCTV",
        "2E:D2:8A:1F:40:11::": "Nokia 3.4",
      };

      devicesTable.forEach((device, ind) => {
        let deviceMacAddress = "";
        deviceMacAddress = device.querySelectorAll("td")[5].textContent.trim();

        // "0" index is for the table headers
        if (ind != 0) {
          const keys = Object.keys(ownDevicesMAC);
          for (let i = 0; i < keys.length; i++) {
            let n = keys[i];
            if (n.includes(deviceMacAddress)) {
              device.querySelectorAll("td")[1].innerHTML =
                `${ind < 10 ? "0" + ind : ind}. ${ownDevicesMAC[n]} <span style='float: right; white-space: pre; width: 100px'>${n.includes(`${deviceMacAddress}::`) ? "2.4GHz" : "5  GHz"}</span>`;
              break; // Stops the loop after finding the first match
            }
          }
        }
      });
    }
  }

  // MR6: Discord date
  else if (
    /^https?:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com(?:\/channels\/.*)?$/i.test(
      pageLocation,
    )
  ) {
    // 1) Get guild ID from URL: /channels/<GUILD_ID>/...
    const serverID = window.location.pathname.split("/")[2];
    const channelID = window.location.pathname.split("/")[3];

    extensionWillRun = true;

    // Open a channel in the server first
    if (!serverID || isNaN(serverID)) {
      extensionWillRun = false;
    } else {
      // 2) Decode Discord snowflake → timestamp
      let label = processDiscordDate(serverID);

      // 4) Find the main header div
      const channelDiv = document.querySelector(".scroller__629e4");
      channelDiv.style.paddingBottom = "0";

      // Server channelDivider not found
      if (!channelDiv) {
        extensionWillRun = false;
      } else {
        // 5) Remove any existing pill before adding a new one
        let existing = document.querySelector(".lole-discord-server-date-pill");
        if (existing) {
          existing.remove();
        }

        // 6) Create a small pill element
        let pill = document.createElement("div");
        pill.className = "lole-discord-server-date-pill";
        pill.innerHTML = `<span style='background-color: rgba(255, 255, 255, 0.1); padding: 2px; border-radius: 0 6px 6px 0;'>Server created: ${label}</span>`;
        Object.assign(pill.style, {
          height: "16px",
          minWidth: "100%",
          lineHeight: "16px",
          fontWeight: "bold",
          textAlign: "center",
          fontSize: "0.75rem",
          alignItems: "center",
          marginBottom: "2rem",
          marginTop: "1rem",
          display: "inline-flex",
          color: "var(--text-muted)",
          backgroundColor: "var(--background-modifier-accent)",
        });

        channelDiv.insertAdjacentElement("afterend", pill);

        // No specific channel is not opened
        if (!serverID || isNaN(serverID)) {
          extensionWillRun = false;
        } else {
          // 8) Find channel header container
          const upperContainer = document.querySelector(
            "div.upperContainer__9293f",
          );

          // Channel header not found
          if (!upperContainer) {
            extensionWillRun = false;
          } else {
            // 5) Remove existing first
            existing = upperContainer.parentElement.querySelector(
              ".lole-discord-channel-date-pill",
            );
            if (existing) existing.remove();

            label = processDiscordDate(channelID);

            // 6) Create inline pill with padding trick
            pill = document.createElement("div");
            pill.className = "lole-discord-channel-date-pill";
            pill.textContent = "Channel created: " + label;
            Object.assign(pill.style, {
              height: "16px",
              fontSize: "11px",
              marginTop: "-3px",
              fontWeight: "bold",
              lineHeight: "16px",
              alignItems: "center",
              display: "inline-flex",
              color: "var(--text-muted)",
              backgroundColor: "var(--background-modifier-accent)",
            });

            // 7) Add space BELOW header by setting padding-bottom on parent
            const parentContainer = upperContainer.parentElement;
            parentContainer.style.paddingBottom = "20px";
            parentContainer.style.paddingTop = "20px";

            // 8) Insert pill inline after header
            upperContainer.insertAdjacentElement("afterend", pill);
          }
        }
      }
    }
  }

  // close the popup for each page
  sendResponse({
    location: extensionWillRun ? null : "defaultLandingPage",
  });
}
