# py/views.py
import uuid
import os
from typing import Optional, Dict
from flask import render_template, request, redirect, url_for, flash, jsonify, current_app, abort
import py.core as core
import py.state_manager as state_manager
import py.tag_manager as tag_manager
import py.content_processor as content_processor

# --- Custom Jinja2 Filter ---
def remove_case_insensitive_filter(value_list: list[str], item_to_remove: str) -> list[str]:
    """
    Removes all occurrences of a string from a list, case-insensitively.
    This is defined here for the purpose of being callable by Flask routes
    if needed directly, otherwise, it's just a Jinja2 filter.
    """
    if not isinstance(value_list, list):
        return value_list
    item_lower = item_to_remove.lower()
    return [item for item in value_list if item.lower() != item_lower]


# --- Flask Routes ---

def get_redirect_url() -> str:
    """Helper to build the redirect URL with current state and filters."""
    state_name = request.args.get('state')
    filters = request.args.getlist('filter')
    # Use url_for directly since this is within the main app context now
    return url_for('index', state=state_name, filter=filters)

def index():
    """Main route to render the document viewer and editor."""
    available_state_files = state_manager.get_available_states()
    if not available_state_files:
        state_manager.create_default_state("Default State")
        available_state_files = state_manager.get_available_states()

    default_state_name = state_manager.get_state_name_from_filename(available_state_files[0])
    current_state_name = request.args.get('state', default_state_name)

    if not state_manager.load_state(current_state_name):
        flash(f"State '{current_state_name}' not found or is corrupt. Loading default.", "warning")
        current_state_name = default_state_name
        state_manager.load_state(current_state_name)

    active_filters = request.args.getlist('filter')
    active_filters_lower = {f.lower() for f in active_filters} # For efficient client-side checks

    sections_to_display = content_processor.get_filtered_sections(active_filters)
    
    return render_template(
        "index.html",
        document=core.document_state,
        sections=sections_to_display,
        all_tags=tag_manager.get_all_known_tags(),
        and_tags=tag_manager.get_and_tags(),
        active_filters=active_filters,
        active_filters_lower=list(active_filters_lower), # Pass this for client-side Jinja2 logic
        available_states=[state_manager.get_state_name_from_filename(f) for f in available_state_files],
        current_state=current_state_name,
        tag_categories=core.document_state.get("tag_categories", []), # Pass categories
        uncategorized_tags=tag_manager.get_uncategorized_tags() # Pass uncategorized tags
    )

# --- State Management Routes ---

def create_state():
    state_name = request.form.get("state_name", "").strip()
    if not state_name:
        flash("State name cannot be empty.", "warning")
        return redirect(url_for('index'))
    
    filename = state_manager.get_filename_from_state_name(state_name)
    if os.path.exists(os.path.join('states', filename)): 
        flash(f"State '{state_name}' already exists.", "error")
        return redirect(url_for('index'))
    
    state_manager.create_default_state(state_name)
    flash(f"State '{state_name}' created successfully.", "success")
    return redirect(url_for('index', state=state_name))

def rename_state():
    old_name = request.form.get("old_state_name")
    new_name = request.form.get("new_state_name", "").strip()
    
    if not old_name or not new_name or old_name == new_name:
        return redirect(url_for('index', state=old_name))

    old_filepath = os.path.join('states', state_manager.get_filename_from_state_name(old_name))
    if os.path.exists(os.path.join('states', state_manager.get_filename_from_state_name(new_name))):
        flash(f"A state named '{new_name}' already exists.", "error")
        return redirect(url_for('index', state=old_name))

    if os.path.exists(old_filepath):
        state_manager.load_state(old_name)
        core.document_state["documentTitle"] = new_name
        state_manager.save_state(new_name)
        os.remove(old_filepath)
        flash(f"State '{old_name}' renamed to '{new_name}'.", "success")
        return redirect(url_for('index', state=new_name))
    
    flash(f"State '{old_name}' not found.", "error")
    return redirect(url_for('index'))

