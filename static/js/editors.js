/*
 * UNIFIED RICH TEXT EDITOR SYSTEM
 * 
 * This system provides a unified approach to rich text editing across the application.
 * 
 * USAGE:
 * 
 * 1. Basic Editor Creation:
 *    const editor = new RichTextEditor('container-id', 'output-element-id', options);
 * 
 * 2. Content Management:
 *    editor.setContent('<p>Hello World</p>');
 *    const content = editor.getContent();
 * 
 * 3. Shared Content (for syncing between note and import editors):
 *    // Sync content from note editor to import editor
 *    if (window.sharedEditorContent) {
 *        window.sharedEditorContent.syncFromNote();
 *    }
 * 
 *    // Sync content from import editor to note editor
 *    if (window.sharedEditorContent) {
 *        window.sharedEditorContent.syncFromImport();
 *    }
 * 
 * 4. Direct Synchronization:
 *    syncEditorContent(noteEditor, importEditor); // Copy from note to import
 *    syncEditorContent(importEditor, noteEditor); // Copy from import to note
 * 
 * PARSING FUNCTIONALITY:
 * The parsing functionality remains separate and is handled by the backend
 * when content is submitted via forms. This maintains separation of concerns.
 */

// Unified Rich Text Editor System
class RichTextEditor {
    constructor(containerId, outputElementId, options = {}) {
        this.containerId = containerId;
        this.outputElementId = outputElementId;
        this.container = document.getElementById(containerId);
        this.outputElement = document.getElementById(outputElementId);
        this.quill = null;
        this.observer = null;
        
        // Create custom toolbar HTML with tooltips
        this.createCustomToolbar();
        
        // Default options with enhanced modules
        this.options = {
            theme: 'snow',
            placeholder: options.placeholder || 'Start typing...',
            modules: { 
                toolbar: `#${containerId}-toolbar`, // Use custom toolbar
                syntax: typeof hljs !== 'undefined' ? {
                    highlight: text => hljs.highlightAuto(text).value
                } : true // Fallback to basic syntax highlighting
            }
        };
        
        this.initialize();
    }
    
    createCustomToolbar() {
        if (!this.container) return;
        
        // Create compact toolbar HTML with tooltips - all in one line
        const toolbarHtml = `
            <div id="${this.containerId}-toolbar" class="ql-toolbar ql-toolbar-compact">
                <span class="ql-formats">
                    <select class="ql-header" title="Header Style">
                        <option selected></option>
                        <option value="1">H1</option>
                        <option value="2">H2</option>
                        <option value="3">H3</option>
                        <option value="4">H4</option>
                        <option value="5">H5</option>
                        <option value="6">H6</option>
                    </select>
                    <select class="ql-font" title="Font Family">
                        <option selected></option>
                    </select>
                    <select class="ql-size" title="Font Size">
                        <option value="small">S</option>
                        <option selected>M</option>
                        <option value="large">L</option>
                        <option value="huge">XL</option>
                    </select>
                </span>
                <span class="ql-formats">
                    <button class="ql-bold" title="Bold Text"></button>
                    <button class="ql-italic" title="Italic Text"></button>
                    <button class="ql-underline" title="Underline Text"></button>
                    <button class="ql-strike" title="Strike Through"></button>
                </span>
                <span class="ql-formats">
                    <select class="ql-color" title="Text Color">
                        <option selected></option>
                    </select>
                    <select class="ql-background" title="Background Color">
                        <option selected></option>
                    </select>
                </span>
                <span class="ql-formats">
                    <button class="ql-script" value="sub" title="Subscript"></button>
                    <button class="ql-script" value="super" title="Superscript"></button>
                    <button class="ql-list" value="ordered" title="Numbered List"></button>
                    <button class="ql-list" value="bullet" title="Bullet List"></button>
                    <button class="ql-indent" value="-1" title="Decrease Indent"></button>
                    <button class="ql-indent" value="+1" title="Increase Indent"></button>
                </span>
                <span class="ql-formats">
                    <button class="ql-blockquote" title="Quote Block"></button>
                    <button class="ql-code-block" title="Code Block"></button>
                    <button class="ql-link" title="Insert Link"></button>
                    <button class="ql-image" title="Insert Image"></button>
                    <button class="ql-video" title="Insert Video"></button>
                    <button class="ql-clean" title="Clear Formatting"></button>
                </span>
            </div>
        `;
        
        // Insert toolbar before the editor container
        this.container.insertAdjacentHTML('beforebegin', toolbarHtml);
    }
    
