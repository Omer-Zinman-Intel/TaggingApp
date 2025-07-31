// Global ESC key handler to close modals
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        // Find the topmost visible modal
        const modals = Array.from(document.querySelectorAll('.modal')).filter(m => !m.classList.contains('hidden'));
        if (modals.length > 0) {
            // Hide the last (topmost) visible modal
            const topModal = modals[modals.length - 1];
            hideModal(topModal.id);
        }
    }
});
// --- Robust modal openers (single definition, robust initialization) ---
function showCreateStateModal() {
    initializeModalSystem();
    try {
        const input = document.getElementById('new_state_name');
        if (input) input.value = '';
        setTimeout(() => { if (input) input.focus(); }, 100);
        const modal = document.getElementById('createStateModal');
        const form = modal ? modal.querySelector('form') : null;
        if (form) {
            if (form._submitHandler) form.removeEventListener('submit', form._submitHandler);
            const submitHandler = function(e) {
                if (!input.value.trim()) {
                    e.preventDefault();
                    alert('State name is required.');
                    input.focus();
                }
            };
            form.addEventListener('submit', submitHandler);
            form._submitHandler = submitHandler;
        }
        showModal('createStateModal');
    } catch (error) {
        console.error('Error in showCreateStateModal:', error);
    }
}

function showAddCategoryModal() {
    initializeModalSystem();
    try {
        const input = document.getElementById('new_category_name');
        if (input) input.value = '';
        setTimeout(() => { if (input) input.focus(); }, 100);
        const modal = document.getElementById('addCategoryModal');
        const form = modal ? modal.querySelector('form') : null;
        if (form) {
            if (form._submitHandler) form.removeEventListener('submit', form._submitHandler);
            const submitHandler = function(e) {
                if (!input.value.trim()) {
                    e.preventDefault();
                    alert('Category name is required.');
                    input.focus();
                }
            };
            form.addEventListener('submit', submitHandler);
            form._submitHandler = submitHandler;
        }
        showModal('addCategoryModal');
    } catch (error) {
        console.error('Error in showAddCategoryModal:', error);
    }
}

function showAddAndTagModal() {
    initializeModalSystem();
    try {
        const container = document.getElementById('newAndTagComponentsContainer');
        if (container) container.innerHTML = '';
        if (typeof addNewAndTagComponent === 'function') {
            addNewAndTagComponent();
            addNewAndTagComponent();
        }
        const preview = document.getElementById('andTagPreview');
        if (preview) preview.classList.add('hidden');
        const modal = document.getElementById('addAndTagModal');
        const form = modal ? modal.querySelector('form') : null;
        if (form) {
            if (form._submitHandler) form.removeEventListener('submit', form._submitHandler);
            const submitHandler = function(e) {
                const inputs = container ? container.querySelectorAll('input[type="text"]') : [];
                const components = Array.from(inputs).map(input => input.value.trim()).filter(Boolean);
                if (components.length < 2) {
                    e.preventDefault();
                    alert('Please enter at least two tag components.');
                    if (inputs[0]) inputs[0].focus();
                }
            };
            form.addEventListener('submit', submitHandler);
            form._submitHandler = submitHandler;
        }
        showModal('addAndTagModal');
    } catch (error) {
        console.error('Error in showAddAndTagModal:', error);
    }
}

function showManualImportModal() {
    initializeModalSystem();
    try {
        if (window.importEditor && window.importEditor.resetEditor) {
            window.importEditor.resetEditor();
        }
        const htmlEditor = document.getElementById('html-import-editor');
        if (htmlEditor) htmlEditor.value = '';
        if (window.toggleImportEditorView) window.toggleImportEditorView('richtext');
        const modal = document.getElementById('importModal');
        const form = modal ? modal.querySelector('form') : null;
        if (form) {
            if (form._submitHandler) form.removeEventListener('submit', form._submitHandler);
            const submitHandler = function(e) {
                const contentInput = document.getElementById('import_html_content');
                if (!contentInput.value.trim()) {
                    e.preventDefault();
                    alert('Please provide content to import.');
                    if (htmlEditor) htmlEditor.focus();
                }
            };
            form.addEventListener('submit', submitHandler);
            form._submitHandler = submitHandler;
        }
        showModal('importModal');
    } catch (error) {
        console.error('Error in showManualImportModal:', error);
    }
}

function showRenameStateModal(currentState) {
    initializeModalSystem();
    try {
        const oldStateInput = document.getElementById('renameOldStateName');
        const oldStateText = document.getElementById('oldStateName');
        const newStateInput = document.getElementById('renameNewStateName');
        if (oldStateInput) oldStateInput.value = currentState || '';
        if (oldStateText) oldStateText.textContent = currentState || '';
        if (newStateInput) newStateInput.value = currentState || '';
        setTimeout(() => { if (newStateInput) newStateInput.focus(); }, 100);
        const modal = document.getElementById('renameStateModal');
        const form = modal ? modal.querySelector('form') : null;
        if (form) {
            if (form._submitHandler) form.removeEventListener('submit', form._submitHandler);
            const submitHandler = function(e) {
                if (!newStateInput.value.trim()) {
                    e.preventDefault();
                    alert('New state name is required.');
                    newStateInput.focus();
                }
            };
            form.addEventListener('submit', submitHandler);
            form._submitHandler = submitHandler;
        }
        showModal('renameStateModal');
    } catch (error) {
        console.error('Error in showRenameStateModal:', error);
    }
}

