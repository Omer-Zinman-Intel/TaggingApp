// js/tags.js

export let tagInputs = {}; // Global object to hold tag input instances

export function createTagInput(containerId, inputId, hiddenInputId, suggestionsId) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    const hiddenInput = document.getElementById(hiddenInputId);
    const suggestionsContainer = document.getElementById(suggestionsId);
    
    // Add null checks since elements might not exist when this is called
    if (!container || !input || !hiddenInput || !suggestionsContainer) {
        console.warn(`Tag input elements not found for ${containerId}`);
        return { init: () => {} }; // Return a dummy object
    }
    
    let partialAndTag = null; // Track partial AND tag being built
    let tags = [];

    function render() {
        // Remove existing tag bubbles and partial components
        container.querySelectorAll('.tag-bubble, .partial-component').forEach(bubble => bubble.remove());
        
        // Render partial AND tag components first (if any)
        if (partialAndTag && partialAndTag.length > 0) {
            partialAndTag.forEach((component, index) => {
                const bubble = createPartialComponent(component, index);
                container.insertBefore(bubble, input);
            });
        }
        
        // Create regular tag bubbles
        tags.forEach(tag => {
            const bubble = document.createElement('div');
            bubble.classList.add('tag-bubble', 'inactive-filter');
            
            // Handle special "all" tag
            if(tag.toLowerCase() === 'all') {
                bubble.classList.add('tag-bubble-all');
                bubble.classList.remove('inactive-filter');
            }
            
            // Handle AND tags display
            if (tag.includes('&')) {
                bubble.classList.add('and-tag');
                const components = tag.split('&');
                const componentContainer = document.createElement('div');
                componentContainer.classList.add('flex', 'flex-col');
                
                components.forEach(component => {
                    const componentDiv = document.createElement('div');
                    componentDiv.classList.add('flex', 'items-center');
                    
                    const componentSpan = document.createElement('span');
                    componentSpan.classList.add('and-tag-component');
                    componentSpan.textContent = component.trim();
                    componentDiv.appendChild(componentSpan);
                    
                    // Add individual component remove button for AND tags
                    if (components.length > 1) { // Only show if there's more than one component
                        const componentRemoveBtn = document.createElement('button');
                        componentRemoveBtn.classList.add('and-component-remove-btn');
                        componentRemoveBtn.innerHTML = '&times;';
                        componentRemoveBtn.title = `Remove '${component.trim()}' from this AND tag`;
                        componentRemoveBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            removeAndTagComponentFromModal(tag, component.trim());
                        });
                        componentDiv.appendChild(componentRemoveBtn);
                    }
                    
                    componentContainer.appendChild(componentDiv);
                });
                
                bubble.appendChild(componentContainer);
            } else {
                // Regular tag
                bubble.textContent = tag;
            }
            
            // Add click handler to extend tag
            bubble.addEventListener('click', (e) => {
                if (e.target.classList.contains('and-component-remove-btn')) return;
                extendExistingTag(tag);
            });
            
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
    }
    
    function createPartialComponent(component, index) {
        const bubble = document.createElement('div');
        bubble.classList.add('partial-component');
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
            background-color: #fef3c7;
            color: #d97706;
            border: 2px dashed #f59e0b;
        `;
        
        bubble.textContent = component;
        
        // Add separator after each component except the last
        if (index < partialAndTag.length - 1) {
            const separator = document.createElement('span');
            separator.classList.add('and-component-separator');
            separator.textContent = ' & ';
            separator.style.cssText = 'color: #f59e0b; font-weight: bold; padding: 0 0.25rem;';
            bubble.appendChild(separator);
        }
        
        return bubble;
    }
    
    function extendExistingTag(existingTag) {
        // Remove the existing tag from the tags array
        tags = tags.filter(t => t.toLowerCase() !== existingTag.toLowerCase());
        
        // Convert to partial AND tag
        if (existingTag.includes('&')) {
            partialAndTag = existingTag.split('&').map(c => c.trim());
        } else {
            partialAndTag = [existingTag];
        }
        
        // Enter AND tag mode
        input.value = '';
        input.style.backgroundColor = '#fef3c7';
        input.style.borderColor = '#f59e0b';
        input.setAttribute('placeholder', 'Add more components... (extending tag)');
        input.focus();
        
        render();
    }
    
    function addTag(tag) {
        const trimmedTag = tag.trim();
        if (!trimmedTag) return;
        
        // If we're in partial AND tag mode, add as component
        if (partialAndTag !== null) {
            addAndTagComponent(trimmedTag);
            return;
        }
        
        // Check if tag already exists in current tags
        if (tags.some(t => t.toLowerCase() === trimmedTag.toLowerCase())) {
            input.value = '';
            hideSuggestions();
            return;
        }
        
        // If tag exists in ALL_TAGS, add it directly
        if (window.ALL_TAGS.some(t => t.toLowerCase() === trimmedTag.toLowerCase())) {
            tags.push(trimmedTag);
            render();
            input.value = '';
            hideSuggestions();
            return;
        }
        
        // If tag doesn't exist, create it via API
        createNewTag(trimmedTag);
    }

    function createNewTag(tagName) {
        // Create FormData for the API call
        const formData = new FormData();
        formData.append('tag_name', tagName);
        formData.append('category_id', 'uncategorized');
        
        // Get current state from URL
        const urlParams = new URLSearchParams(window.location.search);
        const state = urlParams.get('state') || 'default';
        
        // Call the API
        fetch(`/tags/create?state=${encodeURIComponent(state)}`, {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update the global ALL_TAGS array
                if (data.all_tags) {
                    window.ALL_TAGS = data.all_tags;
                }
                
                // Handle partial AND tag mode or regular mode
                if (partialAndTag !== null) {
                    addAndTagComponent(data.tag);
                } else {
                    // Add the new tag to the current tags
                    if (!tags.some(t => t.toLowerCase() === data.tag.toLowerCase())) {
                        tags.push(data.tag);
                        render();
                    }
                }
                
                // Show success message (optional)
                console.log(`Tag '${data.tag}' created successfully`);
            } else {
                console.error('Failed to create tag:', data.message);
                alert('Failed to create tag: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error creating tag:', error);
            alert('Error creating tag. Please try again.');
        });
        
        input.value = '';
        hideSuggestions();
    }

    function removeTag(tag) {
        tags = tags.filter(t => t.toLowerCase() !== tag.toLowerCase());
        render();
    }

    function removeAndTagComponentFromModal(andTag, componentToRemove) {
        if (!confirm(`Remove '${componentToRemove}' from the AND tag '${andTag}'?`)) {
            return;
        }
        
        const components = andTag.split('&').map(c => c.trim());
        const remainingComponents = components.filter(c => c.toLowerCase() !== componentToRemove.toLowerCase());
        
        // Remove the original AND tag
        tags = tags.filter(t => t.toLowerCase() !== andTag.toLowerCase());
        
        if (remainingComponents.length === 1) {
            // If only one component remains, add it as a regular tag
            const remainingTag = remainingComponents[0];
            if (!tags.some(t => t.toLowerCase() === remainingTag.toLowerCase())) {
                tags.push(remainingTag);
            }
        } else if (remainingComponents.length > 1) {
            // If multiple components remain, create a new AND tag
            const newAndTag = remainingComponents.join(' & ');
            if (!tags.some(t => t.toLowerCase() === newAndTag.toLowerCase())) {
                tags.push(newAndTag);
            }
        }
        // If no components remain (shouldn't happen with the UI), the tag is just removed
        
        render();
    }

    function showSuggestions() {
         const value = input.value.trim();
         if (!value) { hideSuggestions(); return; }
         
         // Check if we're in AND tag mode (either building partial or typing contains &)
         const isAndTagMode = partialAndTag !== null || value.includes('&');
         let searchValue = value.toLowerCase();
         
         if (isAndTagMode) {
             // For AND tags, get suggestions for the current component being typed
             if (value.includes('&')) {
                 const components = value.split('&');
                 const currentComponent = components[components.length - 1].trim();
                 searchValue = currentComponent.toLowerCase();
             }
             
             // Add visual indication for AND tag mode
             input.style.backgroundColor = '#fef3c7'; // yellow-100
             input.style.borderColor = '#f59e0b'; // yellow-500
             
             if (partialAndTag && partialAndTag.length > 0) {
                 input.setAttribute('placeholder', 'Add more components... (AND tag mode)');
             } else {
                 input.setAttribute('placeholder', 'Type component name... (AND tag mode)');
             }
         } else {
             // Regular mode styling
             input.style.backgroundColor = '';
             input.style.borderColor = '';
             input.setAttribute('placeholder', input.getAttribute('data-original-placeholder') || 'Add a tag...');
         }
         
         if (!searchValue) { hideSuggestions(); return; }
         
         const currentTagsLower = tags.map(t => t.toLowerCase());
         
         // Filter out components already in the partial AND tag
         let excludeComponents = [];
         if (partialAndTag) {
             excludeComponents = partialAndTag.map(c => c.toLowerCase());
         }
         
         const filtered = window.ALL_TAGS.filter(tag => 
            tag.toLowerCase().startsWith(searchValue) && 
            !currentTagsLower.includes(tag.toLowerCase()) &&
            !excludeComponents.includes(tag.toLowerCase())
         );
         
         suggestionsContainer.innerHTML = '';
         if (filtered.length > 0) {
             filtered.forEach(tag => {
                 const suggestionItem = createSuggestionItem(tag, false, isAndTagMode);
                 suggestionsContainer.appendChild(suggestionItem);
             });
         }
         
         // Add "create new tag" option if the exact tag doesn't exist
         const exactMatch = window.ALL_TAGS.some(tag => tag.toLowerCase() === searchValue);
         if (!exactMatch && !currentTagsLower.includes(searchValue) && !excludeComponents.includes(searchValue)) {
             const componentName = searchValue;
             const createItem = createSuggestionItem(componentName, true, isAndTagMode);
             suggestionsContainer.appendChild(createItem);
         }
         
         if (suggestionsContainer.children.length > 0) {
             // Smart positioning: check if there's enough space below
             positionDropdown();
             suggestionsContainer.classList.remove('hidden');
         } else {
             hideSuggestions();
         }
    }
    
    function positionDropdown() {
        const containerRect = container.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const modalBody = container.closest('.modal-body');
        
        // Calculate available space below the input
        let spaceBelow;
        if (modalBody) {
            const modalBodyRect = modalBody.getBoundingClientRect();
            spaceBelow = modalBodyRect.bottom - containerRect.bottom;
        } else {
            spaceBelow = viewportHeight - containerRect.bottom;
        }
        
        const spaceAbove = containerRect.top - (modalBody ? modalBody.getBoundingClientRect().top : 0);
        const dropdownHeight = Math.min(160, suggestionsContainer.scrollHeight); // Max height from CSS
        
        // Remove existing position classes
        suggestionsContainer.classList.remove('dropdown-up');
        
        // If not enough space below but enough space above, position above
        if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
            suggestionsContainer.classList.add('dropdown-up');
        }
        
        // If there's not enough space in either direction, ensure modal scrolls
        if (spaceBelow < dropdownHeight && spaceAbove < dropdownHeight && modalBody) {
            // Scroll the modal body to give more space
            const scrollOffset = Math.max(0, dropdownHeight - spaceBelow);
            modalBody.scrollTop += scrollOffset;
        }
    }
    
    function createSuggestionItem(tag, isNew = false, isAndTagMode = false) {
        const item = document.createElement('div');
        item.className = 'suggestion-item px-4 py-2 hover:bg-gray-100';
        
        if (isNew) {
            if (isAndTagMode) {
                item.innerHTML = `Create component: <strong class="text-orange-600 ml-1">"${tag}"</strong> <span class="text-xs text-gray-500">(for AND tag)</span>`;
            } else {
                item.innerHTML = `Create new tag: <strong class="text-blue-600 ml-1">"${tag}"</strong>`;
            }
        } else {
            if (isAndTagMode) {
                item.innerHTML = `<span>${tag}</span> <span class="text-xs text-orange-600 ml-2">& component</span>`;
            } else {
                item.textContent = tag;
                if (tag.toLowerCase() === 'all') item.className += ' text-purple-600 font-bold';
            }
        }
        
        item.addEventListener('mousedown', () => {
            if (isAndTagMode) {
                // Clear input immediately to prevent it from being added as well
                input.value = '';
                addAndTagComponent(tag);
            } else {
                addTag(tag);
            }
        });
        return item;
    }

    function hideSuggestions() { 
        setTimeout(() => suggestionsContainer.classList.add('hidden'), 150); 
    }
    
    // Store original placeholder for restoration
    if (input.getAttribute('placeholder')) {
        input.setAttribute('data-original-placeholder', input.getAttribute('placeholder'));
    }
    
    input.addEventListener('input', showSuggestions);
    input.addEventListener('blur', () => {
        // Don't reset styling if we're in partial AND tag mode
        if (partialAndTag === null) {
            input.style.backgroundColor = '';
            input.style.borderColor = '';
            input.setAttribute('placeholder', input.getAttribute('data-original-placeholder') || 'Add a tag...');
        }
        hideSuggestions();
    });
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ',') { 
            e.preventDefault(); 
            
            if (partialAndTag !== null) {
                // Complete the partial AND tag
                completeAndTag();
            } else {
                // Regular tag addition
                const currentValue = input.value.trim();
                if (currentValue.includes('&')) {
                    // Handle inline AND tag creation
                    const components = currentValue.split('&').map(c => c.trim()).filter(c => c);
                    if (components.length >= 2) {
                        const andTag = components.join(' & ');
                        addTag(andTag);
                    }
                } else {
                    addTag(currentValue);
                }
            }
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            if (partialAndTag !== null) {
                cancelPartialAndTag();
            }
        }
        if (e.key === 'Backspace' && input.value === '' && tags.length > 0) { 
            removeTag(tags[tags.length - 1]); 
        }
        // Handle ampersand key for AND tag creation
        if (e.key === '&') {
            e.preventDefault();
            const currentValue = input.value.trim();
            
            if (partialAndTag !== null) {
                // Add current input as component and automatically complete
                if (currentValue) {
                    addAndTagComponent(currentValue);
                } else {
                    // If no input, just complete what we have
                    completeAndTag();
                }
            } else if (currentValue) {
                // Start new partial AND tag but don't complete yet - wait for second component
                partialAndTag = [currentValue];
                input.value = '';
                input.style.backgroundColor = '#fef3c7';
                input.style.borderColor = '#f59e0b';
                input.setAttribute('placeholder', 'Type second component...');
                render();
                showSuggestions();
            }
        }
    });

    function addAndTagComponent(componentName) {
        // Initialize partial AND tag if not exists
        if (!partialAndTag) {
            partialAndTag = [];
        }
        
        // Add the new component (input should already be cleared by suggestion click)
        partialAndTag.push(componentName);
        
        // Only auto-complete if this is the second component (making it a valid AND tag)
        if (partialAndTag.length >= 2) {
            // Complete the AND tag immediately
            const andTag = partialAndTag.join(' & ');
            
            // Check if this exact AND tag already exists
            if (!tags.some(t => t.toLowerCase() === andTag.toLowerCase())) {
                tags.push(andTag);
            }
            
            // Reset partial state and return to normal mode
            partialAndTag = null;
            input.value = '';
            input.style.backgroundColor = '';
            input.style.borderColor = '';
            input.setAttribute('placeholder', input.getAttribute('data-original-placeholder') || 'Add a tag...');
            
            render();
            hideSuggestions();
        } else {
            // Continue building (first component)
            input.style.backgroundColor = '#fef3c7';
            input.style.borderColor = '#f59e0b';
            input.setAttribute('placeholder', 'Type second component...');
            render();
            input.focus();
            hideSuggestions();
        }
    }
    
    function completeAndTag() {
        if (!partialAndTag || partialAndTag.length === 0) return;
        
        // Add current input value if we're completing manually (Enter key)
        const currentValue = input.value.trim();
        if (currentValue && !partialAndTag.includes(currentValue)) {
            partialAndTag.push(currentValue);
        }
        
        // Create the final AND tag if we have multiple components
        if (partialAndTag.length >= 2) {
            const andTag = partialAndTag.join(' & ');
            
            // Check if this exact AND tag already exists
            if (!tags.some(t => t.toLowerCase() === andTag.toLowerCase())) {
                tags.push(andTag);
            }
        } else if (partialAndTag.length === 1) {
            // Single component becomes a regular tag
            const singleTag = partialAndTag[0];
            if (!tags.some(t => t.toLowerCase() === singleTag.toLowerCase())) {
                tags.push(singleTag);
            }
        }
        
        // Reset partial state and return to normal mode
        partialAndTag = null;
        input.value = '';
        input.style.backgroundColor = '';
        input.style.borderColor = '';
        input.setAttribute('placeholder', input.getAttribute('data-original-placeholder') || 'Add a tag...');
        
        render();
        hideSuggestions();
    }

    function cancelPartialAndTag() {
        partialAndTag = null;
        input.value = '';
        input.style.backgroundColor = '';
        input.style.borderColor = '';
        input.setAttribute('placeholder', input.getAttribute('data-original-placeholder') || 'Add a tag...');
        render();
        hideSuggestions();
    }

    return { 
        init: (tagString) => { 
            tags = tagString ? tagString.split(',').map(t => t.trim()).filter(Boolean) : []; 
            render(); 
        },
        render: render // Expose render function for manual refresh
    };
}
