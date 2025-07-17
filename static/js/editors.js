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
            formats: ['header', 'font', 'size', 'bold', 'italic', 'underline', 'strike', 'color', 'background', 'script', 'list', 'bullet', 'indent', 'blockquote', 'code-block', 'link', 'image'],
            modules: { 
                toolbar: {
                    container: `#${containerId}-toolbar`,
                    handlers: {
                        'link': this.handleLink.bind(this),
                        'font': this.handleFont.bind(this),
                        'size': this.handleSize.bind(this)
                    }
                },
                syntax: typeof hljs !== 'undefined' ? {
                    highlight: text => hljs.highlightAuto(text).value
                } : true // Fallback to basic syntax highlighting
            }
        };
        
        // Configure font whitelist for Quill
        const Font = Quill.import('formats/font');
        Font.whitelist = ['serif', 'monospace', 'arial', 'times', 'georgia', 'helvetica', 'comic', 'impact', 'verdana', 'tahoma', 'trebuchet', 'palatino', 'courier', 'lucida'];
        Quill.register(Font, true);
        
        this.initialize();
        
        // Add document-wide click handler to manage picker state
        this.setupPickerStateManager();
    }
    
    setupPickerStateManager() {
        // Add a global click handler to clean up picker positioning when closed
        document.addEventListener('click', (e) => {
            // Check if any picker is being closed
            const wasPickerClick = e.target.closest('.ql-picker');
            
            // If clicking outside all pickers, clean up any positioning
            if (!wasPickerClick) {
                const allPickerOptions = document.querySelectorAll('.ql-picker-options');
                allPickerOptions.forEach(options => {
                    // Reset any positioning we may have applied
                    if (options.style.position === 'fixed' || options.style.position === 'absolute') {
                        options.style.position = '';
                        options.style.left = '';
                        options.style.top = '';
                        options.style.zIndex = '';
                    }
                    // Remove our picker classes
                    options.classList.remove('picker-visible', 'color-picker-visible');
                });
                
                // Remove overflow allowance from modal bodies
                const modalBodies = document.querySelectorAll('.modal-body.allow-overflow');
                modalBodies.forEach(body => {
                    body.classList.remove('allow-overflow');
                });
            }
        });
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
                        <option value="serif">Serif</option>
                        <option value="monospace">Monospace</option>
                        <option value="arial">Arial</option>
                        <option value="times">Times New Roman</option>
                        <option value="georgia">Georgia</option>
                        <option value="helvetica">Helvetica</option>
                        <option value="comic">Comic Sans MS</option>
                        <option value="impact">Impact</option>
                        <option value="verdana">Verdana</option>
                        <option value="tahoma">Tahoma</option>
                        <option value="trebuchet">Trebuchet MS</option>
                        <option value="palatino">Palatino</option>
                        <option value="courier">Courier New</option>
                        <option value="lucida">Lucida Console</option>
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
                    <select class="ql-color" title="Text Color"></select>
                    <select class="ql-background" title="Background Color"></select>
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
        
        // Add video wrapper functionality
        this.setupVideoWrappers();
        
        // Add link wrapper functionality
        this.setupLinkWrappers();
        
        // Set up link formatting handling
        this.setupLinkFormatting();
        
        console.log('Editor initialized with custom toolbar for:', this.containerId);
        
        // Add debugging for color picker functionality
        this.addColorPickerDebugLogging();

        // Patch code block and clear formatting behavior
        this.patchCodeBlockAndClearFormatting();
        
        // Add right-click handler for ordered lists in the editor
        if (this.containerId === 'quill-editor') {
            const editorRoot = this.quill.root;
            let currentOl = null;
            // Helper to update all <ol> start attributes based on data-ol-start and continuity
            function updateOrderedListStarts(container) {
                let lastNumber = 0;
                let lastWasOl = false;
                let lastOl = null;
                Array.from(container.childNodes).forEach(node => {
                    if (node.nodeType === 1 && node.tagName === 'OL') {
                        let start = 1;
                        if (node.hasAttribute('data-ol-start')) {
                            start = parseInt(node.getAttribute('data-ol-start'), 10) || 1;
                        } else if (lastWasOl && lastOl) {
                            // Continue numbering if previous sibling was <ol>
                            const prevLis = lastOl.querySelectorAll('li');
                            start = lastNumber + prevLis.length;
                        }
                        node.setAttribute('start', start);
                        lastNumber = start;
                        lastWasOl = true;
                        lastOl = node;
                    } else if (node.nodeType === 1 && (node.tagName === 'IMG' || node.tagName === 'P' || node.tagName === 'DIV' || node.tagName === 'UL' || node.tagName === 'PRE' || node.tagName === 'BLOCKQUOTE')) {
                        lastWasOl = false;
                        lastOl = null;
                        lastNumber = 0;
                    }
                });
            }
            // Expose for preview use
            window.updateOrderedListStarts = updateOrderedListStarts;
            editorRoot.addEventListener('contextmenu', (e) => {
                let ol = e.target.closest('ol');
                if (ol && editorRoot.contains(ol)) {
                    e.preventDefault();
                    currentOl = ol;
                    // Show modal
                    const modal = document.getElementById('olStartFromModal');
                    const input = document.getElementById('olStartFromInput');
                    input.value = ol.hasAttribute('data-ol-start') ? ol.getAttribute('data-ol-start') : (ol.getAttribute('start') || 1);
                    modal.classList.remove('hidden', 'opacity-0');
                    setTimeout(() => { input.focus(); }, 100);
                }
            });
            // Handle modal form submit
            const form = document.getElementById('olStartFromForm');
            form.addEventListener('submit', (ev) => {
                ev.preventDefault();
                const input = document.getElementById('olStartFromInput');
                const value = parseInt(input.value, 10) || 1;
                if (currentOl) {
                    if (value === 1) {
                        currentOl.removeAttribute('data-ol-start');
                    } else {
                        currentOl.setAttribute('data-ol-start', value);
                    }
                    // Update Quill Delta by replacing the ol's outerHTML
                    // Find the index in Quill corresponding to this ol
                    const html = editorRoot.innerHTML;
                    this.quill.root.innerHTML = html; // Force Quill to reparse
                    updateOrderedListStarts(editorRoot);
                }
                // Hide modal
                document.getElementById('olStartFromModal').classList.add('hidden', 'opacity-0');
                currentOl = null;
            });
            // Update starts after every change
            this.quill.on('text-change', () => {
                updateOrderedListStarts(editorRoot);
            });
            // Initial update
            updateOrderedListStarts(editorRoot);
        }
    }
    
    // Patch Quill to clean all formatting when code block is removed or clear formatting is used
    patchCodeBlockAndClearFormatting() {
        if (!this.quill) return;

        // Track code block state more reliably
        this._lastWasCodeBlock = false;
        this._codeBlockElements = new Set();

        // Listen for format changes and text changes
        this.quill.on('text-change', (delta, oldDelta, source) => {
            setTimeout(() => {
                this.checkForCodeBlockRemoval();
            }, 50); // Small delay to ensure DOM updates
        });

        // Listen for selection changes to track code blocks
        this.quill.on('selection-change', (range) => {
            if (!range) return;
            setTimeout(() => {
                this.trackCodeBlockState(range);
            }, 10);
        });

        // Patch clear formatting button with more aggressive cleaning
        const toolbar = document.getElementById(`${this.containerId}-toolbar`);
        if (toolbar) {
            const clearBtn = toolbar.querySelector('.ql-clean');
            if (clearBtn) {
                clearBtn.addEventListener('click', (e) => {
                    // Prevent default Quill behavior temporarily
                    e.preventDefault();
                    e.stopPropagation();
                    
                    setTimeout(() => {
                        const selection = this.quill.getSelection();
                        if (selection) {
                            this.aggressiveFormatClear(selection);
                        }
                    }, 10);
                });
            }

            // Also listen for code block button clicks
            const codeBlockBtn = toolbar.querySelector('.ql-code-block');
            if (codeBlockBtn) {
                codeBlockBtn.addEventListener('click', () => {
                    setTimeout(() => {
                        const selection = this.quill.getSelection();
                        if (selection) {
                            const format = this.quill.getFormat(selection.index, selection.length);
                            // If code block was just turned off, aggressively clean
                            if (!format['code-block']) {
                                console.log('🎯 Code block button clicked - cleaning formatting');
                                this.aggressiveFormatClear(selection);
                            }
                        }
                    }, 100);
                });
            }
        }
        
        // Also listen for keyboard shortcuts that might toggle code blocks
        this.quill.keyboard.addBinding({
            key: 'E',
            ctrlKey: true,
            shiftKey: true
        }, () => {
            setTimeout(() => {
                const selection = this.quill.getSelection();
                if (selection) {
                    this.checkForCodeBlockRemoval();
                }
            }, 100);
        });
    }

    // Track code block state for better detection
    trackCodeBlockState(range) {
        if (!this.quill || !range) return;
        
        const format = this.quill.getFormat(range.index, range.length);
        const isCodeBlock = !!format['code-block'];
        
        // Store previous state
        const wasCodeBlock = this._lastWasCodeBlock;
        this._lastWasCodeBlock = isCodeBlock;
        
        // If we just exited a code block, clean formatting
        if (wasCodeBlock && !isCodeBlock) {
            setTimeout(() => {
                this.cleanCodeBlockFormatting(range);
            }, 50);
        }
    }

    // Check for code block removal by examining DOM
    checkForCodeBlockRemoval() {
        if (!this.quill) return;
        
        const selection = this.quill.getSelection();
        if (!selection) return;
        
        // Check if we're still in a code block
        const format = this.quill.getFormat(selection.index, selection.length);
        const isCodeBlock = !!format['code-block'];
        
        // If we were in a code block but aren't anymore, clean formatting
        if (this._lastWasCodeBlock && !isCodeBlock) {
            this.cleanCodeBlockFormatting(selection);
        }
        
        this._lastWasCodeBlock = isCodeBlock;
    }

    // More aggressive format clearing
    aggressiveFormatClear(selection) {
        if (!this.quill || !selection) return;
        
        console.log('🧹 Starting aggressive format clear for selection:', selection);
        
        // Step 1: Get the actual text content to preserve
        const textContent = this.quill.getText(selection.index, selection.length || 1);
        
        // Step 2: Remove all formatting using multiple methods
        this.quill.removeFormat(selection.index, selection.length || 1);
        
        // Step 3: Force clear all formats individually
        const allFormats = [
            'font', 'background', 'color', 'code', 'code-block', 'bold', 'italic', 
            'underline', 'strike', 'size', 'script', 'align', 'blockquote', 
            'list', 'indent', 'direction', 'header', 'link'
        ];
        
        allFormats.forEach(format => {
            try {
                this.quill.formatText(selection.index, selection.length || 1, format, false);
            } catch (error) {
                console.warn(`Failed to clear format ${format}:`, error);
            }
        });
        
        // Step 4: Nuclear option - replace the content entirely
        setTimeout(() => {
            if (textContent) {
                // Delete the formatted text and insert plain text
                this.quill.deleteText(selection.index, selection.length || 1);
                this.quill.insertText(selection.index, textContent);
                
                // Reset selection to the new text
                this.quill.setSelection(selection.index, textContent.length);
            }
            
            // Step 5: Clean up any remaining DOM artifacts
            this.cleanupDOMFormatting(selection);
            
            // Step 6: Force editor update
            this.quill.update();
        }, 50);
        
        console.log('✨ Aggressive format clear completed');
    }

    // Clean up DOM-level formatting that Quill might miss
    cleanupDOMFormatting(selection) {
        if (!this.quill || !selection) return;
        
        const editor = this.quill.container.querySelector('.ql-editor');
        if (!editor) return;
        
        console.log('🧹 Cleaning DOM formatting');
        
        // Get all elements in the editor
        const allElements = editor.querySelectorAll('*');
        
        allElements.forEach(element => {
            // Remove inline styles completely
            const stylesToRemove = [
                'fontFamily', 'font-family',
                'backgroundColor', 'background-color', 'background',
                'color',
                'fontSize', 'font-size',
                'fontWeight', 'font-weight',
                'fontStyle', 'font-style',
                'textDecoration', 'text-decoration'
            ];
            
            stylesToRemove.forEach(style => {
                element.style.removeProperty(style);
                element.style[style] = '';
            });
            
            // Remove problematic classes
            const classesToRemove = [];
            Array.from(element.classList).forEach(className => {
                if (className.startsWith('ql-font-') || 
                    className.startsWith('ql-size-') || 
                    className.startsWith('ql-color-') || 
                    className.startsWith('ql-background-') ||
                    className.includes('code') ||
                    className.includes('mono')) {
                    classesToRemove.push(className);
                }
            });
            
            classesToRemove.forEach(className => {
                element.classList.remove(className);
            });
            
            // Remove style attribute if it's empty
            if (element.style.length === 0) {
                element.removeAttribute('style');
            }
        });
        
        // Special handling for code elements
        const codeElements = editor.querySelectorAll('code, pre, .ql-code-block');
        codeElements.forEach(codeEl => {
            // If it's not actually a code block anymore, remove code-specific styling
            const parent = codeEl.parentElement;
            if (parent && !parent.classList.contains('ql-code-block')) {
                codeEl.style.fontFamily = '';
                codeEl.style.backgroundColor = '';
                codeEl.style.color = '';
                codeEl.removeAttribute('style');
            }
        });
        
        console.log('✨ DOM cleanup completed');
    }

    // Remove all code block-related formatting from the selection
    cleanCodeBlockFormatting(selection) {
        if (!this.quill || !selection) return;
        
        console.log('🧹 Cleaning code block formatting from selection:', selection);
        
        // Remove all possible code block-related formats
        const formatsToRemove = [
            'font', 'background', 'color', 'code', 'code-block', 'bold', 'italic', 
            'underline', 'strike', 'size', 'script', 'align', 'blockquote', 
            'list', 'indent', 'direction', 'header', 'link'
        ];
        
        // Use both length and single character to ensure complete cleanup
        const cleanupLength = Math.max(selection.length || 1, 1);
        
        formatsToRemove.forEach(format => {
            try {
                this.quill.formatText(selection.index, cleanupLength, format, false);
            } catch (error) {
                console.warn(`Failed to remove format ${format}:`, error);
            }
        });
        
        // Force a refresh of the editor state
        setTimeout(() => {
            this.quill.update();
        }, 100);
        
        console.log('✨ Code block formatting cleanup completed');
    }
    
    addColorPickerDebugLogging() {
        const toolbar = document.getElementById(`${this.containerId}-toolbar`);
        if (!toolbar) {
            window.appLogger?.error('COLOR_PICKER_DEBUG_SETUP_FAILED', { 
                reason: 'Toolbar not found',
                containerId: this.containerId 
            });
            return;
        }
        
        window.appLogger?.info('COLOR_PICKER_DEBUG_SETUP', {
            containerId: this.containerId,
            toolbarFound: true
        });
        
        // Find all picker elements and their current state
        const allPickers = toolbar.querySelectorAll('.ql-color, .ql-background');
        window.appLogger?.info('COLOR_PICKER_ELEMENTS_FOUND', {
            containerId: this.containerId,
            count: allPickers.length,
            elements: Array.from(allPickers).map((picker, index) => ({
                index,
                tagName: picker.tagName,
                classList: Array.from(picker.classList),
                hasParent: !!picker.parentElement
            }))
        });
        
        // Check if Quill has transformed these selects into picker components
        const quillPickers = toolbar.querySelectorAll('.ql-picker');
        window.appLogger?.info('QUILL_PICKER_COMPONENTS_FOUND', {
            containerId: this.containerId,
            count: quillPickers.length,
            pickers: Array.from(quillPickers).map((picker, index) => ({
                index,
                classList: Array.from(picker.classList),
                childrenCount: picker.children.length,
                hasPickerOptions: !!picker.querySelector('.ql-picker-options')
            }))
        });
        
        // Set up click-based picker positioning - OVERRIDE Quill's default behavior
        this.currentPickerOptions = null;
        this.currentModalBody = null;
        this.currentPickerType = null; // 'color', 'background', 'header', 'font', or 'size'
        
        // Handle all picker button clicks
        toolbar.addEventListener('click', (e) => {
            const colorButton = e.target.closest('.ql-color .ql-picker-label');
            const backgroundButton = e.target.closest('.ql-background .ql-picker-label');
            const headerButton = e.target.closest('.ql-header .ql-picker-label');
            const fontButton = e.target.closest('.ql-font .ql-picker-label');
            const sizeButton = e.target.closest('.ql-size .ql-picker-label');
            
            if (colorButton || backgroundButton || headerButton || fontButton || sizeButton) {
                // Prevent Quill's default expand behavior
                e.preventDefault();
                e.stopPropagation();
                
                const pickerElement = e.target.closest('.ql-picker');
                if (pickerElement) {
                    pickerElement.classList.remove('ql-expanded');
                }
                
                // Determine picker type
                if (colorButton) {
                    this.currentPickerType = 'color';
                } else if (backgroundButton) {
                    this.currentPickerType = 'background';
                } else if (headerButton) {
                    this.currentPickerType = 'header';
                } else if (fontButton) {
                    this.currentPickerType = 'font';
                } else if (sizeButton) {
                    this.currentPickerType = 'size';
                }
                
                // Close any currently open picker
                if (this.currentPickerOptions) {
                    this.hidePicker();
                }
                
                // Show the clicked picker
                this.showPicker(pickerElement, this.currentPickerType);
                
                window.appLogger?.action('PICKER_CLICKED', {
                    type: this.currentPickerType,
                    pickerElement: pickerElement?.className || 'none'
                });
            } else {
                // Click outside picker - close any open picker
                if (this.currentPickerOptions && !e.target.closest('.ql-picker-options')) {
                    this.hidePicker();
                }
            }
        }, true); // Use capture to intercept before Quill handles it
        
        // Handle clicks outside the picker area
        document.addEventListener('click', (e) => {
            if (this.currentPickerOptions && 
                !e.target.closest('.ql-picker-options') && 
                !e.target.closest('.ql-color') && 
                !e.target.closest('.ql-background') &&
                !e.target.closest('.ql-header') &&
                !e.target.closest('.ql-font') &&
                !e.target.closest('.ql-size')) {
                this.hidePicker();
            }
        });    }

    showPicker(pickerElement, pickerType) {
        if (!pickerElement) return;
        
        // Find the picker dropdown/options element
        const pickerOptions = pickerElement.querySelector('.ql-picker-options');
        if (!pickerOptions) return;
        
        // Get the picker button for positioning reference
        const pickerButton = pickerElement.querySelector('.ql-picker-label');
        if (!pickerButton) return;
        
        // Find the modal body and temporarily allow overflow
        const modalBody = pickerElement.closest('.modal-body');
        this.currentModalBody = modalBody;
        if (modalBody) {
            modalBody.classList.add('allow-overflow');
        }
        
        // Position the picker below the button
        this.positionPickerBelowButton(pickerOptions, pickerButton, pickerType);
        
        // Add our visible class to show the picker
        if (pickerType === 'color' || pickerType === 'background') {
            pickerOptions.classList.add('color-picker-visible');
        } else {
            pickerOptions.classList.add('picker-visible');
        }
        
        // Store reference and set up selection handlers
        this.currentPickerOptions = pickerOptions;
        
        if (pickerType === 'color' || pickerType === 'background') {
            this.setupColorSelection(pickerOptions, pickerType);
        } else {
            this.setupDropdownSelection(pickerOptions, pickerType);
        }
        
        window.appLogger?.action('PICKER_SHOWN', {
            type: pickerType,
            positioning: 'fixed below button (click-based)'
        });
    }

    setupColorSelection(pickerOptions, pickerType) {
        if (!pickerOptions) return;
        
        // Remove any existing listeners to prevent duplicates
        const existingHandler = pickerOptions._colorSelectionHandler;
        if (existingHandler) {
            pickerOptions.removeEventListener('click', existingHandler);
        }
        
        // Create new color selection handler
        const colorSelectionHandler = (e) => {
            const colorItem = e.target.closest('.ql-picker-item');
            if (!colorItem) return;
            
            // Get the color value from the item
            const colorValue = colorItem.getAttribute('data-value') || 
                             colorItem.style.backgroundColor || 
                             window.getComputedStyle(colorItem).backgroundColor;
            
            window.appLogger?.action('COLOR_SELECTED', {
                type: pickerType,
                colorValue: colorValue,
                itemElement: colorItem.className
            });
            
            // Apply the color using Quill's format method
            if (this.quill) {
                const selection = this.quill.getSelection();
                if (selection && selection.length > 0) {
                    // Apply to selected text
                    this.quill.format(pickerType, colorValue);
                } else {
                    // Set format for next text input
                    this.quill.format(pickerType, colorValue);
                }
                
                // Focus back to the editor
                this.quill.focus();
            }
            
            // Close the picker after selection
            setTimeout(() => {
                this.hideColorPicker();
            }, 100);
        };
        
        // Store the handler reference and add the listener
        pickerOptions._colorSelectionHandler = colorSelectionHandler;
        pickerOptions.addEventListener('click', colorSelectionHandler);
    }

    setupDropdownSelection(pickerOptions, pickerType) {
        if (!pickerOptions) return;
        
        // Remove any existing listeners to prevent duplicates
        const existingHandler = pickerOptions._dropdownSelectionHandler;
        if (existingHandler) {
            pickerOptions.removeEventListener('click', existingHandler);
        }
        
        // Create new dropdown selection handler
        const dropdownSelectionHandler = (e) => {
            const dropdownItem = e.target.closest('.ql-picker-item');
            if (!dropdownItem) return;
            
            // Get the value from the item
            const itemValue = dropdownItem.getAttribute('data-value') || dropdownItem.textContent;
            
            window.appLogger?.action('DROPDOWN_SELECTED', {
                type: pickerType,
                itemValue: itemValue,
                itemElement: dropdownItem.className
            });
            
            // Apply the selection using Quill's format method
            if (this.quill) {
                const selection = this.quill.getSelection();
                if (selection && selection.length > 0) {
                    // Apply to selected text
                    this.quill.format(pickerType, itemValue || false);
                } else {
                    // Set format for next text input
                    this.quill.format(pickerType, itemValue || false);
                }
                
                // Focus back to the editor
                this.quill.focus();
            }
            
            // Close the picker after selection
            setTimeout(() => {
                this.hidePicker();
            }, 100);
        };
        
        // Store the handler reference and add the listener
        pickerOptions._dropdownSelectionHandler = dropdownSelectionHandler;
        pickerOptions.addEventListener('click', dropdownSelectionHandler);
    }

    hidePicker() {
        if (this.currentPickerOptions) {
            // Remove our visible classes
            this.currentPickerOptions.classList.remove('picker-visible');
            this.currentPickerOptions.classList.remove('color-picker-visible');
            
            // FORCE the picker to be completely hidden - override any CSS that might show it
            this.currentPickerOptions.setAttribute('style', `
                display: none !important;
                visibility: hidden !important;
                position: fixed !important;
                top: -9999px !important;
                left: -9999px !important;
                z-index: -1 !important;
                opacity: 0 !important;
            `);
            
            // Clean up the selection handlers
            const existingColorHandler = this.currentPickerOptions._colorSelectionHandler;
            if (existingColorHandler) {
                this.currentPickerOptions.removeEventListener('click', existingColorHandler);
                delete this.currentPickerOptions._colorSelectionHandler;
            }
            
            const existingDropdownHandler = this.currentPickerOptions._dropdownSelectionHandler;
            if (existingDropdownHandler) {
                this.currentPickerOptions.removeEventListener('click', existingDropdownHandler);
                delete this.currentPickerOptions._dropdownSelectionHandler;
            }
            
            this.currentPickerOptions = null;
        }
        
        if (this.currentModalBody) {
            this.currentModalBody.classList.remove('allow-overflow');
            this.currentModalBody = null;
        }
        
        this.currentPickerType = null;
        
        window.appLogger?.action('PICKER_HIDDEN');
    }

    setupContentSync() {
        // Simple setup - no real-time sync needed
        console.log(`Editor ready: ${this.containerId}`);
        
        // Add real-time sync between rich text and HTML editors
        this.setupRealTimeSync();
    }
    
    setupRealTimeSync() {
        // Set up real-time synchronization for note editor
        if (this.containerId === 'quill-editor') {
            const htmlEditor = document.getElementById('html-editor');
            if (htmlEditor) {
                // Listen for changes in HTML editor and sync to rich text
                htmlEditor.addEventListener('input', () => {
                    // Only sync if HTML editor is currently visible
                    if (!htmlEditor.classList.contains('hidden')) {
                        console.log('📝 HTML editor changed, syncing to rich text (background)');
                        // Don't immediately sync to avoid conflicts while user is typing
                        // Just mark that there are changes
                        htmlEditor.dataset.hasChanges = 'true';
                        
                        // Trigger content preservation for HTML changes
                        if (window.contentPreservation && htmlEditor.value.length > 50) {
                            window.contentPreservation.saveContent('note', htmlEditor.value, 'editNoteForm', 'html-change');
                        }
                    }
                });
            }
            
            // Listen for Quill content changes
            if (this.quill) {
                this.quill.on('text-change', () => {
                    // Only sync if rich text editor is currently visible
                    const richContainer = document.getElementById('quill-editor-container');
                    if (richContainer && !richContainer.classList.contains('hidden')) {
                        console.log('📝 Rich text editor changed, syncing to HTML (background)');
                        const htmlEditor = document.getElementById('html-editor');
                        if (htmlEditor) {
                            htmlEditor.value = this.getContent();
                            htmlEditor.dataset.hasChanges = 'false';
                        }
                        
                        // Trigger content preservation for significant changes
                        if (window.contentPreservation) {
                            const content = this.getContent();
                            if (content && content.length > 50) { // Only backup substantial content
                                window.contentPreservation.saveContent('note', content, 'editNoteForm', 'content-change');
                            }
                        }
                    }
                });
            }
        }
        
        // Set up real-time synchronization for import editor
        if (this.containerId === 'import-editor') {
            const htmlEditor = document.getElementById('html-import-editor');
            if (htmlEditor) {
                // Listen for changes in HTML editor and sync to rich text
                htmlEditor.addEventListener('input', () => {
                    // Only sync if HTML editor is currently visible
                    if (!htmlEditor.classList.contains('hidden')) {
                        console.log('📝 Import HTML editor changed, syncing to rich text (background)');
                        htmlEditor.dataset.hasChanges = 'true';
                        
                        // Trigger content preservation for HTML changes
                        if (window.contentPreservation && htmlEditor.value.length > 50) {
                            window.contentPreservation.saveContent('import', htmlEditor.value, 'importForm', 'html-change');
                        }
                    }
                });
            }
            
            // Listen for Quill content changes
            if (this.quill) {
                this.quill.on('text-change', () => {
                    // Only sync if rich text editor is currently visible
                    const richContainer = document.getElementById('import-editor-container');
                    if (richContainer && !richContainer.classList.contains('hidden')) {
                        console.log('📝 Import rich text editor changed, syncing to HTML (background)');
                        const htmlEditor = document.getElementById('html-import-editor');
                        if (htmlEditor) {
                            htmlEditor.value = this.getContent();
                            htmlEditor.dataset.hasChanges = 'false';
                        }
                        
                        // Trigger content preservation for significant changes
                        if (window.contentPreservation) {
                            const content = this.getContent();
                            if (content && content.length > 50) { // Only backup substantial content
                                window.contentPreservation.saveContent('import', content, 'importForm', 'content-change');
                            }
                        }
                    }
                });
            }
        }
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
            // Clear the editor completely first
            this.quill.setText('');
            
            // Reset any formatting state
            this.quill.removeFormat(0, this.quill.getLength());
            
            // Set the new content
            if (html && html.trim()) {
                // Use the most direct method to avoid extra content
                this.quill.root.innerHTML = html;
                
                // Clean up any extra empty paragraphs that might have been added
                this.cleanupExtraContent();
            } else {
                // Set empty content
                this.quill.setText('');
            }
            
            // Reset selection to beginning
            this.quill.setSelection(0, 0);
            
            // Force a formatting reset to ensure clean state
            this.quill.format('font', false);
            this.quill.format('size', false);
            this.quill.format('color', false);
            this.quill.format('background', false);
            
            console.log(`✨ Editor content reset and loaded fresh (${html?.length || 0} chars)`);
        }
    }
    
    cleanupExtraContent() {
        if (!this.quill) return;
        
        // Remove trailing empty paragraphs
        const content = this.quill.root.innerHTML;
        
        // Check if content ends with empty paragraphs and remove them
        // Specifically target the <p><br></p><p><br></p> pattern at the end
        let cleanedContent = content;
        
        // Handle the exact pattern: <p><br></p><p><br></p>
        if (content.endsWith('<p><br></p><p><br></p>')) {
            cleanedContent = content.substring(0, content.length - '<p><br></p><p><br></p>'.length);
            console.log('🎯 Removed specific <p><br></p><p><br></p> pattern from end');
        }
        // Handle other multiple empty paragraphs at the end
        else {
            cleanedContent = content
                .replace(/(<p><br><\/p>\s*){2,}$/, '') // Remove multiple trailing <p><br></p>
                .replace(/(<p><\/p>\s*){2,}$/, '')     // Remove multiple trailing empty paragraphs
                .replace(/(<p>\s*<\/p>\s*){2,}$/, '')  // Remove multiple trailing paragraphs with whitespace
                .replace(/<p><br><\/p>$/, '')          // Remove single trailing <p><br></p>
                .replace(/<p><\/p>$/, '')              // Remove single trailing empty paragraph
                .replace(/(<br\s*\/?>)+$/, '');        // Remove trailing br tags
        }
        
        if (cleanedContent !== content) {
            this.quill.root.innerHTML = cleanedContent;
            console.log('🧹 Cleaned up extra trailing content');
        }
    }
    
    resetEditor() {
        if (this.quill) {
            // Complete editor reset - clear everything
            this.quill.setText('');
            this.quill.removeFormat(0, this.quill.getLength());
            
            // Reset all possible formatting
            const formats = ['bold', 'italic', 'underline', 'strike', 'font', 'size', 'color', 'background', 'script', 'header', 'blockquote', 'code-block', 'list', 'indent', 'align', 'link'];
            formats.forEach(format => {
                this.quill.format(format, false);
            });
            
            // Reset selection
            this.quill.setSelection(0, 0);
            
            // Clear any cached styles or state
            this.quill.blur();
            
            console.log('🔄 Editor completely reset');
        }
    }
    
    getContent() {
        if (!this.quill) return '';
        
        // Use the proper Quill API method to get HTML content
        try {
            let content = '';
            
            // Try the new Quill 2.0 method first
            if (this.quill.getSemanticHTML) {
                content = this.quill.getSemanticHTML();
            } else {
                // Fallback to root.innerHTML
                content = this.quill.root.innerHTML;
            }
            
            // Clean up any extra trailing content before returning
            return this.cleanExtraContent(content);
        } catch (error) {
            console.error('Error getting content from Quill:', error);
            const fallbackContent = this.quill.root.innerHTML || '';
            return this.cleanExtraContent(fallbackContent);
        }
    }
    
    cleanExtraContent(content) {
        if (!content) return '';
        
        // Remove trailing empty paragraphs and br tags - specifically target <p><br></p> patterns
        return content
            .replace(/(<p><br><\/p>\s*)+$/, '') // Remove multiple trailing <p><br></p> patterns
            .replace(/(<p><\/p>\s*)+$/, '')     // Remove multiple trailing empty paragraphs
            .replace(/(<p>\s*<\/p>\s*)+$/, '')  // Remove multiple trailing paragraphs with only whitespace
            .replace(/(<br\s*\/?>)+$/, '')      // Remove trailing br tags
            .replace(/\s+$/, '');               // Remove any trailing whitespace
    }
    
    getCurrentContent() {
        // Alternative method that ensures we get the latest content
        if (!this.quill) return '';
        
        // Simply get the content without focus/blur cycle to avoid extra content
        return this.getContent();
    }
    
    focus() {
        if (this.quill) {
            this.quill.focus();
        }
    }
    
    fixColorPickerPositioning(pickerElement) {
        if (!pickerElement) return;
        
        // Wait for the picker to be fully expanded
        setTimeout(() => {
            // Find the picker dropdown/options element
            const pickerOptions = pickerElement.querySelector('.ql-picker-options');
            if (!pickerOptions) return;
            
            // Only proceed if the picker is actually expanded (visible)
            const computedStyles = window.getComputedStyle(pickerOptions);
            if (computedStyles.display === 'none') return;
            
            // Get the picker button for positioning reference
            const pickerButton = pickerElement.querySelector('.ql-picker-label');
            if (!pickerButton) return;
            
            // Use fixed positioning to break out of all containers
            this.positionPickerBelowButton(pickerOptions, pickerButton, 'color');
            
            // Log the positioning for debugging
            window.appLogger?.action('COLOR_PICKER_POSITIONING_APPLIED', {
                pickerElement: pickerElement.className,
                positioning: 'fixed above button (tag-suggestions style)',
                zIndex: '99999'
            });
        }, 50); // Small delay to ensure DOM updates are complete
    }
    
    positionPickerBelowButton(pickerOptions, pickerButton, pickerType) {
        // Get button position relative to viewport
        const buttonRect = pickerButton.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        
        console.log('DEBUG: Button position:', {
            type: pickerType,
            top: buttonRect.top,
            bottom: buttonRect.bottom,
            left: buttonRect.left,
            height: buttonRect.height
        });
        
        // Set picker width based on type
        let pickerWidth;
        if (pickerType === 'color' || pickerType === 'background') {
            pickerWidth = 180; // Color picker width
        } else {
            pickerWidth = 200; // Dropdown width
        }
        
        // ALWAYS position below the button - NEVER above
        const belowPosition = buttonRect.bottom + 10; // 10px gap below button
        const leftPosition = buttonRect.left;
        
        console.log('DEBUG: Calculated position:', {
            type: pickerType,
            belowPosition: belowPosition,
            leftPosition: leftPosition,
            pickerWidth: pickerWidth
        });
        
        // Ensure it doesn't go off-screen horizontally
        let finalLeft = leftPosition;
        if (leftPosition + pickerWidth > viewportWidth - 10) {
            finalLeft = viewportWidth - pickerWidth - 10;
        }
        if (finalLeft < 10) {
            finalLeft = 10;
        }
        
        // Apply different styling based on picker type
        let pickerStyles;
        if (pickerType === 'color' || pickerType === 'background') {
            // Color picker styles
            pickerStyles = `
                position: fixed !important;
                z-index: 99999 !important;
                background-color: white !important;
                border: 1px solid #d1d5db !important;
                border-radius: 6px !important;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
                transform: none !important;
                bottom: auto !important;
                right: auto !important;
                margin: 0 !important;
                width: 180px !important;
                min-width: 180px !important;
                max-width: 180px !important;
                display: flex !important;
                flex-wrap: wrap !important;
                padding: 8px !important;
                box-sizing: border-box !important;
                visibility: visible !important;
                top: ${belowPosition}px !important;
                left: ${finalLeft}px !important;
            `;
        } else {
            // Dropdown styles
            pickerStyles = `
                position: fixed !important;
                z-index: 99999 !important;
                background-color: white !important;
                border: 1px solid #d1d5db !important;
                border-radius: 6px !important;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
                transform: none !important;
                bottom: auto !important;
                right: auto !important;
                margin: 0 !important;
                width: 200px !important;
                min-width: 200px !important;
                max-width: 200px !important;
                display: block !important;
                max-height: 200px !important;
                overflow-y: auto !important;
                padding: 0 !important;
                box-sizing: border-box !important;
                visibility: visible !important;
                top: ${belowPosition}px !important;
                left: ${finalLeft}px !important;
            `;
        }
        
        // FORCE final positioning using setAttribute for maximum override power
        pickerOptions.setAttribute('style', pickerStyles);
        
        console.log('DEBUG: Final applied styles:', {
            type: pickerType,
            styleAttribute: pickerOptions.getAttribute('style'),
            computedTop: window.getComputedStyle(pickerOptions).top,
            computedLeft: window.getComputedStyle(pickerOptions).left
        });
        
        // Log final position for debugging
        window.appLogger?.action('PICKER_POSITIONED_BELOW', {
            type: pickerType,
            buttonTop: buttonRect.top,
            buttonBottom: buttonRect.bottom,
            pickerTop: belowPosition,
            pickerLeft: finalLeft,
            pickerWidth: pickerWidth
        });
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        if (this.quill) {
            delete this.quill;
        }
    }
    
    handleVideo() {
        const range = this.quill.getSelection();
        if (!range) {
            this.quill.focus();
            return;
        }
        
        // Prompt user for video URL
        const url = prompt('Enter video URL (YouTube, Vimeo, or direct video link):');
        if (!url) return;
        
        // Process the URL and insert video
        this.insertResponsiveVideo(url, range);
    }
    
    insertResponsiveVideo(url, range) {
        let embedUrl = url;
        let videoId = '';
        
        // Handle YouTube URLs
        if (url.includes('youtube.com/watch?v=')) {
            videoId = url.split('v=')[1].split('&')[0];
            embedUrl = `https://www.youtube.com/embed/${videoId}`;
        } else if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1].split('?')[0];
            embedUrl = `https://www.youtube.com/embed/${videoId}`;
        } else if (url.includes('vimeo.com/')) {
            videoId = url.split('vimeo.com/')[1].split('?')[0];
            embedUrl = `https://player.vimeo.com/video/${videoId}`;
        }
        
        // Create responsive video HTML
        const videoHTML = `
            <div class="video-wrapper">
                <iframe src="${embedUrl}" 
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen>
                </iframe>
            </div>
        `;
        
        // Insert the video HTML
        this.quill.clipboard.dangerouslyPasteHTML(range.index, videoHTML);
        
        // Move cursor after the video
        this.quill.setSelection(range.index + 1);
        
        window.appLogger?.action('VIDEO_INSERTED', {
            url: url,
            embedUrl: embedUrl,
            videoId: videoId
        });
    }
    
    setupVideoWrappers() {
        // Watch for content changes to wrap any new videos
        this.quill.on('text-change', () => {
            this.wrapExistingVideos();
        });
        
        // Initial wrap of any existing videos
        setTimeout(() => {
            this.wrapExistingVideos();
        }, 100);
    }
    
    wrapExistingVideos() {
        const editor = this.quill.container.querySelector('.ql-editor');
        if (!editor) return;
        
        // Find all iframe elements that aren't already wrapped
        const iframes = editor.querySelectorAll('iframe:not(.video-wrapper iframe)');
        
        iframes.forEach(iframe => {
            // Skip if already wrapped
            if (iframe.closest('.video-wrapper')) return;
            
            // Create wrapper
            const wrapper = document.createElement('div');
            wrapper.className = 'video-wrapper';
            
            // Insert wrapper before iframe
            iframe.parentNode.insertBefore(wrapper, iframe);
            
            // Move iframe into wrapper
            wrapper.appendChild(iframe);
            
            // Ensure iframe has proper attributes
            iframe.setAttribute('frameborder', '0');
            iframe.setAttribute('allowfullscreen', '');
            
            window.appLogger?.action('VIDEO_WRAPPED', {
                src: iframe.src,
                wrapper: 'added'
            });
        });
    }
    
    handleLink() {
        const range = this.quill.getSelection();
        if (!range) {
            this.quill.focus();
            return;
        }
        
        const selectedText = this.quill.getText(range.index, range.length);
        
        // Check if there's already a link at this position
        const existingLink = this.quill.getFormat(range.index, range.length).link;
        
        if (existingLink) {
            // If there's already a link, prompt to edit it
            const url = prompt('Edit URL:', existingLink);
            if (url === null) return; // User cancelled
            
            if (url === '') {
                // Remove the link if empty URL
                this.quill.format('link', false);
            } else {
                // Update the existing link
                const processedUrl = this.processUrl(url);
                this.quill.format('link', processedUrl);
            }
        } else {
            // No existing link, create new one
            if (range.length === 0) {
                // No text selected, prompt for both URL and text
                const url = prompt('Enter URL:', 'https://');
                if (!url) return;
                
                const displayText = prompt('Enter display text:', this.getDisplayTextFromUrl(url));
                if (!displayText) return;
                
                // Insert new text with link formatting
                const processedUrl = this.processUrl(url);
                this.quill.insertText(range.index, displayText, 'link', processedUrl);
                this.quill.setSelection(range.index + displayText.length);
            } else {
                // Text is selected, just add link to it
                const url = prompt('Enter URL:', selectedText.startsWith('http') ? selectedText : 'https://');
                if (!url) return;
                
                const processedUrl = this.processUrl(url);
                // Apply link formatting to the selected text
                this.quill.formatText(range.index, range.length, 'link', processedUrl);
            }
        }
        
        // Enhance the link after a short delay
        setTimeout(() => {
            this.enhanceExistingLinks();
        }, 10);
        
        window.appLogger?.action('LINK_HANDLED', {
            selectedText: selectedText,
            hasSelection: range.length > 0,
            existingLink: !!existingLink
        });
    }
    
    processUrl(url) {
        // Ensure URL has protocol
        if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('mailto:')) {
            return 'https://' + url;
        }
        return url;
    }
    
    getDisplayTextFromUrl(url) {
        try {
            const urlObj = new URL(url);
            // Return domain name as display text
            return urlObj.hostname.replace('www.', '');
        } catch (e) {
            // If URL is malformed, return truncated version
            return url.length > 50 ? url.substring(0, 47) + '...' : url;
        }
    }
    
    setupLinkWrappers() {
        // Watch for content changes to enhance any new links
        this.quill.on('text-change', () => {
            this.enhanceExistingLinks();
        });
        
        // Initial enhancement of any existing links
        setTimeout(() => {
            this.enhanceExistingLinks();
        }, 100);
    }
    
    enhanceExistingLinks() {
        const editor = this.quill.container.querySelector('.ql-editor');
        if (!editor) return;
        
        // Find all links
        const links = editor.querySelectorAll('a');
        
        links.forEach(link => {
            // Skip if already enhanced
            if (link.dataset.enhanced) return;
            
            const href = link.getAttribute('href');
            const text = link.textContent;
            
            // Ensure proper viewport handling without changing display
            link.style.maxWidth = '100%';
            link.style.wordWrap = 'break-word';
            link.style.wordBreak = 'break-word';
            link.style.overflowWrap = 'break-word';
            link.style.boxSizing = 'border-box';
            
            // Ensure baseline alignment without forcing font inheritance
            link.style.verticalAlign = 'baseline';
            
            // Add title for long URLs
            if (href && href.length > 50 && text.length < href.length) {
                link.setAttribute('title', href);
            }
            
            // Ensure protocol is present
            if (href && !href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('mailto:')) {
                link.setAttribute('href', 'https://' + href);
            }
            
            // Mark as enhanced
            link.dataset.enhanced = 'true';
            
            window.appLogger?.action('LINK_ENHANCED', {
                href: href,
                text: text,
                enhanced: true
            });
        });
    }
    
    setupLinkFormatting() {
        // Watch for format changes and ensure they're applied to links correctly
        this.quill.on('selection-change', (range) => {
            if (!range) return;
            
            // Check if we're in a link
            const format = this.quill.getFormat(range.index, range.length);
            if (format.link) {
                console.log('Link format detected:', format);
                
                // If we're in a link, ensure any font/size changes get applied to the link element
                setTimeout(() => {
                    const editor = this.quill.container.querySelector('.ql-editor');
                    const links = editor.querySelectorAll('a');
                    
                    links.forEach(link => {
                        if (link.getAttribute('href') === format.link) {
                            // Check if the link has font/size formatting
                            const linkRect = link.getBoundingClientRect();
                            const selection = this.quill.getSelection();
                            
                            if (selection) {
                                const selectionBounds = this.quill.getBounds(selection.index, selection.length);
                                
                                // If this link is in the selection area, apply any pending formats
                                if (format.font) {
                                    link.classList.add(`ql-font-${format.font}`);
                                }
                                if (format.size) {
                                    link.classList.add(`ql-size-${format.size}`);
                                }
                                
                                console.log('Applied formatting to link:', {
                                    font: format.font,
                                    size: format.size,
                                    classes: Array.from(link.classList)
                                });
                            }
                        }
                    });
                }, 10);
            }
        });
    }

    handleFont(value) {
        const range = this.quill.getSelection();
        if (!range) return;
        
        // Check if we're formatting a link
        const format = this.quill.getFormat(range.index, range.length);
        
        if (format.link) {
            // We're in a link, apply font formatting directly to the link element
            this.applyFormatToLink(range, 'font', value, format.link);
        } else {
            // Normal font formatting
            this.quill.format('font', value);
        }
    }
    
    handleSize(value) {
        const range = this.quill.getSelection();
        if (!range) return;
        
        // Check if we're formatting a link
        const format = this.quill.getFormat(range.index, range.length);
        
        if (format.link) {
            // We're in a link, apply size formatting directly to the link element
            this.applyFormatToLink(range, 'size', value, format.link);
        } else {
            // Normal size formatting
            this.quill.format('size', value);
        }
    }
    
    applyFormatToLink(range, formatType, value, linkUrl) {
        const editor = this.quill.container.querySelector('.ql-editor');
        const links = editor.querySelectorAll('a');
        
        // Find the link we're trying to format
        links.forEach(link => {
            if (link.getAttribute('href') === linkUrl) {
                const linkRect = link.getBoundingClientRect();
                const editorRect = editor.getBoundingClientRect();
                
                // Check if this link overlaps with our selection
                const bounds = this.quill.getBounds(range.index, range.length);
                
                // Remove existing format classes
                link.classList.forEach(className => {
                    if (className.startsWith(`ql-${formatType}-`)) {
                        link.classList.remove(className);
                    }
                });
                
                // Add new format class
                if (value) {
                    link.classList.add(`ql-${formatType}-${value}`);
                }
                
                console.log(`Applied ${formatType}:${value} to link:`, link);
                
                // Also apply the Quill format to maintain consistency
                this.quill.format(formatType, value);
            }
        });
    }

    // ...existing code...
}