// Assign robust modal openers globally (single assignment, after definition)
window.showCreateStateModal = showCreateStateModal;
window.showAddCategoryModal = showAddCategoryModal;
window.showAddAndTagModal = showAddAndTagModal;
window.showManualImportModal = showManualImportModal;
window.showRenameStateModal = showRenameStateModal;
// Helper to launch section modal using data-* attributes (like notes)
function showEditSectionModalFromData(btn) {
    const sectionId = btn.getAttribute('data-section-id');
    const sectionTitle = btn.getAttribute('data-section-title');
    const sectionTags = btn.getAttribute('data-section-tags');
    const sectionCategories = btn.getAttribute('data-section-categories');
    showEditSectionModal(sectionId, sectionTitle, sectionTags, sectionCategories);
}
// Global script - no ES6 modules
// Using global tag input system

// Test function to verify modal functions are accessible
function testModalFunctions() {
    console.log('=== Modal Functions Test ===');
    console.log('showModal function:', typeof showModal);
    console.log('hideModal function:', typeof hideModal);
    console.log('handleNoteModalCancel function:', typeof handleNoteModalCancel);
    console.log('handleImportModalCancel function:', typeof handleImportModalCancel);
    console.log('window.showModal:', typeof window.showModal);
    console.log('window.hideModal:', typeof window.hideModal);
    console.log('================================');
}



// Assign modal functions globally, including showAddAndTagModal from window if present
window.showModal = showModal;
window.hideModal = hideModal;
window.testModalFunctions = testModalFunctions;
window.showEditSectionModal = showEditSectionModal;
window.showEditNoteModal = showEditNoteModal;
window.showImportModal = showImportModal;
window.showRenameModal = showRenameModal;
window.showRenameStateModal = showRenameStateModal;
window.showRenameCategoryModal = showRenameCategoryModal;
window.showEditAndTagModal = showEditAndTagModal;
// Assign showAddAndTagModal if defined globally (from index.html)
if (typeof window.showAddAndTagModal === 'function') {
    window.showAddAndTagModal = window.showAddAndTagModal;
}

function showModal(modalId) {
    // Always initialize modal system before showing any modal
    initializeModalSystem();
    window.appLogger?.buttonClick('SHOW_MODAL', { modalId });
    console.log('showModal called with modalId:', modalId);

    // Hide all other modals before showing the requested one
    document.querySelectorAll('.modal').forEach(m => {
        if (m.id !== modalId) m.classList.add('hidden', 'opacity-0');
    });

    const modal = document.getElementById(modalId);
    console.log('modal element:', modal);

    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.remove('opacity-0');
        modal.offsetHeight; // Force reflow
        console.log('Modal should now be visible');

        // Validate modal components
        const components = validateModalComponents(modalId);
        window.appLogger?.modalLoaded(modalId, components);

        // Focus first input if it exists
        setTimeout(() => {
            const firstInput = modal.querySelector('input[type="text"], textarea');
            if (firstInput) {
                firstInput.focus();
                window.appLogger?.componentStatus('FIRST_INPUT', 'focused', { modalId, inputId: firstInput.id });
            }
        }, 100);
    } else {
        window.appLogger?.error('Modal not found:', modalId);
        console.error('Modal not found:', modalId);
    }
}

function validateModalComponents(modalId) {
    const components = {
        modal: !!document.getElementById(modalId),
        forms: [],
        inputs: [],
        buttons: [],
        required_elements: []
    };
    
    const modal = document.getElementById(modalId);
    if (modal) {
        // Count forms
        components.forms = Array.from(modal.querySelectorAll('form')).map(form => ({
            id: form.id,
            action: form.action,
            method: form.method
        }));
        
        // Count inputs
        components.inputs = Array.from(modal.querySelectorAll('input, textarea, select')).map(input => ({
            id: input.id,
            type: input.type,
            name: input.name,
            required: input.required
        }));
        
        // Count buttons
        components.buttons = Array.from(modal.querySelectorAll('button')).map(button => ({
            id: button.id,
            type: button.type,
            text: button.textContent?.trim()
        }));
        
        // Modal-specific required elements
        switch(modalId) {
            case 'editSectionModal':
                components.required_elements = [
                    { id: 'editSectionForm', exists: !!document.getElementById('editSectionForm') },
                    { id: 'editSectionTitle', exists: !!document.getElementById('editSectionTitle') },
                    { id: 'editSectionTagsContainer', exists: !!document.getElementById('editSectionTagsContainer') },
                    { id: 'editSectionTagsInput', exists: !!document.getElementById('editSectionTagsInput') },
                    { id: 'section-suggestions', exists: !!document.getElementById('section-suggestions') }
                ];
                break;
            case 'editNoteModal':
                components.required_elements = [
                    { id: 'editNoteForm', exists: !!document.getElementById('editNoteForm') },
                    { id: 'editNoteTitle', exists: !!document.getElementById('editNoteTitle') },
                    { id: 'quill-editor', exists: !!document.getElementById('quill-editor') },
                    { id: 'editNoteTagsContainer', exists: !!document.getElementById('editNoteTagsContainer') }
                ];
                break;
            case 'importModal':
                components.required_elements = [
                    { id: 'importForm', exists: !!document.getElementById('importForm') },
                    { id: 'import-editor', exists: !!document.getElementById('import-editor') },
                    { id: 'docx-file-input', exists: !!document.getElementById('docx-file-input') }
                ];
                break;
        }
    }
    
    return components;
}

function hideModal(modalId) {
    console.log('🚫 hideModal called with modalId:', modalId);
    window.appLogger?.buttonClick('HIDE_MODAL', { modalId });
    
    // Handle cancellation logic for specific modals
    if (modalId === 'editNoteModal') {
        console.log('🚫 Handling note modal cancel');
        handleNoteModalCancel();
    } else if (modalId === 'importModal') {
        console.log('🚫 Handling import modal cancel');
        handleImportModalCancel();
    }
    
    const modal = document.getElementById(modalId);
    console.log('🚫 Modal element found:', !!modal);
    
    if (modal) {
        console.log('🚫 Adding opacity-0 class');
        modal.classList.add('opacity-0');
        setTimeout(() => {
            console.log('🚫 Adding hidden class');
            modal.classList.add('hidden');
            window.appLogger?.action('MODAL_CLOSED', { modalId });
        }, 250);
    } else {
        console.error('❌ Modal not found for hiding:', modalId);
        window.appLogger?.error('Modal not found for hiding:', modalId);
    }
}