def delete_state():
    state_to_delete = request.form.get("state_to_delete")
    print(f"[DEBUG] Delete state called with: {state_to_delete}")
    
    if not state_to_delete:
        print("[DEBUG] No state_to_delete provided")
        return redirect(url_for('index'))
    
    available_states = state_manager.get_available_states()
    print(f"[DEBUG] Available states: {available_states}")
    
    if len(available_states) <= 1:
        print("[DEBUG] Cannot delete - only one state remaining")
        flash("Cannot delete the last remaining state.", "error")
        return redirect(url_for('index', state=state_to_delete))

    filename = state_manager.get_filename_from_state_name(state_to_delete)
    print(f"[DEBUG] Filename from state name: {filename}")
    
    filepath = os.path.join('states', filename)
    print(f"[DEBUG] Full filepath: {filepath}")
    print(f"[DEBUG] File exists: {os.path.exists(filepath)}")
    
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
            print(f"[DEBUG] Successfully deleted file: {filepath}")
            flash(f"State '{state_to_delete}' deleted.", "success")
        except Exception as e:
            print(f"[DEBUG] Error deleting file: {e}")
            flash(f"Error deleting state '{state_to_delete}': {str(e)}", "error")
    else:
        print(f"[DEBUG] File not found: {filepath}")
        flash(f"State '{state_to_delete}' not found.", "error")

    return redirect(url_for('index'))

# --- Document Content Routes (CRUD Operations) ---

def update_title():
    state_name = request.args.get('state')
    core.document_state["documentTitle"] = request.form.get("documentTitle", "Untitled")
    state_manager.save_state(state_name)
    return redirect(get_redirect_url())

def add_section():
    state_name = request.args.get('state')
    new_section = {"id": str(uuid.uuid4()), "sectionTitle": "New Section", "tags": [], "notes": []}
    core.document_state.setdefault("sections", []).append(new_section)
    state_manager.save_state(state_name)
    return redirect(get_redirect_url())

def update_section(section_id: str):
    state_name = request.args.get('state')
    section = content_processor.find_item(section_id, "section")
    if section:
        old_tags = section.get("tags", [])
        section["sectionTitle"] = request.form.get("sectionTitle", section["sectionTitle"])
        new_tags_input = request.form.get("tags", "")
        
        # Process tags as individual singular tags
        if new_tags_input.strip():
            new_tags = [tag.strip() for tag in new_tags_input.split(',') if tag.strip()]
        else:
            new_tags = []
        
        # Handle intelligent tag editing for cleanup
        tag_manager.handle_smart_tag_update(old_tags, new_tags, exclude_section_id=section_id)
        
        section["tags"] = new_tags
        tag_manager.sync_known_tags()  # No parameters needed - syncs from actual usage
        state_manager.save_state(state_name)
    else:
        flash("Section not found.", "error")
    return redirect(get_redirect_url())

def delete_section(section_id: str):
    state_name = request.args.get('state')
    original_count = len(core.document_state.get("sections", []))
    core.document_state["sections"] = [s for s in core.document_state.get("sections", []) if s["id"] != section_id]
    if len(core.document_state["sections"]) < original_count:
        tag_manager.cleanup_orphan_tags()
        state_manager.save_state(state_name)
    else:
        flash("Section not found.", "error") # Added flash message for consistency
    return redirect(get_redirect_url())

def add_note(section_id: str):
    state_name = request.args.get('state')
    section = content_processor.find_item(section_id, "section")
    if section:
        new_note = {"id": str(uuid.uuid4()), "noteTitle": "New Note", "content": "<p>Start writing here...</p>", "tags": []}
        section.setdefault("notes", []).append(new_note)
        state_manager.save_state(state_name)
    else:
        flash("Could not find section to add note to.", "error")
    return redirect(get_redirect_url())