/*
 * CONTENT PRESERVATION SYSTEM
 * 
 * This system automatically saves and restores editor content to prevent data loss
 * during errors or accidental navigation.
 * 
 * FEATURES:
 * 
 * 1. Automatic Saving:
 *    - Content is automatically saved at regular intervals (e.g., every 5 seconds).
 *    - Saves are triggered on form submissions and before the page unloads.
 * 
 * 2. Restoration on Error:
 *    - If an error occurs (e.g., form validation error), the system attempts to restore
 *      the latest saved content for the affected editor.
 * 
 * 3. Manual Backup/Restore:
 *    - Functions are provided to manually trigger backup and restore actions for testing
 *      and debugging purposes.
 */

// Content preservation system for error recovery
class ContentPreservation {
    constructor() {
        this.storageKey = 'taggingapp_editor_backup';
        this.maxBackups = 5;
        this.autoSaveInterval = 5000; // 5 seconds
        this.autoSaveTimer = null;
        
        // Initialize preservation system
        this.init();
    }
    
    init() {
        console.log('🔄 Initializing content preservation system');
        
        // Restore content on page load if available
        this.restoreContentOnLoad();
        
        // Set up auto-save
        this.setupAutoSave();
        
        // Set up form submission backup
        this.setupFormSubmissionBackup();
        
        // Set up beforeunload backup
        this.setupBeforeUnloadBackup();
    }
    