function handleNoteModalCancel() {
    console.log('🚫 Note modal cancelled - clearing unsaved changes');
    
    try {
        // Reset the editor to clear any styling/formatting state
        if (window.noteEditor && window.noteEditor.resetEditor) {
            window.noteEditor.resetEditor();
            console.log('🚫 Note editor reset on cancel');
        }
        
        // Clear any auto-save backups that shouldn't persist after cancellation
        if (window.contentPreservation) {
            console.log('🚫 Found contentPreservation, calling clearCancelledChanges');
            window.contentPreservation.clearCancelledChanges('note', 'editNoteForm');
            console.log('🚫 clearCancelledChanges completed successfully');
        } else {
            console.log('🚫 No contentPreservation found, skipping cleanup');
        }
        
        window.appLogger?.action('NOTE_MODAL_CANCELLED', {
            timestamp: Date.now(),
            editorReset: true
        });
        
        console.log('🚫 Note modal cancel handling completed');
    } catch (error) {
        console.error('❌ Error in handleNoteModalCancel:', error);
        window.appLogger?.error('Note modal cancel failed', { error: error.message });
    }
}

function handleImportModalCancel() {
    console.log('🚫 Import modal cancelled - clearing unsaved changes');
    
    try {
        // Reset the editor to clear any styling/formatting state
        if (window.importEditor && window.importEditor.resetEditor) {
            window.importEditor.resetEditor();
            console.log('🚫 Import editor reset on cancel');
        }
        
        // Clear any auto-save backups that shouldn't persist after cancellation
        if (window.contentPreservation) {
            console.log('🚫 Found contentPreservation, calling clearCancelledChanges');
            window.contentPreservation.clearCancelledChanges('import', 'importForm');
            console.log('🚫 clearCancelledChanges completed successfully');
        } else {
            console.log('🚫 No contentPreservation found, skipping cleanup');
        }
        
        window.appLogger?.action('IMPORT_MODAL_CANCELLED', {
            timestamp: Date.now(),
            editorReset: true
        });
        
        console.log('🚫 Import modal cancel handling completed');
    } catch (error) {
        console.error('❌ Error in handleImportModalCancel:', error);
        window.appLogger?.error('Import modal cancel failed', { error: error.message });
    }
}

function showEditSectionModal(sectionId, title, tags, categoriesJson) {
    window.appLogger?.action('SHOW_EDIT_SECTION_MODAL', { sectionId, title, tags });
    
    try {
        console.log('showEditSectionModal called with:', { sectionId, title, tags });
        
        const form = document.getElementById('editSectionForm');
        if (!form) {
            throw new Error('editSectionForm not found');
        }
        window.appLogger?.componentStatus('editSectionForm', 'found');
        
        const currentUrl = new URL(window.location.href);
        form.action = `/section/update/${sectionId}` + currentUrl.search;
        window.appLogger?.componentStatus('form_action', 'set', { action: form.action });
        
        const titleInput = document.getElementById('editSectionTitle');
        if (!titleInput) {
            throw new Error('editSectionTitle input not found');
        }
        titleInput.value = title || '';
        window.appLogger?.componentStatus('editSectionTitle', 'populated', { value: title });
        

        // Process tags
        let tagList = [];
        if (!tags) {
            tagList = [];
        } else if (Array.isArray(tags)) {
            tagList = tags.filter(t => t);
        } else if (typeof tags === 'string') {
            tagList = tags.split(',').map(t => t.trim()).filter(t => t);
        }
        window.appLogger?.componentStatus('tags_processed', 'success', { originalTags: tags, processedTags: tagList });

        // Process categories
        let categoryList = [];
        if (categoriesJson) {
            try {
                categoryList = JSON.parse(categoriesJson);
            } catch (e) {
                window.appLogger?.error('Failed to parse section categories JSON', { categoriesJson, error: e });
                categoryList = [];
            }
        }
        window.appLogger?.componentStatus('categories_processed', 'success', { originalCategories: categoriesJson, processedCategories: categoryList });

        const tagsHiddenInput = document.getElementById('editSectionTags');
        if (tagsHiddenInput) {
            tagsHiddenInput.value = tagList.join(', ');
            window.appLogger?.componentStatus('editSectionTags', 'populated', { value: tagsHiddenInput.value });
        }
        
        // Initialize tag input with detailed logging
        setTimeout(() => {
            window.appLogger?.action('INITIALIZING_SECTION_TAG_INPUT');
            
            if (window.createTagInput) {
                if (!window.tagInputs) window.tagInputs = {};
                console.log('Creating section tag input for modal - checking elements...');
                
                const elements = {
                    container: document.getElementById('editSectionTagsContainer'),
                    input: document.getElementById('editSectionTagsInput'),
                    hiddenInput: document.getElementById('editSectionTags'),
                    suggestions: document.getElementById('section-suggestions')
                };
                
                console.log('Section modal elements check:', elements);
                window.appLogger?.componentStatus('tag_input_elements', 'checked', elements);
                
                const allElementsFound = Object.values(elements).every(el => el);
                window.appLogger?.componentStatus('all_tag_elements', allElementsFound ? 'found' : 'missing', {
                    elementsFound: allElementsFound,
                    missingElements: Object.keys(elements).filter(key => !elements[key])
                });
                
                if (allElementsFound) {
                    console.log('All elements found, creating section tag input...');
                    window.tagInputs.section = window.createTagInput(
                        'editSectionTagsContainer',
                        'editSectionTagsInput',
                        'editSectionTags',
                        'section-suggestions'
                    );
                    window.appLogger?.componentStatus('section_tag_input', 'created', { success: !!window.tagInputs.section });
                    
                    if (window.tagInputs.section) {
                        // Always initialize with both tags and categories
                        // Normalize categories to array of IDs if needed
                        function normalizeCategoryArray(categories) {
                            if (!Array.isArray(categories)) return [];
                            if (categories.length > 0 && typeof categories[0] === 'object' && categories[0].id) {
                                return categories.map(cat => cat.id);
                            }
                            return categories;
                        }
                        const normalizedCategories = normalizeCategoryArray(categoryList);
                        window.tagInputs.section.init(tagList, normalizedCategories);
                        window.appLogger?.componentStatus('section_tags', 'initialized', { tags: tagList, categories: normalizedCategories });
                        console.log('Section tags initialized successfully');
                        // Attach submit handler to always send tags/categories
                        const form = document.getElementById('editSectionForm');
                        if (form) {
                            form.addEventListener('submit', function(e) {
                                try {
                                    // Ensure hidden categories input exists
                                    let categoriesInput = form.querySelector('input[name="categories"]');
                                    if (!categoriesInput) {
                                        categoriesInput = document.createElement('input');
                                        categoriesInput.type = 'hidden';
                                        categoriesInput.name = 'categories';
                                        form.appendChild(categoriesInput);
                                    }
                                    window.tagInputs.section.submitToBackend(form);
                                    if (window.appLogger) {
                                        window.appLogger.log('Form submit: section', {
                                            tags: form.querySelector('input[name="tags"]').value,
                                            categories: form.querySelector('input[name="categories"]').value
                                        });
                                    }
                                } catch (err) {
                                    console.error('Form submit error (section):', err);
                                    if (window.appLogger) {
                                        window.appLogger.error('Form submit error (section)', err);
                                    }
                                }
                            });
                        }
                    }
                } else {
                    window.appLogger?.error('Missing elements for section tag input creation:', elements);
                    console.error('Missing elements for section tag input creation:', elements);
                }
            } else {
                window.appLogger?.error('createTagInput function not available');
                console.error('createTagInput function not available');
            }
        }, 500);
        
        showModal('editSectionModal');
        window.appLogger?.action('EDIT_SECTION_MODAL_SHOWN', { sectionId });
        
    } catch (error) {
        window.appLogger?.error('Error in showEditSectionModal:', error.message, { sectionId, title, tags });
        console.error('Error in showEditSectionModal:', error);
        if (window.logModalError) {
            window.logModalError('showEditSectionModal', 'editSectionModal', error, { sectionId, title, tags });
        }
        showModal('editSectionModal');
    }
}

