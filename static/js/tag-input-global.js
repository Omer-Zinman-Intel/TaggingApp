// Global Tag Input System - Non-module version for reliable loading
// This script will be loaded directly (not as a module) to ensure global availability

(function() {
    'use strict';
    
    // Global tag input storage
    window.tagInputs = {};
    
    // Main tag input creation function
    window.createTagInput = function(containerId, inputId, hiddenInputId, suggestionsId) {
        const container = document.getElementById(containerId);
        const input = document.getElementById(inputId);
        const hiddenInput = document.getElementById(hiddenInputId);
        const suggestionsContainer = document.getElementById(suggestionsId);
        
        console.log(`[TAG INPUT] Creating for ${containerId}`);
        console.log('Elements found:', {
            container: !!container,
            input: !!input,
            hiddenInput: !!hiddenInput,
            suggestionsContainer: !!suggestionsContainer
        });
        
        // Add null checks since elements might not exist when this is called
        if (!container || !input || !hiddenInput || !suggestionsContainer) {
            console.warn(`[TAG INPUT] Missing elements for ${containerId}`);
            return { 
                init: () => console.warn(`Cannot initialize tags for ${containerId} - missing elements`),
                render: () => {},
                get tags() { return []; }
            };
        }
        
        let tags = [];
        let selectedCategories = [];

        function render() {
            console.log(`[TAG INPUT] Rendering tags for ${containerId}:`, tags, selectedCategories);
            // Remove existing tag bubbles
            container.querySelectorAll('.tag-bubble').forEach(bubble => bubble.remove());
            // Render category bubbles first
            selectedCategories.forEach(catId => {
                const bubble = document.createElement('div');
                bubble.classList.add('tag-bubble', 'tag-bubble-category');
                bubble.style.cssText = `
                    display: inline-flex;
                    align-items: center;
                    border-radius: 9999px;
                    padding: 0.25rem 0.75rem;
                    margin-right: 0.5rem;
                    margin-bottom: 0.25rem;
                    margin-top: 0.25rem;
                    font-size: 0.875rem;
                    font-weight: 600;
                    background-color: #f0fdf4;
                    color: #166534;
                    border: 1px solid #bbf7d0;
                    cursor: pointer;
                `;
                const categoryObj = window.TAG_CATEGORIES?.find(cat => cat.id === catId);
                const displayName = categoryObj ? categoryObj.name : catId;
                const tagText = document.createElement('span');
                tagText.innerHTML = `📁 ${displayName}`;
                bubble.appendChild(tagText);
                // Add remove button
                const removeBtn = document.createElement('span');
                removeBtn.classList.add('tag-remove-btn');
                removeBtn.innerHTML = '&times;';
                removeBtn.style.cssText = 'margin-left: 0.5rem; cursor: pointer; font-weight: bold; color: #666;';
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    removeCategory(catId);
                });
                bubble.appendChild(removeBtn);
                container.insertBefore(bubble, input);
            });
            // Render regular tag bubbles
            tags.forEach(tag => {
                if (isCategoryId(tag)) return; // Don't render category IDs as tags
                const bubble = document.createElement('div');
                bubble.classList.add('tag-bubble', 'inactive-filter');
                bubble.style.cssText = `
                    display: inline-flex;
                    align-items: center;
                    border-radius: 9999px;
                    padding: 0.25rem 0.75rem;
                    margin-right: 0.5rem;
                    margin-bottom: 0.25rem;
                    margin-top: 0.25rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    background-color: #dbeafe;
                    color: #1e40af;
                    cursor: pointer;
                `;
                if(tag.toLowerCase() === 'all') {
                    bubble.classList.add('tag-bubble-all');
                    bubble.classList.remove('inactive-filter');
                    bubble.style.backgroundColor = '#e9d5ff';
                    bubble.style.color = '#5b21b6';
                }
                const tagText = document.createElement('span');
                tagText.textContent = tag;
                bubble.appendChild(tagText);
                // Add remove button
                const removeBtn = document.createElement('span');
                removeBtn.classList.add('tag-remove-btn');
                removeBtn.innerHTML = '&times;';
                removeBtn.style.cssText = 'margin-left: 0.5rem; cursor: pointer; font-weight: bold; color: #666;';
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    removeTag(tag);
                });
                bubble.appendChild(removeBtn);
                container.insertBefore(bubble, input);
            });
            // Update hidden input
            hiddenInput.value = tags.join(', ');
            hiddenInput.setAttribute('data-categories', JSON.stringify(selectedCategories));
            // Also update a hidden categories input if present in the form
            const form = container.closest('form');
            if (form) {
                let categoriesInput = form.querySelector('input[name="categories"]');
                if (categoriesInput) {
                    categoriesInput.value = JSON.stringify(selectedCategories);
                }
            }
            // Persistent log for every render
            if (window.appLogger && typeof window.appLogger.error === 'function') {
                window.appLogger.error('[TAG INPUT] render', {
                    tags: tags.slice(),
                    selectedCategories: selectedCategories.slice(),
                    hiddenInputValue: hiddenInput.value
                });
            }
        }

        function addTag(tag) {
            const trimmedTag = tag.trim();
            console.log(`[TAG INPUT] Adding tag:`, trimmedTag);
            if (isCategoryId(trimmedTag)) {
                if (!selectedCategories.includes(trimmedTag)) {
                    selectedCategories.push(trimmedTag);
                    // Update hidden input for categories immediately
                    hiddenInput.setAttribute('data-categories', JSON.stringify(selectedCategories));
                    const form = container.closest('form');
                    if (form) {
                        let categoriesInput = form.querySelector('input[name="categories"]');
                        if (categoriesInput) {
                            categoriesInput.value = JSON.stringify(selectedCategories);
                        }
                    }
                    if (window.appLogger && typeof window.appLogger.error === 'function') {
                        window.appLogger.error('[TAG INPUT] Category added', {
                            added: trimmedTag,
                            selectedCategories: selectedCategories.slice()
                        });
                    }
                    render();
                }
            } else if (trimmedTag && !tags.some(t => t.toLowerCase() === trimmedTag.toLowerCase())) {
                tags.push(trimmedTag);
                render();
                if (input.hasAttribute('data-single-tag')) {
                    input.style.display = 'none';
                    input.value = trimmedTag;
                }
            }
            input.value = '';
            hideSuggestions();
        }

        function removeCategory(catId) {
            selectedCategories = selectedCategories.filter(id => id !== catId);
            // Update hidden input for categories immediately
            hiddenInput.setAttribute('data-categories', JSON.stringify(selectedCategories));
            const form = container.closest('form');
            if (form) {
                let categoriesInput = form.querySelector('input[name="categories"]');
                if (categoriesInput) {
                    categoriesInput.value = JSON.stringify(selectedCategories);
                }
            }
            if (window.appLogger && typeof window.appLogger.error === 'function') {
                window.appLogger.error('[TAG INPUT] Category removed', {
                    removed: catId,
                    selectedCategories: selectedCategories.slice()
                });
            }
            render();
        }

        function removeTag(tag) {
            console.log(`[TAG INPUT] Removing tag:`, tag);
            tags = tags.filter(t => t.toLowerCase() !== tag.toLowerCase());
            render();
            console.log(`[TAG INPUT] Tag removed. Current tags:`, tags);
            
            // Check if this is a single-tag component input (used in AND tag modals)
            if (input.hasAttribute('data-single-tag')) {
                input.style.display = 'block';
                input.value = '';
                input.focus();
            }
        }

        function showSuggestions() {
            const value = input.value.trim().toLowerCase();
            // Always show suggestions on focus, even if input is empty
            // Only hide if input is empty AND there are no suggestions
            console.log(`[TAG INPUT] Showing suggestions for:`, value);
            console.log(`[TAG INPUT] ALL_TAGS available:`, !!window.ALL_TAGS, 'Count:', window.ALL_TAGS?.length);
            const currentTagsLower = tags.map(t => t.toLowerCase());
            // Filter available tags - ensure ALL_TAGS is available
            if (!window.ALL_TAGS || !Array.isArray(window.ALL_TAGS)) {
                console.warn('[TAG INPUT] ALL_TAGS not available for suggestions');
                hideSuggestions();
                return;
            }
            // Clear previous suggestions
            suggestionsContainer.innerHTML = '';
            // Add category suggestions first (higher priority)
            addCategoryTagSuggestions(value, currentTagsLower);
            // Add filtered regular tag suggestions
            let filtered = [];
            if (value) {
                filtered = window.ALL_TAGS.filter(tag => 
                    tag.toLowerCase().includes(value) && !currentTagsLower.includes(tag.toLowerCase())
                ).slice(0, 5); // Reduced to 5 to leave more room for category suggestions
            } else {
                // If input is empty, show top tags (up to 5)
                filtered = window.ALL_TAGS.filter(tag => !currentTagsLower.includes(tag.toLowerCase())).slice(0, 5);
            }
            console.log(`[TAG INPUT] Filtered regular suggestions:`, filtered);
            if (filtered.length > 0) {
                filtered.forEach(tag => suggestionsContainer.appendChild(createSuggestionItem(tag)));
            }
            // Add "create new tag" option if value doesn't match exactly
            if (value && !window.ALL_TAGS.some(tag => tag.toLowerCase() === value)) {
                suggestionsContainer.appendChild(createSuggestionItem(input.value.trim(), true));
            }
            // Show suggestions if we have any
            if (suggestionsContainer.children.length > 0) {
                // Smart positioning: Enhanced logic for better positioning
                positionSuggestions();
                // Show the container
                suggestionsContainer.classList.remove('hidden');
            } else {
                console.log('[TAG INPUT] No suggestions to show');
                hideSuggestions();
            }
        }
        
        function addCategoryTagSuggestions(value, currentTagsLower) {
            // Check if TAG_CATEGORIES is available
            if (!window.TAG_CATEGORIES || !Array.isArray(window.TAG_CATEGORIES)) {
                console.warn('[TAG INPUT] TAG_CATEGORIES not available for category suggestions');
                return;
            }

            console.log(`[TAG INPUT] Adding category suggestions for:`, value);
            console.log(`[TAG INPUT] Available categories:`, window.TAG_CATEGORIES.length);

            window.TAG_CATEGORIES.forEach(category => {
                const categoryId = category.id;
                const categoryNameLower = category.name.toLowerCase();
                // Skip if already selected
                if (currentTagsLower.includes(categoryId.toLowerCase())) {
                    return;
                }
                // Show category suggestion if user types part of the category name or ID
                if (
                    categoryNameLower.includes(value) ||
                    categoryId.toLowerCase().includes(value)
                ) {
                    suggestionsContainer.appendChild(createSuggestionItem(categoryId, false, true));
                }
            });
        }
        
        function createSuggestionItem(tag, isNew = false, isCategory = false) {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            if (isNew) {
                item.innerHTML = `Create new tag: <strong style="color: #2563eb; margin-left: 0.25rem;">"${tag}"</strong>`;
                item.style.fontStyle = 'italic';
                item.style.backgroundColor = '#f8fafc';
            } else if (isCategory) {
                // Show category name in dropdown, not ID
                const categoryObj = window.TAG_CATEGORIES?.find(cat => cat.id === tag);
                const displayName = categoryObj ? categoryObj.name : tag;
                item.innerHTML = `📁 ${displayName}`;
                item.style.backgroundColor = '#f0fdf4 !important'; // bg-green-100
                item.style.color = '#166534 !important'; // text-green-800
                item.style.fontWeight = '600 !important';
                item.style.border = '1px solid #bbf7d0 !important'; // border-green-200
                item.style.borderRadius = '9999px !important'; // rounded-full
                item.style.padding = '0.25rem 0.625rem !important'; // px-2.5 py-1
                item.style.margin = '0.25rem !important';
                item.style.display = 'inline-block !important';
            } else {
                item.textContent = tag;
                if (tag.toLowerCase() === 'all') {
                    item.style.color = '#7c3aed';
                    item.style.fontWeight = 'bold';
                }
            }
            
            // Enhanced hover effect
            const originalBgColor = isNew ? '#f8fafc' : 
                                  (isCategory || tag.startsWith('CATEGORY:')) ? '#f0fdf4' : '';
            
            item.addEventListener('mouseenter', () => {
                if (isCategory || tag.startsWith('CATEGORY:')) {
                    item.style.backgroundColor = '#dcfce7 !important'; // darker green on hover
                } else {
                    item.style.backgroundColor = '#e5e7eb !important';
                }
            });
            item.addEventListener('mouseleave', () => {
                item.style.backgroundColor = originalBgColor + ' !important';
            });
            
            // Click handling - use mousedown to prevent blur from hiding suggestions
            const handleClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log(`[TAG INPUT] Suggestion clicked:`, tag);
                addTag(tag);
                // Always refocus input after adding a tag from dropdown
                setTimeout(() => { input.focus(); }, 10);
                hideSuggestions();
            };
            // Use mousedown to fire before blur event hides suggestions
            item.addEventListener('mousedown', handleClick);
            // Also add click for fallback (in case mousedown is blocked)
            item.addEventListener('click', handleClick);
            return item;
        }

        function positionSuggestions() {
            // Enhanced smart positioning logic for small viewports and responsive design
            const inputRect = input.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            
            // Calculate actual suggestions height by temporarily showing it
            suggestionsContainer.style.visibility = 'hidden';
            suggestionsContainer.style.position = 'fixed'; // Use fixed positioning for viewport-relative positioning
            suggestionsContainer.style.display = 'block';
            suggestionsContainer.classList.remove('hidden');
            
            // Set initial styles
            suggestionsContainer.style.zIndex = '10000';
            suggestionsContainer.style.backgroundColor = 'white';
            suggestionsContainer.style.border = '1px solid #d1d5db';
            suggestionsContainer.style.borderRadius = '6px';
            suggestionsContainer.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
            suggestionsContainer.style.minWidth = '200px';
            
            // Remove maxHeight constraint to allow full content display
            suggestionsContainer.style.maxHeight = 'none';
            suggestionsContainer.style.overflowY = 'visible';
            
            // Get actual height of the suggestions container without height constraints
            const suggestionsHeight = suggestionsContainer.scrollHeight;
            
            // Calculate available space below and above the input field
            const spaceBelow = viewportHeight - inputRect.bottom - 10; // 10px margin
            const spaceAbove = inputRect.top - 10; // 10px margin
            
            // Detect small viewport conditions
            const isSmallViewport = viewportHeight < 600 || viewportWidth < 800;
            const isVerySmallViewport = viewportHeight < 400 || viewportWidth < 600;
            
            // Adjust maximum height based on viewport size
            let maxAllowedHeight;
            if (isVerySmallViewport) {
                // Very small screens: limit to 25% of viewport height
                maxAllowedHeight = Math.max(150, viewportHeight * 0.25);
            } else if (isSmallViewport) {
                // Small screens: limit to 30% of viewport height
                maxAllowedHeight = Math.max(200, viewportHeight * 0.3);
            } else {
                // Normal screens: limit to 40% of viewport height
                maxAllowedHeight = Math.max(300, viewportHeight * 0.4);
            }
            
            // Determine if we should show above or below based on available space
            const shouldShowAbove = spaceBelow < Math.min(suggestionsHeight, maxAllowedHeight) && 
                                   spaceAbove > spaceBelow && 
                                   spaceAbove >= 100;
            
            // Position relative to the viewport using fixed positioning
            if (shouldShowAbove) {
                // Position above the input field
                suggestionsContainer.style.bottom = `${viewportHeight - inputRect.top + 2}px`;
                suggestionsContainer.style.top = 'auto';
                // Limit to available space above, but respect our maximum height limits
                const maxHeight = Math.min(suggestionsHeight, spaceAbove, maxAllowedHeight);
                if (maxHeight < suggestionsHeight) {
                    suggestionsContainer.style.maxHeight = `${maxHeight}px`;
                    suggestionsContainer.style.overflowY = 'auto';
                } else {
                    suggestionsContainer.style.maxHeight = 'none';
                    suggestionsContainer.style.overflowY = 'visible';
                }
                console.log(`[TAG INPUT] Suggestions positioned above input (small viewport: ${isSmallViewport}, limited space below: ${spaceBelow}px, using space above: ${spaceAbove}px, max height: ${maxHeight}px)`);
            } else {
                // Position below the input field (default)
                suggestionsContainer.style.top = `${inputRect.bottom + 2}px`;
                suggestionsContainer.style.bottom = 'auto';
                // Limit height to prevent covering important UI elements
                const maxHeight = Math.min(suggestionsHeight, spaceBelow, maxAllowedHeight);
                if (maxHeight < suggestionsHeight) {
                    suggestionsContainer.style.maxHeight = `${maxHeight}px`;
                    suggestionsContainer.style.overflowY = 'auto';
                } else {
                    suggestionsContainer.style.maxHeight = 'none';
                    suggestionsContainer.style.overflowY = 'visible';
                }
                console.log(`[TAG INPUT] Suggestions positioned below input (small viewport: ${isSmallViewport}, space below: ${spaceBelow}px, max height: ${maxHeight}px)`);
            }
            
            // Horizontal positioning - align with the input field
            const inputLeft = inputRect.left;
            const inputWidth = inputRect.width;
            
            // Adjust width based on viewport size
            let suggestionsWidth;
            if (isVerySmallViewport) {
                // Very small screens: use most of the viewport width
                suggestionsWidth = Math.min(viewportWidth - 20, Math.max(inputWidth, 200));
            } else if (isSmallViewport) {
                // Small screens: be more conservative with width
                suggestionsWidth = Math.min(viewportWidth - 40, Math.max(inputWidth, 250));
            } else {
                // Normal screens: use preferred width
                suggestionsWidth = Math.max(inputWidth, 200);
            }
            
            // Calculate left position, ensuring it fits within viewport
            let leftPosition = inputLeft;
            
            // Adjust for small viewports to center or fit better
            if (isVerySmallViewport) {
                // Center the dropdown on very small screens
                leftPosition = Math.max(10, (viewportWidth - suggestionsWidth) / 2);
            } else {
                // Ensure it doesn't go off the left edge
                if (leftPosition < 10) {
                    leftPosition = 10;
                }
                
                // Ensure it doesn't go off the right edge
                if (leftPosition + suggestionsWidth > viewportWidth - 10) {
                    leftPosition = viewportWidth - suggestionsWidth - 10;
                }
            }
            
            suggestionsContainer.style.left = `${leftPosition}px`;
            suggestionsContainer.style.width = `${suggestionsWidth}px`;
            suggestionsContainer.style.right = 'auto';
            
            // Make visible
            suggestionsContainer.style.visibility = 'visible';
            
            console.log(`[TAG INPUT] Smart positioning applied - showAbove: ${shouldShowAbove}, height: ${suggestionsHeight}px, left: ${leftPosition}px, width: ${suggestionsWidth}px, small viewport: ${isSmallViewport}, very small: ${isVerySmallViewport}`);
        }

        function hideSuggestions() { 
            setTimeout(() => {
                suggestionsContainer.classList.add('hidden');
                // Reset inline styles to use CSS defaults
                suggestionsContainer.style.position = '';
                suggestionsContainer.style.top = '';
                suggestionsContainer.style.bottom = '';
                suggestionsContainer.style.left = '';
                suggestionsContainer.style.right = '';
                suggestionsContainer.style.width = '';
                suggestionsContainer.style.zIndex = '';
                suggestionsContainer.style.maxHeight = '';
                suggestionsContainer.style.overflowY = '';
                suggestionsContainer.style.backgroundColor = '';
                suggestionsContainer.style.border = '';
                suggestionsContainer.style.borderRadius = '';
                suggestionsContainer.style.boxShadow = '';
                suggestionsContainer.style.marginTop = '';
                suggestionsContainer.style.marginBottom = '';
                suggestionsContainer.style.visibility = '';
                suggestionsContainer.style.display = '';
                suggestionsContainer.style.minWidth = '';
            }, 200); // Increased delay to allow click events to fire
        }
        
        // Event listeners with improved handling
        input.addEventListener('input', (e) => {
            console.log(`[TAG INPUT] Input event triggered, value:`, e.target.value);
            showSuggestions();
        });
        
        input.addEventListener('focus', () => {
            console.log(`[TAG INPUT] Input focused`);
            // Only show suggestions if input is non-empty
            if (input.value.trim()) {
                showSuggestions();
            } else {
                hideSuggestions();
            }
        });
        
        input.addEventListener('blur', (e) => {
            console.log(`[TAG INPUT] Input blurred`);
            // Don't hide immediately if clicking on suggestions
            if (!e.relatedTarget || !suggestionsContainer.contains(e.relatedTarget)) {
                hideSuggestions();
            }
        });
        
        input.addEventListener('keydown', e => {
            console.log(`[TAG INPUT] Key pressed:`, e.key);
            if (e.key === 'Enter' || e.key === ',') { 
                e.preventDefault(); 
                if (input.value.trim()) {
                    addTag(input.value.trim()); 
                }
            }
            if (e.key === 'Backspace' && input.value === '' && tags.length > 0) { 
                removeTag(tags[tags.length - 1]); 
            }
            if (e.key === 'Escape') {
                hideSuggestions();
            }
        });

        // Handle window resize and scroll to reposition suggestions
        const handleReposition = () => {
            if (!suggestionsContainer.classList.contains('hidden')) {
                positionSuggestions();
            }
        };

        // Add click outside to close suggestions on small screens
        const handleClickOutside = (e) => {
            if (!suggestionsContainer.classList.contains('hidden') && 
                !suggestionsContainer.contains(e.target) && 
                !input.contains(e.target)) {
                // On small screens, allow easier dismissal
                const isSmallViewport = window.innerHeight < 600 || window.innerWidth < 800;
                if (isSmallViewport) {
                    hideSuggestions();
                }
            }
        };

        window.addEventListener('resize', handleReposition);
        window.addEventListener('scroll', handleReposition, true); // Use capture for all scroll events
        document.addEventListener('click', handleClickOutside);

        console.log(`[TAG INPUT] Created successfully for ${containerId}`);

        return {
            /**
             * Initialize tags and categories for the input
             * @param {Array|string} tagString - tags to initialize
             * @param {Array} [categoryArray] - categories to initialize
             */
            init: (tagString, categoryArray) => {
                // Defensive: always use array for categories
                if (!Array.isArray(categoryArray)) categoryArray = [];
                console.log(`[TAG INPUT] Initializing ${containerId} with:`, tagString, categoryArray);
                const newTags = Array.isArray(tagString) ? tagString : (tagString ? tagString.split(',').map(t => t.trim()).filter(Boolean) : []);
                tags = newTags;
                // Normalize category data: handle both arrays of IDs and arrays of objects
                if (categoryArray.length > 0 && typeof categoryArray[0] === 'object' && categoryArray[0] !== null && 'id' in categoryArray[0]) {
                    console.log('[TAG INPUT] Normalizing category objects to IDs.');
                    selectedCategories = categoryArray.map(cat => cat.id);
                } else {
                    // It's already an array of IDs or an empty array
                    selectedCategories = categoryArray;
                }
                console.log(`[TAG INPUT] Tags set to:`, tags, 'Categories set to:', selectedCategories);
                render();
            },
            render: render,
            get tags() { return tags; },
            get categories() { return selectedCategories; },
            /**
             * Ensures tags and categories are sent to backend on form submit
             */
            submitToBackend: function(form) {
                let tagsInput = form.querySelector('input[name="tags"]');
                let categoriesInput = form.querySelector('input[name="categories"]');
                if (!tagsInput) {
                    tagsInput = document.createElement('input');
                    tagsInput.type = 'hidden';
                    tagsInput.name = 'tags';
                    form.appendChild(tagsInput);
                }
                if (!categoriesInput) {
                    categoriesInput = document.createElement('input');
                    categoriesInput.type = 'hidden';
                    categoriesInput.name = 'categories';
                    form.appendChild(categoriesInput);
                }
                tagsInput.value = tags.join(',');
                // Defensive: ensure selectedCategories is up-to-date
                if (typeof this.getCategories === 'function') {
                    categoriesInput.value = JSON.stringify(this.getCategories());
                } else {
                    categoriesInput.value = JSON.stringify(selectedCategories);
                }
                // Log to file via appLogger for verification
                if (window.appLogger && typeof window.appLogger.error === 'function') {
                    window.appLogger.error('submitToBackend', {
                        tags: tagsInput.value,
                        categories: categoriesInput.value,
                        selectedCategories: selectedCategories
                    });
                }
                console.log('[TAG INPUT] submitToBackend:', tagsInput.value, categoriesInput.value, selectedCategories);
            },
            /**
             * Returns the current selected category IDs
             */
            getCategories: function() {
                if (window.appLogger && typeof window.appLogger.error === 'function') {
                    window.appLogger.error('[TAG INPUT] getCategories called', {
                        selectedCategories: selectedCategories.slice()
                    });
                }
                return Array.isArray(selectedCategories) ? selectedCategories : [];
            }
        };
    };
    
    // Utility function to check if a tag is a category ID
    function isCategoryId(tag) {
        // Checks if tag matches any category ID in TAG_CATEGORIES
        return window.TAG_CATEGORIES?.some(cat => cat.id === tag);
    }
    
    console.log('[TAG INPUT] Global tag input system loaded');
    
})();