    generateBackupKey(editorType, formId = null) {
        const timestamp = Date.now();
        const url = window.location.pathname;
        return `${this.storageKey}_${editorType}_${formId || 'default'}_${url}_${timestamp}`;
    }
    
    saveContent(editorType, content, formId = null, reason = 'manual') {
        try {
            const backupData = {
                editorType,
                content,
                formId,
                reason,
                timestamp: Date.now(),
                url: window.location.pathname,
                userAgent: navigator.userAgent.substring(0, 100)
            };
            
            const key = this.generateBackupKey(editorType, formId);
            localStorage.setItem(key, JSON.stringify(backupData));
            
            // Clean up old backups
            this.cleanupOldBackups();
            
            console.log(`💾 Content saved for ${editorType}:`, {
                reason,
                contentLength: content.length,
                key: key.substring(0, 50) + '...'
            });
            
            window.appLogger?.action('CONTENT_PRESERVED', {
                editorType,
                reason,
                contentLength: content.length,
                timestamp: backupData.timestamp
            });
            
            return key;
        } catch (error) {
            console.error('❌ Failed to save content:', error);
            window.appLogger?.error('Content preservation failed', { error: error.message });
            return null;
        }
    }
    
    getLatestBackup(editorType, formId = null) {
        try {
            const keys = Object.keys(localStorage).filter(key => 
                key.startsWith(this.storageKey) && 
                key.includes(`_${editorType}_`) &&
                key.includes(`_${formId || 'default'}_`) &&
                key.includes(window.location.pathname)
            );
            
            if (keys.length === 0) return null;
            
            // Sort by timestamp (newest first)
            keys.sort((a, b) => {
                const timestampA = parseInt(a.split('_').pop());
                const timestampB = parseInt(b.split('_').pop());
                return timestampB - timestampA;
            });
            
            const latestKey = keys[0];
            const backupData = JSON.parse(localStorage.getItem(latestKey));
            
            // Check if backup is recent (within last hour)
            const oneHour = 60 * 60 * 1000;
            if (Date.now() - backupData.timestamp > oneHour) {
                console.log('⏰ Backup is too old, ignoring');
                return null;
            }
            
            return { key: latestKey, data: backupData };
        } catch (error) {
            console.error('❌ Failed to retrieve backup:', error);
            return null;
        }
    }
    