function showEditNoteModal(btn) {
    try {
        if (!btn || !btn.dataset) throw new Error('Button or dataset missing');
        // Parse data attributes safely
        let sectionId = btn.dataset.sectionId;
        let noteId = btn.dataset.noteId;
        let title = '';
        let content = '';
        let tags = [];
        let categories = [];
        try { title = btn.dataset.title ? JSON.parse(btn.dataset.title) : ''; } catch (e) { title = btn.dataset.title || ''; }
        try { content = btn.dataset.content ? JSON.parse(btn.dataset.content) : ''; } catch (e) { content = btn.dataset.content || ''; }
        try { tags = btn.dataset.tags ? JSON.parse(btn.dataset.tags) : []; } catch (e) { tags = []; }
        try { categories = btn.dataset.categories ? JSON.parse(btn.dataset.categories) : []; } catch (e) { categories = []; }

        window.appLogger?.action('SHOW_EDIT_NOTE_MODAL_START', { 
            sectionId, 
            noteId, 
            title, 
            contentLength: content?.length || 0,
            tags: tags,
            categories: categories
        });

        const form = document.getElementById('editNoteForm');
        if (!form) {
            throw new Error('editNoteForm not found');
        }

        const currentUrl = new URL(window.location.href);
        let searchParams = currentUrl.search;
        if (!searchParams.includes('state=') && window.currentState) {
            searchParams = searchParams ? `${searchParams}&state=${window.currentState}` : `?state=${window.currentState}`;
        }
        form.action = `/note/update/${sectionId}/${noteId}${searchParams}`;

        window.appLogger?.action('FORM_ACTION_SET', { 
            formAction: form.action,
            sectionId,
            noteId
        });

        const titleInput = document.getElementById('editNoteTitle');
        if (!titleInput) {
            throw new Error('editNoteTitle input not found');
        }
        titleInput.value = title || '';

        const contentInput = document.getElementById('editNoteContent');
        if (!contentInput) {
            throw new Error('editNoteContent input not found');
        }
        contentInput.value = content || '';

        window.appLogger?.action('MODAL_FIELDS_POPULATED', {
            titleLength: titleInput.value.length,
            contentLength: contentInput.value.length
        });

        if (window.noteEditor) {
            if (window.noteEditor.resetEditor) {
                window.noteEditor.resetEditor();
            }
            window.noteEditor.setContent(content || '');
            if (window.toggleEditorView) {
                window.toggleEditorView('richtext');
            }
            window.appLogger?.action('NOTE_EDITOR_CONTENT_SET', {
                contentLength: content?.length || 0,
                editorAvailable: true,
                editorReset: true
            });
        } else if (window.noteEditorQuill) {
            window.noteEditorQuill.root.innerHTML = content || '';
            if (window.toggleEditorView) {
                window.toggleEditorView('richtext');
            }
            window.appLogger?.action('NOTE_EDITOR_FALLBACK_USED', {
                contentLength: content?.length || 0
            });
        } else {
            window.appLogger?.error('Note editor not available, attempting to initialize');
            setTimeout(() => {
                if (typeof window.initializeEditors === 'function') {
                    window.initializeEditors();
                    if (window.noteEditor) {
                        if (window.noteEditor.resetEditor) {
                            window.noteEditor.resetEditor();
                        }
                        window.noteEditor.setContent(content || '');
                        if (window.toggleEditorView) {
                            window.toggleEditorView('richtext');
                        }
                        window.appLogger?.action('NOTE_EDITOR_LATE_INIT_SUCCESS');
                    }
                } else {
                    window.appLogger?.error('Cannot initialize editors: initializeEditors function not available');
                }
            }, 300);
        }

        // Ensure tags/categories are arrays
        let tagList = Array.isArray(tags) ? tags.filter(t => t) : [];
        let categoryList = Array.isArray(categories) ? categories : [];
        if (window.appLogger && typeof window.appLogger.error === 'function') {
            window.appLogger.error('[DEBUG] Categories for note initialization (modal open):', categoryList);
        }
        // Set tags in hidden input for fallback
        const tagsHiddenInput = document.getElementById('editNoteTags');
        if (tagsHiddenInput) {
            tagsHiddenInput.value = tagList.join(', ');
        }
        // Initialize tag input when modal opens - wait for modal to be visible
        setTimeout(() => {
            // --- COPY OF SECTION MODAL LOGIC FOR TAG INPUT ---
            if (window.createTagInput) {
                if (!window.tagInputs) window.tagInputs = {};
                const elements = {
                    container: document.getElementById('editNoteTagsContainer'),
                    input: document.getElementById('editNoteTagsInput'),
                    hiddenInput: document.getElementById('editNoteTags'),
                    suggestions: document.getElementById('note-suggestions')
                };
                const allElementsFound = Object.values(elements).every(el => el);
                if (allElementsFound) {
                    window.tagInputs.note = window.createTagInput(
                        'editNoteTagsContainer',
                        'editNoteTagsInput',
                        'editNoteTags',
                        'note-suggestions'
                    );
                    // Always initialize with both tags and categories
                    function normalizeCategoryArray(categories) {
                        if (!Array.isArray(categories)) return [];
                        if (categories.length > 0 && typeof categories[0] === 'object' && categories[0].id) {
                            return categories.map(cat => cat.id);
                        }
                        return categories;
                    }
                    const normalizedCategories = normalizeCategoryArray(categoryList);
                    window.tagInputs.note.init(tagList, normalizedCategories);
                    if (window.appLogger && typeof window.appLogger.error === 'function') {
                        window.appLogger.error('[DEBUG] tagInputs.note.init called with:', { tags: tagList, categories: normalizedCategories });
                        window.appLogger.error('[DEBUG] tagInputs.note.getCategories() after init:', window.tagInputs.note.getCategories());
                    }
                    // Attach submit handler to always send tags/categories
                    const form = document.getElementById('editNoteForm');
                    if (form) {
                        // Remove previous submit handler if present
                        if (form._noteSubmitHandler) {
                            form.removeEventListener('submit', form._noteSubmitHandler);
                        }
                        // Define and attach new submit handler
                        const noteSubmitHandler = function(e) {
                            try {
                                // Ensure hidden categories input exists
                                let categoriesInput = form.querySelector('input[name="categories"]');
                                if (!categoriesInput) {
                                    categoriesInput = document.createElement('input');
                                    categoriesInput.type = 'hidden';
                                    categoriesInput.name = 'categories';
                                    form.appendChild(categoriesInput);
                                }
                                // Ensure hidden tags input exists
                                let tagsInput = form.querySelector('input[name="tags"]');
                                if (!tagsInput) {
                                    tagsInput = document.createElement('input');
                                    tagsInput.type = 'hidden';
                                    tagsInput.name = 'tags';
                                    form.appendChild(tagsInput);
                                }
                                // --- FORCE UPDATE hidden fields from tag input system ---
                                const currentTags = window.tagInputs.note.tags || [];
                                const currentCategories = window.tagInputs.note.getCategories ? window.tagInputs.note.getCategories() : [];
                                tagsInput.value = currentTags.join(', ');
                                categoriesInput.value = JSON.stringify(currentCategories);
                                // Debug: log values before backend submit
                                const debugBefore = {
                                    tags: currentTags,
                                    categories: currentCategories,
                                    tagsInputValue: tagsInput.value,
                                    categoriesInputValue: categoriesInput.value
                                };
                                console.log('[NOTE MODAL SUBMIT] Before submitToBackend:', debugBefore);
                                if (window.appLogger && typeof window.appLogger.error === 'function') {
                                    window.appLogger.error('[NOTE MODAL SUBMIT] Before submitToBackend', debugBefore);
                                }
                                window.tagInputs.note.submitToBackend(form);
                                const debugAfter = {
                                    tagsInputValue: tagsInput.value,
                                    categoriesInputValue: categoriesInput.value
                                };
                                console.log('[NOTE MODAL SUBMIT] After submitToBackend:', debugAfter);
                                if (window.appLogger && typeof window.appLogger.error === 'function') {
                                    window.appLogger.error('[NOTE MODAL SUBMIT] After submitToBackend', debugAfter);
                                }
                                if (window.appLogger) {
                                    window.appLogger.action('FORM_SUBMIT_NOTE', {
                                        tags: tagsInput.value,
                                        categories: categoriesInput.value
                                    });
                                }
                            } catch (err) {
                                console.error('Form submit error (note):', err, err?.stack);
                                if (window.appLogger) {
                                    window.appLogger.error('Form submit error (note)', err?.message || err);
                                }
                            }
                        };
                        form.addEventListener('submit', noteSubmitHandler);
                        form._noteSubmitHandler = noteSubmitHandler;
                    }
                } else {
                    window.appLogger?.error('Missing elements for note tag input creation:', elements);
                    console.error('Missing elements for note tag input creation:', elements);
                }
            } else {
                window.appLogger?.error('createTagInput function not available');
                console.error('createTagInput function not available');
            }
        }, 500);
        showModal('editNoteModal');
    } catch (error) {
        console.error('Error in showEditNoteModal:', error);
        if (window.logModalError) {
            window.logModalError('showEditNoteModal', 'editNoteModal', error);
        }
        showModal('editNoteModal');
    }
}

