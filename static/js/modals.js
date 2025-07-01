import { createTagInput } from './tags.js';

export function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.remove('opacity-0'), 10);
    }
}

export function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 250);
    }
}

export function showEditSectionModal(sectionId, title, tags) {
    const form = document.getElementById('editSectionForm');
    const currentUrl = new URL(window.location.href);
    // Ensure the state parameter is preserved in the form action
    form.action = `/section/update/${sectionId}` + currentUrl.search;
    
    document.getElementById('editSectionTitle').value = title;
    
    // Ensure tag input exists before initializing
    if (window.tagInputs && window.tagInputs['section']) {
        window.tagInputs['section'].init(tags);
    } else {
        // Recreate tag input if it doesn't exist
        setTimeout(() => {
            if (!window.tagInputs) window.tagInputs = {};
            window.tagInputs['section'] = createTagInput(
                'editSectionTagsContainer', 
                'editSectionTagsInput', 
                'editSectionTags', 
                'section-suggestions'
            );
            window.tagInputs['section'].init(tags);
        }, 100);
    }
    
    showModal('editSectionModal');
}

export function showEditNoteModal(sectionId, noteId, title, content, tags) {
    const form = document.getElementById('editNoteForm');
    const currentUrl = new URL(window.location.href);
    // Ensure the state parameter is preserved in the form action
    form.action = `/note/update/${sectionId}/${noteId}` + currentUrl.search;
    
    document.getElementById('editNoteTitle').value = title;
    document.getElementById('editNoteContent').value = content; // Hidden textarea value
    
    if (window.noteEditorQuill) {
        window.noteEditorQuill.root.innerHTML = content;
        window.toggleEditorView('richtext'); // Always start with rich text view
    }
    
    // Ensure tag input exists before initializing
    if (window.tagInputs && window.tagInputs['note']) {
        window.tagInputs['note'].init(tags);
    } else {
        // Recreate tag input if it doesn't exist
        setTimeout(() => {
            if (!window.tagInputs) window.tagInputs = {};
            window.tagInputs['note'] = createTagInput(
                'editNoteTagsContainer', 
                'editNoteTagsInput', 
                'editNoteTags', 
                'note-suggestions'
            );
            window.tagInputs['note'].init(tags);
        }, 100);
    }
    
    showModal('editNoteModal');
}

export function showImportModal() {
    if (window.importEditorQuill) {
        window.importEditorQuill.root.innerHTML = '';
        document.getElementById('html-import-editor').value = '';
        window.toggleImportEditorView('richtext'); 
    }
    showModal('importModal');
}

export function showRenameModal(tag) {
    const form = document.getElementById('renameTagModal').querySelector('form');
    const currentUrl = new URL(window.location.href);
    // Ensure state and filter parameters are preserved
    form.action = `/tags/rename` + currentUrl.search;
    document.getElementById('renameOldTag').value = tag;
    document.getElementById('oldTagName').textContent = tag;
    document.getElementById('renameNewTag').value = tag;
    document.getElementById('renameNewTag').focus();
    showModal('renameTagModal');
}

export function showRenameStateModal(stateName) {
    const form = document.getElementById('renameStateModal').querySelector('form');
    document.getElementById('renameOldStateName').value = stateName;
    document.getElementById('oldStateName').textContent = stateName;
    document.getElementById('renameNewStateName').value = stateName;
    document.getElementById('renameNewStateName').focus();
    showModal('renameStateModal');
}

export function showRenameCategoryModal(categoryId, categoryName) {
    const form = document.getElementById('renameCategoryModal').querySelector('form');
    document.getElementById('renameOldCategoryId').value = categoryId;
    document.getElementById('oldCategoryName').textContent = categoryName;
    document.getElementById('renameNewCategoryName').value = categoryName;
    document.getElementById('renameNewCategoryName').focus();
    showModal('renameCategoryModal');
}