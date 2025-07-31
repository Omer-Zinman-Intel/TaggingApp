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
  const replaceInput = document.getElementById('find-in-text-replace');
  const replaceAllBtn = document.getElementById('find-in-text-replace-all');
  const closeBtn = document.getElementById('find-in-text-close');
  const prevBtn = document.getElementById('find-in-text-prev');
  const nextBtn = document.getElementById('find-in-text-next');
  const countSpan = document.getElementById('find-in-text-count');
  if (!toggleBtn || !panel || !input || !replaceInput || !replaceAllBtn || !closeBtn || !prevBtn || !nextBtn || !countSpan) {
    if (window.appLogger) {
      window.appLogger.componentStatus('FIND_IN_TEXT_WIDGET', 'error', {
        message: '[Find in Text] One or more required elements are missing',
        toggleBtn, panel, input, replaceInput, replaceAllBtn, closeBtn, prevBtn, nextBtn, countSpan
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
    replaceAllBtn.disabled = true;
  }

  function highlightMatches(phrase) {
    clearHighlights();
    if (!phrase || phrase.length < 1) {
      countSpan.textContent = '0 / 0';
      debugOverlay.style.display = 'none';
      replaceAllBtn.disabled = true;
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
      replaceAllBtn.disabled = false;
      if (window.appLogger) window.appLogger.action('FIND_IN_TEXT_SEARCH_MATCHES', { value: phrase, count: matches.length });
    } else {
      currentIdx = -1;
      replaceAllBtn.disabled = true;
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

  function replaceAll() {
    const findText = input.value.trim();
    const replaceText = replaceInput.value;
    
    if (!findText || matches.length === 0) {
      if (window.appLogger) window.appLogger.action('FIND_IN_TEXT_REPLACE_NO_MATCHES', { findText, replaceText });
      return;
    }

    // Confirm with user before replacing all
    const confirmMessage = `Replace all ${matches.length} occurrences of "${findText}" with "${replaceText}"?`;
    if (!confirm(confirmMessage)) {
      if (window.appLogger) window.appLogger.action('FIND_IN_TEXT_REPLACE_CANCELLED', { findText, replaceText, count: matches.length });
      return;
    }

    // Show loading state
    replaceAllBtn.disabled = true;
    replaceAllBtn.innerHTML = '<svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" stroke-dasharray="31.416" stroke-dashoffset="31.416"><animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/><animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/></circle></svg>';

    // Get current state from URL
    const urlParams = new URLSearchParams(window.location.search);
    const currentState = urlParams.get('state') || 'Default_State';

    // Send request to backend
    fetch('/replace_text?state=' + encodeURIComponent(currentState), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        findText: findText,
        replaceText: replaceText
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Clear highlights and reset search
        clearHighlights();
        input.value = '';
        replaceInput.value = '';
        countSpan.textContent = '0 / 0';

        if (window.appLogger) window.appLogger.action('FIND_IN_TEXT_REPLACE_ALL_SUCCESS', { 
          findText, 
          replaceText, 
          count: data.replacements 
        });

        // Show success message
        showReplaceSuccess(data.replacements);
        
        // Reload the page to show updated content
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        throw new Error(data.message || 'Replace operation failed');
      }
    })
    .catch(error => {
      console.error('Replace error:', error);
      if (window.appLogger) window.appLogger.error('FindInText replaceAll error:', error);
      alert('Error occurred while replacing text: ' + error.message);
    })
    .finally(() => {
      // Restore button state
      replaceAllBtn.disabled = false;
      replaceAllBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 0-2-2z"/><polyline points="3,7 8,12 3,17"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';
    });
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function showReplaceSuccess(count) {
    // Create a temporary success message
    const successMsg = document.createElement('div');
    successMsg.style.position = 'fixed';
    successMsg.style.top = '20px';
    successMsg.style.right = '20px';
    successMsg.style.background = '#10b981';
    successMsg.style.color = 'white';
    successMsg.style.padding = '12px 16px';
    successMsg.style.borderRadius = '8px';
    successMsg.style.fontSize = '14px';
    successMsg.style.fontWeight = '500';
    successMsg.style.zIndex = '10000';
    successMsg.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    successMsg.style.transform = 'translateX(100%)';
    successMsg.style.transition = 'transform 0.3s ease-out';
    successMsg.textContent = `Successfully replaced ${count} occurrence${count !== 1 ? 's' : ''}`;
    
    document.body.appendChild(successMsg);
    
    // Animate in
    setTimeout(() => {
      successMsg.style.transform = 'translateX(0)';
    }, 10);
    
    // Animate out and remove
    setTimeout(() => {
      successMsg.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (successMsg.parentNode) {
          successMsg.parentNode.removeChild(successMsg);
        }
      }, 300);
    }, 3000);
  }

  // Show/hide logic with focus and highlight reset
  function openPanel() {
    panel.style.display = 'block';
    setTimeout(() => {
      input.focus();
      input.select();
    }, 50);
    replaceAllBtn.disabled = true;
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
    // Hide content menu if open
    const contentMenuPanel = document.getElementById('content-menu-panel');
    if (contentMenuPanel) contentMenuPanel.style.display = 'none';
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
  replaceAllBtn.addEventListener('click', replaceAll);
  
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
  
  replaceInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      replaceAll();
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
