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
        
        // Debug logging
        console.log(`RichTextEditor constructor:`, {
            containerId,
            outputElementId,
            containerFound: !!this.container,
            outputElementFound: !!this.outputElement
        });
        
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
        
        // Retry finding the output element if not found in constructor
        if (!this.outputElement) {
            this.outputElement = document.getElementById(this.outputElementId);
            console.log(`Retrying to find output element ${this.outputElementId}:`, !!this.outputElement);
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
        // Simple setup - no real-time sync needed
        console.log(`Editor ready: ${this.containerId}`);
    }
    
    syncContent() {
        if (this.outputElement) {
            const content = this.getCurrentContent();
            this.outputElement.value = content;
            console.log(`✅ Content synced for ${this.containerId} (${content.length} chars)`);
        } else {
            console.error(`❌ Cannot sync content for ${this.containerId}: outputElement not found (${this.outputElementId})`);
            // Try to find the output element again
            this.outputElement = document.getElementById(this.outputElementId);
            if (this.outputElement) {
                console.log(`✅ Found output element on retry for ${this.containerId}`);
                const content = this.getCurrentContent();
                this.outputElement.value = content;
                console.log(`✅ Content synced on retry for ${this.containerId} (${content.length} chars)`);
            } else {
                console.error(`❌ Output element ${this.outputElementId} still not found`);
            }
        }
    }
    
    setContent(html) {
        if (this.quill) {
            this.quill.root.innerHTML = html || '';
        }
    }
    
    getContent() {
        if (!this.quill) return '';
        
        // Use the proper Quill API method to get HTML content
        try {
            // Try the new Quill 2.0 method first
            if (this.quill.getSemanticHTML) {
                return this.quill.getSemanticHTML();
            }
            // Fallback to root.innerHTML
            return this.quill.root.innerHTML;
        } catch (error) {
            console.error('Error getting content from Quill:', error);
            return this.quill.root.innerHTML || '';
        }
    }
    
    getCurrentContent() {
        // Alternative method that ensures we get the latest content
        if (!this.quill) return '';
        
        // Force a focus/blur cycle to ensure content is captured
        const wasFocused = this.quill.hasFocus();
        if (wasFocused) {
            this.quill.blur();
        }
        
        const content = this.getContent();
        
        if (wasFocused) {
            this.quill.focus();
        }
        
        return content;
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

// Debug function to check sync status
function debugEditorSync() {
    console.log('=== Editor Sync Debug ===');
    
    if (noteEditor) {
        const quillContent = noteEditor.getContent();
        const hiddenContent = noteEditor.outputElement ? noteEditor.outputElement.value : 'N/A';
        console.log('Note Editor:');
        console.log('  Quill content length:', quillContent.length);
        console.log('  Hidden field content length:', hiddenContent.length);
        console.log('  Content matches:', quillContent === hiddenContent);
        console.log('  Quill preview:', quillContent.substring(0, 200) + (quillContent.length > 200 ? '...' : ''));
    } else {
        console.log('Note Editor: Not initialized');
    }
    
    if (importEditor) {
        const quillContent = importEditor.getContent();
        const hiddenContent = importEditor.outputElement ? importEditor.outputElement.value : 'N/A';
        console.log('Import Editor:');
        console.log('  Quill content length:', quillContent.length);
        console.log('  Hidden field content length:', hiddenContent.length);
        console.log('  Content matches:', quillContent === hiddenContent);
        console.log('  Quill preview:', quillContent.substring(0, 200) + (quillContent.length > 200 ? '...' : ''));
    } else {
        console.log('Import Editor: Not initialized');
    }
    
    console.log('=== End Debug ===');
}

// Make debug function globally available
window.debugEditorSync = debugEditorSync;

// Manual sync function for testing
function manualSync() {
    console.log('🔄 Manual sync triggered');
    if (window.noteEditor) {
        window.noteEditor.syncContent();
        console.log('✅ Note editor synced');
    }
    if (window.importEditor) {
        window.importEditor.syncContent();
        console.log('✅ Import editor synced');
    }
}

// Make manual sync globally available
window.manualSync = manualSync;

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
    // Check if editors are already initialized
    if (window.noteEditor && window.noteEditor.quill) {
        return;
    }
    
    // Initialize note editor
    if (document.getElementById('quill-editor')) {
        noteEditor = new RichTextEditor('quill-editor', 'editNoteContent', {
            placeholder: 'Edit your note content...'
        });
        
        // Make globally accessible for backward compatibility
        window.noteEditorQuill = noteEditor.quill;
        window.noteEditor = noteEditor;
    }
    
    // Initialize import editor
    if (document.getElementById('import-editor')) {
        importEditor = new RichTextEditor('import-editor', 'import_html_content', {
            placeholder: 'Paste your content here or import a .docx file...'
        });
        
        // Make globally accessible for backward compatibility
        window.importEditorQuill = importEditor.quill;
        window.importEditor = importEditor;
    }
    
    // Initialize shared content system
    initializeSharedContent();
    
    // Initialize toggle button states
    initializeToggleButtonStates();
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
    
    // Always ensure the hidden textarea is updated after any view change
    if (importEditor) {
        importEditor.syncContent();
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
        
        // Load content from HTML editor if it has content and Quill is empty
        if (noteEditor && htmlEditor.value.trim()) {
            const currentQuillContent = noteEditor.getContent();
            if (!currentQuillContent.trim() || currentQuillContent === '<p><br></p>') {
                console.log('📝 Loading HTML content into rich text editor');
                noteEditor.setContent(htmlEditor.value);
            }
        }
        
        // Update the hidden field with Quill content
        if (noteEditor) {
            const contentField = document.getElementById('editNoteContent');
            if (contentField) {
                contentField.value = noteEditor.getContent();
            }
        }
    } else if (view === 'html') {
        htmlEditor.classList.remove('hidden');
        if (htmlBtn) htmlBtn.classList.add('active');
        
        // Sync from Quill editor to HTML editor
        if (noteEditor) {
            console.log('📝 Syncing rich text content to HTML editor');
            const content = noteEditor.getContent();
            htmlEditor.value = content;
            
            // Update the hidden field
            const contentField = document.getElementById('editNoteContent');
            if (contentField) {
                contentField.value = content;
            }
        }
    } else if (view === 'preview') {
        previewContainer.classList.remove('hidden');
        if (previewBtn) previewBtn.classList.add('active');
        
        // Update preview with current content
        if (noteEditor) {
            console.log('📝 Updating preview with current content');
            const content = noteEditor.getContent();
            previewContainer.innerHTML = content;
            
            // Update the hidden field
            const contentField = document.getElementById('editNoteContent');
            if (contentField) {
                contentField.value = content;
            }
        }
    }
    
    // Always ensure the hidden textarea is updated after any view change
    if (noteEditor) {
        noteEditor.syncContent();
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
    if (noteEditor) {
        noteEditor.syncContent();
        console.log('Note editor content synced');
    }
    if (importEditor) {
        importEditor.syncContent();
        console.log('Import editor content synced');
    }
    console.log('All editors synced');
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

// Manual initialization function for testing
function forceInitializeEditors() {
    console.log('🔄 Force initializing editors...');
    
    // Clear any existing editor instances
    if (window.noteEditor) {
        if (window.noteEditor.destroy) {
            window.noteEditor.destroy();
        }
        window.noteEditor = null;
    }
    
    if (window.importEditor) {
        if (window.importEditor.destroy) {
            window.importEditor.destroy();
        }
        window.importEditor = null;
    }
    
    // Call initialization
    initializeEditors();
}

// Make functions globally available
window.initializeEditors = initializeEditors;
window.forceInitializeEditors = forceInitializeEditors;
window.toggleImportEditorView = toggleImportEditorView;
window.toggleEditorView = toggleEditorView;
window.cleanActiveEditorContent = cleanActiveEditorContent;
window.syncEditorContent = syncEditorContent;
window.syncAllEditors = syncAllEditors;
window.initializeSharedContent = initializeSharedContent;
window.createSharedEditorContent = createSharedEditorContent;
window.initializeToggleButtonStates = initializeToggleButtonStates;

initializeToggleButtonStates();
