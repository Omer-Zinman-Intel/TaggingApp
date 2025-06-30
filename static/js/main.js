// js/main.js

import { showModal, hideModal, showEditSectionModal, showEditNoteModal, showImportModal, showRenameModal, showRenameStateModal, showRenameCategoryModal } from './modals.js';
import { initializeEditors, toggleEditorView, toggleImportEditorView, cleanActiveEditorContent } from './editors.js';
import { createTagInput } from './tags.js';
import { drag, dragEnd, allowDrop, leaveDrop, drop, isDragging } from './drag_drop.js';

// Read data from the body tag and set as global variables
const bodyData = document.body.dataset;
window.ALL_TAGS = JSON.parse(bodyData.allTags || '[]');
window.CURRENT_STATE = bodyData.currentState || '';
window.ACTIVE_FILTERS_LOWER = JSON.parse(bodyData.activeFiltersLower || '[]');


// --- Expose functions to the global scope for inline HTML event handlers ---
window.showModal = showModal;
window.hideModal = hideModal;
window.showEditSectionModal = showEditSectionModal;
window.showEditNoteModal = showEditNoteModal;
window.showImportModal = showImportModal;
window.showRenameModal = showRenameModal;
window.showRenameStateModal = showRenameStateModal;
window.showRenameCategoryModal = showRenameCategoryModal;
window.toggleEditorView = toggleEditorView;
window.toggleImportEditorView = toggleImportEditorView;
window.cleanActiveEditorContent = cleanActiveEditorContent;
window.drag = drag;
window.dragEnd = dragEnd;
window.allowDrop = allowDrop;
window.leaveDrop = leaveDrop;
window.drop = drop;
window.isDragging = isDragging; // Expose the flag as well

// --- Other global functions ---
window.exportPdf = function() {
    if (window.html2pdf) {
        const element = document.getElementById('content-to-export');
        const docTitle = document.title.replace(/ /g, '_');
        const opt = { margin: [0.5, 0.5, 0.5, 0.5], filename: `${docTitle}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
        window.html2pdf().from(element).set(opt).save();
    } else {
        console.error("PDF generation library is not loaded yet.");
    }
};

window.handleTagClick = function(event, tagName) {
    event.preventDefault();
    event.stopPropagation();
    if (window.isDragging) { // Accessing the global flag
        return;
    }
    const lowerTagName = tagName.toLowerCase();
    const currentFilters = new Set(window.ACTIVE_FILTERS_LOWER);

    let newFilters;
    if (currentFilters.has(lowerTagName)) {
        newFilters = Array.from(currentFilters).filter(f => f !== lowerTagName);
    } else {
        newFilters = Array.from(currentFilters);
        newFilters.push(lowerTagName);
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('filter');
    newFilters.forEach(f => url.searchParams.append('filter', f));
    url.searchParams.set('state', window.CURRENT_STATE);
    window.location.href = url.toString();
};

window.removeAndTagComponent = async function(event, andTagName, componentToRemove) {
    event.preventDefault();
    event.stopPropagation();
    if (!confirm(`Are you sure you want to remove '${componentToRemove}' from '${andTagName}'?`)) {
        return;
    }
    const currentUrl = new URL(window.location.href);
    const queryParams = new URLSearchParams(currentUrl.search);
    
    const formData = new FormData();
    formData.append('and_tag_name', andTagName);
    formData.append('component_to_remove', componentToRemove);
    formData.append('state', window.CURRENT_STATE);

    try {
        const response = await fetch(`/tag/remove_and_component?${queryParams.toString()}`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.success) {
            window.location.reload();
        } else {
            alert('Failed to remove component: ' + data.message);
        }
    } catch (error) {
        console.error('Error removing AND tag component:', error);
        alert('An error occurred while removing the component.');
    }
};

// --- DOMContentLoaded Setup ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize editors and expose their instances globally
    const editors = initializeEditors();
    window.noteEditorQuill = editors.noteEditorQuill;
    window.importEditorQuill = editors.importEditorQuill;

    // Create and expose tagInputs globally so modals can access them
    window.tagInputs = {
        section: createTagInput('editSectionTagsContainer', 'editSectionTagsInput', 'editSectionTags', 'section-suggestions'),
        note: createTagInput('editNoteTagsContainer', 'editNoteTagsInput', 'editNoteTags', 'note-suggestions')
    };

    const docxInput = document.getElementById('docx-file-input');
    if (docxInput) {
        docxInput.addEventListener('change', (event) => {
            if(event.target.files.length === 0) return;
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.onload = function(loadEvent) {
                mammoth.convertToHtml({ arrayBuffer: loadEvent.target.result })
                    .then(result => {
                        if (window.importEditorQuill) {
                            window.importEditorQuill.root.innerHTML = result.value;
                            toggleImportEditorView('richtext');
                        }
                    })
                    .catch(err => {
                        console.error("DOCX conversion error:", err);
                    });
            };
            reader.readAsArrayBuffer(file);
        });
    }

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

    document.querySelectorAll('.dropzone').forEach(dropzone => {
        dropzone.addEventListener('dragleave', leaveDrop);
    });
});
