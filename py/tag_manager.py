import uuid
import copy
from typing import List, Dict, Set, Optional, Any
import py.core as core
import json
from datetime import datetime
import os

def should_show_content_for_filter(content_tags, filter_tag):
    """
    Returns True if the content (section/note) should be shown for the given filter_tag.
    Supports both singular tags and AND tags (e.g., 'A&B').
    """
    if not filter_tag:
        return True
    # AND tag: must match all components
    if '&' in filter_tag:
        required = [t.strip() for t in filter_tag.split('&')]
        return all(t in content_tags for t in required)
    # Singular tag: match any
    return filter_tag in content_tags

# --- Logging helper ---
def log_tag_deletion(action: str, tag: str, details: str = "", before=None, after=None, context=None):
    log_entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "action": action,
        "tag": tag,
        "details": details,
        "before": before,
        "after": after,
        "context": context
    }
    log_path = os.path.join(os.path.dirname(__file__), '..', 'logs', 'backend_tag_deletion.log')
    try:
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(json.dumps(log_entry) + "\n")
    except Exception as e:
        pass  # Avoid crashing if logging fails

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
    for section in core.document_state.get("sections", []):
        in_use_tags.update(section.get("tags", []))
        for note in section.get("notes", []):
            in_use_tags.update(note.get("tags", []))
    # Ensure all known_tags are included
    in_use_tags.update(core.document_state.get("known_tags", []))
    return in_use_tags

def get_all_known_tags() -> List[str]:
    """
    Returns a sorted list of all tags that are available for filtering,
    including any tag attached to a category, even if not used in content.
    """
    # Collect tags from notes/sections
    available_tags = get_available_tags()
    # Add tags from categories
    for category in core.document_state.get("tag_categories", []):
        available_tags.update(category.get("tags", []))
    # Remove CATEGORY: tags and all variations of 'all' from the filter menu
    filter_menu_tags = [tag for tag in available_tags if not is_category_tag(tag) and tag.strip().lower() != 'all']
    return sorted(filter_menu_tags, key=str.lower)

def get_all_tags_for_suggestion() -> List[str]:
    """
    Returns all tags for suggestion/autocomplete, including 'all' and CATEGORY tags.
    """
    available_tags = get_available_tags()
    for category in core.document_state.get("tag_categories", []):
        available_tags.update(category.get("tags", []))
    # Remove all variations of 'all' from suggestions
    filtered_tags = [tag for tag in available_tags if tag.strip().lower() != 'all']
    return sorted(filtered_tags, key=str.lower)

def get_all_used_tags() -> Set[str]:
    """
    Get all tags that are actually used in sections and notes.
    This function now allows singular tags that contain '&' characters.
    """
    used_tags = set()
    
    # Collect from sections
    for section in core.document_state.get('sections', []):
        # Allow tags with '&' but filter out AND tag format (tags with "&" as a separate component)
        used_tags.update(section.get('tags', []))
        
        # Collect from notes within sections
        for note in section.get('notes', []):
            used_tags.update(note.get('tags', []))
    
    # Collect from top-level notes
    for note in core.document_state.get('notes', []):
        used_tags.update(note.get('tags', []))
    
    return used_tags

def get_available_tags() -> Set[str]:
    """
    Get all singular tags available for use in content.
    These are auto-populated from actual usage in sections and notes.
    AND tags are not included here as they cannot be used in content.
    """
    return get_all_used_tags()

def get_and_tags() -> List[str]:
    """
    Returns a sorted list of all manually created AND tags.
    These are stored separately from content tags and are used for filtering only.
    """
    and_tags = core.document_state.get("and_tags", [])
    return sorted([tag for tag in and_tags if '&' in tag], key=str.lower)

def add_and_tag(and_tag: str) -> bool:
    """
    Add a new AND tag to the manually created list.
    Returns True if added, False if it already exists.
    """
    if "and_tags" not in core.document_state:
        core.document_state["and_tags"] = []
    
    if and_tag not in core.document_state["and_tags"]:
        core.document_state["and_tags"].append(and_tag)
        core.document_state["and_tags"] = sorted(list(set(core.document_state["and_tags"])), key=str.lower)
        return True
    return False