def update_note(section_id: str, note_id: str):
    state_name = request.args.get('state')
    
    # Debug: Log all form data
    print(f"🔍 DEBUG: Form data received:")
    print(f"  - noteTitle: {request.form.get('noteTitle', 'NOT_PROVIDED')}")
    print(f"  - content: {request.form.get('content', 'NOT_PROVIDED')[:200]}...")
    print(f"  - tags: {request.form.get('tags', 'NOT_PROVIDED')}")
    
    _, note = content_processor.find_section_and_note(section_id, note_id)
    if note:
        # Get form data
        new_title = request.form.get("noteTitle", note["noteTitle"])
        new_content = request.form.get("content", note["content"])
        new_tags_input = request.form.get("tags", "")
        
        print(f"🔍 DEBUG: Before update - Note content: {note['content'][:200]}...")
        print(f"🔍 DEBUG: New content to save: {new_content[:200]}...")
        
        # Update note with new data
        old_tags = note.get("tags", [])
        note["noteTitle"] = new_title
        note["content"] = new_content  # Save HTML directly to JSON
        
        if new_tags_input.strip():
            new_tags = [tag.strip() for tag in new_tags_input.split(',') if tag.strip()]
        else:
            new_tags = []
        
        # Update tags and save state
        tag_manager.handle_smart_tag_update(old_tags, new_tags, exclude_note_id=note_id)
        note["tags"] = new_tags
        tag_manager.sync_known_tags()
        
        # Force save state and verify
        save_result = state_manager.save_state(state_name)
        print(f"🔍 DEBUG: Save state result: {save_result}")
        
        # Verify the save worked
        fresh_note = content_processor.find_section_and_note(section_id, note_id)[1]
        if fresh_note:
            print(f"🔍 DEBUG: After save - Note content: {fresh_note['content'][:200]}...")
        
        # Log successful update
        print(f"✅ Note {note_id} updated successfully - Content: {len(new_content)} chars, Tags: {new_tags}")
        
    else:
        flash("Note not found.", "error")
        print(f"❌ Note not found: section_id={section_id}, note_id={note_id}")
    
    # Return to same page position
    return redirect(get_redirect_url())

def delete_note(section_id: str, note_id: str):
    state_name = request.args.get('state')
    section, _ = content_processor.find_section_and_note(section_id, note_id)
    if section:
        section["notes"] = [n for n in section.get("notes", []) if n["id"] != note_id]
        tag_manager.cleanup_orphan_tags()
        state_manager.save_state(state_name)
    else:
        flash("Could not find note or section to delete from.", "error")
    return redirect(get_redirect_url())

def toggle_note_completed(section_id: str, note_id: str):
    state_name = request.args.get('state') or request.json.get('state')
    if not state_name:
        return jsonify({'success': False, 'message': 'Missing state'}), 400
    section, note = content_processor.find_section_and_note(section_id, note_id)
    if not note:
        return jsonify({'success': False, 'message': 'Note not found'}), 404
    # Toggle completed
    note['completed'] = not note.get('completed', False)
    state_manager.save_state(state_name)
    return jsonify({'success': True, 'completed': note['completed']})

# --- Tag Management Routes ---

def add_global_tag():
    state_name = request.args.get('state')
    new_tag = request.form.get("new_tag_name", "").strip()
    target_category_id = request.form.get("target_category_id")

    if not new_tag:
        flash("Tag name cannot be empty.", "warning")
        return redirect(get_redirect_url())
    
    # Don't treat tags with '&' as AND tags unless they're specifically created as AND tags
    # This allows regular tags like "tr & co" to be created normally

    if new_tag.lower() in [t.lower() for t in tag_manager.get_all_known_tags()]:
        flash(f"Tag '{new_tag}' already exists.", "info")
        return redirect(get_redirect_url())

    # Add to known_tags set
    core.document_state.setdefault("known_tags", set()).add(new_tag)

    # Add to the specified category or 'Uncategorized' by default
    target_category_obj = find_category(target_category_id)
    if not target_category_obj:
        # Fallback to 'Uncategorized' if target_category_id is invalid or not provided
        for cat in core.document_state.get("tag_categories", []):
            if cat['name'].lower() == 'uncategorized':
                target_category_obj = cat
                break
        if not target_category_obj: # Create 'Uncategorized' if it somehow doesn't exist
            new_uncat_id = str(uuid.uuid4())
            new_uncat = {"id": new_uncat_id, "name": "Uncategorized", "tags": []}
            core.document_state["tag_categories"].insert(0, new_uncat)
            target_category_obj = new_uncat

    if new_tag not in target_category_obj.get("tags", []):
        target_category_obj.setdefault("tags", []).append(new_tag)
        target_category_obj["tags"] = sorted(target_category_obj["tags"], key=str.lower)

    tag_manager.cleanup_orphan_tags()
    state_manager.save_state(state_name)
    flash(f"Tag '{new_tag}' created and added to '{target_category_obj['name']}'.", "success")
    return redirect(get_redirect_url())