    restoreContent(editorType, formId = null, showNotification = false) {
        const backup = this.getLatestBackup(editorType, formId);
        if (!backup) return false;
        
        try {
            const editor = this.getEditorInstance(editorType);
            if (!editor) {
                console.warn(`Editor ${editorType} not found for restoration`);
                return false;
            }
            
            // Restore content
            editor.setContent(backup.data.content);
            
            console.log(`🔄 Content restored for ${editorType}:`, {
                contentLength: backup.data.content.length,
                savedAt: new Date(backup.data.timestamp).toLocaleString(),
                reason: backup.data.reason,
                showNotification: showNotification
            });
            
            // Only show user notification if explicitly requested (during error recovery)
            if (showNotification) {
                this.showRestoreNotification(editorType, backup.data);
            }
            
            // Clean up the used backup
            localStorage.removeItem(backup.key);
            
            window.appLogger?.action('CONTENT_RESTORED', {
                editorType,
                contentLength: backup.data.content.length,
                originalReason: backup.data.reason,
                timeSinceBackup: Date.now() - backup.data.timestamp,
                notificationShown: showNotification
            });
            
            return true;
        } catch (error) {
            console.error('❌ Failed to restore content:', error);
            window.appLogger?.error('Content restoration failed', { error: error.message });
            return false;
        }
    }
    
