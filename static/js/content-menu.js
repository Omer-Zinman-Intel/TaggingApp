// content-menu.js
// Floating content menu for TaggingApp
// Dynamically lists section and note titles in order, with navigation and live updates


// Content Menu Widget Logic (robust, improved)
document.addEventListener('DOMContentLoaded', function() {
  const menuToggle = document.getElementById('content-menu-toggle');
  const menuPanel = document.getElementById('content-menu-panel');
  const contentRoot = document.getElementById('content-to-export');
  if (!menuToggle || !menuPanel) return;

  // Show/hide logic
  menuToggle.addEventListener('click', function() {
    // Hide search panel if open
    const searchPanel = document.getElementById('find-in-text-panel');
    if (searchPanel) searchPanel.style.display = 'none';
    // Toggle content menu
    if (menuPanel.style.display === 'none' || menuPanel.style.display === '') {
      menuPanel.style.display = 'block';
      renderContentMenu();
    } else {
      menuPanel.style.display = 'none';
    }
  });

  // Hide menu if clicking outside
  document.addEventListener('mousedown', function(e) {
    if (menuPanel.style.display === 'block' && !menuPanel.contains(e.target) && !menuToggle.contains(e.target)) {
      menuPanel.style.display = 'none';
    }
  });

  // Build the menu
  function renderContentMenu() {
    if (!contentRoot) return;
    menuPanel.innerHTML = '';
    const ul = document.createElement('ul');
    ul.className = 'space-y-1 w-full';
    // Traverse sections
    const sections = contentRoot.querySelectorAll('[class*="group/section"]');
    sections.forEach(section => {
      const sectionId = section.id;
      const sectionTitle = section.querySelector('h2')?.textContent?.trim() || 'Untitled Section';
      const notes = section.querySelectorAll('.note-draggable');
      let allNotesCompleted = true;
      // Section row FIRST
      const liSection = document.createElement('li');
      liSection.className = 'font-semibold text-gray-800 cursor-pointer hover:text-blue-600 px-1 py-0.5 rounded';
      liSection.textContent = sectionTitle;
      liSection.tabIndex = 0;
      liSection.setAttribute('data-scroll-id', sectionId);
      liSection.addEventListener('click', () => scrollToId(sectionId));
      liSection.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { scrollToId(sectionId); } });
      ul.appendChild(liSection);
      // Notes under this section
      notes.forEach(note => {
        const noteId = note.id;
        const noteTitle = note.querySelector('h3')?.textContent?.trim() || 'Untitled Note';
        const isCompleted = note.classList.contains('completed') || note.getAttribute('data-completed') === 'true' || note.querySelector('.completed, [data-completed="true"]');
        if (!isCompleted) allNotesCompleted = false;
        const liNote = document.createElement('li');
        liNote.className = 'ml-5 text-gray-700 cursor-pointer hover:text-blue-600 px-1 py-0.5 rounded' + (isCompleted ? ' content-menu-completed' : '');
        liNote.textContent = noteTitle;
        liNote.tabIndex = 0;
        liNote.setAttribute('data-scroll-id', noteId);
        liNote.addEventListener('click', () => scrollToId(noteId));
        liNote.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { scrollToId(noteId); } });
        ul.appendChild(liNote);
      });
      // Update section style if all notes completed
      if (allNotesCompleted && notes.length > 0) {
        liSection.classList.add('content-menu-completed');
      }
    });
    menuPanel.appendChild(ul);
  }

  // Scroll to element by id
  function scrollToId(id) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Optionally, highlight the element briefly
      el.classList.add('ring-2', 'ring-blue-400');
      setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400'), 1200);
    }
    menuPanel.style.display = 'none';
  }

  // Live update: observe content changes
  const observer = new MutationObserver(() => {
    if (menuPanel.style.display === 'block') {
      renderContentMenu();
    }
  });
  if (contentRoot) {
    observer.observe(contentRoot, { childList: true, subtree: true, characterData: true });
  }

  // Initial render if menu is open on load
  if (menuPanel.style.display === 'block') {
    renderContentMenu();
  }
});
