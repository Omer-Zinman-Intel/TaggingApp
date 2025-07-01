# py/tag_manager.py
import uuid
import copy
from typing import List, Dict, Set, Optional, Any
import py.global_state as global_state

# --- Helper for AND tags ---
def combine_tags_to_and(tags: List[str]) -> str:
    """
    Combines a list of tags into a canonical AND tag string (e.g., "A&B").
    Tags are sorted alphabetically to ensure consistency (A&B is same as B&A).
    Using format without spaces to match existing data format.
    """
    unique_sorted_tags = sorted(list(set(tags)), key=str.lower)
    return "&".join(unique_sorted_tags)

def parse_and_tag_components(tag_name: str) -> List[str]:
    """
    Parses an AND tag string (e.g., "A & B") into its individual components.
    If the tag is not an AND tag, returns a list containing the original tag.
    """
    if '&' in tag_name:
        # Split on ' & ' first, then fallback to '&' for compatibility
        if ' & ' in tag_name:
            components = [comp.strip() for comp in tag_name.split(' & ')]
        else:
            components = [comp.strip() for comp in tag_name.split('&')]
        return sorted(components, key=str.lower) # Ensure components are also sorted
    return [tag_name]

# --- Tag Management Logic ---

def get_all_tags_in_use() -> Set[str]:
    """Scans the entire document and returns a set of all tags currently applied."""
    in_use_tags: Set[str] = set()
    for section in global_state.document_state.get("sections", []):
        in_use_tags.update(section.get("tags", []))
        for note in section.get("notes", []):
            in_use_tags.update(note.get("tags", []))
    return in_use_tags

def get_all_known_tags() -> List[str]:
    """Returns a sorted list of all tags that are actually available (used in content)."""
    return sorted(list(get_available_tags()), key=str.lower)

def get_all_used_tags() -> Set[str]:
    """
    Get all tags that are actually used in sections and notes.
    This replaces the concept of 'known_tags' - only tags in actual content are available.
    """
    used_tags = set()
    
    # Collect from sections
    for section in global_state.document_state.get('sections', []):
        used_tags.update(section.get('tags', []))
        
        # Collect from notes within sections
        for note in section.get('notes', []):
            used_tags.update(note.get('tags', []))
    
    # Collect from top-level notes
    for note in global_state.document_state.get('notes', []):
        used_tags.update(note.get('tags', []))
    
    return used_tags

def get_available_tags() -> Set[str]:
    """
    Get all tags available for use, including individual components from AND tags.
    This includes both standalone tags and components of AND tags.
    """
    used_tags = get_all_used_tags()
    available_tags = set()
    
    for tag in used_tags:
        if '&' in tag:
            # Add the AND tag itself
            available_tags.add(tag)
            # Add individual components
            components = parse_and_tag_components(tag)
            available_tags.update(components)
        else:
            # Add standalone tag
            available_tags.add(tag)
    
    return available_tags

def sync_known_tags(new_tags: List[str] = None) -> None:
    """
    Sync known_tags with actually used tags. This maintains backward compatibility
    but now known_tags is derived from actual usage, not manually maintained.
    Also ensures new tags are added to the Uncategorized category.
    """
    # Get all actually used tags
    used_tags = get_all_used_tags()
    
    # Get all available tags (including components)
    available_tags = get_available_tags()
    
    # Update known_tags to match available tags
    global_state.document_state['known_tags'] = available_tags
    
    # Update tag categories to only include used tags
    for category in global_state.document_state.get('tag_categories', []):
        # Remove tags that are no longer used
        category['tags'] = [tag for tag in category.get('tags', []) if tag in available_tags]
        category['tags'].sort(key=str.lower)
    
    # Find the Uncategorized category
    uncategorized_category = None
    for category in global_state.document_state.get('tag_categories', []):
        if category['name'].lower() == 'uncategorized':
            uncategorized_category = category
            break
    
    # If Uncategorized category doesn't exist, create it
    if uncategorized_category is None:
        uncategorized_category = {
            'id': str(uuid.uuid4()),
            'name': 'Uncategorized',
            'tags': []
        }
        global_state.document_state.setdefault('tag_categories', []).append(uncategorized_category)
    
    # Find tags that are available but not in any category
    all_categorized = get_all_categorized_tags()
    uncategorized_tags = available_tags - all_categorized
    
    # Add uncategorized tags to the Uncategorized category
    for tag in uncategorized_tags:
        if tag not in uncategorized_category['tags']:
            uncategorized_category['tags'].append(tag)
    
    # Sort the Uncategorized category tags
    uncategorized_category['tags'].sort(key=str.lower)


