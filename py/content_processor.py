# py/content_processor.py
import re
import copy
import uuid
from bs4 import BeautifulSoup
from typing import List, Dict, Set, Optional, Any
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
            for cat_name in note_categories:
                for category in core.document_state.get("tag_categories", []):
                    if category.get("name") == cat_name:
                        all_note_tags.update(tag.lower() for tag in category.get("tags", []))
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

def process_tags_string(tags_str: str) -> List[str]:
    """Converts a comma-separated string of tags into a clean, unique list."""
    if not tags_str: return []
    # Using dict.fromkeys to preserve order and ensure uniqueness
    return list(dict.fromkeys(tag.strip() for tag in tags_str.split(',') if tag.strip()))

def _parse_imported_html(html_content: str) -> tuple[List[Dict], Set[str]]:
    """Helper to parse HTML content into sections and notes."""
    soup = BeautifulSoup(html_content, 'html.parser')
    new_sections: List[Dict] = []
    new_known_tags: Set[str] = set()
    current_section: Optional[Dict] = None


    import os
    def log_action(action: str):
        log_path = os.path.join(os.path.dirname(__file__), '../logs/import_parser.log')
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(f"{action}\n")

    def extract_tags(text: str) -> List[str]:
        tags = re.findall(r'\[([^\]]+)\]', text)
        log_action(f"extract_tags: text='{text}' -> tags={tags}")
        return tags

    def extract_category(text: str):
        matches = re.findall(r'\{\{([^:}]+):\s*\[([^\]]*)\]\}\}', text)
        categories = []
        for cat_name, tags_str in matches:
            cat_name = cat_name.strip()
            tags = [t.strip() for t in re.split(r'[ ,;]+', tags_str) if t.strip()]
            log_action(f"extract_category: cat_name='{cat_name}', tags_str='{tags_str}' -> tags={tags}")
            categories.append((cat_name, tags))
        log_action(f"extract_category: text='{text}' -> categories={categories}")
        return categories if categories else None

    def clean_title(text: str) -> str:
        orig_text = text
        text = re.sub(r'\{\{[^:}]+:\s*\[[^\]]*\]\}\}', '', text)
        text = re.sub(r'\[([^\]]+)]', '', text)
        cleaned = text.strip()
        log_action(f"clean_title: orig='{orig_text}' -> cleaned='{cleaned}'")
        return cleaned

    # Define which HTML tags can become notes (headers) vs. content
    NOTE_TAGS = ['h2', 'h3']
    ALL_TAGS = ['h1'] + NOTE_TAGS + ['p', 'ul', 'ol', 'div', 'pre', 'blockquote', 'h4', 'h5', 'h6']

    pending_content = ''
    from py import tag_manager
    # --- Collect all categories found in the document ---
    all_categories_dict = {}  # name.lower() -> {'name': name, 'tags': set([...])}

    for el in soup.find_all(ALL_TAGS):
        log_action(f"Processing element: tag='{el.name}', text='{el.get_text()}'")
        # H1 creates a new section
        if el.name == 'h1':
            log_action(f"[IMPORT] Handling H1 element: {el.get_text()}")
            if current_section and pending_content and (not current_section.get('notes') or len(current_section['notes']) == 0):
                log_action(f"Creating blank note for pending_content in section id={current_section.get('id')}")
                current_section.setdefault('notes', []).append({
                    'id': str(uuid.uuid4()),
                    'noteTitle': '',
                    'content': pending_content,
                    'tags': []
                })
            pending_content = ''
            if current_section:
                log_action(f"Appending section id={current_section.get('id')}")
                new_sections.append(current_section)
            found_categories = extract_category(el.get_text())
            section_categories = []
            if found_categories:
                log_action(f"[IMPORT] Found categories: {found_categories}")
                for cat_name, cat_tags in found_categories:
                    key = cat_name.lower()
                    if key not in all_categories_dict:
                        all_categories_dict[key] = {'name': cat_name, 'tags': set()}
                    all_categories_dict[key]['tags'].update(cat_tags)
                    section_categories.append({'name': cat_name, 'tags': cat_tags})
                    for t in cat_tags:
                        new_known_tags.add(t)
                    # Add category name itself as a tag to the section
                    if cat_name not in tags:
                        tags.append(cat_name)
                        new_known_tags.add(cat_name)
            tags = extract_tags(el.get_text())
            log_action(f"[IMPORT] Extracted tags: {tags}")
            new_known_tags.update(tags)
            # Do NOT add category tags to tags list unless you want them as regular tags too
            log_action(f"Section tags: {tags}")
            section_title = clean_title(el.get_text())
            log_action(f"Section title: '{section_title}'")
            log_action(f"Section categories: {section_categories}")
            current_section = {"id": str(uuid.uuid4()), "sectionTitle": section_title, "tags": tags, "notes": [], "categories": section_categories}
        elif el.name in NOTE_TAGS:
            if current_section and pending_content and (not current_section.get('notes') or len(current_section['notes']) == 0):
                log_action(f"Creating blank note for pending_content in section id={current_section.get('id')}")
                current_section.setdefault('notes', []).append({
                    'id': str(uuid.uuid4()),
                    'noteTitle': '',
                    'content': pending_content,
                    'tags': []
                })
                pending_content = ''
            found_categories = extract_category(el.get_text())
            note_categories = []
            if found_categories:
                for cat_name, cat_tags in found_categories:
                    key = cat_name.lower()
                    if key not in all_categories_dict:
                        all_categories_dict[key] = {'name': cat_name, 'tags': set()}
                    all_categories_dict[key]['tags'].update(cat_tags)
                    note_categories.append({'name': cat_name, 'tags': cat_tags})
                    for t in cat_tags:
                        new_known_tags.add(t)
                    # Add category name itself as a tag to the note
                    if cat_name not in tags:
                        tags.append(cat_name)
                        new_known_tags.add(cat_name)
            tags = extract_tags(el.get_text())
            new_known_tags.update(tags)
            # Do NOT add category tags to tags list unless you want them as regular tags too
            log_action(f"Note tags: {tags}")
            note_title = clean_title(el.get_text())
            log_action(f"Note title: '{note_title}'")
            note_content = {"id": str(uuid.uuid4()), "noteTitle": note_title, "content": '', "tags": tags, "categories": note_categories}
            current_section.setdefault("notes", []).append(note_content)
        elif current_section:
            if current_section.get("notes"):
                last_note = current_section["notes"][-1]
                last_note["content"] += str(el)
                tags = extract_tags(el.get_text())
                new_known_tags.update(tags)
                last_note["tags"].extend(tags)
                last_note["tags"] = list(dict.fromkeys(last_note["tags"])) # Deduplicate
                log_action(f"Appended content to note id={last_note['id']}, tags added: {tags}")
            else:
                pending_content += str(el)
                log_action(f"Appended content to pending_content for section id={current_section.get('id')}")
    # At the end, if there is pending content and no notes, create a blank note
    if current_section and pending_content and (not current_section.get('notes') or len(current_section['notes']) == 0):
        log_action(f"Creating final blank note for pending_content in section id={current_section.get('id')}")
        current_section.setdefault('notes', []).append({
            'id': str(uuid.uuid4()),
            'noteTitle': '',
            'content': pending_content,
            'tags': []
        })
    if current_section:
        log_action(f"Appending final section id={current_section.get('id')}")
        new_sections.append(current_section)

    # Convert all_categories_dict to a list of category objects with unique tags
    all_categories = []
    # Ensure all categories referenced in notes/sections are present in all_categories_dict
    def ensure_category_obj(cat):
        # cat: dict with 'name' and 'tags'
        key = cat['name'].lower()
        if key not in all_categories_dict:
            all_categories_dict[key] = {'name': cat['name'], 'tags': set(cat['tags'])}
        else:
            all_categories_dict[key]['tags'].update(cat['tags'])

    # Scan all notes/sections for categories and ensure they're in all_categories_dict
    for section in new_sections:
        for cat in section.get('categories', []):
            ensure_category_obj(cat)
        for note in section.get('notes', []):
            for cat in note.get('categories', []):
                ensure_category_obj(cat)

    for cat in all_categories_dict.values():
        all_categories.append({
            'id': str(uuid.uuid4()),
            'name': cat['name'],
            'tags': sorted(list(set(cat['tags'])), key=str.lower)
        })

    log_action(f"Syncing known tags: {list(new_known_tags)}")
    tag_manager.sync_known_tags(list(new_known_tags))
    log_action("Cleaning up orphan tags")
    tag_manager.cleanup_orphan_tags()
    log_action(f"Returning new_sections: {len(new_sections)} sections, new_known_tags: {len(new_known_tags)} tags, all_categories: {all_categories}")
    return new_sections, new_known_tags, all_categories