    getEditorInstance(editorType) {
        switch (editorType) {
            case 'note':
                return window.noteEditor;
            case 'import':
                return window.importEditor;
            default:
                return null;
        }
    }
    
    restoreContentOnLoad() {
        // Check if we're coming back from a form submission (detect error state)
        const urlParams = new URLSearchParams(window.location.search);
        const hasError = urlParams.has('error') || 
                        document.querySelector('.alert-danger, .error-message') ||
                        window.location.hash.includes('error');
        
        if (hasError) {
            console.log('🚨 Error state detected, attempting content restoration');
        }
        
        // Delay restoration to ensure editors are initialized
        setTimeout(() => {
            let restored = false;
            
            // Try to restore note editor content - only show notification if there's an error
            if (window.noteEditor) {
                if (this.restoreContent('note', 'editNoteForm', hasError)) {
                    restored = true;
                }
            }
            
            // Try to restore import editor content - only show notification if there's an error
            if (window.importEditor) {
                if (this.restoreContent('import', 'importForm', hasError)) {
                    restored = true;
                }
            }
            
            if (restored) {
                console.log('✅ Content restoration completed');
                if (hasError) {
                    console.log('📢 User was notified about error recovery');
                } else {
                    console.log('🔇 Silent restoration (no error state)');
                }
            }
        }, 1000);
    }
    