def rename_global_tag():
    state_name = request.args.get('state')
    old_tag = request.form.get("old_tag")
    new_tag = request.form.get("new_tag", "").strip()

    if not all([old_tag, new_tag]) or old_tag.lower() == new_tag.lower():
        return redirect(get_redirect_url())
    
    # Check if this is a manually created AND tag - only then redirect to AND tag update
    manual_and_tags = core.document_state.get("and_tags", [])
    if old_tag in manual_and_tags:
        # This is a manually created AND tag - use the AND tag update logic
        return update_and_tag()
    
    # Handle singular tag renaming
    # Check if new tag name already exists (case-insensitively) excluding the old tag itself
    existing_tags_lower = {t.lower() for t in tag_manager.get_all_known_tags() if t.lower() != old_tag.lower()}
    if new_tag.lower() in existing_tags_lower:
        flash(f"Tag '{new_tag}' already exists.", "error")
        return redirect(get_redirect_url())
    elif old_tag.lower() == 'all':
        flash("The 'All' tag cannot be renamed.", "error")
        return redirect(get_redirect_url())
    else:
        # Use the smart rename logic for singular tags
        tag_manager.smart_rename_tag(old_tag, new_tag)
        tag_manager.cleanup_orphan_tags()
        state_manager.save_state(state_name)
        flash(f"Tag '{old_tag}' renamed to '{new_tag}'.", "success")
        
        # Update active filters if the renamed tag is currently being filtered
        active_filters = request.args.getlist('filter')
        updated_filters = []
        for filter_tag in active_filters:
            if filter_tag.lower() == old_tag.lower():
                updated_filters.append(new_tag)
            else:
                updated_filters.append(filter_tag)
        
        # Build redirect URL with updated filters
        return redirect(url_for('index', state=state_name, filter=updated_filters))

    return redirect(get_redirect_url())

def delete_global_tag():
    state_name = request.args.get('state')
    tag_to_delete = request.form.get("tag_to_delete")
    if not tag_to_delete:
        return redirect(get_redirect_url())

    if tag_to_delete.lower() == 'all':
        flash("The 'All' tag cannot be deleted.", "error")
        return redirect(get_redirect_url())

    # Check if this is a manually created AND tag - only then use AND tag deletion
    manual_and_tags = core.document_state.get("and_tags", [])
    if tag_to_delete in manual_and_tags:
        return delete_and_tag()

    # Handle singular tag deletion
    lower_tag = tag_to_delete.lower()
    
    # Remove from known_tags
    core.document_state["known_tags"].discard(tag_to_delete)
    
    # Remove from all content
    for section in core.document_state.get("sections", []):
        section["tags"] = [t for t in section.get("tags", []) if t.lower() != lower_tag]
        for note in section.get("notes", []):
            note["tags"] = [t for t in note.get("tags", []) if t.lower() != lower_tag]
    
    # Remove from all categories
    for category in core.document_state.get("tag_categories", []):
        category["tags"] = [t for t in category.get("tags", []) if t.lower() != lower_tag]
        category["tags"] = sorted(category["tags"], key=str.lower) # Re-sort after deletion

    tag_manager.cleanup_orphan_tags() # Reconcile after deletion
    state_manager.save_state(state_name)
    flash(f"Tag '{tag_to_delete}' deleted everywhere.", "success")
    
    # Update active filters if the deleted tag is currently being filtered
    active_filters = request.args.getlist('filter')
    updated_filters = [filter_tag for filter_tag in active_filters if filter_tag.lower() != tag_to_delete.lower()]
    
    # Build redirect URL with updated filters (remove the deleted tag from filters)
    return redirect(url_for('index', state=state_name, filter=updated_filters))

