import json

def remove_orphan_tags(state):
    """
    Remove orphan tags from the global tag list in the state dict.
    Orphan tags are:
    1. Not used in any note or section.
    2. Not assigned to any category.
    """
    # Collect all tags used in notes and sections
    used_tags = set()
    for section in state.get('sections', []):
        used_tags.update(section.get('tags', []))
        for note in section.get('notes', []):
            used_tags.update(note.get('tags', []))

    # Collect all tags assigned to categories, ignoring 'Uncategorized'
    category_tags = set()
    for cat in state.get('tag_categories', []):
        if cat.get('name', '').lower() != 'uncategorized':
            category_tags.update(cat.get('tags', []))

    # Only keep tags that are used in notes/sections OR assigned to a non-uncategorized category
    valid_tags = used_tags | category_tags

    # Remove orphan tags from global tag list and filter out 'all' variations (but do not remove from suggestions)
    state['known_tags'] = [tag for tag in state.get('known_tags', []) if tag in valid_tags and tag.strip().lower() != 'all']

    # Also remove orphan tags from all categories except 'Uncategorized', and filter out 'all' variations
    for cat in state.get('tag_categories', []):
        if cat.get('name', '').lower() != 'uncategorized':
            cat['tags'] = [tag for tag in cat.get('tags', []) if tag in valid_tags and tag.strip().lower() != 'all']

    # Remove orphan tags from 'Uncategorized' if not used in notes/sections, and filter out 'all' variations
    for cat in state.get('tag_categories', []):
        if cat.get('name', '').lower() == 'uncategorized':
            cat['tags'] = [tag for tag in cat.get('tags', []) if tag in used_tags and tag.strip().lower() != 'all']

    # Do NOT remove 'all' from suggestions: handled in tag_manager.get_all_tags_for_suggestion()
    return state
