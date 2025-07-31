// Collapse/expand section
window.toggleSectionCollapse = function(sectionId) {
    const sectionElem = document.getElementById('section-' + sectionId);
    if (!sectionElem) return;
    const noteList = sectionElem.querySelector('.note-list');
    const collapseBtn = sectionElem.querySelector('.collapse-btn .collapse-icon');
    const collapsed = !noteList.classList.contains('collapsed-content');
    if (collapsed) {
        noteList.classList.add('collapsed-content');
        if (collapseBtn) {
            collapseBtn.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" />'; // right arrow
        }
    } else {
        noteList.classList.remove('collapsed-content');
        if (collapseBtn) {
            collapseBtn.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" />'; // down arrow
        }
    }
    fetch(`/collapse_state?state=${encodeURIComponent(window.CURRENT_STATE)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'section', id: sectionId, collapsed })
    });
}

// Collapse/expand note
window.toggleNoteCollapse = function(noteId) {
    const noteElem = document.getElementById('note-' + noteId);
    if (!noteElem) return;
    const contentElem = noteElem.querySelector('.note-content');
    const collapseBtn = noteElem.querySelector('.collapse-btn .collapse-icon');
    const collapsed = !contentElem.classList.contains('collapsed-content');
    if (collapsed) {
        contentElem.classList.add('collapsed-content');
        if (collapseBtn) {
            collapseBtn.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" />'; // right arrow
        }
    } else {
        contentElem.classList.remove('collapsed-content');
        if (collapseBtn) {
            collapseBtn.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" />'; // down arrow
        }
    }
    fetch(`/collapse_state?state=${encodeURIComponent(window.CURRENT_STATE)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'note', id: noteId, collapsed })
    });
}
// Reset completion status for all notes in current state
window.resetCompletionStatus = function() {
    fetch(`/reset_completion_status?state=${encodeURIComponent(window.CURRENT_STATE)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: window.CURRENT_STATE })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            // Update all notes in DOM
            document.querySelectorAll('.note-draggable[data-completed="true"]').forEach(noteElem => {
                noteElem.classList.remove('note-completed');
                noteElem.classList.add('bg-white');
                noteElem.removeAttribute('data-completed');
                // Update checkmark button
                const btn = noteElem.querySelector('button[onclick^="toggleNoteCompleted"]');
                if (btn) {
                    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="text-gray-400"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
                }
            });
            // Update Content Menu immediately
            if (window.renderContentMenu) {
                window.renderContentMenu();
            } else if (typeof renderContentMenu === 'function') {
                renderContentMenu();
            }
        }
    });
}
// Utility: Wrap code blocks between triple quotes with <pre class='ql-syntax'>...</pre>
function wrapCodeBlocks(text) {
    // Match triple straight or curly single/double quotes (including mixed)
    // ['\"] = straight, [‘’“”] = curly
    return text.replace(/((['\"‘’“”]){3})([\s\S]*?)(\1)/g, function(match, p1, code) {
        return `<pre class="ql-syntax">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
    });
}

function stripHtmlTags(html) {
    // Create a temporary element and get only the text content (preserves line breaks for <br> and <p>)
    const tmp = document.createElement('div');
    tmp.innerHTML = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n');
    return tmp.textContent || tmp.innerText || '';
}