def get_all_categorized_tags() -> Set[str]:
    """Returns a set of all tags currently assigned to any category."""
    categorized_tags = set()
    for category in global_state.document_state.get("tag_categories", []):
        categorized_tags.update(category.get("tags", []))
    return categorized_tags

def get_uncategorized_tags() -> List[str]:
    """Returns a sorted list of tags specifically assigned to the 'Uncategorized' category."""
    for category in global_state.document_state.get("tag_categories", []):
        if category['name'].lower() == 'uncategorized':
            # Exclude 'All' tag and AND tags from the list of uncategorized tags to display
            return sorted([tag for tag in category.get('tags', []) if tag.lower() != 'all' and '&' not in tag], key=str.lower)
    return [] 

def get_and_tags() -> List[str]:
    """Returns a sorted list of all AND tags from the known_tags list."""
    all_tags = get_all_known_tags()
    return sorted([tag for tag in all_tags if '&' in tag], key=str.lower)

def get_primary_category_for_tag(tag_name: str) -> Optional[Dict]:
    """
    Finds the category object that explicitly contains the given tag.
    Returns the category object or None if not found in any explicit category.
    """
    for category in global_state.document_state.get("tag_categories", []):
        if tag_name in category.get('tags', []):
            return category
    return None

def delete_tag_from_all_categories(tag_name: str) -> None:
    """Removes a given tag from all categories it might reside in."""
    for category in global_state.document_state.get("tag_categories", []):
        if tag_name in category.get("tags", []):
            category["tags"].remove(tag_name)
            category["tags"].sort(key=str.lower)


def update_content_with_new_tag(old_tag: str, new_tag: str) -> None:
    """
    Updates all occurrences of old_tag with new_tag in sections and notes.
    Removes old_tag from known_tags if it's no longer used outside of new_tag's components.
    Also handles AND tag component updates properly.
    """
    old_tag_lower = old_tag.lower()
    
    # Collect all tags that will be added due to this rename
    tags_to_sync = [new_tag]
    if '&' in new_tag:
        tags_to_sync.extend(parse_and_tag_components(new_tag))
    
    for section in global_state.document_state.get("sections", []):
        # Update section tags
        section_tags_updated = [new_tag if t.lower() == old_tag_lower else t for t in section.get("tags", [])]
        section['tags'] = list(dict.fromkeys(section_tags_updated)) # Deduplicate and assign
        
        # Update note tags within sections
        for note in section.get("notes", []):
            note_tags_updated = [new_tag if t.lower() == old_tag_lower else t for t in note.get("tags", [])]
            note['tags'] = list(dict.fromkeys(note_tags_updated)) # Deduplicate and assign
    
    # Ensure all new tags and their components are properly synced
    sync_known_tags(tags_to_sync)
    
    # Ensure known_tags is consistent
    if old_tag_lower != new_tag.lower(): # Avoid removing new_tag if it just replaced old_tag
        if old_tag in global_state.document_state.get("known_tags", set()):
            global_state.document_state["known_tags"].discard(old_tag)
    
    cleanup_orphan_tags() # Reconcile global known_tags and categorized lists