    setupAutoSave() {
        // Track last saved content for each editor
        this.lastSavedContent = {
            note: null,
            import: null
        };
        this.autoSaveTimer = setInterval(() => {
            this.performAutoSave();
        }, this.autoSaveInterval);
        console.log(`⏱️ Auto-save enabled (every ${this.autoSaveInterval/1000}s)`);
    }

    performAutoSave() {
        let saved = false;

        // Auto-save note editor only if changed
        if (window.noteEditor && window.noteEditor.quill) {
            const content = window.noteEditor.getContent();
            if (content && content.trim() && content !== '<p><br></p>' && content !== this.lastSavedContent.note) {
                this.saveContent('note', content, 'editNoteForm', 'auto-save');
                this.lastSavedContent.note = content;
                saved = true;
            }
        }

        // Auto-save import editor only if changed
        if (window.importEditor && window.importEditor.quill) {
            const content = window.importEditor.getContent();
            if (content && content.trim() && content !== '<p><br></p>' && content !== this.lastSavedContent.import) {
                this.saveContent('import', content, 'importForm', 'auto-save');
                this.lastSavedContent.import = content;
                saved = true;
            }
        }

        if (saved) {
            console.log('💾 Auto-save completed');
        }
    }
    
    setupFormSubmissionBackup() {
        // Backup before form submission
        const forms = ['editNoteForm', 'importForm', 'editSectionForm'];
        
        forms.forEach(formId => {
            const form = document.getElementById(formId);
            if (form) {
                // Add event listener with high priority
                form.addEventListener('submit', (e) => {
                    this.backupBeforeSubmission(formId);
                }, true);
            }
        });
    }
    
