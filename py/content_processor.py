# py/content_processor.py
import re
import copy
import uuid
from bs4 import BeautifulSoup
from typing import List, Dict, Set, Optional, Any
import py.global_state as global_state # Corrected import statement

# --- Content Filtering and Retrieval ---

def get_filtered_sections(active_filters: List[str]) -> List[Dict]:
    """
    Returns a filtered list of sections based on the active filters.
    - An OR logic is applied: shows content with ANY of the selected tags.
    - A section is shown if it matches OR if it contains notes that match.
    - Content tagged with 'All' is always shown.
    """
    if not active_filters:
        return global_state.document_state.get("sections", [])

    lower_case_active_filters = {f.lower() for f in active_filters}
    filtered_sections = []

    for section in global_state.document_state.get("sections", []):
        section_tags = {t.lower() for t in section.get("tags", [])}
        
        # The 'All' tag on a section makes it and all its notes immune to filtering.
        if 'all' in section_tags:
            filtered_sections.append(copy.deepcopy(section))
            continue

        section_copy = copy.deepcopy(section)
        section_tags_match = not section_tags.isdisjoint(lower_case_active_filters)

        # Filter notes within the section
        visible_notes = []
        for note in section_copy.get("notes", []):
            note_tags = {t.lower() for t in note.get("tags", [])}
            if 'all' in note_tags or not note_tags.isdisjoint(lower_case_active_filters):
                visible_notes.append(note)
        
        section_copy['notes'] = visible_notes

        # The section should be displayed if the section itself matches or if it has any visible notes.
        if section_tags_match or visible_notes:
            filtered_sections.append(section_copy)
            
    return filtered_sections

def find_item(item_id: str, item_type: str) -> Optional[Dict]:
    """Finds a section or note by its ID."""
    for section in global_state.document_state.get("sections", []):
        if item_type == "section" and section["id"] == item_id:
            return section
        if item_type == "note":
            for note in section.get("notes", []):
                if note["id"] == item_id:
                    return note
    return None

def find_section_and_note(section_id: str, note_id: str) -> tuple[Optional[Dict], Optional[Dict]]:
    """A convenience function to find a note and its parent section."""
    for section in global_state.document_state.get("sections", []):
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

    def extract_tags(text: str) -> List[str]: return re.findall(r'\[([^\]]+)\]', text)
    def clean_title(text: str) -> str: return re.sub(r'\[([^\]]+)\]', '', text).strip()

    # Define which HTML tags can become notes (headers) vs. content
    NOTE_TAGS = ['h2', 'h3', 'h4', 'h5', 'h6']
    ALL_TAGS = ['h1'] + NOTE_TAGS + ['p', 'ul', 'ol', 'div', 'pre', 'blockquote']

    for el in soup.find_all(ALL_TAGS):
        # H1 creates a new section
        if el.name == 'h1':
            if current_section: new_sections.append(current_section)
            tags = extract_tags(el.get_text())
            new_known_tags.update(tags)
            current_section = {"id": str(uuid.uuid4()), "sectionTitle": clean_title(el.get_text()), "tags": tags, "notes": []}
        # H2-H6 create a new note within the current section
        elif el.name in NOTE_TAGS:
            if not current_section:
                current_section = {"id": str(uuid.uuid4()), "sectionTitle": "Imported Content", "tags": [], "notes": []}
            tags = extract_tags(el.get_text())
            new_known_tags.update(tags)
            note_content = {"id": str(uuid.uuid4()), "noteTitle": clean_title(el.get_text()), "content": '', "tags": tags}
            current_section.setdefault("notes", []).append(note_content)
        # Other tags are appended as content to the most recent note
        elif current_section and current_section.get("notes"):
            last_note = current_section["notes"][-1]
            last_note["content"] += str(el)
            tags = extract_tags(el.get_text())
            new_known_tags.update(tags)
            last_note["tags"].extend(tags)
            last_note["tags"] = list(dict.fromkeys(last_note["tags"])) # Deduplicate

    if current_section: new_sections.append(current_section)
    return new_sections, new_known_tags