def cleanup_orphan_tags() -> None:
    """
    Removes any tags from the master 'known_tags' list if they are no longer
    used anywhere in the document AND are not assigned to any category.
    Also removes orphan tags from categories if they are no longer known.
    """
    in_use_tags = get_all_tags_in_use()
    categorized_tags_before_cleanup = get_all_categorized_tags()

    # 'All' is a special reserved tag and should never be removed.
    preserved_tags_in_known = in_use_tags.union(categorized_tags_before_cleanup)
    preserved_tags_in_known.add('All')
    
    global_state.document_state["known_tags"] = {tag for tag in global_state.document_state.get("known_tags", set()) if tag in preserved_tags_in_known}

    # Also, ensure no orphan tags remain in categories (e.g. if they were deleted from content or renamed globally)
    current_known_tags_lower = {t.lower() for t in global_state.document_state["known_tags"]}
    for category in global_state.document_state.get("tag_categories", []):
        category["tags"] = [tag for tag in category.get("tags", []) if tag.lower() in current_known_tags_lower]
        # Sort tags within category after cleanup
        category["tags"] = sorted(category["tags"], key=str.lower)

def smart_rename_tag(old_tag: str, new_tag: str) -> None:
    """
    Intelligently renames a tag, handling AND tag components specially:
    
    1. If renaming from filter menu (old_tag is a component), updates all AND tags
       that contain this component to use the new component name.
    2. If renaming from note/section editor, does standard rename.
    3. Ensures proper synchronization of all affected tags and components.
    """
    old_tag_lower = old_tag.lower()
    
    # Find all AND tags that contain the old_tag as a component
    and_tags_to_update = []
    for known_tag in get_all_known_tags():
        if '&' in known_tag:
            components = parse_and_tag_components(known_tag)
            if any(comp.lower() == old_tag_lower for comp in components):
                and_tags_to_update.append(known_tag)
    
    # If there are AND tags containing this component, we need to update them
    if and_tags_to_update:
        new_and_tags = []
        for and_tag in and_tags_to_update:
            components = parse_and_tag_components(and_tag)
            # Replace the old component with the new one
            updated_components = [new_tag if comp.lower() == old_tag_lower else comp for comp in components]
            new_and_tag = combine_tags_to_and(updated_components)
            new_and_tags.append((and_tag, new_and_tag))
        
        # Update all AND tags in content and categories
        for old_and_tag, new_and_tag in new_and_tags:
            if old_and_tag != new_and_tag:  # Only update if actually different
                update_content_with_new_tag(old_and_tag, new_and_tag)
                
                # Update in categories
                for category in global_state.document_state.get("tag_categories", []):
                    if old_and_tag in category.get("tags", []):
                        category["tags"] = [new_and_tag if t == old_and_tag else t for t in category["tags"]]
                        category["tags"] = sorted(category["tags"], key=str.lower)
    
    # Always update the individual tag as well
    update_content_with_new_tag(old_tag, new_tag)
    
    # Update in categories  
    for category in global_state.document_state.get("tag_categories", []):
        if old_tag in category.get("tags", []):
            category["tags"] = [new_tag if t == old_tag else t for t in category["tags"]]
            category["tags"] = sorted(category["tags"], key=str.lower)

def is_tag_used_elsewhere(tag_name: str, exclude_section_id: str = None, exclude_note_id: str = None) -> bool:
    """
    Checks if a tag is used anywhere else in the document, optionally excluding
    a specific section or note from the check.
    """
    tag_lower = tag_name.lower()
    
    for section in global_state.document_state.get("sections", []):
        # Check section tags (skip if this is the section being excluded)
        if exclude_section_id != section.get("id"):
            if any(t.lower() == tag_lower for t in section.get("tags", [])):
                return True
        
        # Check note tags within this section
        for note in section.get("notes", []):
            # Skip if this is the note being excluded
            if exclude_note_id and exclude_note_id == note.get("id"):
                continue
            if any(t.lower() == tag_lower for t in note.get("tags", [])):
                return True
    
    return False

