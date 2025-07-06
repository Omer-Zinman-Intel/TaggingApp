// Main application initialization
document.addEventListener('DOMContentLoaded', function() {
    window.appLogger?.action('CORE_INITIALIZATION_START');
    console.log('Initializing TaggingApp...');
    
    // Initialize editors
    if (typeof initializeEditors === 'function') {
        window.appLogger?.componentStatus('EDITORS', 'initializing');
        initializeEditors();
        window.appLogger?.componentStatus('EDITORS', 'initialized');
    } else {
        window.appLogger?.componentStatus('EDITORS', 'missing');
    }
    
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
        window.appLogger?.componentStatus('DOCX_INPUT', 'found');
        docxInput.addEventListener('change', (event) => {
            window.appLogger?.action('DOCX_FILE_SELECTED', { 
                fileCount: event.target.files.length,
                fileName: event.target.files[0]?.name 
            });
            if(event.target.files.length === 0) return;
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.onload = function(loadEvent) {
                window.appLogger?.action('DOCX_CONVERSION_START', { fileName: file.name });
                mammoth.convertToHtml({ arrayBuffer: loadEvent.target.result })
                    .then(result => {
                        window.appLogger?.action('DOCX_CONVERSION_SUCCESS', { 
                            fileName: file.name,
                            contentLength: result.value.length 
                        });
                        if (window.importEditorQuill) {
                            window.importEditorQuill.root.innerHTML = result.value;
                            toggleImportEditorView('richtext');
                        }
                    })
                    .catch(err => console.error("DOCX conversion error:", err));
            };
            reader.readAsArrayBuffer(file);
        });
    }

    // Setup import form handler
    const importForm = document.getElementById('importForm');
    if(importForm) {
        importForm.addEventListener('submit', () => {
            const contentHolder = document.getElementById('import_html_content');
            if(document.getElementById('html-import-editor').classList.contains('hidden')){
                contentHolder.value = window.importEditorQuill.root.innerHTML;
            } else {
                contentHolder.value = document.getElementById('html-import-editor').value;
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
            }
        });
    }
    
    const editNoteForm = document.getElementById('editNoteForm');
    if (editNoteForm) {
        editNoteForm.addEventListener('submit', function() {
            if (window.tagInputs && window.tagInputs.note) {
                const hiddenInput = document.getElementById('editNoteTags');
                if (hiddenInput) {
                    const tagsValue = window.tagInputs.note.tags.join(', ');
                    hiddenInput.value = tagsValue;
                }
            }
        });
    }
    
    window.appLogger?.action('CORE_INITIALIZATION_COMPLETE');
    console.log('TaggingApp initialization complete');
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
            html2canvas: { scale: 2, useCORS: true }, 
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } 
        };
        
        window.appLogger?.action('PDF_GENERATION_CONFIG', { 
            filename: opt.filename,
            elementId: element?.id,
            elementExists: !!element
        });
        
        window.html2pdf().from(element).set(opt).save();
        window.appLogger?.action('EXPORT_PDF_SUCCESS', { filename: opt.filename });
    } else {
        window.appLogger?.error("PDF generation library is not loaded yet.");
        console.error("PDF generation library is not loaded yet.");
    }
};

window.handleTagClick = function(event, tagName) {
    window.appLogger?.action('TAG_CLICK', { 
        tagName, 
        isDragging: !!window.isDragging,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey
    });
    
    event.preventDefault();
    event.stopPropagation();
    if (window.isDragging) return;
    
    const lowerTagName = tagName.toLowerCase();
    const currentFilters = new Set(window.ACTIVE_FILTERS_LOWER);

    let newFilters;
    if (currentFilters.has(lowerTagName)) {
        newFilters = Array.from(currentFilters).filter(f => f !== lowerTagName);
        window.appLogger?.action('TAG_FILTER_REMOVED', { tagName, remainingFilters: newFilters });
    } else {
        newFilters = Array.from(currentFilters);
        newFilters.push(lowerTagName);
        window.appLogger?.action('TAG_FILTER_ADDED', { tagName, allFilters: newFilters });
    }
    
    const url = new URL(window.location.href);
    url.searchParams.delete('filter');
    newFilters.forEach(f => url.searchParams.append('filter', f));
    url.searchParams.set('state', window.CURRENT_STATE);
    
    window.appLogger?.action('NAVIGATING_WITH_FILTERS', { 
        newUrl: url.toString(),
        filters: newFilters,
        state: window.CURRENT_STATE
    });
    window.location.href = url.toString();
};