function insertHtmlAndCodeBlocksToQuill(quill, html) {
    // Regex for triple straight or curly quotes
    const regex = /((['\"‘’“”]){3})([\s\S]*?)(\1)/g;
    let lastIndex = 0;
    let match;
    quill.setText(''); // Clear editor
    while ((match = regex.exec(html)) !== null) {
        // Insert HTML before code block
        if (match.index > lastIndex) {
            const htmlSegment = html.slice(lastIndex, match.index);
            quill.clipboard.dangerouslyPasteHTML(quill.getLength() - 1, htmlSegment);
        }
        // Insert code block (as plain text, with line breaks preserved)
        const codeText = stripHtmlTags(match[3]);
        quill.insertText(quill.getLength() - 1, codeText, { 'code-block': true });
        lastIndex = regex.lastIndex;
    }
    // Insert any remaining HTML
    if (lastIndex < html.length) {
        const htmlSegment = html.slice(lastIndex);
        quill.clipboard.dangerouslyPasteHTML(quill.getLength() - 1, htmlSegment);
    }
}

function nestQuillLists(flatListHtml) {
    const temp = document.createElement('div');
    temp.innerHTML = flatListHtml;
    const list = temp.querySelector('ul, ol');
    if (!list) return flatListHtml;

    const stack = [{ level: 0, list: document.createElement(list.tagName.toLowerCase()) }];
    Array.from(list.children).forEach(li => {
        const match = (li.className || '').match(/ql-indent-(\d+)/);
        const level = match ? parseInt(match[1], 10) : 0;
        while (stack.length > 1 && stack[stack.length - 1].level >= level) {
            stack.pop();
        }
        if (level > stack[stack.length - 1].level) {
            const sublist = document.createElement(list.tagName.toLowerCase());
            stack[stack.length - 1].list.lastElementChild.appendChild(sublist);
            stack.push({ level, list: sublist });
        }
        const newLi = li.cloneNode(true);
        newLi.className = (newLi.className || '').replace(/ql-indent-\d+/g, '').trim();
        stack[stack.length - 1].list.appendChild(newLi);
    });
    return stack[0].list.outerHTML;
}

function nestAllQuillListsInContainer(container) {
    // For every flat list in the container
    container.querySelectorAll('ul, ol').forEach(list => {
        // Only process lists that have ql-indent classes
        if (!list.querySelector('li.ql-indent-1, li.ql-indent-2, li.ql-indent-3, li.ql-indent-4, li.ql-indent-5, li.ql-indent-6, li.ql-indent-7, li.ql-indent-8')) return;

        // Build a stack for nested lists
        const stack = [{ level: 0, list: document.createElement(list.tagName.toLowerCase()) }];
        Array.from(list.children).forEach(li => {
            const match = (li.className || '').match(/ql-indent-(\d+)/);
            const level = match ? parseInt(match[1], 10) : 0;
            while (stack.length > 1 && stack[stack.length - 1].level >= level) {
                stack.pop();
            }
            if (level > stack[stack.length - 1].level) {
                const sublist = document.createElement(list.tagName.toLowerCase());
                stack[stack.length - 1].list.lastElementChild.appendChild(sublist);
                stack.push({ level, list: sublist });
            }
            const newLi = li.cloneNode(true);
            newLi.className = (newLi.className || '').replace(/ql-indent-\d+/g, '').trim();
            stack[stack.length - 1].list.appendChild(newLi);
        });
        // Replace the old list with the new nested one
        list.parentNode.replaceChild(stack[0].list, list);
    });
}

// Main application initialization
document.addEventListener('DOMContentLoaded', function() {
    // --- LOGGING: Send all import data to backend for debugging ---
    function logFrontendImport(payload) {
        try {
            fetch('/log_frontend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) { console.error('Failed to log to backend', e); }
    }
    // --- Render categories as badges for sections and notes ---
    function renderCategoriesBadges() {
        // For sections (H1)
        document.querySelectorAll('h1[data-categories]').forEach(h1 => {
            let catData = h1.getAttribute('data-categories');
            if (!catData) return;
            let categoryIds = [];
            try { categoryIds = JSON.parse(catData); } catch {}
            h1.querySelectorAll('.category-badge').forEach(b => b.remove());
            categoryIds.forEach(catId => {
                const catObj = window.TAG_CATEGORIES?.find(c => c.id === catId);
                if (!catObj) return;
                const badge = document.createElement('span');
                badge.className = 'category-badge ml-2 px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-semibold';
                badge.textContent = `📁 ${catObj.name}`;
                h1.appendChild(badge);
            });
        });
        // For notes (H2, H3)
        document.querySelectorAll('h2[data-categories], h3[data-categories]').forEach(hx => {
            let catData = hx.getAttribute('data-categories');
            if (!catData) return;
            let categoryIds = [];
            try { categoryIds = JSON.parse(catData); } catch {}
            hx.querySelectorAll('.category-badge').forEach(b => b.remove());
            categoryIds.forEach(catId => {
                const catObj = window.TAG_CATEGORIES?.find(c => c.id === catId);
                if (!catObj) return;
                const badge = document.createElement('span');
                badge.className = 'category-badge ml-2 px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-semibold';
                badge.textContent = `📁 ${catObj.name}`;
                hx.appendChild(badge);
            });
        });
    }
    // Call after import and on DOMContentLoaded
    renderCategoriesBadges();
    // Also observe for dynamic changes (e.g. after import)
    const catObs = new MutationObserver(() => renderCategoriesBadges());
    catObs.observe(document.body, { childList: true, subtree: true });
    window.appLogger?.action('CORE_INITIALIZATION_START');
    console.log('Initializing TaggingApp...');
    
    // Initialize tag inputs system
    try {
        if (!window.tagInputs) window.tagInputs = {};
        window.appLogger?.componentStatus('TAG_INPUT_SYSTEM', 'ready');
        console.log('Tag input system ready');
    } catch (error) {
        window.appLogger?.error('Error setting up tag input system:', error.message);
        console.error('Error setting up tag input system:', error);
    }

    // Setup file input handlers
    const docxInput = document.getElementById('docx-file-input');
    if (docxInput) {
        // FIX: Only attach one event listener, no nesting
        docxInput.addEventListener('change', (event) => {
            if(event.target.files.length === 0) {
                return;
            }
            const file = event.target.files[0];
            
            // Auto-populate document title with filename (without extension)
            const documentTitleInput = document.getElementById('importDocumentTitle');
            if (documentTitleInput && !documentTitleInput.value) {
                const fileName = file.name.replace(/\.docx$/i, '').replace(/\.doc$/i, '');
                documentTitleInput.value = fileName;
            }
            
            const reader = new FileReader();
            reader.onload = function(loadEvent) {
                if (typeof mammoth === 'undefined') {
                    console.error('mammoth is not defined!');
                    return;
                }
                mammoth.convertToHtml({ arrayBuffer: loadEvent.target.result })
                    .then(result => {
                        if (window.importEditorQuill) {
                            insertHtmlAndCodeBlocksToQuill(window.importEditorQuill, result.value);
                            toggleImportEditorView('richtext');
                        } else {
                            console.error('importEditorQuill is NOT available!');
                        }
                    })
                    .catch(err => console.error('Mammoth error:', err));
            };
            reader.readAsArrayBuffer(file);
        });
    }

    // Setup import form handler
    const importForm = document.getElementById('importForm');
    if(importForm) {
        importForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const contentHolder = document.getElementById('import_html_content');
            const currentView = document.getElementById('html-import-editor').classList.contains('hidden');
            let htmlContent = '';
            if(currentView) {
                if (window.importEditor && window.importEditor.quill) {
                    htmlContent = window.importEditor.quill.root.innerHTML;
                } else {
                    console.error('❌ Import editor not available');
                    return;
                }
            } else {
                const htmlEditor = document.getElementById('html-import-editor');
                htmlContent = htmlEditor.value;
            }
            function parseSectionsFromHTML(html) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const NOTE_TAGS = ['h2', 'h3'];
                const ALL_TAGS = ['h1', 'h2', 'h3', 'p', 'ul', 'ol', 'div', 'pre', 'blockquote', 'h4', 'h5', 'h6'];
                let sections = [];
                let currentSection = null;
                let pendingContent = '';
                // Extract tags from [tag] patterns
                function extractTags(text) {
                    const matches = [...text.matchAll(/\[([^\]]+)\]/g)];
                    return matches.map(m => m[1]);
                }
                // Extract categories from {{category:[tag1] [tag2]}} patterns
                function extractCategories(text) {
                    // Allow whitespace before/after colon and before/after brackets
                    // Match category patterns with any number of [tag] blocks, even if tags are empty
                    const matches = [...text.matchAll(/\{\{\s*([^:}]+)\s*:\s*((?:\s*\[[^\]]*\])*)\s*\}\}/g)];
                    let categories = [];
                    matches.forEach(m => {
                        const catName = m[1].trim();
                        let tags = [];
                        if (m[2]) {
                            // Find all [tag] blocks, including empty ones
                            const tagMatches = [...m[2].matchAll(/\[([^\]]*)\]/g)];
                            tagMatches.forEach(tm => {
                                // Only add non-empty tags
                                if (tm[1].trim()) {
                                    tags.push(tm[1].trim());
                                }
                            });
                        }
                        categories.push({ name: catName, tags });
                    });
                    return categories; // Always return an array
                }
                // Remove all category and tag patterns from title
                function cleanTitle(text) {
                    // Remove everything from {{ to }} (greedy)
                    let cleaned = text.replace(/\{\{[^}]*\}\}/g, '');
                    cleaned = cleaned.replace(/\[([^\]]+)]/g, '');
                    return cleaned.trim();
                }
                const elements = Array.from(doc.body.querySelectorAll(ALL_TAGS.join(',')));
                elements.forEach((el, idx) => {
                    try {
                        if (el.tagName && typeof el.tagName.toLowerCase === 'function') {
                            const tagName = el.tagName.toLowerCase();
                    
                            if (tagName === 'h1') {
                                logFrontendImport({
                                    event: 'IMPORT_HEADING_DEBUG',
                                    type: 'section',
                                    headingText: el.textContent
                                });
                    
                                // Finalize previous section if needed
                                if (currentSection && pendingContent && (!currentSection.notes || currentSection.notes.length === 0)) {
                                    currentSection.notes = currentSection.notes || [];
                                    currentSection.notes.push({
                                        id: crypto.randomUUID(),
                                        noteTitle: '',
                                        content: pendingContent,
                                        tags: []
                                    });
                                }
                                pendingContent = '';
                                if (currentSection) sections.push(currentSection);
                    
                                // Parse categories and tags
                                let categories = [];
                                let allCatTags = [];
                                try {
                                    categories = extractCategories(el.textContent) || [];
                                    categories.forEach(cat => {
                                        if (cat && Array.isArray(cat.tags)) {
                                            allCatTags = allCatTags.concat(cat.tags);
                                        }
                                    });
                                } catch (e) {
                                    console.error('[IMPORT] Error extracting categories:', e);
                                }
                    
                                let tags = [];
                                try {
                                    tags = extractTags(el.textContent) || [];
                                } catch (e) {
                                    console.error('[IMPORT] Error extracting tags:', e);
                                }
                    
                                // Only keep tags that are NOT part of any category
                                let singularTags = tags.filter(t => !allCatTags.includes(t));
                                const sectionTitle = cleanTitle(el.textContent);
                                // Merge category tags into the tags array
                                let allTags = [...singularTags, ...allCatTags];
                                console.log('[IMPORT] Section:', sectionTitle, 'Tags:', allTags, 'Categories:', categories);
                    
                                currentSection = {
                                    id: crypto.randomUUID(),
                                    sectionTitle,
                                    tags: allTags,
                                    notes: [],
                                    categories
                                };
                                el.setAttribute('data-categories', JSON.stringify(categories));
                        
                            } else if (NOTE_TAGS.includes(tagName)) {
                                if (currentSection && pendingContent && (!currentSection.notes || currentSection.notes.length === 0)) {
                                    currentSection.notes = currentSection.notes || [];
                                    currentSection.notes.push({
                                        id: crypto.randomUUID(),
                                        noteTitle: '',
                                        content: pendingContent,
                                        tags: []
                                    });
                                    pendingContent = '';
                                }
                    
                                // Parse categories and tags
                                let categories = [];
                                let allCatTags = [];
                                try {
                                    categories = extractCategories(el.textContent) || [];
                                    categories.forEach(cat => {
                                        if (cat && Array.isArray(cat.tags)) {
                                            allCatTags = allCatTags.concat(cat.tags);
                                        }
                                    });
                                } catch (e) {
                                    console.error('[IMPORT] Error extracting note categories:', e);
                                }
                    
                                let tags = [];
                                try {
                                    tags = extractTags(el.textContent) || [];
                                } catch (e) {
                                    console.error('[IMPORT] Error extracting note tags:', e);
                                }
                    
                                // Only keep tags that are NOT part of any category
                                let singularTags = tags.filter(t => !allCatTags.includes(t));
                                const noteTitle = cleanTitle(el.textContent);
                                console.log('[IMPORT] Note:', noteTitle, 'Tags:', singularTags, 'Categories:', categories);
                    
                                const note = {
                                    id: crypto.randomUUID(),
                                    noteTitle,
                                    content: '',
                                    tags: singularTags,
                                    categories
                                };
                                currentSection.notes.push(note);
                                el.setAttribute('data-categories', JSON.stringify(categories));
                        
                            } else if (currentSection) {
                                if (currentSection.notes && currentSection.notes.length > 0) {
                                    const lastNote = currentSection.notes[currentSection.notes.length - 1];
                                    if (!lastNote.blocks) lastNote.blocks = [];
                                    if (tagName === 'ul' || tagName === 'ol') {
                                        lastNote.blocks.push(el.outerHTML);
                                    } else {
                                        lastNote.blocks.push(el.outerHTML);
                                    }
                                } else {
                                    pendingContent += el.outerHTML;
                                }
                            }
                        } else {
                            console.warn('[IMPORT] Skipped element with invalid tagName:', el);
                        }
                    } catch (err) {
                        console.error('[IMPORT] Fatal error in section/note parsing:', err, el);
                    }
                }); // <-- CLOSES the .forEach

                // Now, OUTSIDE the .forEach, add the end-of-parsing logic:
                if (currentSection && pendingContent && (!currentSection.notes || currentSection.notes.length === 0)) {
                    currentSection.notes = currentSection.notes || [];
                    currentSection.notes.push({ id: crypto.randomUUID(), noteTitle: '', content: pendingContent, tags: [] });
                }
                if (currentSection) sections.push(currentSection);
            
                // Join blocks for each note
                sections.forEach(section => {
                    section.notes.forEach(note => {
                        if (note.blocks) {
                            note.content = note.blocks.join('');
                            delete note.blocks;
                        }
                    });
                });
            
                return sections;
            } // <-- CLOSES the function
            const sections = parseSectionsFromHTML(htmlContent);
            // Log the parsed sections and tagCategories before sending to backend
            logFrontendImport({
                event: 'IMPORT_SUBMIT',
                htmlContent,
                parsedSections: sections,
                tagCategories: window.tagCategories,
                timestamp: new Date().toISOString()
            });
            // Collect all categories and tags from parsed sections/notes
            let allCategories = {};
            sections.forEach(section => {
                (section.categories || []).forEach(cat => {
                    if (!allCategories[cat.name]) {
                        allCategories[cat.name] = new Set();
                    }
                    cat.tags.forEach(tag => allCategories[cat.name].add(tag));
                });
                section.notes.forEach(note => {
                    (note.categories || []).forEach(cat => {
                        if (!allCategories[cat.name]) {
                            allCategories[cat.name] = new Set();
                        }
                        cat.tags.forEach(tag => allCategories[cat.name].add(tag));
                    });
                });
            });
            // Convert to array format for UI
            window.tagCategories = Object.entries(allCategories).map(([name, tagsSet]) => ({
                name,
                tags: Array.from(tagsSet)
            }));
            console.log('[IMPORT] Global categories:', window.tagCategories);
            // Wrap code blocks in each note's content
            sections.forEach(section => {
                section.notes.forEach(note => {
                    note.content = wrapCodeBlocks(note.content);
                });
            });
            const importMode = importForm.querySelector('input[name="import_mode"]:checked').value;
            const documentTitle = document.getElementById('importDocumentTitle').value.trim();
            const state = window.CURRENT_STATE;
            async function clearState() {
                await fetch(`/import/clear?state=${encodeURIComponent(state)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            }
            async function addSection(section, isFirstSection = false) {
                try {
                    // Log to backend what is being sent
                    await fetch('/log_frontend', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ event: 'IMPORT_SECTION_SEND', state, section, isFirstSection })
                    });
                    const response = await fetch(`/import/add?state=${encodeURIComponent(state)}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            section,
                            document_title: isFirstSection ? documentTitle : null
                        })
                    });
                    if (!response.ok) {
                        console.error('[IMPORT] Import failed:', response.status, response.statusText);
                    } else {
                        const data = await response.text();
                        console.log('[IMPORT] Import response:', data);
                    }
                } catch (error) {
                    console.error('[IMPORT] POST error:', error);
                }
            }
            // Progress bar logic
            const progressBarContainer = document.getElementById('import-progress-bar-container');
            const progressBar = document.getElementById('import-progress-bar');
            const progressLabel = document.getElementById('import-progress-label');
            function showProgressBar() {
                progressBarContainer.classList.remove('hidden');
                progressBar.style.width = '0%';
                progressLabel.textContent = '';
            }
            function updateProgressBar(current, total) {
                const percent = Math.round((current / total) * 100);
                progressBar.style.width = percent + '%';
                progressLabel.textContent = `Importing section ${current} of ${total} (${percent}%)`;
            }
            function hideProgressBar() {
                progressBarContainer.classList.add('hidden');
                progressBar.style.width = '0%';
                progressLabel.textContent = '';
            }
            showProgressBar();
            try {
                if (importMode === 'overwrite') {
                    await clearState();
                }
                for (let i = 0; i < sections.length; i++) {
                    await addSection(sections[i], i === 0); // Pass isFirstSection=true for the first section
                    updateProgressBar(i + 1, sections.length);
                }
                setTimeout(() => {
                    hideProgressBar();
                    window.location.reload();
                }, 400);
            } catch (err) {
                progressLabel.textContent = 'Error during import.';
                progressBar.style.backgroundColor = '#dc2626'; // Tailwind red-600
                setTimeout(hideProgressBar, 2000);
                throw err;
            }
        });
    }

    // Setup form submit handlers for tag synchronization
    const editSectionForm = document.getElementById('editSectionForm');
    if (editSectionForm) {
        editSectionForm.addEventListener('submit', function(e) {
            if (window.tagInputs && window.tagInputs.section) {
                const hiddenInput = document.getElementById('editSectionTags');
                if (hiddenInput) {
                    const tags = window.tagInputs.section.tags || [];
                    hiddenInput.value = tags.join(', ');
                }
                
                // Also handle categories
                const categoriesHiddenInput = document.getElementById('editSectionCategories');
                if (categoriesHiddenInput) {
                    const categories = window.tagInputs.section.categories || [];
                    categoriesHiddenInput.value = JSON.stringify(categories);
                }
            }
        });
    }
    
    const editNoteForm = document.getElementById('editNoteForm');
    if (editNoteForm) {
        editNoteForm.addEventListener('submit', function(e) {
            // Prevent default submission to capture content first
            e.preventDefault();
            
            // Store scroll position and note ID for restoration after page reload
            const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
            
            // Extract note ID from form action URL (format: /note/update/section_id/note_id)
            const actionUrl = editNoteForm.action;
            const urlParts = actionUrl.split('/');
            const noteId = urlParts[urlParts.length - 1].split('?')[0]; // Remove query parameters
            
            sessionStorage.setItem('scrollPosition', scrollPosition);
            sessionStorage.setItem('editedNoteId', noteId);
            
            window.appLogger?.action('NOTE_FORM_SUBMISSION_START', {
                formAction: editNoteForm.action,
                formMethod: editNoteForm.method,
                hasNoteEditor: !!window.noteEditor,
                hasQuill: !!(window.noteEditor && window.noteEditor.quill),
                scrollPosition: scrollPosition,
                noteId: noteId
            });
            
            // Get HTML content using multiple methods for debugging
            if (window.noteEditor && window.noteEditor.quill) {
                // Capture multiple content states for debugging
                const quillRootContent = window.noteEditor.quill.root.innerHTML;
                const getCurrentContentResult = window.noteEditor.getCurrentContent();
                const getContentResult = window.noteEditor.getContent();
                
                // Also try getSemanticHTML if available
                let semanticHTML = null;
                try {
                    if (window.noteEditor.quill.getSemanticHTML) {
                        semanticHTML = window.noteEditor.quill.getSemanticHTML();
                    }
                } catch (error) {
                    // Ignore error, semanticHTML will remain null
                }
                
                // Log all content capture methods for comparison
                window.appLogger?.action('QUILL_CONTENT_CAPTURE_DEBUG', {
                    quillRootContent: {
                        length: quillRootContent.length,
                        preview: quillRootContent.substring(0, 300),
                        full: quillRootContent
                    },
                    getCurrentContentResult: {
                        length: getCurrentContentResult.length,
                        preview: getCurrentContentResult.substring(0, 300),
                        full: getCurrentContentResult
                    },
                    getContentResult: {
                        length: getContentResult.length,
                        preview: getContentResult.substring(0, 300),
                        full: getContentResult
                    },
                    semanticHTML: semanticHTML ? {
                        length: semanticHTML.length,
                        preview: semanticHTML.substring(0, 300),
                        full: semanticHTML
                    } : null,
                    hasFocus: window.noteEditor.quill.hasFocus(),
                    selection: window.noteEditor.quill.getSelection(),
                    editorState: {
                        isEnabled: window.noteEditor.quill.isEnabled(),
                        length: window.noteEditor.quill.getLength()
                    }
                });
                
                // Use the getCurrentContent method (which should be the most reliable)
                const htmlContent = getCurrentContentResult;
                const contentField = document.getElementById('editNoteContent');
                
                window.appLogger?.action('NOTE_CONTENT_CAPTURED', {
                    contentLength: htmlContent.length,
                    hasContent: htmlContent.length > 0,
                    contentPreview: htmlContent.substring(0, 200),
                    hasContentField: !!contentField
                });
                
                if (contentField) {
                    contentField.value = htmlContent;
                    
                    // Log what was actually set in the field
                    window.appLogger?.action('CONTENT_FIELD_POPULATED', {
                        fieldValueLength: contentField.value.length,
                        fieldValuePreview: contentField.value.substring(0, 200),
                        fieldValueFull: contentField.value,
                        matchesHtmlContent: contentField.value === htmlContent
                    });
                } else {
                    window.appLogger?.error('Content field editNoteContent not found');
                }
            } else {
                window.appLogger?.error('Rich text editor not available during form submission', {
                    hasNoteEditor: !!window.noteEditor,
                    hasQuill: !!(window.noteEditor && window.noteEditor.quill)
                });
            }
            
            // Handle tags
            if (window.tagInputs && window.tagInputs.note) {
                const hiddenInput = document.getElementById('editNoteTags');
                if (hiddenInput) {
                    const tagsValue = window.tagInputs.note.tags.join(', ');
                    hiddenInput.value = tagsValue;
                    window.appLogger?.action('NOTE_TAGS_CAPTURED', { 
                        tags: tagsValue,
                        tagCount: window.tagInputs.note.tags.length
                    });
                }
                // FIX START: Add categories to the form
                let categoriesHiddenInput = editNoteForm.querySelector('input[name="categories"]');
                if (!categoriesHiddenInput) {
                    categoriesHiddenInput = document.createElement('input');
                    categoriesHiddenInput.type = 'hidden';
                    categoriesHiddenInput.name = 'categories';
                    editNoteForm.appendChild(categoriesHiddenInput);
                }
                const categoriesValue = JSON.stringify(window.tagInputs.note.getCategories() || []);
                categoriesHiddenInput.value = categoriesValue;
                window.appLogger?.action('NOTE_CATEGORIES_CAPTURED', {
                    categories: categoriesValue,
                    categoryCount: (window.tagInputs.note.getCategories() || []).length
                });
                // FIX END
            }
            
            // Log final form data before submission
            const formData = new FormData(editNoteForm);
            const formDataObj = {};
            for (let [key, value] of formData.entries()) {
                formDataObj[key] = value;
            }
            window.appLogger?.action('NOTE_FORM_SUBMISSION_READY', {
                formData: formDataObj,
                contentLength: formDataObj.content ? formDataObj.content.length : 0,
                contentPreview: formDataObj.content ? formDataObj.content.substring(0, 200) : 'NO_CONTENT',
                fullContent: formDataObj.content || 'NO_CONTENT'
            });
            
            // Now submit the form programmatically
            editNoteForm.submit();
        });
    }
    
    window.appLogger?.action('CORE_INITIALIZATION_COMPLETE');
    console.log('TaggingApp initialization complete');
    
    // Restore scroll position after note editing
    setTimeout(() => {
        const savedScrollPosition = sessionStorage.getItem('scrollPosition');
        const editedNoteId = sessionStorage.getItem('editedNoteId');
        
        if (savedScrollPosition && editedNoteId) {
            window.appLogger?.action('SCROLL_POSITION_RESTORE_ATTEMPT', {
                savedScrollPosition: parseInt(savedScrollPosition),
                editedNoteId: editedNoteId
            });
            
            // First try to scroll to the specific note
            const noteElement = document.querySelector(`[data-note-id="${editedNoteId}"]`) || 
                               document.querySelector(`#note-${sanitizeNoteId(editedNoteId)}`) ||
                               document.querySelector(`[id*="${sanitizeNoteId(editedNoteId)}"]`);

            // Helper to sanitize noteId for selectors
            function sanitizeNoteId(noteId) {
                if (!noteId) return '';
                return String(noteId).replace(/['"%]/g, ''); // Remove quotes and percent signs
            }
            
            if (noteElement) {
                // Scroll to the note with some offset
                const elementTop = noteElement.offsetTop - 100; // 100px offset from top
                window.scrollTo({
                    top: elementTop,
                    behavior: 'smooth'
                });
                
                window.appLogger?.action('SCROLL_TO_NOTE_SUCCESS', {
                    noteId: editedNoteId,
                    elementTop: elementTop
                });
            } else {
                // Fallback to saved scroll position
                window.scrollTo({
                    top: parseInt(savedScrollPosition),
                    behavior: 'smooth'
                });
                
                window.appLogger?.action('SCROLL_TO_POSITION_FALLBACK', {
                    scrollPosition: parseInt(savedScrollPosition)
                });
            }
            
            // Clear the stored values
            sessionStorage.removeItem('scrollPosition');
            sessionStorage.removeItem('editedNoteId');
        }
    }, 100); // Small delay to ensure page is fully loaded

    // On page load, apply collapsed state to sections and notes
    // This ensures collapse/expand state persists after reload

    // Sections
    document.querySelectorAll('[id^="section-"]').forEach(function(sectionElem) {
        const noteList = sectionElem.querySelector('.note-list');
        const collapseBtn = sectionElem.querySelector('.collapse-btn .collapse-icon');
        // Always set the icon explicitly and persistently
        if (sectionElem.classList.contains('collapsed')) {
            if (noteList) noteList.classList.add('collapsed-content');
            if (collapseBtn) {
                collapseBtn.innerHTML = '';
                collapseBtn.insertAdjacentHTML('afterbegin', '<path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" />');
            }
        } else {
            if (noteList) noteList.classList.remove('collapsed-content');
            if (collapseBtn) {
                collapseBtn.innerHTML = '';
                collapseBtn.insertAdjacentHTML('afterbegin', '<path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" />');
            }
        }
    });
    // Notes
    document.querySelectorAll('.note-draggable').forEach(function(noteElem) {
        const contentElem = noteElem.querySelector('.note-content');
        const collapseBtn = noteElem.querySelector('.collapse-btn .collapse-icon');
        // Always set the icon explicitly
        if (contentElem && contentElem.classList.contains('collapsed-content')) {
            if (collapseBtn) {
                collapseBtn.innerHTML = '';
                collapseBtn.insertAdjacentHTML('afterbegin', '<path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" />');
            }
        } else {
            if (collapseBtn) {
                collapseBtn.innerHTML = '';
                collapseBtn.insertAdjacentHTML('afterbegin', '<path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" />');
            }
        }
    });
});