function showImportModal() {
    console.log('[DEBUG] showImportModal called');
    // Clear both editors using proper reset method
    if (window.importEditor) {
        if (window.importEditor.resetEditor) {
            window.importEditor.resetEditor();
        } else if (window.importEditor.quill) {
            window.importEditor.quill.root.innerHTML = '';
        }
    }
    const htmlEditor = document.getElementById('html-import-editor');
    if (htmlEditor) {
        htmlEditor.value = '';
    }
    // Start with rich text view
    if (window.toggleImportEditorView) {
        window.toggleImportEditorView('richtext');
    }

    // --- Robust initialization for import modal ---
    setTimeout(() => {
        // Tag/category input system for import modal (if present)
        if (window.createTagInput) {
            if (!window.tagInputs) window.tagInputs = {};
            const elements = {
                container: document.getElementById('importTagsContainer'),
                input: document.getElementById('importTagsInput'),
                hiddenInput: document.getElementById('importTags'),
                suggestions: document.getElementById('import-suggestions')
            };
            const allElementsFound = Object.values(elements).every(el => el);
            if (allElementsFound) {
                window.tagInputs.import = window.createTagInput(
                    'importTagsContainer',
                    'importTagsInput',
                    'importTags',
                    'import-suggestions'
                );
                // Always initialize with both tags and categories (empty by default)
                window.tagInputs.import.init([], []);
                // Attach submit handler to always send tags/categories
                const form = document.getElementById('importForm');
                if (form) {
                    if (form._importSubmitHandler) {
                        form.removeEventListener('submit', form._importSubmitHandler);
                    }
                    const importSubmitHandler = function(e) {
                        try {
                            // Ensure hidden categories input exists
                            let categoriesInput = form.querySelector('input[name="categories"]');
                            if (!categoriesInput) {
                                categoriesInput = document.createElement('input');
                                categoriesInput.type = 'hidden';
                                categoriesInput.name = 'categories';
                                form.appendChild(categoriesInput);
                            }
                            // Ensure hidden tags input exists
                            let tagsInput = form.querySelector('input[name="tags"]');
                            if (!tagsInput) {
                                tagsInput = document.createElement('input');
                                tagsInput.type = 'hidden';
                                tagsInput.name = 'tags';
                                form.appendChild(tagsInput);
                            }
                            // --- FORCE UPDATE hidden fields from tag input system ---
                            const currentTags = window.tagInputs.import.tags || [];
                            const currentCategories = window.tagInputs.import.getCategories ? window.tagInputs.import.getCategories() : [];
                            tagsInput.value = currentTags.join(', ');
                            categoriesInput.value = JSON.stringify(currentCategories);
                            window.tagInputs.import.submitToBackend(form);
                        } catch (err) {
                            console.error('Form submit error (import):', err);
                            if (window.appLogger) {
                                window.appLogger.error('Form submit error (import)', err);
                            }
                        }
                    };
                    form.addEventListener('submit', importSubmitHandler);
                    form._importSubmitHandler = importSubmitHandler;
                }
            } else {
                window.appLogger?.error('Missing elements for import tag input creation:', elements);
                console.error('Missing elements for import tag input creation:', elements);
            }
        }
    }, 500);
    showModal('importModal');
}