window.removeAndTagComponent = async function(event, andTagName, componentToRemove) {
    window.appLogger?.action('REMOVE_AND_TAG_COMPONENT_START', { andTagName, componentToRemove });
    
    event.preventDefault();
    event.stopPropagation();
    if (!confirm(`Are you sure you want to remove '${componentToRemove}' from '${andTagName}'?`)) {
        window.appLogger?.action('REMOVE_AND_TAG_COMPONENT_CANCELLED', { andTagName, componentToRemove });
        return;
    }
    
    const currentUrl = new URL(window.location.href);
    const queryParams = new URLSearchParams(currentUrl.search);
    
    const formData = new FormData();
    formData.append('and_tag_name', andTagName);
    formData.append('component_to_remove', componentToRemove);
    formData.append('state', window.CURRENT_STATE);

    try {
        window.appLogger?.action('REMOVE_AND_TAG_COMPONENT_REQUEST', { 
            url: `/tag/remove_and_component?${queryParams.toString()}`,
            andTagName,
            componentToRemove
        });
        
        const response = await fetch(`/tag/remove_and_component?${queryParams.toString()}`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        
        if (data.success) {
            window.appLogger?.action('REMOVE_AND_TAG_COMPONENT_SUCCESS', { andTagName, componentToRemove });
            window.location.reload();
        } else {
            alert('Failed to remove component: ' + data.message);
        }
    } catch (error) {
        console.error('Error removing AND tag component:', error);
        alert('An error occurred while removing the component.');
    }
};

window.showTagContextMenu = function(event, tagName) {
    window.appLogger?.action('SHOW_TAG_CONTEXT_MENU', { 
        tagName,
        x: event.pageX,
        y: event.pageY 
    });
    
    event.preventDefault();
    event.stopPropagation();
    
    const contextMenu = document.createElement('div');
    contextMenu.className = 'fixed bg-white shadow-lg border rounded-md py-2 z-50';
    contextMenu.style.left = event.pageX + 'px';
    contextMenu.style.top = event.pageY + 'px';
    
    const renameItem = document.createElement('div');
    renameItem.className = 'px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm';
    renameItem.textContent = 'Rename tag globally';
    renameItem.onclick = () => {
        window.appLogger?.action('CONTEXT_MENU_RENAME_CLICKED', { tagName });
        document.body.removeChild(contextMenu);
        showRenameModal(tagName);
    };
    
    const removeItem = document.createElement('div');
    removeItem.className = 'px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-red-600';
    removeItem.textContent = 'Remove tag globally';
    removeItem.onclick = () => {
        window.appLogger?.action('CONTEXT_MENU_REMOVE_CLICKED', { tagName });
        document.body.removeChild(contextMenu);
        if (confirm(`Remove tag '${tagName}' from ALL content? This action cannot be undone.`)) {
            window.appLogger?.action('TAG_GLOBAL_REMOVAL_CONFIRMED', { tagName });
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/tag/delete_global_tag';
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'tag_to_delete';
            input.value = tagName;
            form.appendChild(input);
            document.body.appendChild(form);
            form.submit();
        } else {
            window.appLogger?.action('TAG_GLOBAL_REMOVAL_CANCELLED', { tagName });
        }
    };
    
    contextMenu.appendChild(renameItem);
    contextMenu.appendChild(removeItem);
    document.body.appendChild(contextMenu);
    
    window.appLogger?.componentStatus('CONTEXT_MENU', 'created', { 
        tagName,
        menuItems: ['rename', 'remove']
    });
    
    const removeMenu = (e) => {
        if (!contextMenu.contains(e.target)) {
            window.appLogger?.action('CONTEXT_MENU_CLOSED', { tagName });
            document.body.removeChild(contextMenu);
            document.removeEventListener('click', removeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', removeMenu), 0);
};