    initialize() {
        if (!this.container) {
            console.warn(`Container ${this.containerId} not found`);
            return;
        }
        
        // Initialize Quill editor
        this.quill = new Quill(`#${this.containerId}`, this.options);
        
        // Set up content synchronization
        this.setupContentSync();
        
        // Add custom image resize functionality
        if (typeof window.makeImageResizable === 'function') {
            window.makeImageResizable(this.quill);
        }
        
        console.log('Editor initialized with custom toolbar for:', this.containerId);
    }
    
    setupContentSync() {
        if (!this.outputElement) return;
        
        // Listen for text changes
        this.quill.on('text-change', () => {
            this.syncContent();
        });
        
        // Listen for manual content updates (like image resize)
        this.observer = new MutationObserver(() => {
            this.syncContent();
        });
        
        this.observer.observe(this.quill.root, { 
            childList: true, 
            subtree: true, 
            attributes: true, 
            attributeFilter: ['style', 'width', 'height'] 
        });
    }
    
    syncContent() {
        if (this.outputElement) {
            this.outputElement.value = this.quill.root.innerHTML;
        }
    }
    
    setContent(html) {
        if (this.quill) {
            this.quill.root.innerHTML = html || '';
        }
    }
    
    getContent() {
        return this.quill ? this.quill.root.innerHTML : '';
    }
    
    focus() {
        if (this.quill) {
            this.quill.focus();
        }
    }
    
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        if (this.quill) {
            delete this.quill;
        }
    }
}

// Global editor instances
let noteEditor;
let importEditor;

const TOOLBAR_OPTIONS = [
    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
    [{ 'font': [] }],
    [{ 'size': ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'script': 'sub'}, { 'script': 'super' }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'indent': '-1'}, { 'indent': '+1' }],
    ['blockquote', 'code-block'],
    ['link', 'image', 'video'],
    ['clean']
];

function initializeEditors() {
    // Initialize note editor
    if (document.getElementById('quill-editor')) {
        noteEditor = new RichTextEditor('quill-editor', 'editNoteContent', {
            placeholder: 'Edit your note content...'
        });
        
        // Make globally accessible for backward compatibility
        window.noteEditorQuill = noteEditor.quill;
    }
    
    // Initialize import editor
    if (document.getElementById('import-editor')) {
        importEditor = new RichTextEditor('import-editor', 'import_html_content', {
            placeholder: 'Paste your content here or import a .docx file...'
        });
        
        // Make globally accessible for backward compatibility
        window.importEditorQuill = importEditor.quill;
    }
    
    // Initialize shared content system
    initializeSharedContent();
    
    // Initialize toggle button states
    initializeToggleButtonStates();
    
    // Store editor instances globally
    window.noteEditor = noteEditor;
    window.importEditor = importEditor;
}

// Initialize button states for editor toggles
function initializeToggleButtonStates() {
    // Set default active state for note editor (Rich Text)
    const noteRichTextBtn = document.querySelector('#editor-toggle-buttons button[onclick*="richtext"]');
    if (noteRichTextBtn) noteRichTextBtn.classList.add('active');
    
    // Set default active state for import editor (Rich Text)
    const importRichTextBtn = document.querySelector('#import-editor-toggle-buttons button[onclick*="richtext"]');
    if (importRichTextBtn) importRichTextBtn.classList.add('active');
}

function toggleImportEditorView(view) {
    const rich = document.getElementById('import-editor-container');
    const html = document.getElementById('html-import-editor');
    
    // Get toggle buttons
    const richTextBtn = document.querySelector('#import-editor-toggle-buttons button[onclick*="richtext"]');
    const htmlBtn = document.querySelector('#import-editor-toggle-buttons button[onclick*="html"]');
    
    if (view === 'richtext') {
        rich.classList.remove('hidden');
        html.classList.add('hidden');
        
        // Update button states
        if (richTextBtn) richTextBtn.classList.add('active');
        if (htmlBtn) htmlBtn.classList.remove('active');
        
        if (importEditor && html.value) {
            importEditor.setContent(html.value);
        }
    } else {
        html.classList.remove('hidden');
        rich.classList.add('hidden');
        
        // Update button states
        if (htmlBtn) htmlBtn.classList.add('active');
        if (richTextBtn) richTextBtn.classList.remove('active');
        
        if (importEditor) {
            html.value = importEditor.getContent();
        }
    }
}

