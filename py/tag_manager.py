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
    """
    unique_sorted_tags = sorted(list(set(tags)), key=str.lower)
    return "&".join(unique_sorted_tags)

def parse_and_tag_components(tag_name: str) -> List[str]:
    """
    Parses an AND tag string (e.g., "A&B") into its individual components.
    If the tag is not an AND tag, returns a list containing the original tag.
    """
    if '&' in tag_name:
        return sorted(tag_name.split('&'), key=str.lower) # Ensure components are also sorted
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
    """Returns a sorted list of all tags the application is aware of."""
    return sorted(list(global_state.document_state.get("known_tags", set())), key=str.lower)

def sync_known_tags(new_tags: List[str]) -> None:
    """
    Ensures that a list of new tags (including potentially new AND tags)
    is added to the master 'known_tags' set and placed into the 'Uncategorized' category
    if they are not already in any existing category.
    """
    # First, add all new_tags to the global known_tags set
    global_state.document_state.setdefault("known_tags", set()).update(new_tags)
    
    uncategorized_category = None
    for cat in global_state.document_state.get("tag_categories", []):
        if cat['name'].lower() == 'uncategorized':
            uncategorized_category = cat
            break
    
    if uncategorized_category:
        # Get all tags currently assigned to any category (to avoid re-adding)
        current_categorized_tags = get_all_categorized_tags()
        
        for tag in new_tags:
            # Only add to Uncategorized if it's a new tag OR if it's known but currently uncategorized
            # The 'All' tag is explicitly handled on state creation, so it should be there.
            if tag.lower() != 'all' and tag not in current_categorized_tags and '&' not in tag:
                uncategorized_category['tags'].append(tag)
        
        # Deduplicate and re-sort uncategorized tags
        uncategorized_category['tags'] = sorted(list(dict.fromkeys(uncategorized_category['tags'])), key=str.lower)
    else: 
        # Fallback: create Uncategorized if somehow missing (should be caught by load_state/create_default_state)
        global_state.document_state.setdefault("tag_categories", []).insert(0, {"id": str(uuid.uuid4()), "name": "Uncategorized", "tags": sorted([t for t in new_tags if '&' not in t])})


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
    """
    old_tag_lower = old_tag.lower()
    for section in global_state.document_state.get("sections", []):
        # Update section tags
        section_tags_updated = [new_tag if t.lower() == old_tag_lower else t for t in section.get("tags", [])]
        section['tags'] = list(dict.fromkeys(section_tags_updated)) # Deduplicate and assign
        
        # Update note tags within sections
        for note in section.get("notes", []):
            note_tags_updated = [new_tag if t.lower() == old_tag_lower else t for t in note.get("tags", [])]
            note['tags'] = list(dict.fromkeys(note_tags_updated)) # Deduplicate and assign
    
    # Ensure known_tags is consistent
    if old_tag_lower != new_tag.lower(): # Avoid removing new_tag if it just replaced old_tag
        if old_tag in global_state.document_state.get("known_tags", set()):
            global_state.document_state["known_tags"].discard(old_tag)
        global_state.document_state.setdefault("known_tags", set()).add(new_tag)
    
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