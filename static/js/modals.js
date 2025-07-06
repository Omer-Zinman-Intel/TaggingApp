// Global script - no ES6 modules
// Using global tag input system

function showModal(modalId) {
    window.appLogger?.buttonClick('SHOW_MODAL', { modalId });
    console.log('showModal called with modalId:', modalId);
    
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
    window.appLogger?.buttonClick('HIDE_MODAL', { modalId });
    console.log('hideModal called with modalId:', modalId);
    
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            window.appLogger?.action('MODAL_CLOSED', { modalId });
        }, 250);
    } else {
        window.appLogger?.error('Modal not found for hiding:', modalId);
        console.error('Modal not found for hiding:', modalId);
    }
}

function showEditSectionModal(sectionId, title, tags) {
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
                        window.tagInputs.section.init(tagList);
                        window.appLogger?.componentStatus('section_tags', 'initialized', { tags: tagList });
                        console.log('Section tags initialized successfully');
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

function showEditNoteModal(sectionId, noteId, title, content, tags) {
    try {
        console.log('showEditNoteModal called with:', { sectionId, noteId, title, content: content?.substring(0, 100), tags });
        
        const form = document.getElementById('editNoteForm');
        if (!form) {
            throw new Error('editNoteForm not found');
        }
        
        const currentUrl = new URL(window.location.href);
        // Ensure the state parameter is preserved in the form action
        form.action = `/note/update/${sectionId}/${noteId}` + currentUrl.search;
        
        const titleInput = document.getElementById('editNoteTitle');
        if (!titleInput) {
            throw new Error('editNoteTitle input not found');
        }
        titleInput.value = title || '';
        
        const contentInput = document.getElementById('editNoteContent');
        if (!contentInput) {
            throw new Error('editNoteContent input not found');
        }
        contentInput.value = content || ''; // Hidden textarea value
        
        if (window.noteEditorQuill) {
            window.noteEditorQuill.root.innerHTML = content || '';
            if (window.toggleEditorView) {
                window.toggleEditorView('richtext'); // Always start with rich text view
            }
        } else {
            console.warn('noteEditorQuill not available, attempting to initialize');
            // Try to initialize the editor after modal is shown
            setTimeout(() => {
                if (typeof Quill !== 'undefined' && document.getElementById('quill-editor')) {
                    console.log('Initializing Quill editor for note modal');
                    window.noteEditorQuill = new Quill('#quill-editor', {
                        theme: 'snow',
                        modules: { 
                            toolbar: [
                                [{ 'header': [1, 2, 3, 4, 5, 6, false] }], [{ 'font': [] }],
                                [{ 'color': [] }, { 'background': [] }], ['bold', 'italic', 'underline', 'strike'],
                                [{ 'align': [] }], ['blockquote', 'code-block'],
                                [{ 'list': 'ordered'}, { 'list': 'bullet' }], [{ 'script': 'sub'}, { 'script': 'super' }],
                                [{ 'indent': '-1'}, { 'indent': '+1' }], ['link', 'image', 'video'], ['clean']
                            ]
                        }
                    });
                    window.noteEditorQuill.on('text-change', () => { 
                        const contentInput = document.getElementById('editNoteContent');
                        if (contentInput) {
                            contentInput.value = window.noteEditorQuill.root.innerHTML; 
                        }
                    });
                    window.noteEditorQuill.root.innerHTML = content || '';
                    if (window.toggleEditorView) {
                        window.toggleEditorView('richtext');
                    }
                } else {
                    console.error('Cannot initialize Quill editor: Quill not available or element not found');
                }
            }, 300);
        }
        
        // Ensure tags is an array of singular tags
        let tagList = [];
        // Defensive: handle undefined/null tags first
        if (!tags) {
            tagList = [];
        } else if (Array.isArray(tags)) {
            tagList = tags.filter(t => t); // Allow tags with & characters
        } else if (typeof tags === 'string') {
            tagList = tags.split(',').map(t => t.trim()).filter(t => t);
        }
        
        // Set tags in hidden input for fallback
        const tagsHiddenInput = document.getElementById('editNoteTags');
        if (tagsHiddenInput) {
            tagsHiddenInput.value = tagList.join(', ');
        }
        
        // Initialize tag input when modal opens - wait for modal to be visible
        setTimeout(() => {
            // Recreate tag input since the modal DOM elements are now available
            if (window.createTagInput) {
                if (!window.tagInputs) window.tagInputs = {};
                console.log('Creating note tag input for modal - checking elements...');
                
                // Verify all required elements exist
                const elements = {
                    container: document.getElementById('editNoteTagsContainer'),
                    input: document.getElementById('editNoteTagsInput'),
                    hiddenInput: document.getElementById('editNoteTags'),
                    suggestions: document.getElementById('note-suggestions')
                };
                
                console.log('Note modal elements check:', elements);
                console.log('ALL_TAGS available:', !!window.ALL_TAGS, 'Count:', window.ALL_TAGS?.length || 0);
                
                if (Object.values(elements).every(el => el)) {
                    console.log('All elements found, creating note tag input...');
                    window.tagInputs.note = window.createTagInput(
                        'editNoteTagsContainer',
                        'editNoteTagsInput',
                        'editNoteTags',
                        'note-suggestions'
                    );
                    console.log('Note tag input created:', !!window.tagInputs.note);
                    console.log('Initializing note tags with:', tagList);
                    window.tagInputs.note.init(tagList);
                    console.log('Note tags initialized successfully');
                } else {
                    console.error('Missing elements for note tag input creation:', elements);
                }
            } else {
                console.error('createTagInput function not available');
            }
        }, 500); // Increased delay to ensure modal is fully rendered
        
        showModal('editNoteModal');
    } catch (error) {
        console.error('Error in showEditNoteModal:', error);
        if (window.logModalError) {
            window.logModalError('showEditNoteModal', 'editNoteModal', error, { sectionId, noteId, title, tags });
        }
        // Still try to show the modal even if initialization fails
        showModal('editNoteModal');
    }
}

function showImportModal() {
    if (window.importEditorQuill) {
        window.importEditorQuill.root.innerHTML = '';
        document.getElementById('html-import-editor').value = '';
        window.toggleImportEditorView('richtext'); 
    }
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

// Global functions for AND tag editing
window.addAndTagComponent = function() {
    const container = document.getElementById('andTagComponentsContainer');
    const componentCount = container.children.length;
    addAndTagComponentInput('', componentCount);
}

window.removeAndTagModalComponent = function(index) {
    const container = document.getElementById('andTagComponentsContainer');
    const componentDiv = container.querySelector(`[data-component-index="${index}"]`);
    if (componentDiv && container.children.length > 1) {
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

// Make all modal functions globally accessible
window.showModal = showModal;
window.hideModal = hideModal;
window.showEditSectionModal = showEditSectionModal;
window.showEditNoteModal = showEditNoteModal;
window.showImportModal = showImportModal;
window.showRenameModal = showRenameModal;
window.showRenameStateModal = showRenameStateModal;
window.showRenameCategoryModal = showRenameCategoryModal;
window.showEditAndTagModal = showEditAndTagModal;
window.showAddAndTagModal = showAddAndTagModal;