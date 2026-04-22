const defaultLandingPage = "https://versatilevats.com/lole";

// for inserting scripts into the page
if (location.href.includes(`${defaultLandingPage}/notes.html`)) {
  let fontScript = document.createElement("script");
  fontScript.src = "https://versatilevats.com/utilities/font.js?font=comfortaa";
  document.head.append(fontScript);

  let notificationScript = document.createElement("script");
  notificationScript.src =
    "https://versatilevats.com/utilities/notification.js?v=1.1";

  const viewId = new URLSearchParams(window.location.search);
  const view = viewId.get("view");

  if (typeof view !== "undefined" && view != null)
    notificationScript.onload = () => {
      showNotification(
        "Viewing <b>someone else</b> notes",
        "rgba(0, 255, 0, 0.6)",
        2000,
      );
    };

  document.body.append(notificationScript);
}
// for the landing page to use the notification script
else if (
  location.href.replace(/\/$/, "") === defaultLandingPage.replace(/\/$/, "")
) {
  let notificationScript = document.createElement("script");
  notificationScript.src =
    "https://versatilevats.com/utilities/notification.js?v=1.1";
  document.body.append(notificationScript);
}
// for the reddit page (to show the notifications)
else if (
  /^https:\/\/www\.reddit\.com\/(?:\?feed=home|r\/all)?\/?$/.test(location.href)
) {
  let notificationScript = document.createElement("script");
  notificationScript.src =
    "https://versatilevats.com/utilities/notification.js?v=1.1";
  document.body.append(notificationScript);

  notificationScript.onload = () => {
    showNotification(
      "<b>Auto-scrolling</b> the UI",
      "rgba(0, 255, 0, 0.6)",
      2000,
      "right",
    );
  };
}
