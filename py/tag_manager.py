# --- Category Deletion Logic ---
def delete_category_and_associated_tags(category_name: str) -> dict:
    """
    Deletes a category and removes all its tags from the global known_tags list.
    Returns a dict with the deleted category info and affected tags.
    """
    category_name_lower = category_name.lower()
    deleted_category = None
    affected_tags = []
    
    # Find and remove the category
    for i, category in enumerate(core.document_state.get("tag_categories", [])):
        if category.get("name", "").lower() == category_name_lower:
            deleted_category = category
            affected_tags = category.get("tags", [])
            core.document_state["tag_categories"].pop(i)
            break
    
    if deleted_category:
        # Remove affected tags from known_tags if they're not used elsewhere
        for tag in affected_tags:
            tag_used_elsewhere = False
            # Check if tag is used in other categories
            for other_category in core.document_state.get("tag_categories", []):
                if tag in other_category.get("tags", []):
                    tag_used_elsewhere = True
                    break
            # Check if tag is used in sections or notes
            if not tag_used_elsewhere:
                for section in core.document_state.get("sections", []):
                    if tag in section.get("tags", []):
                        tag_used_elsewhere = True
                        break
                    for note in section.get("notes", []):
                        if tag in note.get("tags", []):
                            tag_used_elsewhere = True
                            break
            # Remove from known_tags if not used elsewhere
            if not tag_used_elsewhere and tag in core.document_state.get("known_tags", []):
                core.document_state["known_tags"].remove(tag)
    
    return {
        "deleted_category": deleted_category,
        "affected_tags": affected_tags
    }
import uuid
import copy
from typing import List, Set, Dict, Optional
import py.core as core
import json
from datetime import datetime
import os

def should_show_content_for_filter(content_tags, content_categories, filter_tag):
    """
    Determines if content should be shown based on the filter tag.
    Handles both singular tags and AND tags.
    """
    if not filter_tag:
        return True
    
    # Handle AND tags (containing '&')
    if '&' in filter_tag:
        components = [comp.strip() for comp in filter_tag.split('&')]
        # Content must have ALL components
        return all(comp in content_tags for comp in components)
    else:
        # Handle singular tags - content must have the tag
        return filter_tag in content_tags

# --- Logging helper ---
def log_tag_deletion(action: str, tag: str, details: str = "", before=None, after=None, context=None):
    """
    Logs tag deletion events for debugging and audit purposes.
    """
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "action": action,
        "tag": tag,
        "details": details,
        "before": before,
        "after": after,
        "context": context or {}
    }
    
    # Log to file
    log_dir = "logs"
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    log_file = os.path.join(log_dir, f"tag_deletions_{datetime.now().strftime('%Y-%m-%d')}.log")
    with open(log_file, 'a', encoding='utf-8') as f:
        f.write(json.dumps(log_entry) + '\n')

# --- Helper for AND tags ---
def combine_tags_to_and(tags: List[str]) -> str:
    """Combines a list of tags into an AND tag format."""
    return "&".join(sorted(tags))

def parse_and_tag_components(tag_name: str) -> List[str]:
    """Parses an AND tag into its component tags."""
    if '&' in tag_name:
        return [comp.strip() for comp in tag_name.split('&')]
    return [tag_name]

# --- Tag Management Logic ---

def get_all_tags_in_use() -> Set[str]:
    """Returns a set of all tags currently in use in sections and notes."""
    used_tags = set()
    for section in core.document_state.get("sections", []):
        used_tags.update(section.get("tags", []))
        for note in section.get("notes", []):
            used_tags.update(note.get("tags", []))
    for note in core.document_state.get("notes", []):
        used_tags.update(note.get("tags", []))
    return used_tags

def get_all_known_tags() -> List[str]:
    """Returns a sorted list of all known tags."""
    return sorted(core.document_state.get("known_tags", []), key=str.lower)

def get_all_tags_for_suggestion() -> List[str]:
    """Returns a list of all tags available for suggestions."""
    all_tags = set()
    # Add known tags
    all_tags.update(core.document_state.get("known_tags", []))
    # Add AND tags
    all_tags.update(core.document_state.get("and_tags", []))
    return sorted(list(all_tags), key=str.lower)

def get_all_used_tags() -> Set[str]:
    """Returns a set of all tags currently used in content."""
    used_tags = set()
    for section in core.document_state.get("sections", []):
        used_tags.update(section.get("tags", []))
        for note in section.get("notes", []):
            used_tags.update(note.get("tags", []))
    for note in core.document_state.get("notes", []):
        used_tags.update(note.get("tags", []))
    return used_tags

def get_available_tags() -> Set[str]:
    """Returns a set of all available tags (known + used)."""
    available_tags = set()
    available_tags.update(core.document_state.get("known_tags", []))
    available_tags.update(get_all_used_tags())
    return available_tags

def get_and_tags() -> List[str]:
    """Returns a list of all AND tags."""
    return core.document_state.get("and_tags", [])

def add_and_tag(and_tag: str) -> bool:
    """Adds an AND tag to the list if it doesn't already exist."""
    if and_tag not in core.document_state.get("and_tags", []):
        core.document_state.setdefault("and_tags", []).append(and_tag)
        return True
    return False

def remove_and_tag(and_tag: str) -> bool:
    """Removes an AND tag from the list."""
    if and_tag in core.document_state.get("and_tags", []):
        core.document_state["and_tags"].remove(and_tag)
        return True
    return False

def update_and_tag(old_tag: str, new_tag: str) -> bool:
    """Updates an AND tag in the list."""
    and_tags = core.document_state.get("and_tags", [])
    if old_tag in and_tags:
        index = and_tags.index(old_tag)
        and_tags[index] = new_tag
        return True
    return False

def sync_known_tags(new_tags: List[str] = None) -> None:
    """
    Synchronizes the known_tags list with all tags currently in use.
    Optionally adds new tags to the list.
    """
    if new_tags:
        for tag in new_tags:
            if tag not in core.document_state.get("known_tags", []):
                core.document_state.setdefault("known_tags", []).append(tag)
    
    # Ensure known_tags is sorted
    core.document_state["known_tags"] = sorted(core.document_state.get("known_tags", []), key=str.lower)

def get_all_categorized_tags() -> Set[str]:
    """Returns a set of all tags that are assigned to categories."""
    categorized_tags = set()
    for category in core.document_state.get("tag_categories", []):
        categorized_tags.update(category.get("tags", []))
    return set(categorized_tags)

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

def is_category_tag(tag: str) -> bool:
    """
    Returns True if the tag is a reserved CATEGORY tag (not a regular tag).
    Convention: CATEGORY tags are uppercase and not used in notes/sections.
    """
    reserved_tags = {"ALL", "UNCATEGORIZED"}
    return tag.strip().upper() in reserved_tags

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
        category["tags"] = [tag for tag in category.get("tags") if tag in used_tags]
        category["tags"] = sorted(list(set(category["tags"])), key=str.lower)
    # Remove reserved tags from categories
    for category in core.document_state.get("tag_categories", []):
        category["tags"] = [tag for tag in category["tags"] if tag not in reserved_tags]
    # Persist the cleaned state immediately if possible
    if hasattr(core, 'save_state'):
        core.save_state()