function toggleEditorView(view) {
    const richContainer = document.getElementById('quill-editor-container');
    const htmlEditor = document.getElementById('html-editor');
    const previewContainer = document.getElementById('quill-preview-container');
    
    // Get toggle buttons
    const richTextBtn = document.querySelector('#editor-toggle-buttons button[onclick*="richtext"]');
    const htmlBtn = document.querySelector('#editor-toggle-buttons button[onclick*="html"]');
    const previewBtn = document.querySelector('#editor-toggle-buttons button[onclick*="preview"]');
    
    // Hide all views first
    richContainer.classList.add('hidden');
    htmlEditor.classList.add('hidden');
    previewContainer.classList.add('hidden');
    
    // Remove active class from all buttons
    if (richTextBtn) richTextBtn.classList.remove('active');
    if (htmlBtn) htmlBtn.classList.remove('active');
    if (previewBtn) previewBtn.classList.remove('active');
    
    if (view === 'richtext') {
        richContainer.classList.remove('hidden');
        if (richTextBtn) richTextBtn.classList.add('active');
        
        // Sync from HTML editor if it has content
        if (noteEditor && htmlEditor.value) {
            noteEditor.setContent(htmlEditor.value);
        }
    } else if (view === 'html') {
        htmlEditor.classList.remove('hidden');
        if (htmlBtn) htmlBtn.classList.add('active');
        
        // Sync from Quill editor
        if (noteEditor) {
            htmlEditor.value = noteEditor.getContent();
        }
    } else if (view === 'preview') {
        previewContainer.classList.remove('hidden');
        if (previewBtn) previewBtn.classList.add('active');
        
        // Update preview with current content
        if (noteEditor) {
            previewContainer.innerHTML = noteEditor.getContent();
        }
    }
}

function cleanActiveEditorContent(editorType) {
    let editor, htmlEditor;
    if (editorType === 'note') {
        editor = noteEditor;
        htmlEditor = document.getElementById('html-editor');
    } else {
        editor = importEditor;
        htmlEditor = document.getElementById('html-import-editor');
    }
    if (!editor) return;
    
    const cleaned = (editor.getContent() || '').replace(/(<p>\s*<\/p>)+/g, '<p></p>');
    editor.setContent(cleaned);
    if (htmlEditor) htmlEditor.value = cleaned;
}

// Content synchronization functions
function syncEditorContent(fromEditor, toEditor) {
    if (!fromEditor || !toEditor) return;
    
    const content = fromEditor.getContent();
    toEditor.setContent(content);
}

function syncAllEditors() {
    // This function can be called when you want to sync content between editors
    // For example, when opening a modal that should show the same content
    if (noteEditor && importEditor) {
        // You can implement logic here to decide which direction to sync
        // For now, this is a placeholder for future use
        console.log('Sync functionality available');
    }
}

// Advanced synchronization utilities
function createSharedEditorContent() {
    // Creates a shared content system that can be used by both editors
    let sharedContent = '';
    
    return {
        setContent: function(content) {
            sharedContent = content;
            // Update both editors if they exist
            if (noteEditor) noteEditor.setContent(content);
            if (importEditor) importEditor.setContent(content);
        },
        
        getContent: function() {
            return sharedContent;
        },
        
        syncFromNote: function() {
            if (noteEditor) {
                sharedContent = noteEditor.getContent();
                if (importEditor) importEditor.setContent(sharedContent);
            }
        },
        
        syncFromImport: function() {
            if (importEditor) {
                sharedContent = importEditor.getContent();
                if (noteEditor) noteEditor.setContent(sharedContent);
            }
        }
    };
}

// Initialize shared content system
let sharedEditorContent = null;

function initializeSharedContent() {
    sharedEditorContent = createSharedEditorContent();
    window.sharedEditorContent = sharedEditorContent;
}

window.initializeEditors = initializeEditors;
window.toggleImportEditorView = toggleImportEditorView;
window.toggleEditorView = toggleEditorView;
window.cleanActiveEditorContent = cleanActiveEditorContent;
window.syncEditorContent = syncEditorContent;
window.syncAllEditors = syncAllEditors;
window.initializeSharedContent = initializeSharedContent;
window.createSharedEditorContent = createSharedEditorContent;
window.initializeToggleButtonStates = initializeToggleButtonStates;
window.initializeSharedContent = initializeSharedContent;

initializeToggleButtonStates();
