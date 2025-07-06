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

        function render() {
            console.log(`[TAG INPUT] Rendering tags for ${containerId}:`, tags);
            
            // Remove existing tag bubbles
            container.querySelectorAll('.tag-bubble').forEach(bubble => bubble.remove());
            
            // Create new tag bubbles
            tags.forEach(tag => {
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
                
                // Handle special "all" tag
                if(tag.toLowerCase() === 'all') {
                    bubble.classList.add('tag-bubble-all');
                    bubble.classList.remove('inactive-filter');
                    bubble.style.backgroundColor = '#e9d5ff';
                    bubble.style.color = '#5b21b6';
                }
                
                // Regular tag - create proper structure
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
                
                // Insert before the input field
                container.insertBefore(bubble, input);
            });
            
            // Update hidden input
            hiddenInput.value = tags.join(', ');
            console.log(`[TAG INPUT] Hidden input updated:`, hiddenInput.value);
        }
        
        function addTag(tag) {
            const trimmedTag = tag.trim();
            console.log(`[TAG INPUT] Adding tag:`, trimmedTag);
            
            // Allow any singular tag (including those with &)
            if (trimmedTag && 
                !tags.some(t => t.toLowerCase() === trimmedTag.toLowerCase())) {
                tags.push(trimmedTag);
                render();
                console.log(`[TAG INPUT] Tag added. Current tags:`, tags);
                
                // Check if this is a single-tag component input (used in AND tag modals)
                if (input.hasAttribute('data-single-tag')) {
                    input.style.display = 'none';
                    input.value = trimmedTag; // Keep the value for form submission
                }
            }
            input.value = '';
            hideSuggestions();
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
            if (!value) { 
                hideSuggestions(); 
                return; 
            }
            
            console.log(`[TAG INPUT] Showing suggestions for:`, value);
            console.log(`[TAG INPUT] ALL_TAGS available:`, !!window.ALL_TAGS, 'Count:', window.ALL_TAGS?.length);
            
            const currentTagsLower = tags.map(t => t.toLowerCase());
            
            // Filter available tags - ensure ALL_TAGS is available
            if (!window.ALL_TAGS || !Array.isArray(window.ALL_TAGS)) {
                console.warn('[TAG INPUT] ALL_TAGS not available for suggestions');
                hideSuggestions();
                return;
            }
            
            const filtered = window.ALL_TAGS.filter(tag => 
                tag.toLowerCase().includes(value) && !currentTagsLower.includes(tag.toLowerCase())
            ).slice(0, 8); // Limit to 8 suggestions
            
            console.log(`[TAG INPUT] Filtered suggestions:`, filtered);
            
            // Clear previous suggestions
            suggestionsContainer.innerHTML = '';
            
            // Add filtered tag suggestions
            if (filtered.length > 0) {
                filtered.forEach(tag => suggestionsContainer.appendChild(createSuggestionItem(tag)));
            }
            
            // Add "create new tag" option if value doesn't match exactly
            if (!window.ALL_TAGS.some(tag => tag.toLowerCase() === value)) {
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
        
        function createSuggestionItem(tag, isNew = false) {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            
            if (isNew) {
                item.innerHTML = `Create new tag: <strong style="color: #2563eb; margin-left: 0.25rem;">"${tag}"</strong>`;
                item.style.fontStyle = 'italic';
                item.style.backgroundColor = '#f8fafc';
            } else {
                item.textContent = tag;
                if (tag.toLowerCase() === 'all') {
                    item.style.color = '#7c3aed';
                    item.style.fontWeight = 'bold';
                }
            }
            
            // Enhanced hover effect
            item.addEventListener('mouseenter', () => {
                item.style.backgroundColor = '#e5e7eb';
            });
            item.addEventListener('mouseleave', () => {
                item.style.backgroundColor = isNew ? '#f8fafc' : '';
            });
            
            // Click handling - use mousedown to prevent blur from hiding suggestions
            const handleClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log(`[TAG INPUT] Suggestion clicked:`, tag);
                addTag(tag);
                hideSuggestions();
            };
            
            // Use mousedown to fire before blur event hides suggestions
            item.addEventListener('mousedown', handleClick);
            
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
            if (input.value.trim()) {
                showSuggestions();
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
            init: (tagString) => { 
                console.log(`[TAG INPUT] Initializing ${containerId} with:`, tagString);
                const newTags = Array.isArray(tagString) ? tagString : (tagString ? tagString.split(',').map(t => t.trim()).filter(Boolean) : []);
                tags = newTags;
                console.log(`[TAG INPUT] Tags set to:`, tags);
                render(); 
            },
            render: render,
            get tags() { return tags; }
        };
    };
    
    console.log('[TAG INPUT] Global tag input system loaded');
    
})();
