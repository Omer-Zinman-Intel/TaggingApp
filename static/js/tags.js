// js/tags.js

export let tagInputs = {}; // Global object to hold tag input instances

export function createTagInput(containerId, inputId, hiddenInputId, suggestionsId) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    const hiddenInput = document.getElementById(hiddenInputId);
    const suggestionsContainer = document.getElementById(suggestionsId);
    let tags = [];

    function render() {
        container.querySelectorAll('.tag-bubble').forEach(bubble => bubble.remove());
        tags.forEach(tag => {
            const bubble = document.createElement('div');
            bubble.classList.add('tag-bubble');
            if(tag.toLowerCase() === 'all') bubble.classList.add('tag-bubble-all');
            bubble.textContent = tag;
            const removeBtn = document.createElement('span');
            removeBtn.classList.add('tag-remove-btn');
            removeBtn.innerHTML = '&times;';
            removeBtn.addEventListener('click', () => removeTag(tag));
            bubble.appendChild(removeBtn);
            container.insertBefore(bubble, input);
        });
        hiddenInput.value = tags.join(', ');
    }
    
    function addTag(tag) {
        const trimmedTag = tag.trim();
        if (trimmedTag && !tags.some(t => t.toLowerCase() === trimmedTag.toLowerCase())) {
            tags.push(trimmedTag);
            render();
        }
        input.value = '';
        hideSuggestions();
    }

    function removeTag(tag) {
        tags = tags.filter(t => t.toLowerCase() !== tag.toLowerCase());
        render();
    }

    function showSuggestions() {
         const value = input.value.trim().toLowerCase();
         if (!value) { hideSuggestions(); return; }
         const currentTagsLower = tags.map(t => t.toLowerCase());
         const filtered = window.ALL_TAGS.filter(tag => // Use window.ALL_TAGS for global access
            tag.toLowerCase().startsWith(value) && !currentTagsLower.includes(tag.toLowerCase())
         );
         suggestionsContainer.innerHTML = '';
         if (filtered.length > 0) {
             filtered.forEach(tag => suggestionsContainer.appendChild(createSuggestionItem(tag)));
         }
         const isAlreadyATag = window.ALL_TAGS.some(t => t.toLowerCase() === value); // Use window.ALL_TAGS
         if (!isAlreadyATag && !currentTagsLower.includes(value)) {
             suggestionsContainer.appendChild(createSuggestionItem(input.value.trim(), true));
         }
         if (suggestionsContainer.children.length > 0) {
             suggestionsContainer.classList.remove('hidden');
         } else {
             hideSuggestions();
         }
    }
    
    function createSuggestionItem(tag, isNew = false) {
        const item = document.createElement('div');
        item.className = 'suggestion-item px-4 py-2 hover:bg-gray-100';
        if (isNew) {
            item.innerHTML = `Create new tag: <strong class="text-blue-600 ml-1">"${tag}"</strong>`;
        } else {
            item.textContent = tag;
            if (tag.toLowerCase() === 'all') item.className += ' text-purple-600 font-bold';
        }
        item.addEventListener('mousedown', () => addTag(tag));
        return item;
    }

    function hideSuggestions() { setTimeout(() => suggestionsContainer.classList.add('hidden'), 150); }
    input.addEventListener('input', showSuggestions);
    input.addEventListener('blur', hideSuggestions);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input.value); }
        if (e.key === 'Backspace' && input.value === '' && tags.length > 0) { removeTag(tags[tags.length - 1]); }
    });

    return { init: (tagString) => { tags = tagString ? tagString.split(',').map(t => t.trim()).filter(Boolean) : []; render(); } };
}