def remove_and_tag(and_tag: str) -> bool:
    """
    Remove an AND tag from the manually created list.
    Returns True if removed, False if it didn't exist.
    """
    if "and_tags" not in core.document_state:
        return False
    
    if and_tag in core.document_state["and_tags"]:
        core.document_state["and_tags"].remove(and_tag)
        return True
    return False

def update_and_tag(old_tag: str, new_tag: str) -> bool:
    """
    Update an AND tag in the manually created list.
    Returns True if updated, False if old tag didn't exist.
    """
    if remove_and_tag(old_tag):
        add_and_tag(new_tag)
        # Ensure AND tags are unique and sorted
        core.document_state["and_tags"] = sorted(list(set(core.document_state["and_tags"])), key=str.lower)
        return True
    return False

def sync_known_tags(new_tags: List[str] = None) -> None:
    """
    Sync known_tags with actually used tags. This maintains backward compatibility
    but now known_tags is derived from actual usage, not manually maintained.
    Also ensures new tags are added to the Uncategorized category.
    """
    # Always treat known_tags as a set internally
    if 'known_tags' not in core.document_state:
        core.document_state['known_tags'] = set()
    if isinstance(core.document_state['known_tags'], list):
        state_known_tags = set(core.document_state['known_tags'])
    else:
        state_known_tags = core.document_state['known_tags']
    # Optionally add new_tags
    if new_tags:
        state_known_tags.update(new_tags)
    category_tags = set()
    for category in core.document_state.get('tag_categories', []):
        category_tags.update([tag for tag in category.get('tags', []) if not _is_category_tag(tag)])
def _is_category_tag(tag: str) -> bool:
    """Returns True if the tag is a reserved category tag (e.g. 'All'), False otherwise."""
    # You can expand this logic if you have more reserved category tags
    return tag.strip().lower() == 'all'
# --- Utility: Identify if a tag is a CATEGORY tag (not a regular tag) ---
def is_category_tag(tag: str) -> bool:
    """
    Returns True if the tag is a reserved CATEGORY tag (not a regular tag).
    CATEGORY tags are typically used for system/logic, not user tagging.
    Convention: CATEGORY tags are uppercase and not used in notes/sections.
    """
    # You may adjust this logic if you have more reserved tags
    reserved_tags = {"ALL", "UNCATEGORIZED"}
    return tag.strip().upper() in reserved_tags
    used_tags = get_all_used_tags()
    all_tags = state_known_tags.union(category_tags).union(used_tags)
    # Remove all variations of 'all' from tags (case-insensitive)
    all_tags = {tag for tag in all_tags if tag.strip().lower() != 'all'}
    # Save as sorted list for serialization
    core.document_state['known_tags'] = sorted(list(all_tags), key=str.lower)
    # Update tag categories to include all their tags, sorted, and exclude CATEGORY tags and 'all'
    for category in core.document_state.get('tag_categories', []):
        category['tags'] = [tag for tag in category.get('tags', []) if not is_category_tag(tag) and tag.strip().lower() != 'all']
        category['tags'] = sorted(list(set(category['tags'])), key=str.lower)


def get_all_categorized_tags() -> Set[str]:
    """Returns a set of all tags currently assigned to any category."""
    categorized_tags = set()
    for category in core.document_state.get("tag_categories", []):
        categorized_tags.update(category.get("tags", []))
    return set(categorized_tags)

def get_uncategorized_tags() -> List[str]:
    """Returns a sorted list of tags specifically assigned to the 'Uncategorized' category, excluding CATEGORY tags."""
    # Deprecated: No longer used. Return empty list.
    return []



def get_primary_category_for_tag(tag_name: str) -> Optional[Dict]:
    """
    Finds the category object that explicitly contains the given tag.
    Returns the category object or None if not found in any explicit category.
    """
    # Deprecated: Tags can belong to multiple categories. Use get_categories_for_tag instead.
    return None

def get_categories_for_tag(tag_name: str) -> list:
    """
    Returns a list of category objects that contain the given tag.
    """
    categories = []
    for category in core.document_state.get("tag_categories", []):
        if tag_name in category.get('tags', []):
            categories.append(category)
    return categories

def delete_tag_from_all_categories(tag_name: str) -> None:
    """Removes a given tag from all categories it might reside in."""
    for category in core.document_state.get("tag_categories", []):
        if tag_name in category.get("tags", []):
            category["tags"].remove(tag_name)
    # Remove duplicates and sort after all removals
    for category in core.document_state.get("tag_categories", []):
        category["tags"] = sorted(list(set(category["tags"])), key=str.lower)