def remove_and_tag_component():
    state_name = request.args.get('state')
    and_tag_name = request.form.get("and_tag_name")
    component_to_remove = request.form.get("component_to_remove")

    if not and_tag_name or not component_to_remove:
        return jsonify({"success": False, "message": "Missing tag or component name."})
    
    # Use the tag_manager function for consistency
    result = tag_manager.remove_and_tag_component(state_name, and_tag_name, component_to_remove)
    
    if result['success']:
        state_manager.save_state(state_name)
        flash(result['message'], "success")
    else:
        flash(result['message'], "error")
    
    return jsonify(result)


def move_tag():
    state_name = request.args.get('state')
    dragged_tag_name = request.form.get("tag_name")
    source_category_id = request.form.get("source_category_id")
    target_category_id = request.form.get("target_category_id")
    target_tag_name = request.form.get("target_tag_name") # The tag it was dropped ONTO

    if not dragged_tag_name:
        return jsonify({"success": False, "message": "Dragged tag name is missing."})
    
    # If dropping onto an existing tag (forming an AND tag)
    if target_tag_name and target_tag_name != dragged_tag_name:
        # Get components of both tags
        dragged_components = tag_manager.parse_and_tag_components(dragged_tag_name)
        target_components = tag_manager.parse_and_tag_components(target_tag_name)
        
        # Combine all unique components
        all_components = list(set(dragged_components + target_components))
        new_and_tag_name = tag_manager.combine_tags_to_and(all_components)

        # Add the new AND tag to known_tags but do not remove the old ones
        core.document_state.setdefault("known_tags", set()).add(new_and_tag_name)
        
        flash(f"New AND tag '{new_and_tag_name}' created.", "success")

    # If dropping onto an empty space in a category (moving a singular tag)
    else:
        source_category_obj = find_category(source_category_id)
        target_category_obj = find_category(target_category_id)

        if not source_category_obj or not target_category_obj:
            return jsonify({"success": False, "message": "Category not found."})

        # Remove tag from its original category
        if dragged_tag_name in source_category_obj.get("tags", []):
            source_category_obj["tags"].remove(dragged_tag_name)
            source_category_obj["tags"].sort(key=str.lower)
        
        # Add tag to target category
        if dragged_tag_name not in target_category_obj.get("tags", []):
            target_category_obj["tags"].append(dragged_tag_name)
            target_category_obj["tags"].sort(key=str.lower)
        
        flash(f"Tag '{dragged_tag_name}' moved to '{target_category_obj['name']}'.", "success")

    state_manager.save_state(state_name)
    
    return jsonify({"success": True, "message": "Operation successful."})

def import_html():
    state_name = request.args.get('state')
    html_content = request.form.get("html_content")
    import_mode = request.form.get("import_mode", "overwrite")

    if not html_content or not html_content.strip():
        flash("No content provided to import.", "warning")
        return redirect(get_redirect_url())

    new_sections, new_tags = content_processor._parse_imported_html(html_content)

    if new_sections:
        if import_mode == 'overwrite':
            core.document_state['sections'] = new_sections
            core.document_state['known_tags'] = new_tags.union({'All'})
            # Overwrite categories, ensure 'Uncategorized' has all tags
            core.document_state['tag_categories'] = [{"id": str(uuid.uuid4()), "name": "Uncategorized", "tags": sorted(list(new_tags.union({'All'})))}]
            flash("Content imported, overwriting previous data.", "success")
        else: # aggregate mode
            core.document_state.setdefault('sections', []).extend(new_sections)
            core.document_state.setdefault('known_tags', set()).update(new_tags)
            # Add new tags to uncategorized if they are not in any category
            tag_manager.sync_known_tags(list(new_tags))
            flash("Content appended to the end of the document.", "success")
        tag_manager.cleanup_orphan_tags()
        state_manager.save_state(state_name)
    else:
        flash("Could not parse any valid sections or notes from the import.", "warning")

    return redirect(get_redirect_url())

