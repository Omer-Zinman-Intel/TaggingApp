# py/content_processor.py
import copy
from typing import List, Dict, Set, Optional
import py.core as core

# --- Content Filtering and Retrieval ---

def get_filtered_sections(active_filters: List[str]) -> List[Dict]:
    """
    Returns a filtered list of sections based on the active filters.
    - Supports both singular tags and AND tags
    - For singular tags: OR logic (shows content with ANY of the selected tags)
    - For AND tags: shows content that contains ALL components of the AND tag
    - A section is shown if it matches OR if it contains notes that match
    - Content tagged with 'All' is always shown
    """
    if not active_filters:
        return core.document_state.get("sections", [])

    filtered_sections = []

    from py import user_config_manager
    username = getattr(core, 'current_username', 'default_user')
    from flask import request
    state_name = request.args.get('state') or request.json.get('state') or 'Default_State'
    user_config = user_config_manager.load_user_config(username)
    completed_notes_by_state = user_config.get('completed_notes', {})
    user_completed_notes = set(completed_notes_by_state.get(state_name, []))

    for section in core.document_state.get("sections", []):
        section_tags = {t.lower() for t in section.get("tags", [])}
        section_categories = section.get("categories", [])
        # The 'All' tag on a section makes it and all its notes immune to filtering
        if 'all' in section_tags:
            filtered_sections.append(copy.deepcopy(section))
            continue

        section_copy = copy.deepcopy(section)
        section_matches = _matches_filters(section_tags, active_filters, section_categories)

        # Filter notes within the section
        visible_notes = []
        for note in section_copy.get("notes", []):
            note_tags = {t.lower() for t in note.get("tags", [])}
            note_categories = note.get("categories", [])
            # Combine direct tags and tags from attached categories
            all_note_tags = set(note_tags)
            for category_id in note_categories:
                for category in core.document_state.get("tag_categories", []):
                    if str(category.get("id")) == str(category_id):
                        all_note_tags.update(tag.lower() for tag in category.get("tags", []))
                        break
            # Attach completed status from user config (per state)
            note['completed'] = note.get('id') in user_completed_notes
            if 'all' in all_note_tags or _matches_filters(all_note_tags, active_filters, note_categories):
                visible_notes.append(note)
        section_copy['notes'] = visible_notes

        # The section should be displayed if the section itself matches or if it has any visible notes
        if section_matches or visible_notes:
            filtered_sections.append(section_copy)
            
    return filtered_sections

def _matches_filters(content_tags: Set[str], active_filters: List[str], content_categories: List[str] = None) -> bool:
    """
    Check if content tags match any of the active filters.
    Enhanced to support CATEGORY tags - content with category tags will be shown
    when filtering by any tag in that category.
    """
    import py.tag_manager as tag_manager
    if content_categories is None:
        content_categories = []
    for filter_tag in active_filters:
        if tag_manager.should_show_content_for_filter(content_tags, content_categories, filter_tag):
            return True
    return False

def find_item(item_id: str, item_type: str) -> Optional[Dict]:
    """Finds a section or note by its ID."""
    for section in core.document_state.get("sections", []):
        if item_type == "section" and section["id"] == item_id:
            return section
        if item_type == "note":
            for note in section.get("notes", []):
                if note["id"] == item_id:
                    return note
    return None

def find_section_and_note(section_id: str, note_id: str) -> tuple[Optional[Dict], Optional[Dict]]:
    """A convenience function to find a note and its parent section."""
    for section in core.document_state.get("sections", []):
        if section["id"] == section_id:
            for note in section.get("notes", []):
                if note["id"] == note_id:
                    return section, note
    return None, None

def _parse_imported_html(html_content: str) -> tuple[List[Dict], Set[str]]:
    """
    Legacy function for parsing imported HTML content.
    This function is kept for backward compatibility but is no longer used
    since the frontend handles imports directly.
    """
    # Return empty results since this function is deprecated
    return [], set()
