// js/drag_drop.js

export let draggedTagInfo = {}; // Stores { tagName, sourceCategoryId }
export let isDragging = false; // Flag to indicate if a drag operation is in progress

export function drag(event) {
    const tagElement = event.target;
    
    // Prevent dragging of 'All' tag or any tag without a data-tag-name
    if (!tagElement.dataset.tagName || tagElement.dataset.tagName.toLowerCase() === 'all') {
        event.preventDefault(); // Disallow drag operation
        return;
    }

    draggedTagInfo = {
        tagName: tagElement.dataset.tagName,
        sourceCategoryId: tagElement.dataset.sourceCategoryId
    };
    event.dataTransfer.setData("text/plain", draggedTagInfo.tagName); // Required for Firefox
    
    // Set the dragging flag
    isDragging = true;

    // Add a class to indicate dragging for visual feedback (optional)
    tagElement.classList.add('opacity-50', 'dragging');
}

export function dragEnd(event) {
    // Reset the dragging flag
    isDragging = false;
    // Remove dragging classes from the dragged element
    event.target.classList.remove('opacity-50', 'dragging');
}


export function allowDrop(event) {
    event.preventDefault(); // Necessary to allow dropping
    // Add a visual cue to the dropzone
    event.currentTarget.classList.add('drag-over');
}

export function leaveDrop(event) {
    // Remove visual cue from the dropzone
    event.currentTarget.classList.remove('drag-over');
    // The dragged element's opacity and 'dragging' class are handled by dragEnd
}

export async function drop(event) {
    event.preventDefault();
    event.stopPropagation(); // Stop the event from bubbling up to parent dropzones
    event.currentTarget.classList.remove('drag-over'); // Remove visual cue

    const targetCategoryId = event.currentTarget.dataset.categoryId;
    const targetTagName = event.currentTarget.dataset.tagName; // New: get the tag name of the drop target
    const { tagName, sourceCategoryId } = draggedTagInfo;
    
    // If dropping onto another tag, but it's the same tag, do nothing.
    if (targetTagName && targetTagName.toLowerCase() === tagName.toLowerCase()) {
        return;
    }

    // If 'All' tag was somehow dragged (should be prevented by drag()), or if essential info is missing
    if (!tagName || sourceCategoryId === undefined || (targetCategoryId === undefined && targetTagName === undefined)) {
        return;
    }

    const currentUrl = new URL(window.location.href);
    const queryParams = new URLSearchParams(currentUrl.search);
    
    const formData = new FormData();
    formData.append('tag_name', tagName);
    formData.append('source_category_id', sourceCategoryId);
    // If dropped on a tag, the category ID is the tag's container. Otherwise, it's the dropzone itself.
    formData.append('target_category_id', event.currentTarget.closest('.dropzone').dataset.categoryId); 
    formData.append('target_tag_name', targetTagName || '');
    formData.append('state', window.CURRENT_STATE); // Use global CURRENT_STATE

    try {
        const response = await fetch(`/tag/move?${queryParams.toString()}`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.success) {
            // Reload the page to reflect the updated categorization
            window.location.reload();
        } else {
            alert('Failed to move tag: ' + data.message);
        }
    } catch (error) {
        console.error('Error moving tag:', error);
        alert('An error occurred while moving the tag.');
    }
}