def find_category(category_id: str) -> Optional[Dict]:
    """Finds a category by its ID."""
    # Special case for uncategorized
    if category_id == 'uncategorized' or category_id == 'and_tags':
        for category in core.document_state.get("tag_categories", []):
            if category.get("name", "").lower() == 'uncategorized':
                return category
        return None
        
    for category in core.document_state.get("tag_categories", []):
        if category.get("id") == category_id:
            return category
    return None

def add_category():
    state_name = request.args.get('state')
    category_name = request.form.get("category_name", "").strip()
    if not category_name:
        flash("Category name cannot be empty.", "warning")
    elif any(c['name'].lower() == category_name.lower() for c in core.document_state.get("tag_categories", [])):
        flash(f"Category '{category_name}' already exists.", "info")
    else:
        new_category = {"id": str(uuid.uuid4()), "name": category_name, "tags": []}
        core.document_state.setdefault("tag_categories", []).append(new_category)
        state_manager.save_state(state_name)
        flash(f"Category '{category_name}' created.", "success")
    return redirect(get_redirect_url())

def rename_category():
    state_name = request.args.get('state')
    category_id = request.form.get("category_id")
    new_name = request.form.get("new_category_name", "").strip()

    category = find_category(category_id)
    if not category:
        flash("Category not found.", "error")
    elif not new_name:
        flash("New category name cannot be empty.", "warning")
    elif any(c['name'].lower() == new_name.lower() and c['id'] != category_id for c in core.document_state.get("tag_categories", [])):
        flash(f"A category named '{new_name}' already exists.", "error")
    elif category['name'].lower() == 'uncategorized' and new_name.lower() != 'uncategorized':
        flash("The 'Uncategorized' category cannot be renamed.", "error")
    else:
        old_name = category['name']
        
        # Update associated CATEGORY tags in content before renaming the category
        category_rename_result = tag_manager.rename_category_and_associated_tags(old_name, new_name)
        
        # Rename the category
        category['name'] = new_name
        state_manager.save_state(state_name)
        
        # Build comprehensive success message
        success_message = f"Category '{old_name}' renamed to '{new_name}'."
        if category_rename_result['success'] and "CATEGORY tags updated" in category_rename_result['message']:
            success_message += " Associated CATEGORY tags have been updated in all content."
        
        flash(success_message, "success")
    return redirect(get_redirect_url())

def delete_category():
    state_name = request.args.get('state')
    category_id = request.form.get("category_id_to_delete")
    
    category_to_delete = find_category(category_id)
    if not category_to_delete:
        flash("Category not found.", "error")
        return redirect(get_redirect_url())

    if category_to_delete['name'].lower() == 'uncategorized':
        flash("The 'Uncategorized' category cannot be deleted.", "error")
        return redirect(get_redirect_url())

    # Find the "Uncategorized" category to move tags to
    uncategorized_category = None
    for cat in core.document_state["tag_categories"]:
        if cat['name'].lower() == 'uncategorized':
            uncategorized_category = cat
            break
    
    if not uncategorized_category:
        # This should ideally not happen if 'Uncategorized' is always present
        new_uncategorized_id = str(uuid.uuid4())
        uncategorized_category = {"id": new_uncategorized_id, "name": "Uncategorized", "tags": []}
        core.document_state["tag_categories"].insert(0, uncategorized_category) # Add at the beginning

    # Move tags from the deleted category to "Uncategorized"
    if category_to_delete.get('tags'):
        uncategorized_category['tags'].extend(category_to_delete.get('tags', []))
        uncategorized_category['tags'] = sorted(list(dict.fromkeys(uncategorized_category['tags'])), key=str.lower) # Deduplicate and sort

    # Remove any CATEGORY tags associated with this category from all content
    category_deletion_result = tag_manager.delete_category_and_associated_tags(category_to_delete['name'])

    # Remove the category from the list
    core.document_state["tag_categories"] = [c for c in core.document_state.get("tag_categories", []) if c["id"] != category_id]
    
    # Cleanup tags and save
    tag_manager.cleanup_orphan_tags() # Ensure known_tags is consistent
    state_manager.save_state(state_name)
    
    # Build comprehensive success message
    success_message = f"Category '{category_to_delete['name']}' deleted and its tags moved to 'Uncategorized'."
    if category_deletion_result['success']:
        if "CATEGORY:" in category_deletion_result['message']:
            success_message += f" {category_deletion_result['message'].split('. ', 1)[1] if '. ' in category_deletion_result['message'] else category_deletion_result['message']}"
    
    flash(success_message, "success")
    return redirect(get_redirect_url())

