// js/editors.js

// Declare Quill instances globally within this module
let noteEditorQuill;
let importEditorQuill;

// Toolbar options for Quill editors
const FULL_TOOLBAR_OPTIONS = [
    [{ 'header': [1, 2, 3, 4, 5, 6, false] }], [{ 'font': [] }],
    [{ 'color': [] }, { 'background': [] }], ['bold', 'italic', 'underline', 'strike'],
    [{ 'align': [] }], ['blockquote', 'code-block'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }], [{ 'script': 'sub'}, { 'script': 'super' }],
    [{ 'indent': '-1'}, { 'indent': '+1' }], ['link', 'image', 'video'], ['clean']
];

// Function to initialize Quill editors and return their instances
export function initializeEditors() {
    // Initialize note editor
    if (document.getElementById('quill-editor')) {
        noteEditorQuill = new Quill('#quill-editor', {
            theme: 'snow',
            modules: { toolbar: { container: FULL_TOOLBAR_OPTIONS } }
        });
        noteEditorQuill.on('text-change', () => { 
            document.getElementById('editNoteContent').value = noteEditorQuill.root.innerHTML; 
        });
        addQuillTooltips('#editNoteModal');
    }

    // Initialize import editor
    if (document.getElementById('import-editor')) {
        importEditorQuill = new Quill('#import-editor', {
            theme: 'snow',
            placeholder: 'Paste your content here or import a .docx file...',
            modules: { toolbar: { container: FULL_TOOLBAR_OPTIONS } }
        });
        addQuillTooltips('#importModal');
    }

    return { noteEditorQuill, importEditorQuill };
}

export function toggleEditorView(view) {
    const views = {
        richtext: document.getElementById('quill-editor-container'),
        html: document.getElementById('html-editor'),
        preview: document.getElementById('quill-preview-container')
    };
    const contentHolder = document.getElementById('editNoteContent');
    const activeBtn = document.querySelector('#editor-toggle-buttons .toggle-btn.active');
    const currentView = activeBtn ? activeBtn.dataset.view : 'richtext';

    // Sync content from the currently active view before switching
    if (currentView === 'html') {
        contentHolder.value = views.html.value;
    } else if (noteEditorQuill) { 
        contentHolder.value = noteEditorQuill.root.innerHTML;
    }
    
    Object.values(views).forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('#editor-toggle-buttons .toggle-btn').forEach(btn => btn.classList.remove('active'));

    const targetBtn = document.querySelector(`#editor-toggle-buttons .toggle-btn[onclick*="'${view}'"]`);
    views[view].classList.remove('hidden');
    if(targetBtn) {
        targetBtn.classList.add('active');
        targetBtn.dataset.view = view;
    }

    // Populate the new view with the synced content
    if (view === 'richtext' && noteEditorQuill) noteEditorQuill.root.innerHTML = contentHolder.value;
    if (view === 'html') views.html.value = contentHolder.value;
    if (view === 'preview') views.preview.innerHTML = contentHolder.value;
}

export function toggleImportEditorView(view) {
    const views = {
        richtext: document.getElementById('import-editor-container'),
        html: document.getElementById('html-import-editor')
    };
    const contentHolder = document.getElementById('import_html_content');
    const activeBtn = document.querySelector('#import-editor-toggle-buttons .toggle-btn.active');
    const currentView = activeBtn ? activeBtn.dataset.view : 'richtext';

    // Sync content from the currently active view before switching
    if (currentView === 'html') {
        contentHolder.value = views.html.value;
    } else if (importEditorQuill) {
        contentHolder.value = importEditorQuill.root.innerHTML;
    }

    Object.values(views).forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('#import-editor-toggle-buttons .toggle-btn').forEach(btn => btn.classList.remove('active'));
    
    const targetBtn = document.querySelector(`#import-editor-toggle-buttons .toggle-btn[onclick*="'${view}'"]`);
    views[view].classList.remove('hidden');
    if (targetBtn) {
        targetBtn.classList.add('active');
        targetBtn.dataset.view = view;
    }
    
    if (view === 'richtext' && importEditorQuill) importEditorQuill.root.innerHTML = contentHolder.value;
    if (view === 'html') views.html.value = contentHolder.value;
}

export function addQuillTooltips(scopeSelector) {
    document.querySelectorAll(`${scopeSelector} .ql-toolbar button, ${scopeSelector} .ql-toolbar .ql-picker-label`).forEach(el => {
        const tooltips = { 'bold': 'Bold', 'italic': 'Italic', 'underline': 'Underline', 'strike': 'Strikethrough', 'blockquote': 'Blockquote', 'code-block': 'Code Block', 'header': 'Heading', 'font': 'Font', 'color': 'Font Color', 'background': 'Highlight Color', 'align': 'Text Alignment', 'list': 'List', 'script': 'Sub/Superscript', 'indent': 'Indent', 'link': 'Insert Link', 'image': 'Insert Image', 'video': 'Insert Video', 'clean': 'Remove Formatting' };
            for(const key in tooltips){
                if(el.classList.contains(`ql-${key}`) || (el.parentElement && el.parentElement.classList.contains(`ql-${key}`))) {
                    el.setAttribute('title', tooltips[key]);
                }
            }
        });
    }

export function cleanHtmlClientSide(htmlStr) {
    if (!htmlStr || !htmlStr.trim()) return "";
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlStr, 'text/html');
    const body = doc.body;
    if (!body) return htmlStr;
    
    let consecutiveBlanks = 0;
    const children = Array.from(body.children);

    for (const el of children) {
        const isBlank = el.nodeName === 'P' && (!el.textContent.trim() && !el.querySelector('img'));
        if (isBlank) {
            consecutiveBlanks++;
            if (consecutiveBlanks > 1) {
                el.remove();
            }
        } else {
            consecutiveBlanks = 0;
        }
    }
    
    const updatedChildren = Array.from(body.children);
    for (let i = updatedChildren.length - 1; i >= 0; i--) {
        const el = updatedChildren[i];
        if (el.nodeName === 'P' && (!el.textContent.trim() && !el.querySelector('img'))) {
            el.remove();
        } else {
            break;
        }
    }
    return body.innerHTML;
}

export function cleanActiveEditorContent(editorType) {
    let editor;
    let htmlEditor;

    if (editorType === 'note') {
        editor = noteEditorQuill;
        htmlEditor = document.getElementById('html-editor');
    } else { // 'import'
        editor = importEditorQuill;
        htmlEditor = document.getElementById('html-import-editor');
    }

    if (!editor) return;

    const currentHtml = editor.root.innerHTML;
    const cleanedHtml = cleanHtmlClientSide(currentHtml);
    
    editor.root.innerHTML = cleanedHtml;
    
    if (htmlEditor) {
        htmlEditor.value = cleanedHtml;
    }
}