def update_content_with_new_tag(old_tag: str, new_tag: str) -> None:
    """
    Updates all occurrences of old_tag with new_tag in sections and notes.
    Removes old_tag from known_tags if it's no longer used outside of new_tag's components.
    Also handles AND tag component updates properly.
    """
    old_tag_lower = old_tag.lower()
    
    # Collect all tags that will be added due to this rename
    tags_to_sync = [new_tag]
    # Only parse components if new_tag is a manually created AND tag
    manual_and_tags = core.document_state.get("and_tags", [])
    if new_tag in manual_and_tags:
        tags_to_sync.extend(parse_and_tag_components(new_tag))
    
    for section in core.document_state.get("sections", []):
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
        if old_tag in core.document_state.get("known_tags", set()):
            core.document_state["known_tags"].discard(old_tag)
    
    cleanup_orphan_tags() # Reconcile global known_tags and categorized lists


def get_primary_category_for_tag(tag_name: str) -> Optional[Dict]:
    """
    Finds the category object that explicitly contains the given tag.
    Returns the category object or None if not found in any explicit category.
    """
    # Deprecated: Tags can belong to multiple categories. Use get_categories_for_tag instead.
    return None

def get_categories_for_tag(tag_name: str) -> list:
    """
    Returns a list of category objects that contain the given tag.
    """
    categories = []
    for category in core.document_state.get("tag_categories", []):
        if tag_name in category.get('tags', []):
            categories.append(category)
    return categories

def delete_tag_from_all_categories(tag_name: str) -> None:
    """Removes a given tag from all categories it might reside in."""
    for category in core.document_state.get("tag_categories", []):
        if tag_name in category.get("tags", []):
            category["tags"].remove(tag_name)
    # Remove duplicates and sort after all removals
    for category in core.document_state.get("tag_categories", []):
        category["tags"] = sorted(list(set(category["tags"])), key=str.lower)


def update_content_with_new_tag(old_tag: str, new_tag: str) -> None:
    """
    Updates all occurrences of old_tag with new_tag in sections and notes.
    Removes old_tag from known_tags if it's no longer used outside of new_tag's components.
    Also handles AND tag component updates properly.
    """
    old_tag_lower = old_tag.lower()
    
    # Collect all tags that will be added due to this rename
    tags_to_sync = [new_tag]
    # Only parse components if new_tag is a manually created AND tag
    manual_and_tags = core.document_state.get("and_tags", [])
    if new_tag in manual_and_tags:
        tags_to_sync.extend(parse_and_tag_components(new_tag))
    
    for section in core.document_state.get("sections", []):
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
        if old_tag in core.document_state.get("known_tags", set()):
            core.document_state["known_tags"].discard(old_tag)
    
    cleanup_orphan_tags() # Reconcile global known_tags and categorized lists


def get_primary_category_for_tag(tag_name: str) -> Optional[Dict]:
    """
    Finds the category object that explicitly contains the given tag.
    Returns the category object or None if not found in any explicit category.
    """
    # Deprecated: Tags can belong to multiple categories. Use get_categories_for_tag instead.
    return None

def get_categories_for_tag(tag_name: str) -> list:
    """
    Returns a list of category objects that contain the given tag.
    """
    categories = []
    for category in core.document_state.get("tag_categories", []):
        if tag_name in category.get('tags', []):
            categories.append(category)
    return categories

def delete_tag_from_all_categories(tag_name: str) -> None:
    """Removes a given tag from all categories it might reside in."""
    for category in core.document_state.get("tag_categories", []):
        if tag_name in category.get("tags", []):
            category["tags"].remove(tag_name)
    # Remove duplicates and sort after all removals
    for category in core.document_state.get("tag_categories", []):
        category["tags"] = sorted(list(set(category["tags"])), key=str.lower)