    backupBeforeSubmission(formId) {
        console.log(`💾 Backing up content before ${formId} submission`);
        
        if (formId === 'editNoteForm' && window.noteEditor) {
            const content = window.noteEditor.getContent();
            if (content && content.trim()) {
                this.saveContent('note', content, formId, 'form-submission');
            }
        }
        
        if (formId === 'importForm' && window.importEditor) {
            const content = window.importEditor.getContent();
            if (content && content.trim()) {
                this.saveContent('import', content, formId, 'form-submission');
            }
        }
    }
    
    setupBeforeUnloadBackup() {
        window.addEventListener('beforeunload', () => {
            this.performAutoSave();
        });
    }
    
    cleanupOldBackups() {
        try {
            const keys = Object.keys(localStorage).filter(key => 
                key.startsWith(this.storageKey)
            );
            
            if (keys.length <= this.maxBackups) return;
            
            // Sort by timestamp and remove oldest
            keys.sort((a, b) => {
                const timestampA = parseInt(a.split('_').pop());
                const timestampB = parseInt(b.split('_').pop());
                return timestampA - timestampB;
            });
            
            const toRemove = keys.slice(0, keys.length - this.maxBackups);
            toRemove.forEach(key => localStorage.removeItem(key));
            
            console.log(`🧹 Cleaned up ${toRemove.length} old backups`);
        } catch (error) {
            console.error('❌ Failed to cleanup old backups:', error);
        }
    }
    
