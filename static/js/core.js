// Main application initialization
document.addEventListener('DOMContentLoaded', function() {
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
            console.log('📥 Import form submission - Direct WYSIWYG mode');
            
            const contentHolder = document.getElementById('import_html_content');
            const currentView = document.getElementById('html-import-editor').classList.contains('hidden');
            
            if(currentView) {
                // Rich text view is active
                if (window.importEditor && window.importEditor.quill) {
                    const content = window.importEditor.quill.root.innerHTML;
                    contentHolder.value = content;
                    console.log('✅ Import content from rich text editor:', content.length, 'characters');
                } else {
                    console.error('❌ Import editor not available');
                }
            } else {
                // HTML view is active
                const htmlEditor = document.getElementById('html-import-editor');
                contentHolder.value = htmlEditor.value;
                console.log('✅ Import content from HTML editor:', htmlEditor.value.length, 'characters');
            }
            
            console.log('📤 Final import content length:', contentHolder.value.length);
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
        editNoteForm.addEventListener('submit', function(e) {
            // Prevent default submission to capture content first
            e.preventDefault();
            
            window.appLogger?.action('NOTE_FORM_SUBMISSION_START', {
                formAction: editNoteForm.action,
                formMethod: editNoteForm.method,
                hasNoteEditor: !!window.noteEditor,
                hasQuill: !!(window.noteEditor && window.noteEditor.quill)
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
window.showTagContextMenu = function(event, tagName) {
    console.log(`Tag context menu requested for: ${tagName}`);
    window.appLogger?.action('TAG_CONTEXT_MENU', { tag: tagName });
    
    // Prevent the default context menu
    event.preventDefault();
    
    // Get existing or create a new context menu
    let contextMenu = document.getElementById('tag-context-menu');
    if (!contextMenu) {
        contextMenu = document.createElement('div');
        contextMenu.id = 'tag-context-menu';
        contextMenu.className = 'absolute z-50 bg-white shadow-lg rounded-md py-2 w-48';
        contextMenu.style.display = 'none';
        document.body.appendChild(contextMenu);
    }
    
    // Position the context menu at the mouse position
    contextMenu.style.top = `${event.pageY}px`;
    contextMenu.style.left = `${event.pageX}px`;
    
    // Update the context menu content based on the tag
    contextMenu.innerHTML = `
        <div class="px-3 py-1 text-sm font-medium text-gray-800 border-b mb-1">${tagName}</div>
        <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" 
           onclick="event.preventDefault(); showRenameModal('${tagName}'); hideContextMenu();">
           Rename Tag
        </a>
        <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
           onclick="event.preventDefault(); copyToClipboard('${tagName}'); hideContextMenu();">
           Copy Tag
        </a>
        <a href="#" class="block px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
           onclick="event.preventDefault(); deleteGlobalTag('${tagName}'); hideContextMenu();">
           Delete Tag
        </a>
    `;
    
    // Show the context menu
    contextMenu.style.display = 'block';
    
    // Add a click event listener to the document to hide the context menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', hideContextMenu);
    }, 10);
    
    return false;
};

// Helper function to hide the context menu
window.hideContextMenu = function() {
    const contextMenu = document.getElementById('tag-context-menu');
    if (contextMenu) {
        contextMenu.style.display = 'none';
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
        form.action = `/tag/delete?state=${window.CURRENT_STATE || ''}&${params.toString()}`;
        
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
