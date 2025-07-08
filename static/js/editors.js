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
