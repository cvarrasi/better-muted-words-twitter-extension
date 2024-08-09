chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: "https://github.com/cvarrasi/better-muted-words-twitter-extension/blob/main/README.md" });
  });