def get_and_tags_containing_component(component: str) -> List[str]:
    """
    Returns a list of AND tags that contain the given component.
    """
    component_lower = component.lower()
    and_tags_with_component = []
    
    for known_tag in get_all_known_tags():
        if '&' in known_tag:
            components = parse_and_tag_components(known_tag)
            if any(comp.lower() == component_lower for comp in components):
                and_tags_with_component.append(known_tag)
    
    return and_tags_with_component

def handle_smart_tag_update(old_tags: List[str], new_tags: List[str], exclude_section_id: str = None, exclude_note_id: str = None) -> None:
    """
    Handles intelligent tag updates when editing from note/section editor.
    
    If a tag is being edited and it's the last occurrence of that tag in the document,
    it will also update the tag in the filter menu (categories) accordingly.
    
    Args:
        old_tags: The previous list of tags
        new_tags: The new list of tags
        exclude_section_id: Section ID to exclude from "last occurrence" check
        exclude_note_id: Note ID to exclude from "last occurrence" check
    """
    old_tags_set = set(t.lower() for t in old_tags)
    new_tags_set = set(t.lower() for t in new_tags)
    
    # Find tags that were removed
    removed_tags = old_tags_set - new_tags_set
    
    # Find tags that were added
    added_tags = new_tags_set - old_tags_set
    
    # For removed tags, check if they were the last occurrence
    for removed_tag_lower in removed_tags:
        # Find the original case of the removed tag
        removed_tag = next((t for t in old_tags if t.lower() == removed_tag_lower), None)
        if removed_tag:
            # Check if this tag is used elsewhere
            if not is_tag_used_elsewhere(removed_tag, exclude_section_id, exclude_note_id):
                # This was the last occurrence - remove from categories too
                delete_tag_from_all_categories(removed_tag)
                
                # Also remove from known_tags if it's not a component of any AND tag
                and_tags_containing = get_and_tags_containing_component(removed_tag)
                if not and_tags_containing:
                    global_state.document_state.setdefault("known_tags", set()).discard(removed_tag)
    
    # Handle tag renames (when there's a 1:1 mapping between old and new)
    if len(removed_tags) == 1 and len(added_tags) == 1:
        removed_tag_lower = list(removed_tags)[0]
        added_tag_lower = list(added_tags)[0]
        
        # Find the original case tags
        removed_tag = next((t for t in old_tags if t.lower() == removed_tag_lower), None)
        added_tag = next((t for t in new_tags if t.lower() == added_tag_lower), None)
        
        if removed_tag and added_tag:
            # Check if this was the last occurrence of the old tag
            if not is_tag_used_elsewhere(removed_tag, exclude_section_id, exclude_note_id):
                # This was the last occurrence - rename in categories too
                found_in_category = False
                for category in global_state.document_state.get("tag_categories", []):
                    if removed_tag in category.get("tags", []):
                        category["tags"] = [added_tag if t == removed_tag else t for t in category["tags"]]
                        category["tags"] = sorted(category["tags"], key=str.lower)
                        found_in_category = True
                        break
                
                if not found_in_category:
                    # Tag wasn't in any category, add the new tag to uncategorized
                    sync_known_tags([added_tag])
                
                # Update in known_tags
                if removed_tag in global_state.document_state.get("known_tags", set()):
                    global_state.document_state["known_tags"].discard(removed_tag)
                    global_state.document_state.setdefault("known_tags", set()).add(added_tag)

