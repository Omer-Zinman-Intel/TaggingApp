// Quill editors with image resize functionality
let noteEditorQuill;
let importEditorQuill;

const TOOLBAR_OPTIONS = [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    ['link', 'image'],
    ['clean']
];

function initializeEditors() {
    // Initialize note editor
    if (document.getElementById('quill-editor')) {
        noteEditorQuill = new Quill('#quill-editor', {
            theme: 'snow',
            modules: { 
                toolbar: TOOLBAR_OPTIONS
            }
        });
        
        noteEditorQuill.on('text-change', () => {
            document.getElementById('editNoteContent').value = noteEditorQuill.root.innerHTML;
        });
        
        // Also listen for any manual content updates (like image resize)
        const observer = new MutationObserver(() => {
            document.getElementById('editNoteContent').value = noteEditorQuill.root.innerHTML;
        });
        observer.observe(noteEditorQuill.root, { 
            childList: true, 
            subtree: true, 
            attributes: true, 
            attributeFilter: ['style', 'width', 'height'] 
        });
        
        // Add custom image resize functionality
        if (typeof window.makeImageResizable === 'function') {
            window.makeImageResizable(noteEditorQuill);
        }
    }
    
    // Initialize import editor
    if (document.getElementById('import-editor')) {
        importEditorQuill = new Quill('#import-editor', {
            theme: 'snow',
            placeholder: 'Paste your content here or import a .docx file...',
            modules: { 
                toolbar: TOOLBAR_OPTIONS
            }
        });
        
        importEditorQuill.on('text-change', () => {
            document.getElementById('import_html_content').value = importEditorQuill.root.innerHTML;
        });
        
        // Also listen for any manual content updates (like image resize)
        const importObserver = new MutationObserver(() => {
            document.getElementById('import_html_content').value = importEditorQuill.root.innerHTML;
        });
        importObserver.observe(importEditorQuill.root, { 
            childList: true, 
            subtree: true, 
            attributes: true, 
            attributeFilter: ['style', 'width', 'height'] 
        });
        
        // Add custom image resize functionality
        if (typeof window.makeImageResizable === 'function') {
            window.makeImageResizable(importEditorQuill);
        }
    }
    
    // Make editors globally accessible
    window.noteEditorQuill = noteEditorQuill;
    window.importEditorQuill = importEditorQuill;
}

function toggleImportEditorView(view) {
    const rich = document.getElementById('import-editor-container');
    const html = document.getElementById('html-import-editor');
    if (view === 'richtext') {
        rich.classList.remove('hidden');
        html.classList.add('hidden');
        if (importEditorQuill && html.value) importEditorQuill.root.innerHTML = html.value;
    } else {
        html.classList.remove('hidden');
        rich.classList.add('hidden');
        if (importEditorQuill) html.value = importEditorQuill.root.innerHTML;
    }
}

function toggleEditorView(view) {
    const richContainer = document.getElementById('quill-editor-container');
    const htmlEditor = document.getElementById('html-editor');
    const previewContainer = document.getElementById('quill-preview-container');
    
    // Hide all views first
    richContainer.classList.add('hidden');
    htmlEditor.classList.add('hidden');
    previewContainer.classList.add('hidden');
    
    if (view === 'richtext') {
        richContainer.classList.remove('hidden');
        // Sync from HTML editor if it has content
        if (noteEditorQuill && htmlEditor.value) {
            noteEditorQuill.root.innerHTML = htmlEditor.value;
        }
    } else if (view === 'html') {
        htmlEditor.classList.remove('hidden');
        // Sync from Quill editor
        if (noteEditorQuill) {
            htmlEditor.value = noteEditorQuill.root.innerHTML;
        }
    } else if (view === 'preview') {
        previewContainer.classList.remove('hidden');
        // Update preview with current content
        if (noteEditorQuill) {
            previewContainer.innerHTML = noteEditorQuill.root.innerHTML;
        }
    }
}

function cleanActiveEditorContent(editorType) {
    let editor, htmlEditor;
    if (editorType === 'note') {
        editor = noteEditorQuill;
        htmlEditor = document.getElementById('html-editor');
    } else {
        editor = importEditorQuill;
        htmlEditor = document.getElementById('html-import-editor');
    }
    if (!editor) return;
    const cleaned = (editor.root.innerHTML || '').replace(/(<p>\s*<\/p>)+/g, '<p></p>');
    editor.root.innerHTML = cleaned;
    if (htmlEditor) htmlEditor.value = cleaned;
}

window.initializeEditors = initializeEditors;
window.toggleImportEditorView = toggleImportEditorView;
window.toggleEditorView = toggleEditorView;
window.cleanActiveEditorContent = cleanActiveEditorContent;