def remove_tag_globally():
    """Remove a tag from all content globally."""
    state_name = request.args.get('state')
    tag_to_remove = request.form.get('tag_name')
    
    if not tag_to_remove:
        return jsonify({"success": False, "message": "Missing tag name."})
    
    result = tag_manager.remove_tag_globally(tag_to_remove)
    
    if result['success']:
        state_manager.save_state(state_name)
        flash(result['message'], "success")
    else:
        flash(result['message'], "error")
    
    return jsonify(result)

def rename_tag_globally():
    """Rename a tag in all content globally."""
    state_name = request.args.get('state')
    old_tag = request.form.get('old_tag_name')
    new_tag = request.form.get('new_tag_name')
    
    if not old_tag or not new_tag:
        return jsonify({"success": False, "message": "Missing old or new tag name."})
    
    result = tag_manager.rename_tag_globally(old_tag, new_tag)
    
    if result['success']:
        state_manager.save_state(state_name)
        flash(result['message'], "success")
    else:
        flash(result['message'], "error")
    
    return jsonify(result)

# --- AND Tag Management Routes ---

def add_and_tag():
    """Create a new AND tag manually"""
    state_name = request.args.get('state')
    and_tag_components = request.form.get("and_tag_components", "").strip()
    
    if not and_tag_components:
        flash("AND tag components cannot be empty.", "error")
        return redirect(get_redirect_url())
    
    # Parse components and create AND tag
    components = [comp.strip() for comp in and_tag_components.split(',') if comp.strip()]
    if len(components) < 2:
        flash("AND tag must have at least 2 components.", "error")
        return redirect(get_redirect_url())
    
    # Create the AND tag using the standard format
    and_tag = tag_manager.combine_tags_to_and(components)
    
    # Check if it already exists
    existing_and_tags = tag_manager.get_and_tags()
    if and_tag in existing_and_tags:
        flash(f"AND tag '{and_tag}' already exists.", "error")
        return redirect(get_redirect_url())
    
    # Add the AND tag
    if tag_manager.add_and_tag(and_tag):
        state_manager.save_state(state_name)
        flash(f"AND tag '{and_tag}' created successfully.", "success")
    else:
        flash("Failed to create AND tag.", "error")
    
    return redirect(get_redirect_url())

