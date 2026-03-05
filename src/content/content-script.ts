// Content script injected into file:// URLs ending in .md or .markdown
// Detects raw markdown text displayed by Chrome and opens it in Happy MD Editor

(() => {
  const url = window.location.href;

  // Only act on file:// URLs with markdown extensions
  if (!url.startsWith('file://')) return;
  if (!(/\.(md|markdown)$/i.test(url.split('?')[0].split('#')[0]))) return;

  // Chrome renders file:// text files inside a <pre> in the body
  const pre = document.querySelector('body > pre');
  if (!pre) return;

  const markdownContent = pre.textContent ?? '';
  const fileName = decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? 'untitled.md');

  // Send the content to the background script to open in editor
  chrome.runtime.sendMessage({
    type: 'open-markdown',
    content: markdownContent,
    fileName,
    sourceUrl: url,
  });
})();
