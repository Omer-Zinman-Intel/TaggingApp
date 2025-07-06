
// Minimal editors.js for Quill note and import editors
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
    if (document.getElementById('quill-editor')) {
        noteEditorQuill = new Quill('#quill-editor', {
            theme: 'snow',
            modules: { toolbar: TOOLBAR_OPTIONS }
        });
        noteEditorQuill.on('text-change', () => {
            document.getElementById('editNoteContent').value = noteEditorQuill.root.innerHTML;
        });
    }
    if (document.getElementById('import-editor')) {
        importEditorQuill = new Quill('#import-editor', {
            theme: 'snow',
            placeholder: 'Paste your content here or import a .docx file...',
            modules: { toolbar: TOOLBAR_OPTIONS }
        });
        importEditorQuill.on('text-change', () => {
            document.getElementById('import_html_content').value = importEditorQuill.root.innerHTML;
        });
    }
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
window.cleanActiveEditorContent = cleanActiveEditorContent;

// Make all editor functions globally accessible
window.initializeEditors = initializeEditors;
window.toggleEditorView = toggleEditorView;
window.toggleImportEditorView = toggleImportEditorView;
window.addQuillTooltips = addQuillTooltips;
window.cleanActiveEditorContent = cleanActiveEditorContent;