function showRenameModal(tag) {
    console.log('showRenameModal called with tag:', tag);
    
    // Check if the modal exists
    const modal = document.getElementById('renameTagModal');
    if (!modal) {
        console.error('renameTagModal not found!');
        return;
    }
    
    const form = modal.querySelector('form');
    if (!form) {
        console.error('Form not found in renameTagModal!');
        return;
    }
    
    const currentUrl = new URL(window.location.href);
    // Ensure state and filter parameters are preserved
    form.action = `/tags/rename` + currentUrl.search;
    console.log('Form action set to:', form.action);
    
    const oldTagInput = document.getElementById('renameOldTag');
    const oldTagText = document.getElementById('oldTagName');
    const newTagInput = document.getElementById('renameNewTag');
    
    if (!oldTagInput || !oldTagText || !newTagInput) {
        console.error('Required form elements not found:', {
            oldTagInput: !!oldTagInput,
            oldTagText: !!oldTagText,
            newTagInput: !!newTagInput
        });
        return;
    }
    
    oldTagInput.value = tag;
    oldTagText.textContent = tag;
    newTagInput.value = tag;
    
    console.log('About to call showModal');
    showModal('renameTagModal');
    console.log('showModal called');
    
    // Focus after modal is shown
    setTimeout(() => {
        newTagInput.focus();
        newTagInput.select();
    }, 100);
}

function showRenameStateModal(stateName) {
    const form = document.getElementById('renameStateModal').querySelector('form');
    document.getElementById('renameOldStateName').value = stateName;
    document.getElementById('oldStateName').textContent = stateName;
    document.getElementById('renameNewStateName').value = stateName;
    document.getElementById('renameNewStateName').focus();
    showModal('renameStateModal');
}

function showRenameCategoryModal(categoryId, categoryName) {
    const form = document.getElementById('renameCategoryModal').querySelector('form');
    document.getElementById('renameOldCategoryId').value = categoryId;
    document.getElementById('oldCategoryName').textContent = categoryName;
    document.getElementById('renameNewCategoryName').value = categoryName;
    document.getElementById('renameNewCategoryName').focus();
    showModal('renameCategoryModal');
}