def remove_tag_globally(tag_to_remove: str) -> Dict[str, Any]:
    """
    Remove a tag from all sections and notes globally.
    If it's an AND tag, also remove orphaned components.
    """
    changes_made = False
    
    # Remove from sections
    for section in global_state.document_state.get('sections', []):
        if tag_to_remove in section.get('tags', []):
            section['tags'] = [tag for tag in section['tags'] if tag != tag_to_remove]
            changes_made = True
        
        # Remove from notes within sections
        for note in section.get('notes', []):
            if tag_to_remove in note.get('tags', []):
                note['tags'] = [tag for tag in note['tags'] if tag != tag_to_remove]
                changes_made = True
    
    # Remove from top-level notes
    for note in global_state.document_state.get('notes', []):
        if tag_to_remove in note.get('tags', []):
            note['tags'] = [tag for tag in note['tags'] if tag != tag_to_remove]
            changes_made = True
    
    if changes_made:
        # Remove from tag categories
        for category in global_state.document_state.get('tag_categories', []):
            if tag_to_remove in category.get('tags', []):
                category['tags'].remove(tag_to_remove)
        
        # If the removed tag was an AND tag, check for orphaned components
        if '&' in tag_to_remove:
            remove_orphaned_components(tag_to_remove)
        
        # Sync known_tags and categories
        sync_known_tags()
        
        return {'success': True, 'message': f"Tag '{tag_to_remove}' removed from all content"}
    else:
        return {'success': False, 'message': f"Tag '{tag_to_remove}' not found in any content"}

def remove_orphaned_components(removed_and_tag: str) -> None:
    """
    Remove components of an AND tag that are no longer used elsewhere.
    This implements the rule: if components only exist in the removed AND tag,
    they should be removed as well.
    """
    components = parse_and_tag_components(removed_and_tag)
    used_tags = get_all_used_tags()
    
    for component in components:
        # Check if this component exists elsewhere
        component_used_elsewhere = False
        
        for used_tag in used_tags:
            if used_tag == component:
                # Component exists as a standalone tag
                component_used_elsewhere = True
                break
            elif '&' in used_tag and used_tag != removed_and_tag:
                # Component exists in another AND tag
                other_components = parse_and_tag_components(used_tag)
                if component in other_components:
                    component_used_elsewhere = True
                    break
        
        # If component is not used elsewhere, remove it globally
        if not component_used_elsewhere:
            remove_tag_globally(component)

def rename_tag_globally(old_tag: str, new_tag: str) -> Dict[str, Any]:
    """
    Rename a tag in all sections and notes globally.
    """
    if old_tag == new_tag:
        return {'success': False, 'message': 'Old and new tag names are the same'}
    
    changes_made = False
    
    # Rename in sections
    for section in global_state.document_state.get('sections', []):
        section_tags = section.get('tags', [])
        if old_tag in section_tags:
            section['tags'] = [new_tag if tag == old_tag else tag for tag in section_tags]
            changes_made = True
        
        # Rename in notes within sections
        for note in section.get('notes', []):
            note_tags = note.get('tags', [])
            if old_tag in note_tags:
                note['tags'] = [new_tag if tag == old_tag else tag for tag in note_tags]
                changes_made = True
    
    # Rename in top-level notes
    for note in global_state.document_state.get('notes', []):
        note_tags = note.get('tags', [])
        if old_tag in note_tags:
            note['tags'] = [new_tag if tag == old_tag else tag for tag in note_tags]
            changes_made = True
    
    if changes_made:
        # Update tag categories to rename the tag there too
        for category in global_state.document_state.get('tag_categories', []):
            if old_tag in category.get('tags', []):
                category['tags'] = [new_tag if tag == old_tag else tag for tag in category['tags']]
                category['tags'].sort(key=str.lower)
        
        # Sync known_tags and categories
        sync_known_tags()
        
        return {'success': True, 'message': f"Tag '{old_tag}' renamed to '{new_tag}' in all content"}
    else:
        return {'success': False, 'message': f"Tag '{old_tag}' not found in any content"}