def update_and_tag():
    """Update an existing AND tag"""
    state_name = request.args.get('state')
    old_tag = request.form.get("old_tag")
    new_tag_components = request.form.get("new_tag", "").strip()
    
    if not old_tag or not new_tag_components:
        flash("Missing tag information.", "error")
        return redirect(get_redirect_url())
    
    # Parse components and create new AND tag
    if ',' in new_tag_components:
        # Components separated by comma
        components = [comp.strip() for comp in new_tag_components.split(',') if comp.strip()]
    else:
        # Assume it's already formatted as an AND tag
        components = tag_manager.parse_and_tag_components(new_tag_components)
    
    if len(components) < 2:
        flash("AND tag must have at least 2 components.", "error")
        return redirect(get_redirect_url())
    
    new_tag = tag_manager.combine_tags_to_and(components)
    
    # Check if new tag already exists (excluding the old one)
    existing_and_tags = [tag for tag in tag_manager.get_and_tags() if tag != old_tag]
    if new_tag in existing_and_tags:
        flash(f"AND tag '{new_tag}' already exists.", "error")
        return redirect(get_redirect_url())
    
    # Update the AND tag
    if tag_manager.update_and_tag(old_tag, new_tag):
        state_manager.save_state(state_name)
        flash(f"AND tag updated from '{old_tag}' to '{new_tag}'.", "success")
        
        # Update active filters if the renamed AND tag is currently being filtered
        active_filters = request.args.getlist('filter')
        updated_filters = []
        for filter_tag in active_filters:
            if filter_tag.lower() == old_tag.lower():
                updated_filters.append(new_tag)
            else:
                updated_filters.append(filter_tag)
        
        # Build redirect URL with updated filters
        return redirect(url_for('index', state=state_name, filter=updated_filters))
    else:
        flash("Failed to update AND tag.", "error")
    
    return redirect(get_redirect_url())

def delete_and_tag():
    """Delete an AND tag"""
    state_name = request.args.get('state')
    and_tag = request.form.get("and_tag_to_delete")
    
    # Log the request details
    current_app.logger.info(f"Delete AND tag request: {and_tag}")
    current_app.logger.info(f"Current active filters: {request.args.getlist('filter')}")
    
    if not and_tag:
        current_app.logger.warning("Missing AND tag to delete")
        flash("Missing AND tag to delete.", "error")
        return redirect(get_redirect_url())
    
    if tag_manager.remove_and_tag(and_tag):
        state_manager.save_state(state_name)
        flash(f"AND tag '{and_tag}' deleted successfully.", "success")
        
        # Update active filters if the deleted AND tag is currently being filtered
        active_filters = request.args.getlist('filter')
        updated_filters = [filter_tag for filter_tag in active_filters if filter_tag.lower() != and_tag.lower()]
        
        current_app.logger.info(f"AND tag '{and_tag}' deleted successfully")
        current_app.logger.info(f"Filters before: {active_filters}")
        current_app.logger.info(f"Filters after: {updated_filters}")
        
        # Build redirect URL with updated filters (remove the deleted AND tag from filters)
        redirect_url = url_for('index', state=state_name, filter=updated_filters)
        current_app.logger.info(f"Redirecting to: {redirect_url}")
        return redirect(redirect_url)
    else:
        current_app.logger.error(f"Failed to delete AND tag '{and_tag}'")
        flash("Failed to delete AND tag.", "error")
        return redirect(get_redirect_url())

# Register in app.py:
# app.add_url_rule('/section/reorder_notes/<section_id>', 'reorder_notes', views.reorder_notes, methods=["POST"])

def reorder_notes(section_id):
    data = request.get_json()
    note_ids = data.get('note_ids')
    state_name = data.get('state')
    if not note_ids or not state_name:
        return jsonify({'success': False, 'message': 'Missing note_ids or state'}), 400
    if not state_manager.load_state(state_name):
        # Try to return last error if available
        last_error = getattr(state_manager, 'last_save_error', None)
        return jsonify({'success': False, 'message': 'State not found', 'error': last_error}), 404
    # Find the section
    for section in core.document_state.get('sections', []):
        if section.get('id') == section_id:
            notes_by_id = {n['id']: n for n in section.get('notes', [])}
            new_notes = []
            for nid in note_ids:
                note = notes_by_id.get(nid)
                if note:
                    new_notes.append(note)
            # Optionally, append any notes not in the new order (shouldn't happen)
            for note in section.get('notes', []):
                if note['id'] not in note_ids:
                    new_notes.append(note)
            section['notes'] = new_notes
            ok = state_manager.save_state(state_name)
            if ok:
                return jsonify({'success': True})
            else:
                # Return last error if available
                last_error = getattr(state_manager, 'last_save_error', None)
                return jsonify({'success': False, 'message': 'Failed to save state', 'error': last_error}), 500
    return jsonify({'success': False, 'message': 'Section not found'}), 404
