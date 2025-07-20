// js/drag_drop.js

// Stores { tagName, sourceCategoryId }
window.draggedTagInfo = {};
window.isDragging = false;

function drag(event) {
    const tagElement = event.target;
    // Prevent dragging of 'All' tag or any tag without a data-tag-name
    if (!tagElement.dataset.tagName || tagElement.dataset.tagName.toLowerCase() === 'all') {
        event.preventDefault();
        return;
    }
    window.draggedTagInfo = {
        tagName: tagElement.dataset.tagName,
        sourceCategoryId: tagElement.dataset.sourceCategoryId
    };
    event.dataTransfer.setData("text/plain", window.draggedTagInfo.tagName); // Correct reference
    window.isDragging = true;
    tagElement.classList.add('opacity-50', 'dragging');
}

function dragEnd(event) {
    window.isDragging = false;
    event.target.classList.remove('opacity-50', 'dragging');
}

function allowDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
}

function leaveDrop(event) {
    event.currentTarget.classList.remove('drag-over');
}

async function drop(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('drag-over');
    let targetCategoryId = event.currentTarget.dataset.categoryId;
    let targetTagName = event.currentTarget.dataset.tagName;

    // If dropping onto a tag-bubble, always get parent dropzone's categoryId
    if (event.currentTarget.classList.contains('tag-bubble')) {
        const parentDropzone = event.currentTarget.closest('.dropzone');
        if (parentDropzone) {
            targetCategoryId = parentDropzone.dataset.categoryId;
        }
    }
    const { tagName, sourceCategoryId } = window.draggedTagInfo;

    // If dropping onto another tag, but it's the same tag, do nothing.
    if (targetTagName && targetTagName.toLowerCase() === tagName.toLowerCase()) {
        return;
    }

    // If the drop target is a tag-bubble, get its parent dropzone's categoryId
    if (!targetCategoryId && event.currentTarget.classList.contains('tag-bubble')) {
        const parentDropzone = event.currentTarget.closest('.dropzone');
        if (parentDropzone) {
            targetCategoryId = parentDropzone.dataset.categoryId;
        }
    }

    if (!tagName || sourceCategoryId === undefined || !targetCategoryId) {
        console.warn('Drop aborted: missing info', { tagName, sourceCategoryId, targetCategoryId });
        return;
    }
    if (targetCategoryId === 'all_tags' || targetCategoryId === 'and_tags') {
        alert('Cannot move tag to this location.');
        return;
    }
    console.log('Drop: moving tag', { tagName, sourceCategoryId, targetCategoryId, targetTagName });
    const currentUrl = new URL(window.location.href);
    const queryParams = new URLSearchParams(currentUrl.search);
    const formData = new FormData();
    formData.append('tag_name', tagName);
    formData.append('source_category_id', sourceCategoryId);
    formData.append('target_category_id', targetCategoryId);
    formData.append('target_tag_name', targetTagName || '');
    formData.append('state', window.currentState || window.CURRENT_STATE);
    try {
        const response = await fetch(`/tag/move?${queryParams.toString()}`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.success) {
            window.location.reload();
        } else {
            alert('Failed to move tag: ' + data.message);
        }
    } catch (error) {
        console.error('Error moving tag:', error);
        alert('An error occurred while moving the tag.');
    }
}

// --- Attach drag-and-drop handlers after DOM is loaded ---
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.dropzone').forEach(function(zone) {
        zone.classList.remove('drag-over');
        zone.addEventListener('dragover', allowDrop);
        zone.addEventListener('dragleave', leaveDrop);
        zone.addEventListener('drop', drop);
    });
    document.querySelectorAll('.tag-bubble[draggable="true"]').forEach(function(tag) {
        tag.addEventListener('dragstart', drag);
        tag.addEventListener('dragend', dragEnd);
    });
});