document.addEventListener('DOMContentLoaded', function() {
    // For each note content block in the main content view
    document.querySelectorAll('#main-content .prose').forEach(block => {
        nestAllQuillListsInContainer(block);
    });
});

// Core application functions
window.exportPdf = function() {
    window.appLogger?.action('EXPORT_PDF_START');
    
    if (window.html2pdf) {
        const element = document.getElementById('content-to-export');
        const docTitle = document.title.replace(/ /g, '_');
        const opt = { 
            margin: [0.5, 0.5, 0.5, 0.5], 
            filename: `${docTitle}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2, 
                logging: false,
                width: element.scrollWidth,
                height: element.scrollHeight
            },
            jsPDF: { 
                unit: 'in', 
                format: 'a4', 
                orientation: 'portrait'
            }
        };
        
        const promise = window.html2pdf().from(element).set(opt).save();
        promise.then(() => {
            window.appLogger?.action('EXPORT_PDF_SUCCESS');
        }).catch(error => {
            window.appLogger?.error('Error exporting PDF:', error.message);
        });
    } else {
        window.appLogger?.error('html2pdf library not available');
        alert('PDF export library not loaded. Please refresh the page and try again.');
    }
};

window.exportHtml = function() {
    window.appLogger?.action('EXPORT_HTML_START');
    
    const element = document.getElementById('content-to-export');
    const content = element.innerHTML;
    const docTitle = document.title.replace(/ /g, '_');
    
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docTitle}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    window.appLogger?.action('EXPORT_HTML_SUCCESS');
};

// Handle tag clicks in the filter menu
window.handleTagClick = function(event, tagName) {
    console.log(`Tag clicked: ${tagName}`);
    window.appLogger?.action('TAG_CLICKED', { tag: tagName });
    
    event.preventDefault();
    event.stopPropagation();
    
    // Prevent click handling during drag operations
    if (window.isDragging) {
        console.log("Tag click ignored during drag operation");
        return;
    }
    
    // Get the current URL and parse its parameters
    const currentUrl = new URL(window.location.href);
    const params = new URLSearchParams(currentUrl.search);
    
    // Get all current filters
    const currentFilters = params.getAll('filter');
    
    // Special case for "All" tag - clear all filters
    if (tagName.toLowerCase() === 'all') {
        params.delete('filter');
    } 
    // If this tag is already active, remove it from filters
    else if (currentFilters.some(filter => filter.toLowerCase() === tagName.toLowerCase())) {
        params.delete('filter');
        currentFilters.forEach(filter => {
            if (filter.toLowerCase() !== tagName.toLowerCase()) {
                params.append('filter', filter);
            }
        });
    } 
    // Otherwise add this tag to filters
    else {
        params.append('filter', tagName);
    }
    
    // Build the new URL and navigate to it
    currentUrl.search = params.toString();
    console.log(`Navigating to: ${currentUrl.toString()}`);
    window.location.href = currentUrl.toString();
};

// Handle right-click context menu for tags
// Test function to debug context menu
window.testContextMenu = function() {
    window.appLogger?.action('TEST_CONTEXT_MENU', { message: 'Context menu test function called' });
    return false;
};

window.showTagContextMenu = function(event, tagName, categoryId) {
    // Fire a dedicated context menu opened event for future logging/analytics
    window.appLogger?.action('CONTEXT_MENU_OPENED', {
        type: 'tag_context_menu',
        tag: tagName,
        position: { x: event.clientX, y: event.clientY },
        timestamp: Date.now(),
        url: window.location.href
    });
    
    window.appLogger?.action('TAG_CONTEXT_MENU_START', { 
        tag: tagName,
        message: 'Tag context menu requested'
    });
    
    window.appLogger?.action('TAG_CONTEXT_MENU_EVENT', { 
        tag: tagName,
        eventType: event.type,
        target: event.target.tagName,
        mouseX: event.clientX,
        mouseY: event.clientY,
        message: 'Event details captured'
    });
    
    window.appLogger?.action('TAG_CONTEXT_MENU', { 
        tag: tagName,
        eventType: event.type,
        target: event.target.tagName,
        mouseX: event.clientX,
        mouseY: event.clientY
    });
    
    // Prevent the default context menu
    event.preventDefault();
    event.stopPropagation();
    
    // Get existing or create a new context menu
    window.appLogger?.action('TAG_CONTEXT_MENU_CREATE', { 
        tag: tagName,
        message: 'Creating or finding context menu'
    });
    
    let contextMenu = document.getElementById('tag-context-menu');
    if (!contextMenu) {
        window.appLogger?.action('TAG_CONTEXT_MENU_NEW', { 
            tag: tagName,
            message: 'Context menu not found, creating new one'
        });
        
        contextMenu = document.createElement('div');
        contextMenu.id = 'tag-context-menu';
        contextMenu.className = 'absolute bg-white shadow-lg rounded-md py-2 w-48 border';
        contextMenu.style.display = 'none';
        contextMenu.style.zIndex = '9999';
        contextMenu.style.position = 'fixed';
        document.body.appendChild(contextMenu);
        
        window.appLogger?.action('TAG_CONTEXT_MENU_APPENDED', { 
            tag: tagName,
            message: 'New context menu created and appended to body'
        });
    } else {
        window.appLogger?.action('TAG_CONTEXT_MENU_FOUND', { 
            tag: tagName,
            message: 'Existing context menu found'
        });
    }
    
    // Position the context menu at the mouse position
    window.appLogger?.action('TAG_CONTEXT_MENU_POSITION', { 
        tag: tagName,
        x: event.clientX,
        y: event.clientY,
        message: 'Positioning context menu at mouse position'
    });
    
    contextMenu.style.top = `${event.clientY}px`;
    contextMenu.style.left = `${event.clientX}px`;
    
    // Update the context menu content based on the tag
    window.appLogger?.action('TAG_CONTEXT_MENU_CONTENT', { 
        tag: tagName,
        message: 'Setting context menu content'
    });
    
    // Check if this is an AND tag (contains '&' character)
    const isAndTag = tagName.includes('&');
    
    // Use appropriate functions based on tag type
    const deleteFunction = isAndTag ? 
        `deleteAndTagFromContextMenu('${tagName}')` : 
        `deleteGlobalTag('${tagName}')`;
    
    const editFunction = isAndTag ? 
        `showEditAndTagModal('${tagName}')` : 
        `showRenameModal('${tagName}')`;
    
    const editLabel = isAndTag ? 'Edit Components' : 'Rename Tag';
    
    // Add Remove from Category option if categoryId is provided
    const removeFromCategoryFunction = categoryId ? `removeTagFromCategoryFromContextMenu('${tagName}', '${categoryId}')` : '';
    const removeFromCategoryItem = categoryId ? `<a href="#" class="block px-4 py-2 text-sm text-yellow-700 hover:bg-gray-100" onclick="event.preventDefault(); ${removeFromCategoryFunction}; hideContextMenu();">Remove tag from category</a>` : '';
    contextMenu.innerHTML = `
        <div class="px-3 py-1 text-sm font-medium text-gray-800 border-b mb-1">${tagName}</div>
        <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" 
           onclick="event.preventDefault(); ${editFunction}; hideContextMenu();">
           ${editLabel}
        </a>
        ${removeFromCategoryItem}
        <a href="#" class="block px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
           onclick="event.preventDefault(); ${deleteFunction}; hideContextMenu();">
           Delete Tag
        </a>
    `;
    
    // Show the context menu
    window.appLogger?.action('TAG_CONTEXT_MENU_SHOW', { 
        tag: tagName,
        message: 'Showing context menu'
    });
    
    contextMenu.style.display = 'block';
    
    window.appLogger?.action('TAG_CONTEXT_MENU_DISPLAYED', { 
        tag: tagName,
        message: 'Context menu display set to block'
    });
    
    // Log final state
    window.appLogger?.action('TAG_CONTEXT_MENU_FINAL_STATE', { 
        tag: tagName,
        display: contextMenu.style.display,
        position: `${contextMenu.style.left}, ${contextMenu.style.top}`,
        hasContent: contextMenu.innerHTML.length > 0,
        message: 'Final context menu state logged'
    });
    
    // Add a click event listener to the document to hide the context menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', hideContextMenu);
    }, 10);
    
    window.appLogger?.action('TAG_CONTEXT_MENU_COMPLETE', { 
        tag: tagName,
        message: 'Context menu setup complete'
    });
    
    return false;
};

// Helper function to hide the context menu
window.hideContextMenu = function() {
    window.appLogger?.action('TAG_CONTEXT_MENU_HIDE', { 
        message: 'Hiding context menu'
    });
    
    const contextMenu = document.getElementById('tag-context-menu');
    if (contextMenu) {
        contextMenu.style.display = 'none';
        window.appLogger?.action('TAG_CONTEXT_MENU_HIDDEN', { 
            message: 'Context menu hidden successfully'
        });
    } else {
        window.appLogger?.action('TAG_CONTEXT_MENU_NOT_FOUND', { 
            message: 'Context menu not found when trying to hide'
        });
    }
    
    document.removeEventListener('click', hideContextMenu);
};

// Helper function to copy text to clipboard
window.copyToClipboard = function(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            console.log('Text copied to clipboard:', text);
            window.appLogger?.action('COPY_TO_CLIPBOARD', { content: text });
            
            // Show a brief notification
            const notification = document.createElement('div');
            notification.textContent = 'Copied to clipboard!';
            notification.className = 'fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-md shadow-lg z-50';
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 2000);
        })
        .catch(err => {
            console.error('Failed to copy text:', err);
            window.appLogger?.error('Failed to copy to clipboard', { error: err.message });
        });
};

// Helper function to delete a tag globally
window.deleteGlobalTag = function(tagName) {
    if (confirm(`Are you sure you want to delete the tag "${tagName}" everywhere?`)) {
        // Create and submit a form to delete the tag
        const form = document.createElement('form');
        form.method = 'POST';
        
        // Get the current URL parameters
        const currentUrl = new URL(window.location.href);
        const params = new URLSearchParams(currentUrl.search);
        
        // Build the delete tag URL
        form.action = `/tags/delete?state=${window.currentState || ''}&${params.toString()}`;
        
        // Add the tag to delete
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'tag_to_delete';
        input.value = tagName;
        
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
    }
};

// Helper function to delete an AND tag from context menu
window.deleteAndTagFromContextMenu = function(tagName) {
    console.log('deleteAndTagFromContextMenu called for:', tagName);
    
    if (confirm(`Are you sure you want to delete the AND tag '${tagName}'?`)) {
        console.log('User confirmed deletion, submitting form...');
        
        // Log the deletion event
        window.appLogger?.action('AND_TAG_DELETED_FROM_CONTEXT_MENU', {
            tagName: tagName,
            timestamp: Date.now()
        });
        
        // Get the current URL parameters
        const currentUrl = new URL(window.location.href);
        const params = new URLSearchParams(currentUrl.search);
        
        // Create and submit a form programmatically to delete the AND tag
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = `/and-tags/delete?state=${window.CURRENT_STATE || ''}&${params.toString()}`;
        
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'and_tag_to_delete';
        input.value = tagName;
        
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
    } else {
        console.log('User cancelled deletion');
    }
};

// Global functions for editor management
window.toggleEditorView = function(viewType) {
    const richTextContainer = document.getElementById('quill-editor-container');
    const htmlEditor = document.getElementById('html-editor');
    const previewContainer = document.getElementById('quill-preview-container');
    const toggleButtons = document.querySelectorAll('#editor-toggle-buttons .toggle-btn');
    
    // Reset all buttons
    toggleButtons.forEach(btn => {
        btn.classList.remove('bg-blue-500', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    
    // Hide all views
    richTextContainer.classList.add('hidden');
    htmlEditor.classList.add('hidden');
    previewContainer.classList.add('hidden');
    
    switch(viewType) {
        case 'richtext':
            richTextContainer.classList.remove('hidden');
            document.querySelector('button[onclick="toggleEditorView(\'richtext\')"]').classList.add('bg-blue-500', 'text-white');
            document.querySelector('button[onclick="toggleEditorView(\'richtext\')"]').classList.remove('bg-gray-200', 'text-gray-700');
            break;
        case 'html':
            htmlEditor.classList.remove('hidden');
            if (window.noteEditor && window.noteEditor.quill) {
                htmlEditor.value = window.noteEditor.quill.root.innerHTML;
            }
            document.querySelector('button[onclick="toggleEditorView(\'html\')"]').classList.add('bg-blue-500', 'text-white');
            document.querySelector('button[onclick="toggleEditorView(\'html\')"]').classList.remove('bg-gray-200', 'text-gray-700');
            break;
        case 'preview':
            previewContainer.classList.remove('hidden');
            if (window.noteEditor && window.noteEditor.quill) {
                previewContainer.innerHTML = window.noteEditor.quill.root.innerHTML;
                if (window.updateOrderedListStarts) {
                    window.updateOrderedListStarts(previewContainer);
                }
            }
            document.querySelector('button[onclick="toggleEditorView(\'preview\')"]').classList.add('bg-blue-500', 'text-white');
            document.querySelector('button[onclick="toggleEditorView(\'preview\')"]').classList.remove('bg-gray-200', 'text-gray-700');
            break;
    }
};

window.cleanActiveEditorContent = function(editorType) {
    let editor;
    
    switch(editorType) {
        case 'note':
            editor = window.noteEditor;
            break;
        case 'import':
            editor = window.importEditor;
            break;
        default:
            console.error('Unknown editor type:', editorType);
            return;
    }
    
    if (editor && editor.quill) {
        let content = editor.quill.root.innerHTML;
        
        // Remove empty paragraphs
        content = content.replace(/<p><br><\/p>/g, '');
        content = content.replace(/<p>\s*<\/p>/g, '');
        
        // Remove multiple consecutive <br> tags
        content = content.replace(/(<br\s*\/?>){3,}/g, '<br><br>');
        
        // Set the cleaned content back
        editor.quill.root.innerHTML = content;
        
        console.log(`✅ Cleaned ${editorType} editor content`);
    } else {
        console.error(`❌ ${editorType} editor not available for cleaning`);
    }
};

// --- Native Note Reordering ---
let reorderModeSections = new Set();
let draggedNoteId = null;

window.toggleNoteReorderMode = function(sectionId) {
    const noteList = document.getElementById('note-list-' + sectionId);
    if (!noteList) {
        console.warn('No note-list found for section', sectionId);
        return;
    }
    const notes = noteList.querySelectorAll('.note-draggable');
    const handles = noteList.querySelectorAll('.note-drag-handle');
    const enable = !reorderModeSections.has(sectionId);
    console.log('toggleNoteReorderMode', { sectionId, enable, notes: notes.length, handles: handles.length });
    if (enable) {
        reorderModeSections.add(sectionId);
        notes.forEach(note => {
            note.setAttribute('draggable', 'true');
            note.classList.add('drag-enabled');
            note.style.boxShadow = '0 0 0 2px #bbf7d0'; // subtle highlight
        });
        handles.forEach(h => h.classList.remove('hidden'));
    } else {
        reorderModeSections.delete(sectionId);
        notes.forEach(note => {
            note.setAttribute('draggable', 'false');
            note.classList.remove('drag-enabled');
            note.style.boxShadow = '';
        });
        handles.forEach(h => h.classList.add('hidden'));
    }
    // Log reorder mode toggle to logger (file), with fallback to backend if logger is missing or not working
    const logPayload = {
        sectionId,
        enable,
        notesCount: notes.length,
        handlesCount: handles.length,
        timestamp: Date.now(),
        url: window.location.href
    };
    let loggerWorked = false;
    try {
        if (window.appLogger && typeof window.appLogger.action === 'function') {
            window.appLogger.action('TOGGLE_NOTE_REORDER_MODE', logPayload);
            loggerWorked = true;
        }
    } catch (e) {
        loggerWorked = false;
    }
    if (!loggerWorked) {
        // Fallback: POST to main backend logging endpoint
        fetch('/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: 'TOGGLE_NOTE_REORDER_MODE',
                data: logPayload
            })
        }).catch(err => {
            console.warn('Failed to log reorder mode toggle to backend:', err);
        });
        console.warn('window.appLogger not available or failed, used backend logging fallback.');
    }
};

window.onNoteDragStart = function(event, sectionId) {
    if (!reorderModeSections.has(sectionId)) {
        event.preventDefault();
        return;
    }
    draggedNoteId = event.currentTarget.dataset.noteId;
    event.dataTransfer.effectAllowed = 'move';
    event.currentTarget.classList.add('opacity-50');
};

// --- Enhanced drag-over animation for notes ---
window.onNoteDragOver = function(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const target = event.currentTarget;
    // Remove drag-over classes from all siblings
    const siblings = target.parentElement.querySelectorAll('.note-draggable');
    siblings.forEach(sib => {
        sib.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    // Add class to show where the dragged note will go
    const rect = target.getBoundingClientRect();
    const before = (event.clientY - rect.top) < (rect.height / 2);
    if (before) {
        target.classList.add('drag-over-top');
    } else {
        target.classList.add('drag-over-bottom');
    }
};

window.onNoteDrop = function(event, sectionId) {
    event.preventDefault();
    if (!reorderModeSections.has(sectionId)) return;
    const noteList = document.getElementById('note-list-' + sectionId);
    const target = event.currentTarget;
    if (!draggedNoteId || !target || !noteList) return;
    const draggedElem = document.getElementById('note-' + draggedNoteId);
    if (draggedElem === target) return;
    // Insert before or after depending on mouse position
    const rect = target.getBoundingClientRect();
    const before = (event.clientY - rect.top) < (rect.height / 2);
    // Remove drag-over classes from all siblings
    const siblings = target.parentElement.querySelectorAll('.note-draggable');
    siblings.forEach(sib => {
        sib.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    if (before) {
        noteList.insertBefore(draggedElem, target);
    } else {
        noteList.insertBefore(draggedElem, target.nextSibling);
    }
    // Save new order
    saveNoteOrder(sectionId);
};

window.onNoteDragEnd = function(event) {
    event.currentTarget.classList.remove('opacity-50');
    // Remove drag-over classes from all notes
    document.querySelectorAll('.note-draggable').forEach(n => n.classList.remove('drag-over-top', 'drag-over-bottom'));
    draggedNoteId = null;
};

function saveNoteOrder(sectionId) {
    const noteList = document.getElementById('note-list-' + sectionId);
    if (!noteList) return;
    const noteIds = Array.from(noteList.querySelectorAll('.note-draggable')).map(n => n.dataset.noteId);
    fetch('/section/reorder_notes/' + sectionId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_ids: noteIds, state: window.CURRENT_STATE })
    })
    .then(async res => {
        const contentType = res.headers.get('content-type');
        const text = await res.text();
        if (!res.ok) {
            console.error('Server error response:', text);
            throw new Error('Server error: ' + res.status + ' - ' + text);
        }
        if (!contentType || !contentType.includes('application/json')) {
            console.error('Non-JSON response:', text);
            throw new Error('Expected JSON, got: ' + text.substring(0, 200));
        }
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error('JSON parse error. Raw response:', text);
            throw new Error('Invalid JSON: ' + e.message + '\nRaw: ' + text.substring(0, 200));
        }
    })
    .then(data => {
        if (!data.success) {
            let msg = 'Failed to save note order: ' + (data.message || 'Unknown error');
            if (data.error) {
                msg += '\n\nError details (copyable):\n' + data.error;
            }
            // Show error in a prompt for easy copying
            window.prompt(msg + '\n\nCopy this error if you need to report it:', msg);
        }
    })
    .catch(err => {
        // Show error in a prompt for easy copying
        window.prompt('Error saving note order: ' + err.message + '\n\nCopy this error if you need to report it:', err.message);
    });
}

// --- Allow dropping on the note-list container for easier drop ---
window.onNoteListDragOver = function(event, sectionId) {
    if (!reorderModeSections.has(sectionId)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    // Remove drag-over classes from all notes
    const noteList = document.getElementById('note-list-' + sectionId);
    noteList.querySelectorAll('.note-draggable').forEach(n => n.classList.remove('drag-over-top', 'drag-over-bottom'));
};

// --- Improved: Only drop at end if not hovering a note ---
window.onNoteListDrop = function(event, sectionId) {
    if (!reorderModeSections.has(sectionId)) return;
    event.preventDefault();
    const noteList = document.getElementById('note-list-' + sectionId);
    if (!draggedNoteId || !noteList) return;
    // Only append to end if not hovering a note
    const notes = Array.from(noteList.querySelectorAll('.note-draggable'));
    const mouseY = event.clientY;
    let inserted = false;
    for (const note of notes) {
        const rect = note.getBoundingClientRect();
        if (mouseY < rect.top + rect.height / 2) {
            noteList.insertBefore(document.getElementById('note-' + draggedNoteId), note);
            inserted = true;
            break;
        }
    }
    if (!inserted) {
        noteList.appendChild(document.getElementById('note-' + draggedNoteId));
    }
    saveNoteOrder(sectionId);
    noteList.querySelectorAll('.note-draggable').forEach(n => n.classList.remove('drag-over-top', 'drag-over-bottom'));
};

window.toggleNoteCompleted = function(sectionId, noteId) {
    fetch(`/note/toggle_completed/${sectionId}/${noteId}?state=${encodeURIComponent(window.CURRENT_STATE)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: window.CURRENT_STATE })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            const noteElem = document.getElementById('note-' + noteId);
            if (noteElem) {
                // Update background
                if (data.completed) {
                    noteElem.classList.add('note-completed');
                    noteElem.classList.remove('bg-white');
                    noteElem.setAttribute('data-completed', 'true');
                } else {
                    noteElem.classList.remove('note-completed');
                    noteElem.classList.add('bg-white');
                    noteElem.removeAttribute('data-completed');
                }
                // Update checkmark SVG
                // Find the checkmark button (first button in the flex row)
                const btn = noteElem.querySelector('button[onclick^="toggleNoteCompleted"]');
                if (btn) {
                    if (data.completed) {
                        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="text-green-600"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>`;
                    } else {
                        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="text-gray-400"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
                    }
                }
                // Immediately update Content Menu
                if (window.renderContentMenu) {
                    window.renderContentMenu();
                } else if (typeof renderContentMenu === 'function') {
                    renderContentMenu();
                }
            }
        } else {
            alert('Failed to toggle completed: ' + (data.message || 'Unknown error'));
        }
    })
    .catch(err => {
        alert('Error toggling completed: ' + err.message);
    });
};
function nestQuillListsInBlock(block) {
    block.querySelectorAll('ul, ol').forEach(list => {
        // Only process lists with ql-indent classes
        if (!Array.from(list.children).some(li => li.className && li.className.match(/ql-indent-\d+/))) return;

        // Gather all <li> and their indent levels
        const items = Array.from(list.children).map(li => {
            const match = (li.className || '').match(/ql-indent-(\d+)/);
            const level = match ? parseInt(match[1], 10) : 0;
            const newLi = li.cloneNode(true);
            newLi.className = (newLi.className || '').replace(/ql-indent-\d+/g, '').trim();
            return { level, li: newLi };
        });

        // Build the nested list structure
        const root = document.createElement(list.tagName.toLowerCase());
        let parents = [root];
        let lastLevel = 0;

        items.forEach(({ level, li }) => {
            if (level > lastLevel) {
                // Create a new sublist and append to previous <li>
                const sublist = document.createElement(list.tagName.toLowerCase());
                parents[parents.length - 1].lastElementChild.appendChild(sublist);
                parents.push(sublist);
            } else if (level < lastLevel) {
                // Go up to the correct parent
                parents = parents.slice(0, level + 1);
            }
            parents[parents.length - 1].appendChild(li);
            lastLevel = level;
        });

        // Replace the old list with the new nested one
        list.parentNode.replaceChild(root, list);
    });
}

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('#main-content .prose').forEach(block => {
        nestQuillListsInBlock(block);
    });
});

// Expand all notes and sections in current state
window.expandAll = function() {
    // Expand all sections
    document.querySelectorAll('[id^="section-"]').forEach(function(sectionElem) {
        sectionElem.classList.remove('collapsed');
        const noteList = sectionElem.querySelector('.note-list');
        if (noteList) noteList.classList.remove('collapsed-content');
        const collapseBtn = sectionElem.querySelector('.collapse-btn .collapse-icon');
        if (collapseBtn) {
            collapseBtn.innerHTML = '';
            collapseBtn.insertAdjacentHTML('afterbegin', '<path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" />');
        }
    });
    // Expand all notes
    document.querySelectorAll('.note-draggable').forEach(function(noteElem) {
        const contentElem = noteElem.querySelector('.note-content');
        if (contentElem) contentElem.classList.remove('collapsed-content');
        const collapseBtn = noteElem.querySelector('.collapse-btn .collapse-icon');
        if (collapseBtn) {
            collapseBtn.innerHTML = '';
            collapseBtn.insertAdjacentHTML('afterbegin', '<path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" />');
        }
    });
    // Optionally, persist expanded state to backend
    fetch(`/expand_all?state=${encodeURIComponent(window.CURRENT_STATE)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: window.CURRENT_STATE })
    });
}

window.removeTagFromCategoryFromContextMenu = function(tagName, categoryId) {
    fetch('/remove_tag_from_category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tag: tagName,
            category_id: categoryId,
            state: window.CURRENT_STATE
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            // Remove the tag from the category in the DOM
            // Find the tag element in the category and remove it
            const tagElems = document.querySelectorAll(`[data-tag-name="${tagName}"][data-category-id="${categoryId}"]`);
            tagElems.forEach(el => el.remove());
            // Optionally, show a toast/alert
            if (data.tag_deleted) {
                alert(`Tag '${tagName}' was removed from category and deleted globally (orphan).`);
            } else {
                alert(`Tag '${tagName}' was removed from category.`);
            }
        } else {
            alert('Failed to remove tag from category: ' + (data.error || 'Unknown error'));
        }
    })
    .catch(err => {
        alert('Error removing tag from category: ' + err);
    });
}