def update_content_with_new_tag(old_tag: str, new_tag: str) -> None:
    """
    Updates all occurrences of old_tag with new_tag in sections and notes.
    Removes old_tag from known_tags if it's no longer used outside of new_tag's components.
    Also handles AND tag component updates properly.
    """
    old_tag_lower = old_tag.lower()
    
    # Collect all tags that will be added due to this rename
    tags_to_sync = [new_tag]
    # Only parse components if new_tag is a manually created AND tag
    manual_and_tags = core.document_state.get("and_tags", [])
    if new_tag in manual_and_tags:
        tags_to_sync.extend(parse_and_tag_components(new_tag))
    
    for section in core.document_state.get("sections", []):
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
        if old_tag in core.document_state.get("known_tags", set()):
            core.document_state["known_tags"].discard(old_tag)
    
    cleanup_orphan_tags() # Reconcile global known_tags and categorized lists


def get_primary_category_for_tag(tag_name: str) -> Optional[Dict]:
    """
    Finds the category object that explicitly contains the given tag.
    Returns the category object or None if not found in any explicit category.
    """
    # Deprecated: Tags can belong to multiple categories. Use get_categories_for_tag instead.
    return None

def get_categories_for_tag(tag_name: str) -> list:
    """
    Returns a list of category objects that contain the given tag.
    """
    categories = []
    for category in core.document_state.get("tag_categories", []):
        if tag_name in category.get('tags', []):
            categories.append(category)
    return categories

def delete_tag_from_all_categories(tag_name: str) -> None:
    """Removes a given tag from all categories it might reside in."""
    for category in core.document_state.get("tag_categories", []):
        if tag_name in category.get("tags", []):
            category["tags"].remove(tag_name)
    # Remove duplicates and sort after all removals
    for category in core.document_state.get("tag_categories", []):
        category["tags"] = sorted(list(set(category["tags"])), key=str.lower)


def update_content_with_new_tag(old_tag: str, new_tag: str) -> None:
    """
    Updates all occurrences of old_tag with new_tag in sections and notes.
    Removes old_tag from known_tags if it's no longer used outside of new_tag's components.
    Also handles AND tag component updates properly.
    """
    old_tag_lower = old_tag.lower()
    
    # Collect all tags that will be added due to this rename
    tags_to_sync = [new_tag]
    # Only parse components if new_tag is a manually created AND tag
    manual_and_tags = core.document_state.get("and_tags", [])
    if new_tag in manual_and_tags:
        tags_to_sync.extend(parse_and_tag_components(new_tag))
    
    for section in core.document_state.get("sections", []):
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
        if old_tag in core.document_state.get("known_tags", set()):
            core.document_state["known_tags"].discard(old_tag)
    
    cleanup_orphan_tags() # Reconcile global known_tags and categorized lists


def get_primary_category_for_tag(tag_name: str) -> Optional[Dict]:
    """
    Finds the category object that explicitly contains the given tag.
    Returns the category object or None if not found in any explicit category.
    """
    # Deprecated: Tags can belong to multiple categories. Use get_categories_for_tag instead.
    return None

def get_categories_for_tag(tag_name: str) -> list:
    """
    Returns a list of category objects that contain the given tag.
    """
    categories = []
    for category in core.document_state.get("tag_categories", []):
        if tag_name in category.get('tags', []):
            categories.append(category)
    return categories

def delete_tag_from_all_categories(tag_name: str) -> None:
    """Removes a given tag from all categories it might reside in."""
    for category in core.document_state.get("tag_categories", []):
        if tag_name in category.get("tags", []):
            category["tags"].remove(tag_name)
    # Remove duplicates and sort after all removals
    for category in core.document_state.get("tag_categories", []):
        category["tags"] = sorted(list(set(category["tags"])), key=str.lower)


def update_content_with_new_tag(old_tag: str, new_tag: str) -> None:
    """
    Updates all occurrences of old_tag with new_tag in sections and notes.
    Removes old_tag from known_tags if it's no longer used outside of new_tag's components.
    Also handles AND tag component updates properly.
    """
    old_tag_lower = old_tag.lower()
    
    # Collect all tags that will be added due to this rename
    tags_to_sync = [new_tag]
    # Only parse components if new_tag is a manually created AND tag
    manual_and_tags = core.document_state.get("and_tags", [])
    if new_tag in manual_and_tags:
        tags_to_sync.extend(parse_and_tag_components(new_tag))
    
    for section in core.document_state.get("sections", []):
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
        if old_tag in core.document_state.get("known_tags", set()):
            core.document_state["known_tags"].discard(old_tag)
    
    cleanup_orphan_tags() # Reconcile global known_tags and categorized lists


