// Find in Text Widget Logic (robust, improved)
document.addEventListener('DOMContentLoaded', function() {
  // DEBUG: Add a temporary overlay for search debug info
  let debugOverlay = document.createElement('div');
  debugOverlay.style.position = 'fixed';
  debugOverlay.style.bottom = '10px';
  debugOverlay.style.right = '10px';
  debugOverlay.style.background = 'rgba(255,255,0,0.95)';
  debugOverlay.style.color = '#222';
  debugOverlay.style.padding = '6px 12px';
  debugOverlay.style.borderRadius = '6px';
  debugOverlay.style.fontSize = '14px';
  debugOverlay.style.zIndex = 9999;
  debugOverlay.style.display = 'none';
  document.body.appendChild(debugOverlay);

  const toggleBtn = document.getElementById('find-in-text-toggle');
  const panel = document.getElementById('find-in-text-panel');
  const input = document.getElementById('find-in-text-input');
  const closeBtn = document.getElementById('find-in-text-close');
  const prevBtn = document.getElementById('find-in-text-prev');
  const nextBtn = document.getElementById('find-in-text-next');
  const countSpan = document.getElementById('find-in-text-count');
  if (!toggleBtn || !panel || !input || !closeBtn || !prevBtn || !nextBtn || !countSpan) {
    if (window.appLogger) {
      window.appLogger.componentStatus('FIND_IN_TEXT_WIDGET', 'error', {
        message: '[Find in Text] One or more required elements are missing',
        toggleBtn, panel, input, closeBtn, prevBtn, nextBtn, countSpan
      });
    }
    return;
  } else {
    if (window.appLogger) {
      window.appLogger.componentStatus('FIND_IN_TEXT_WIDGET', 'loaded', {
        message: 'Find in Text widget initialized',
        url: window.location.href
      });
    }
  }
  let matches = [];
  let currentIdx = -1;

  // Helper: Recursively walk and highlight all matches in a node (robust, non-overlapping)
  function highlightAllInNode(node, phrase) {
    if (!phrase) return 0;
    let count = 0;
    if (node.nodeType === Node.TEXT_NODE) {
      let text = node.textContent;
      let search = phrase.toLowerCase();
      let lower = text.toLowerCase();
      let idx = lower.indexOf(search);
      if (idx === -1) return 0;
      let parent = node.parentNode;
      let curr = node;
      // To avoid infinite loop, always operate on the current text node
      while ((idx = curr.textContent.toLowerCase().indexOf(search)) !== -1 && curr.textContent.length > 0) {
        let before = document.createTextNode(curr.textContent.slice(0, idx));
        let match = document.createElement('span');
        match.className = 'find-in-text-highlight';
        match.textContent = curr.textContent.slice(idx, idx + phrase.length);
        matches.push(match);
        let after = document.createTextNode(curr.textContent.slice(idx + phrase.length));
        parent.insertBefore(before, curr);
        parent.insertBefore(match, curr);
        parent.insertBefore(after, curr);
        parent.removeChild(curr);
        curr = after;
        count++;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('find-in-text-highlight') && !node.classList.contains('find-in-text-current')) {
      if (["SCRIPT", "STYLE"].includes(node.tagName)) return 0;
      Array.from(node.childNodes).forEach(child => {
        try {
          count += highlightAllInNode(child, phrase);
        } catch (e) {
          if (window.appLogger) {
            window.appLogger.error('FindInText highlight error:', e);
          }
        }
      });
    }
    return count;
  }

  function clearHighlights() {
    // Remove all highlight spans and restore text
    // Defensive: use a while loop in case highlights are nested or adjacent
    let found;
    do {
      found = false;
      document.querySelectorAll('.find-in-text-highlight, .find-in-text-current').forEach(el => {
        const parent = el.parentNode;
        try {
          parent.replaceChild(document.createTextNode(el.textContent), el);
          parent.normalize();
          found = true;
        } catch (e) {
          if (window.appLogger) {
            window.appLogger.error('FindInText clearHighlights error:', e);
          }
        }
      });
    } while (found);
    matches = [];
    currentIdx = -1;
  }

  function highlightMatches(phrase) {
    clearHighlights();
    if (!phrase || phrase.length < 1) {
      countSpan.textContent = '0 / 0';
      debugOverlay.style.display = 'none';
      if (window.appLogger) window.appLogger.action('FIND_IN_TEXT_SEARCH_CLEARED', { value: phrase });
      return;
    }
    // DEBUG: Log what is being searched
    console.log('[FindInText] Searching for:', phrase);
    if (window.appLogger) window.appLogger.action('FIND_IN_TEXT_SEARCH_INPUT', { value: phrase });
    // Restrict search to only the main note/section content (not filter menu, categories, tags, etc.)
    // Use '#content-to-export' as the main content container
    let mainContent = document.querySelector('#content-to-export');
    if (!mainContent) {
      // fallback: try #main-content, .main-content, .content, or body
      mainContent = document.querySelector('#main-content') || document.querySelector('.main-content') || document.querySelector('.content') || document.body;
    }
    let nodeCount = 0;
    function walkAndHighlight(node) {
      // Skip script/style/hidden
      if (node.nodeType === Node.ELEMENT_NODE) {
        const style = window.getComputedStyle(node);
        if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || style.display === 'none' || style.visibility === 'hidden') return;
        Array.from(node.childNodes).forEach(child => walkAndHighlight(child));
      } else if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent.trim().length > 0) {
          nodeCount++;
          highlightAllInNode(node, phrase);
        }
      }
    }
    walkAndHighlight(mainContent);
    debugOverlay.textContent = `Searching: "${phrase}"\nText nodes: ${nodeCount}`;
    debugOverlay.style.display = 'block';
    setTimeout(() => { debugOverlay.style.display = 'none'; }, 2000);
    console.log('[FindInText] Matches found:', matches.length);
    if (matches.length > 0) {
      currentIdx = 0;
      updateCurrent();
      if (window.appLogger) window.appLogger.action('FIND_IN_TEXT_SEARCH_MATCHES', { value: phrase, count: matches.length });
    } else {
      currentIdx = -1;
      if (window.appLogger) window.appLogger.action('FIND_IN_TEXT_SEARCH_NO_MATCHES', { value: phrase });
      // Show a message in the widget if nothing found
      countSpan.textContent = '0 / 0 (no matches)';
    }
    countSpan.textContent = matches.length > 0 ? `${currentIdx+1} / ${matches.length}` : '0 / 0 (no matches)';
  }

  function updateCurrent() {
    matches.forEach((el, i) => {
      el.className = i === currentIdx ? 'find-in-text-current' : 'find-in-text-highlight';
    });
    if (matches[currentIdx]) {
      try {
        matches[currentIdx].scrollIntoView({behavior: 'smooth', block: 'center'});
      } catch (e) {}
      if (window.appLogger) window.appLogger.action('FIND_IN_TEXT_NAVIGATE', { index: currentIdx+1, total: matches.length });
    }
    countSpan.textContent = matches.length > 0 ? `${currentIdx+1} / ${matches.length}` : '0 / 0';
  }

  function next() {
    if (matches.length === 0) return;
    currentIdx = (currentIdx + 1) % matches.length;
    updateCurrent();
  }
  function prev() {
    if (matches.length === 0) return;
    currentIdx = (currentIdx - 1 + matches.length) % matches.length;
    updateCurrent();
  }

  // Show/hide logic with focus and highlight reset
  function openPanel() {
    panel.style.display = 'block';
    setTimeout(() => {
      input.focus();
      input.select();
    }, 50);
    if (input.value) {
      highlightMatches(input.value);
    }
    if (window.appLogger) window.appLogger.action('FIND_IN_TEXT_OPENED', {});
  }
  function closePanel() {
    panel.style.display = 'none';
    clearHighlights();
    if (window.appLogger) window.appLogger.action('FIND_IN_TEXT_CLOSED', {});
  }

  toggleBtn.addEventListener('click', () => {
    if (panel.style.display === 'none' || panel.style.display === '') {
      openPanel();
    } else {
      closePanel();
    }
  });
  closeBtn.addEventListener('click', closePanel);

  let lastInputTimer = null;
  function doSearchImmediate() {
    highlightMatches(input.value);
  }
  input.addEventListener('input', () => {
    if (lastInputTimer) clearTimeout(lastInputTimer);
    lastInputTimer = setTimeout(() => {
      // Always run search on input
      doSearchImmediate();
    }, 30); // faster debounce for more responsive typing
  });
  nextBtn.addEventListener('click', next);
  prevBtn.addEventListener('click', prev);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        prev();
      } else {
        next();
      }
      e.preventDefault();
    }
  });
  panel.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closePanel();
    }
  });
  document.addEventListener('mousedown', (e) => {
    if (panel.style.display !== 'none' && !panel.contains(e.target) && !toggleBtn.contains(e.target)) {
      closePanel();
    }
  });
  // Optional: open with Ctrl+F (but not if input or textarea is focused)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !e.repeat) {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
      openPanel();
      e.preventDefault();
    }
  });
});