def remove_and_tag_component(state_name: str, and_tag_name: str, component_to_remove: str) -> Dict[str, Any]:
    """
    Remove a component from an AND tag across all sections and notes.
    Uses the new approach: find the tag globally and replace it everywhere.
    
    Args:
        state_name: The name of the state (might not be used if working with global state)
        and_tag_name: The full AND tag name (e.g., "tag1&tag2&tag3")
        component_to_remove: The component to remove (e.g., "tag2")
    
    Returns:
        Dict with 'success' boolean and optional 'message'
    """
    # Normalize the AND tag name - convert to format without spaces for consistency
    normalized_and_tag = and_tag_name.replace(' & ', '&').replace(' &', '&').replace('& ', '&')
    
    # Parse the AND tag components
    components = parse_and_tag_components(normalized_and_tag)
    
    # Validate the component exists in the AND tag
    if component_to_remove not in components:
        return {
            'success': False, 
            'message': f"Component '{component_to_remove}' not found in AND tag '{and_tag_name}'"
        }
    
    # Calculate remaining components
    remaining_components = [c for c in components if c != component_to_remove]
    
    if len(remaining_components) == 0:
        # Should not happen with proper UI, but handle gracefully
        return {
            'success': False,
            'message': "Cannot remove the last component from an AND tag"
        }
    
    # Determine the replacement tag (use format without spaces for consistency)
    if len(remaining_components) == 1:
        replacement_tag = remaining_components[0]
    else:
        replacement_tag = '&'.join(sorted(remaining_components, key=str.lower))
    
    # Use global tag renaming to replace the AND tag everywhere
    result = rename_tag_globally(normalized_and_tag, replacement_tag)
    
    if result['success']:
        # Check if the removed component is now orphaned and should be removed
        used_tags = get_all_used_tags()
        component_used_elsewhere = False
        
        # Check if component exists as standalone tag or in other AND tags
        for used_tag in used_tags:
            if used_tag == component_to_remove:
                component_used_elsewhere = True
                break
            elif '&' in used_tag:
                other_components = parse_and_tag_components(used_tag)
                if component_to_remove in other_components:
                    component_used_elsewhere = True
                    break
        
        # If component is orphaned, remove it from categories
        if not component_used_elsewhere:
            for category in global_state.document_state.get('tag_categories', []):
                if component_to_remove in category.get('tags', []):
                    category['tags'].remove(component_to_remove)
        
        return {
            'success': True,
            'message': f"Successfully removed '{component_to_remove}' from '{and_tag_name}'. New tag: '{replacement_tag}'"
        }
    else:
        return result

def intelligent_tag_processing(old_tags: List[str], new_input: str) -> List[str]:
    """
    Intelligently processes tag input by combining old tags with new input.
    
    Logic:
    - If new_input is empty, return old_tags
    - Parse new_input into individual tags (split by comma)
    - If old_tags contains AND tags or multiple tags, combine all into a single AND tag
    - If old_tags is empty, return parsed new_input
    - Handle AND tag expansion and combination intelligently
    
    Args:
        old_tags: List of existing tags
        new_input: String input from user (comma-separated tags)
        
    Returns:
        List of processed tags
    """
    if not new_input or not new_input.strip():
        return old_tags
    
    # Parse new input into individual tags
    input_tags = [tag.strip() for tag in new_input.split(',') if tag.strip()]
    
    if not input_tags:
        return old_tags
    
    # If no old tags, return the new input tags as-is
    if not old_tags:
        return input_tags
    
    # Collect all individual components from old tags
    all_components = []
    for tag in old_tags:
        if '&' in tag:
            # This is an AND tag, extract its components
            components = parse_and_tag_components(tag)
            all_components.extend(components)
        else:
            # Single tag
            all_components.append(tag)
    
    # Add new input components
    for tag in input_tags:
        if '&' in tag:
            # New input contains AND tag, extract components
            components = parse_and_tag_components(tag)
            all_components.extend(components)
        else:
            # Single tag
            all_components.append(tag)
    
    # Remove duplicates and sort
    unique_components = sorted(list(set(all_components)), key=str.lower)
    
    # If we have multiple components, combine them into an AND tag
    if len(unique_components) > 1:
        return [combine_tags_to_and(unique_components)]
    elif len(unique_components) == 1:
        return unique_components
    else:
        return old_tags