def get_primary_category_for_tag(tag_name: str) -> Optional[Dict]:
    """
    Finds the category object that explicitly contains the given tag.
    Returns the category object or None if not found in any explicit category.
    """
    # Deprecated: Tags can belong to multiple categories. Use get_categories_for_tag instead.
    return None

def get_categories_for_tag(tag_name: str) -> list:
    """
    Returns a list of category objects that contain the given tag.
    """
    categories = []
    for category in core.document_state.get("tag_categories", []):
        if tag_name in category.get('tags', []):
            categories.append(category)
    return categories

def delete_tag_from_all_categories(tag_name: str) -> None:
    """Removes a given tag from all categories it might reside in."""
    for category in core.document_state.get("tag_categories", []):
        if tag_name in category.get("tags", []):
            category["tags"].remove(tag_name)
    # Remove duplicates and sort after all removals
    for category in core.document_state.get("tag_categories", []):
        category["tags"] = sorted(list(set(category["tags"])), key=str.lower)


def update_content_with_new_tag(old_tag: str, new_tag: str) -> None:
    """
    Updates all occurrences of old_tag with new_tag in sections and notes.
    Removes old_tag from known_tags if it's no longer used outside of new_tag's components.
    Also handles AND tag component updates properly.
    """
    old_tag_lower = old_tag.lower()
    
    # Collect all tags that will be added due to this rename
    tags_to_sync = [new_tag]
    # Only parse components if new_tag is a manually created AND tag
    manual_and_tags = core.document_state.get("and_tags", [])
    if new_tag in manual_and_tags:
        tags_to_sync.extend(parse_and_tag_components(new_tag))
    
    for section in core.document_state.get("sections", []):
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
        if old_tag in core.document_state.get("known_tags", set()):
            core.document_state["known_tags"].discard(old_tag)
    
    cleanup_orphan_tags() # Reconcile global known_tags and categorized lists


def cleanup_orphan_tags() -> None:
    """
    Removes any tags from the master 'known_tags' list if they are no longer
    used anywhere in the document (sections, notes, categories).
    Also removes orphan tags from categories if they are no longer known.
    Reserved tags ("all"/"All") are always hidden and never reappear.
    """
    reserved_tags = {"all", "All"}
    uncategorized_names = {"uncategorized", "Uncategorized"}
    # Build set of all tags used in sections and notes
    used_tags = set()
    for section in core.document_state.get('sections', []):
        used_tags.update(section.get('tags', []))
        for note in section.get('notes', []):
            used_tags.update(note.get('tags', []))
    for note in core.document_state.get('notes', []):
        used_tags.update(note.get('tags', []))
    # Also include all tags present in categories EXCEPT 'Uncategorized'
    for category in core.document_state.get('tag_categories', []):
        cat_name = category.get('name', '').strip().lower()
        if cat_name not in uncategorized_names:
            used_tags.update(category.get('tags', []))
    # Remove reserved tags from used_tags
    used_tags -= reserved_tags
    # Force known_tags to be exactly the used tags (no orphans)
    new_known_tags = sorted(list(used_tags), key=str.lower)
    prev_known_tags = set(core.document_state.get("known_tags", []))
    removed_tags = prev_known_tags - set(new_known_tags)
    before_state = list(prev_known_tags)
    after_state = list(new_known_tags)
    core.document_state["known_tags"] = new_known_tags
    # Log any tags that were cleaned up
    for tag in removed_tags:
        log_tag_deletion("cleanup_orphan_tag", tag, "Tag removed from known_tags during orphan cleanup.", before=before_state, after=after_state, context={"removed_tags": list(removed_tags)})
    # Remove orphan tags from categories (tags not in used_tags)
    for category in core.document_state.get("tag_categories", []):
        category["tags"] = [tag for tag in category.get("tags", []) if tag in used_tags]
        category["tags"] = sorted(list(set(category["tags"])), key=str.lower)
    # Remove reserved tags from categories
    for category in core.document_state.get("tag_categories", []):
        category["tags"] = [tag for tag in category["tags"] if tag not in reserved_tags]
    # Persist the cleaned state immediately if possible
    if hasattr(core, 'save_state'):
        core.save_state()