    showRestoreNotification(editorType, backupData) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-3 rounded-md shadow-lg z-50 max-w-sm';
        notification.innerHTML = `
            <div class="flex items-start space-x-3">
                <div class="flex-shrink-0">
                    <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                    </svg>
                </div>
                <div class="flex-1">
                    <div class="text-sm font-medium">Content Restored</div>
                    <div class="text-xs opacity-90 mt-1">
                        Your ${editorType} editor content was automatically restored from ${new Date(backupData.timestamp).toLocaleTimeString()}
                    </div>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 10000);
    }
    
    // Manual backup/restore functions for debugging
    manualBackup(editorType) {
        const editor = this.getEditorInstance(editorType);
        if (!editor) return false;
        
        const content = editor.getContent();
        return this.saveContent(editorType, content, null, 'manual');
    }
    
    manualRestore(editorType) {
        return this.restoreContent(editorType, null, true); // Show notification for manual restore
    }
    
    // Clear backups for cancelled operations
    clearCancelledChanges(editorType, formId = null) {
        try {
            const keys = Object.keys(localStorage).filter(key => 
                key.startsWith(this.storageKey) && 
                key.includes(`_${editorType}_`) &&
                key.includes(`_${formId || 'default'}_`) &&
                key.includes(window.location.pathname)
            );
            
            // Remove recent backups (last 5 minutes) that might be from cancelled operations
            const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
            keys.forEach(key => {
                const timestamp = parseInt(key.split('_').pop());
                if (timestamp > fiveMinutesAgo) {
                    localStorage.removeItem(key);
                }
            });
            
            console.log(`🧹 Cleared ${keys.length} cancelled backups for ${editorType}`);
            
            window.appLogger?.action('CANCELLED_BACKUPS_CLEARED', {
                editorType,
                formId,
                clearedCount: keys.length
            });
        } catch (error) {
            console.error('❌ Failed to clear cancelled backups:', error);
        }
    }
    
    // Clear all backups for a specific editor type and form
    clearAllBackups(editorType, formId = null) {
        try {
            const keys = Object.keys(localStorage).filter(key => 
                key.startsWith(this.storageKey) && 
                key.includes(`_${editorType}_`) &&
                key.includes(`_${formId || 'default'}_`) &&
                key.includes(window.location.pathname)
            );
            
            keys.forEach(key => localStorage.removeItem(key));
            
            console.log(`🗑️ Cleared all ${keys.length} backups for ${editorType}`);
            
            window.appLogger?.action('ALL_BACKUPS_CLEARED', {
                editorType,
                formId,
                clearedCount: keys.length
            });
        } catch (error) {
            console.error('❌ Failed to clear all backups:', error);
        }
    }
    
    // Cleanup method
    destroy() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }
}

// Initialize content preservation system
let contentPreservation = null;

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

// Make manual backup/restore functions globally available for debugging
window.manualBackupNote = function() {
    if (contentPreservation) {
        return contentPreservation.manualBackup('note');
    }
    console.warn('Content preservation system not initialized');
    return false;
};

window.manualRestoreNote = function() {
    if (contentPreservation) {
        return contentPreservation.manualRestore('note');
    }
    console.warn('Content preservation system not initialized');
    return false;
};

window.manualBackupImport = function() {
    if (contentPreservation) {
        return contentPreservation.manualBackup('import');
    }
    console.warn('Content preservation system not initialized');
    return false;
};

window.manualRestoreImport = function() {
    if (contentPreservation) {
        return contentPreservation.manualRestore('import');
    }
    console.warn('Content preservation system not initialized');
    return false;
};

// Enhanced debug function that includes backup information
window.debugEditorBackups = function() {
    console.log('=== Editor Backup Debug ===');
    
    if (contentPreservation) {
        const noteBackup = contentPreservation.getLatestBackup('note', 'editNoteForm');
        const importBackup = contentPreservation.getLatestBackup('import', 'importForm');
        
        console.log('Note Editor Backup:', noteBackup ? {
            timestamp: new Date(noteBackup.data.timestamp).toLocaleString(),
            contentLength: noteBackup.data.content.length,
            reason: noteBackup.data.reason,
            preview: noteBackup.data.content.substring(0, 200)
        } : 'None');
        
        console.log('Import Editor Backup:', importBackup ? {
            timestamp: new Date(importBackup.data.timestamp).toLocaleString(),
            contentLength: importBackup.data.content.length,
            reason: importBackup.data.reason,
            preview: importBackup.data.content.substring(0, 200)
        } : 'None');
        
        // Show all backup keys
        const allBackups = Object.keys(localStorage).filter(key => 
            key.startsWith(contentPreservation.storageKey)
        );
        console.log('Total Backups:', allBackups.length);
        console.log('Backup Keys:', allBackups);
    } else {
        console.log('Content preservation system not initialized');
    }
    
    console.log('=== End Backup Debug ===');
};

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
    
    // Initialize content preservation system first
    if (!contentPreservation) {
        contentPreservation = new ContentPreservation();
        window.contentPreservation = contentPreservation;
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
        // Before switching to rich text, sync any changes from HTML editor
        if (importEditor && html.value.trim()) {
            console.log('📝 Syncing HTML content to rich text editor');
            importEditor.setContent(html.value);
            html.dataset.hasChanges = 'false';
        }
        
        rich.classList.remove('hidden');
        html.classList.add('hidden');
        
        // Update button states
        if (richTextBtn) richTextBtn.classList.add('active');
        if (htmlBtn) htmlBtn.classList.remove('active');
        
        // Focus the rich text editor
        if (importEditor) {
            setTimeout(() => importEditor.focus(), 100);
        }
    } else {
        // Before switching to HTML, sync any changes from rich text editor
        if (importEditor) {
            console.log('📝 Syncing rich text content to HTML editor');
            const content = importEditor.getContent();
            html.value = content;
            html.dataset.hasChanges = 'false';
        }
        
        html.classList.remove('hidden');
        rich.classList.add('hidden');
        
        // Update button states
        if (htmlBtn) htmlBtn.classList.add('active');
        if (richTextBtn) richTextBtn.classList.remove('active');
        
        // Focus the HTML editor
        setTimeout(() => html.focus(), 100);
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
        // Before switching to rich text, sync any changes from HTML editor
        if (noteEditor && htmlEditor.value.trim()) {
            // Always sync when switching, regardless of whether HTML editor had focus
            console.log('📝 Syncing HTML content to rich text editor');
            noteEditor.setContent(htmlEditor.value);
            htmlEditor.dataset.hasChanges = 'false';
        }
        
        richContainer.classList.remove('hidden');
        if (richTextBtn) richTextBtn.classList.add('active');
        
        // Focus the rich text editor
        if (noteEditor) {
            setTimeout(() => noteEditor.focus(), 100);
        }
        
        // Update the hidden field with Quill content
        if (noteEditor) {
            const contentField = document.getElementById('editNoteContent');
            if (contentField) {
                contentField.value = noteEditor.getContent();
            }
        }
    } else if (view === 'html') {
        // Before switching to HTML, sync any changes from rich text editor
        if (noteEditor) {
            console.log('📝 Syncing rich text content to HTML editor');
            const content = noteEditor.getContent();
            htmlEditor.value = content;
            htmlEditor.dataset.hasChanges = 'false';
        }
        
        htmlEditor.classList.remove('hidden');
        if (htmlBtn) htmlBtn.classList.add('active');
        
        // Focus the HTML editor
        setTimeout(() => htmlEditor.focus(), 100);
        
        // Update the hidden field
        const contentField = document.getElementById('editNoteContent');
        if (contentField) {
            contentField.value = htmlEditor.value;
        }
    } else if (view === 'preview') {
        // Before switching to preview, sync content from the currently active editor
        let contentToPreview = '';
        
        // Check which editor was active and sync from it
        if (!richContainer.classList.contains('hidden') && noteEditor) {
            // Rich text was active
            contentToPreview = noteEditor.getContent();
        } else if (!htmlEditor.classList.contains('hidden')) {
            // HTML was active
            contentToPreview = htmlEditor.value;
        } else if (noteEditor) {
            // Default to rich text content
            contentToPreview = noteEditor.getContent();
        }
        
        console.log('📝 Syncing content to preview');
        previewContainer.classList.remove('hidden');
        if (previewBtn) previewBtn.classList.add('active');
        
        // Update preview content
        previewContainer.innerHTML = contentToPreview;
        
        // Update the hidden field
        const contentField = document.getElementById('editNoteContent');
        if (contentField) {
            contentField.value = contentToPreview;
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
    
    let content = editor.getContent() || '';
    // Remove all <p> elements that are empty or contain only whitespace
    const cleaned = content.replace(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '');
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