function showEditAndTagModal(tag) {
    const form = document.getElementById('editAndTagModal').querySelector('form');
    const currentUrl = new URL(window.location.href);
    // Ensure state and filter parameters are preserved
    form.action = `/tags/rename` + currentUrl.search;
    
    document.getElementById('editAndTagOldTag').value = tag;
    document.getElementById('oldAndTagName').textContent = tag;
    
    // Clear previous components
    const container = document.getElementById('andTagComponentsContainer');
    container.innerHTML = '';
    
    // Split the tag by '&' and create input for each component
    const components = tag.split('&').map(c => c.trim());
    components.forEach((component, index) => {
        addAndTagComponentInput(component, index);
    });
    
    showModal('editAndTagModal');
}

// AND Tag Modal logic
function initAddAndTagModal() {
    const modal = document.getElementById('addAndTagModal');
    const form = modal.querySelector('form');
    const modalBody = modal.querySelector('.p-6.space-y-4');
    if (!modalBody) return;
    // Clear previous components
    modalBody.innerHTML = '';
    // Add a container for AND tag components
    let andTagContainer = document.getElementById('andTagComponentsContainer');
    if (!andTagContainer) {
        andTagContainer = document.createElement('div');
        andTagContainer.id = 'andTagComponentsContainer';
        andTagContainer.className = 'space-y-2';
        modalBody.appendChild(andTagContainer);
    } else {
        andTagContainer.innerHTML = '';
        modalBody.appendChild(andTagContainer);
    }
    // Add two default AND tag components
    addAndTagComponentInput('', 0);
    addAndTagComponentInput('', 1);
    // Add "+ Component" button
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'px-3 py-1 bg-blue-100 text-blue-800 rounded-md font-semibold';
    addBtn.textContent = '+ Component';
    addBtn.onclick = function() {
        const idx = andTagContainer.children.length;
        addAndTagComponentInput('', idx);
    };
    modalBody.appendChild(addBtn);
}

function addAndTagComponent(container) {
    const idx = container.children.length;
    // Create row
    const row = document.createElement('div');
    row.className = 'flex items-center space-x-2';
    // Tag input
    const inputId = `andTagInput_${idx}`;
    const hiddenId = `andTagHidden_${idx}`;
    const suggestionsId = `andTagSuggestions_${idx}`;
    const input = document.createElement('input');
    input.type = 'text';
    input.id = inputId;
    input.className = 'p-1 border border-gray-300 rounded-md text-sm';
    input.setAttribute('data-single-tag', 'true');
    input.autocomplete = 'off';
    input.placeholder = 'Tag or Category...';
    // Hidden field
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.id = hiddenId;
    // Suggestions dropdown
    const suggestions = document.createElement('div');
    suggestions.id = suggestionsId;
    suggestions.className = 'tag-suggestions absolute z-10 bg-white border border-gray-300 rounded-md hidden shadow-lg';
    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'px-2 py-1 bg-gray-200 rounded-md text-gray-700 hover:bg-gray-300';
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => row.remove();
    // Container for input/suggestions
    const inputWrap = document.createElement('div');
    inputWrap.className = 'relative flex-grow';
    inputWrap.appendChild(input);
    inputWrap.appendChild(hidden);
    inputWrap.appendChild(suggestions);
    row.appendChild(inputWrap);
    row.appendChild(removeBtn);
    container.appendChild(row);
    // Initialize tag input system for this component
    if (window.createTagInput) {
        window.createTagInput(inputWrap.id || inputId, inputId, hiddenId, suggestionsId);
    }
}

// Show modal and initialize components
window.showAddAndTagModal = function() {
    const modal = document.getElementById('addAndTagModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.remove('opacity-0');
    initAddAndTagModal();
};

// Global functions for AND tag editing
window.addAndTagComponent = function() {
    const container = document.getElementById('andTagComponentsContainer');
    const componentCount = container.children.length;
    addAndTagComponentInput('', componentCount);
}

window.removeAndTagModalComponent = function(index) {
    const container = document.getElementById('andTagComponentsContainer');
    const componentDiv = container.querySelector(`[data-component-index="${index}"]`);
    if (componentDiv && container.children.length > 2) {
        componentDiv.remove();
        // Reindex remaining components
        Array.from(container.children).forEach((child, newIndex) => {
            child.setAttribute('data-component-index', newIndex);
            const input = child.querySelector('input');
            const removeBtn = child.querySelector('button');
            if (input) input.setAttribute('data-index', newIndex);
            if (removeBtn) removeBtn.setAttribute('onclick', `removeAndTagModalComponent(${newIndex})`);
        });
    }
}

window.updateAndTagFromComponents = function() {
    const container = document.getElementById('andTagComponentsContainer');
    const inputs = container.querySelectorAll('input[data-index]');
    const components = Array.from(inputs)
        .map(input => input.value.trim())
        .filter(value => value.length > 0);
    
    if (components.length > 0) {
        const newTag = components.join(' & ');
        document.getElementById('editAndTagNewTag').value = newTag;
        return true;
    } else {
        alert('Please enter at least one component.');
        return false;
    }
}

function addAndTagComponentInput(value = '', index = 0) {
    const container = document.getElementById('andTagComponentsContainer');
    const componentDiv = document.createElement('div');
    componentDiv.className = 'flex items-center space-x-2 relative';
    componentDiv.setAttribute('data-component-index', index);
    const inputContainer = document.createElement('div');
    inputContainer.className = 'flex-grow relative';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.className = 'w-full p-2 border border-gray-300 rounded-md text-sm';
    input.placeholder = 'Enter tag component...';
    input.setAttribute('data-index', index);
    input.name = `andTagComponent_${index}`; // <-- Ensure correct name for backend
    // Create suggestions dropdown
    const suggestionsDiv = document.createElement('div');
    suggestionsDiv.className = 'absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 hidden max-h-40 overflow-y-auto shadow-lg';
    suggestionsDiv.setAttribute('id', `component-suggestions-${index}`);
    
    // Add autocomplete functionality
    input.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();
        if (query.length === 0) {
            suggestionsDiv.classList.add('hidden');
            return;
        }
        
        // Filter tags that match the query - allow all tags including those with &
        const matchingTags = window.ALL_TAGS.filter(tag => 
            tag.toLowerCase().includes(query)
        ).slice(0, 10); // Limit to 10 suggestions
        
        if (matchingTags.length > 0) {
            suggestionsDiv.innerHTML = '';
            matchingTags.forEach(tag => {
                const suggestion = document.createElement('div');
                suggestion.className = 'px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm';
                suggestion.textContent = tag;
                suggestion.addEventListener('click', () => {
                    input.value = tag;
                    suggestionsDiv.classList.add('hidden');
                    input.focus();
                });
                suggestionsDiv.appendChild(suggestion);
            });
            suggestionsDiv.classList.remove('hidden');
        } else {
            suggestionsDiv.classList.add('hidden');
        }
    });
    
    // Hide suggestions when clicking outside
    input.addEventListener('blur', function() {
        setTimeout(() => suggestionsDiv.classList.add('hidden'), 200);
    });
    
    // Handle Enter key
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            suggestionsDiv.classList.add('hidden');
        }
    });
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-md';
    removeBtn.innerHTML = '&times;';
    removeBtn.title = 'Remove component';
    removeBtn.setAttribute('onclick', `removeAndTagModalComponent(${index})`);
    
    inputContainer.appendChild(input);
    inputContainer.appendChild(suggestionsDiv);
    componentDiv.appendChild(inputContainer);
    componentDiv.appendChild(removeBtn);
    container.appendChild(componentDiv);
    
    // Focus the new input if it's empty
    if (!value) {
        input.focus();
    }
}

