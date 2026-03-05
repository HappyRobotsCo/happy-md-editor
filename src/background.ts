chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('src/editor/index.html'),
  });
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('src/onboarding/index.html'),
    });
  }
});

// Handle markdown files opened directly in Chrome (file:// URLs)
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type !== 'open-markdown') return;

  const editorUrl = chrome.runtime.getURL('src/editor/index.html');

  // Store the content in session storage, then navigate once the write completes
  chrome.storage.session.set({
    pendingFile: {
      content: message.content,
      fileName: message.fileName,
      sourceUrl: message.sourceUrl,
    },
  }).then(() => {
    if (sender.tab?.id) {
      chrome.tabs.update(sender.tab.id, { url: editorUrl });
    } else {
      chrome.tabs.create({ url: editorUrl });
    }
  });
});