// --- Modal System Initialization Helper ---
function initializeModalSystem() {
    // Ensure editors are initialized
    if (typeof window.initializeEditors === 'function') {
        window.initializeEditors();
    }
    // Re-initialize modal event listeners if available
    if (typeof window.reinitializeModalEventListeners === 'function') {
        window.reinitializeModalEventListeners();
    }
    // Optionally, initialize global tag input system
    if (window.tagInputs && window.tagInputs.global && typeof window.tagInputs.global.init === 'function') {
        window.tagInputs.global.init(window.ALL_TAGS || [], window.TAG_CATEGORIES || []);
    }
}

// Utility: Render AND tag bubbles with distinct styling
function renderAndTagBubble(andTag) {
    // Split components by '&' and trim
    const components = andTag.split('&').map(c => c.trim());
    const bubble = document.createElement('span');
    bubble.className = 'tag-bubble tag-bubble-and flex items-center bg-gradient-to-r from-blue-100 via-purple-100 to-blue-100 text-purple-800 font-semibold mr-2 mb-1 px-2.5 py-1 rounded-full';
    // Render each component distinctly
    components.forEach((comp, idx) => {
        const compSpan = document.createElement('span');
        compSpan.className = 'and-tag-component px-1';
        compSpan.textContent = comp;
        bubble.appendChild(compSpan);
        if (idx < components.length - 1) {
            const sep = document.createElement('span');
            sep.className = 'and-tag-separator px-1 text-gray-400';
            sep.textContent = ' & ';
            bubble.appendChild(sep);
        }
    });
    return bubble;
}

function renderAndTagsContainer(andTags, container) {
    container.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'font-bold text-purple-700 mb-2';
    title.textContent = 'AND Tags';
    container.appendChild(title);
    andTags.forEach(andTag => {
        container.appendChild(renderAndTagBubble(andTag));
    });
}

// Patch filter rendering logic to use renderAndTagBubble for AND tags
function renderFilterTags(tagList, container) {
    container.innerHTML = '';
    tagList.forEach(tag => {
        if (tag.includes('&')) {
            container.appendChild(renderAndTagBubble(tag));
        } else {
            // Regular tag bubble
            const bubble = document.createElement('span');
            bubble.className = 'tag-bubble bg-blue-100 text-blue-800 font-semibold mr-2 mb-1 px-2.5 py-1 rounded-full';
            bubble.textContent = tag;
            container.appendChild(bubble);
        }
    });
}

// Make all modal functions globally accessible (single assignment, robust pattern)
window.showModal = showModal;
window.hideModal = hideModal;
window.showEditSectionModal = showEditSectionModal;
window.showEditNoteModal = showEditNoteModal;
window.showImportModal = showImportModal;
window.showManualImportModal = showImportModal; // Alias legacy opener to main
window.showRenameModal = showRenameModal;
window.showRenameStateModal = showRenameStateModal;
window.showRenameCategoryModal = showRenameCategoryModal;
window.showEditAndTagModal = showEditAndTagModal;
window.showAddCategoryModal = showAddCategoryModal;
window.showAddAndTagModal = showAddAndTagModal;
window.showAddStateModal = window.showCreateStateModal;

// Ensure all modal event handlers are initialized on page load
window.addEventListener('DOMContentLoaded', function() {
    // Attach click handlers for modal triggers
    document.querySelectorAll('[data-modal-trigger]').forEach(function(btn) {
        const modalType = btn.getAttribute('data-modal-trigger');
        if (modalType && typeof window['show' + modalType + 'Modal'] === 'function') {
            btn.addEventListener('click', function(e) {
                window['show' + modalType + 'Modal']();
            });
        }
    });
    // Optionally, initialize tag input system for global modals if needed
    if (window.tagInputs && window.tagInputs.global && typeof window.tagInputs.global.init === 'function') {
        window.tagInputs.global.init(window.ALL_TAGS || [], window.TAG_CATEGORIES || []);
    }
});

window.addEventListener('error', function(event) {
    console.error('Uncaught error:', event.error || event.message);
    if (window.appLogger) {
        window.appLogger.error('Uncaught error', event.error || event.message);
    }
});