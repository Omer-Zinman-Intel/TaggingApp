# py/views.py
import uuid
import os
import sys
from typing import Optional, Dict
from flask import render_template, request, redirect, url_for, flash, jsonify, current_app, abort
import py.core as core
import py.state_manager as state_manager
import py.tag_manager as tag_manager
import py.content_processor as content_processor
from flask import Blueprint, jsonify, request
import datetime
import json # Importing json here to fix missing import for category parsing
from py import filelock_util
from py.filelock_util import FileLock  # Use FileLock if available, otherwise fallback to open

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




# Endpoint to receive frontend logs and write to backend log file

app = Blueprint('app', __name__)

# --- LOGGING ENDPOINT FOR DEBUGGING IMPORT/EXPORT ---
@app.route('/log_frontend', methods=['POST'])
def log_frontend():
    """
    Receives logs from the frontend and writes them to a backend log file with a timestamp.
    """
    try:
        log_dir = os.path.join(os.path.dirname(__file__), '../logs')
        os.makedirs(log_dir, exist_ok=True)
        log_path = os.path.join(log_dir, 'frontend.log')
        data = request.get_json(force=True, silent=True) or {}
        timestamp = datetime.datetime.utcnow().isoformat()
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(f"[{timestamp}] {data}\n")
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

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

    # Attach completed and collapsed status to all notes/sections for current user and state
    from py import user_config_manager
    username = getattr(core, 'current_username', 'default_user')
    user_config = user_config_manager.load_user_config(username)
    state_config = user_config.get(current_state_name, {"completed_notes": [], "collapsed_sections": [], "collapsed_notes": []})
    user_completed_notes = set(state_config.get('completed_notes', []))
    collapsed_sections = set(state_config.get('collapsed_sections', []))
    collapsed_notes = set(state_config.get('collapsed_notes', []))
    for section in core.document_state.get("sections", []):
        section['collapsed'] = section.get('id') in collapsed_sections
        for note in section.get("notes", []):
            note['completed'] = note.get('id') in user_completed_notes
            note['collapsed'] = note.get('id') in collapsed_notes

    # --- Remove orphan tags on every page reload ---
    from py import tag_cleanup_util
    core.document_state = tag_cleanup_util.remove_orphan_tags(core.document_state)
    state_manager.save_state(current_state_name)

    sections_to_display = content_processor.get_filtered_sections(active_filters)

    # Debug output for tags sent to frontend
    # print(f"[DEBUG] all_tags: {tag_manager.get_all_known_tags()}", file=sys.stderr)
    # print(f"[DEBUG] tag_categories: {core.document_state.get('tag_categories', [])}", file=sys.stderr)
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
        tag_categories=core.document_state.get("tag_categories", []), # Pass categories only
        all_tag_suggestions=tag_manager.get_all_tags_for_suggestion()
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
        # Update user config completed_notes key
        from py import user_config_manager
        username = getattr(core, 'current_username', 'default_user')
        config = user_config_manager.load_user_config(username)
        if old_name in config:
            config[new_name] = config.pop(old_name)
            user_config_manager.save_user_config(username, config)
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
    after_section_id = request.form.get('after_section_id', '')
    import json
    section_title = request.form.get("sectionTitle", "New Section")
    tags_input = request.form.get("tags", "")
    tags = [t.strip() for t in tags_input.split(",") if t.strip()]
    categories_json = request.form.get("categories", "[]")
    try:
        categories = json.loads(categories_json)
        if not isinstance(categories, list):
            categories = []
    except Exception:
        categories = []
    # Normalize categories to IDs
    tag_categories = core.document_state.get("tag_categories", [])
    cat_map = {c['name'].lower(): c for c in tag_categories}
    normalized_categories = []
    for cat in categories:
        cat_name = cat['name'] if isinstance(cat, dict) else cat
        cat_obj = cat_map.get(cat_name.lower())
        if cat_obj:
            normalized_categories.append(cat_obj['id'])
    new_section = {
        "id": str(uuid.uuid4()),
        "sectionTitle": section_title,
        "tags": tags,
        "categories": normalized_categories,
        "notes": []
    }
    sections = core.document_state.setdefault("sections", [])

    if after_section_id:
        # Find the index of the section to insert after
        for idx, section in enumerate(sections):
            if section["id"] == after_section_id:
                sections.insert(idx + 1, new_section)
                break
        else:
            # If not found, append at the end
            sections.append(new_section)
    else:
        # Insert at the beginning
        sections.insert(0, new_section)

    state_manager.save_state(state_name)

    # Pass new_section_id as a query param for scroll restoration
    redirect_url = get_redirect_url()
    if '?' in redirect_url:
        redirect_url += f'&new_section_id={new_section["id"]}'
    else:
        redirect_url += f'?new_section_id={new_section["id"]}'
    return redirect(redirect_url)

def update_section(section_id: str):
    state_name = request.args.get('state')
    section = content_processor.find_item(section_id, "section")
    if section:
        tags_input = request.form.get("tags", "")
        tags = [t.strip() for t in tags_input.split(",") if t.strip()]
        categories_json = request.form.get("categories", "[]")
        try:
            categories = json.loads(categories_json)
            if not isinstance(categories, list):
                categories = []
        except Exception:
            categories = []
        # Normalize categories to IDs (handle both IDs and names)
        tag_categories = core.document_state.get("tag_categories", [])
        cat_map = {c['name'].lower(): c for c in tag_categories}
        id_map = {c['id']: c for c in tag_categories}
        normalized_categories = []
        for cat in categories:
            if isinstance(cat, dict):
                cat_name = cat.get('name')
                cat_id = cat.get('id')
            else:
                cat_name = cat
                cat_id = cat
            # If it's a valid category ID, use it directly
            if cat_id in id_map:
                normalized_categories.append(cat_id)
            elif cat_name and cat_name.lower() in cat_map:
                normalized_categories.append(cat_map[cat_name.lower()]['id'])
        # Always replace tags with submitted list
        section["tags"] = tags
        section["categories"] = normalized_categories
        tag_manager.sync_known_tags()
        state_manager.save_state(state_name)
    else:
        flash("Section not found.", "error")
    return redirect(get_redirect_url())

def delete_section(section_id: str):
    state_name = request.args.get('state')
    sections = core.document_state.get("sections", [])
    idx_to_delete = None
    for idx, s in enumerate(sections):
        if s["id"] == section_id:
            idx_to_delete = idx
            break
    scroll_to_section_id = None
    if idx_to_delete is not None:
        # Prefer to scroll to the next section, or previous if last
        if idx_to_delete < len(sections) - 1:
            scroll_to_section_id = sections[idx_to_delete + 1]["id"]
        elif idx_to_delete > 0:
            scroll_to_section_id = sections[idx_to_delete - 1]["id"]
        # Remove the section
        del sections[idx_to_delete]
        tag_manager.cleanup_orphan_tags()
        state_manager.save_state(state_name)
    else:
        flash("Section not found.", "error")
    # Redirect with scroll target if possible
    redirect_url = get_redirect_url()
    if scroll_to_section_id:
        if '?' in redirect_url:
            redirect_url += f'&new_section_id={scroll_to_section_id}'
        else:
            redirect_url += f'?new_section_id={scroll_to_section_id}'
    return redirect(redirect_url)

def add_note(section_id: str):
    state_name = request.args.get('state')
    section = content_processor.find_item(section_id, "section")
    if section:
        import json
        note_title = request.form.get("noteTitle", "New Note")
        note_content = request.form.get("content", "<p>Start writing here...</p>")
        tags_input = request.form.get("tags", "")
        tags = [t.strip() for t in tags_input.split(",") if t.strip()]
        categories_json = request.form.get("categories", "[]")
        try:
            categories = json.loads(categories_json)
            if not isinstance(categories, list):
                categories = []
        except Exception:
            categories = []
        # Normalize categories to IDs
        tag_categories = core.document_state.get("tag_categories", [])
        cat_map = {c['name'].lower(): c for c in tag_categories}
        normalized_categories = []
        for cat in categories:
            cat_name = cat['name'] if isinstance(cat, dict) else cat
            cat_obj = cat_map.get(cat_name.lower())
            if cat_obj:
                normalized_categories.append(cat_obj['id'])
        new_note = {
            "id": str(uuid.uuid4()),
            "noteTitle": note_title,
            "content": note_content,
            "tags": tags,
            "categories": normalized_categories
        }
        section.setdefault("notes", []).append(new_note)
        state_manager.save_state(state_name)
    else:
        flash("Could not find section to add note to.", "error")
    return redirect(get_redirect_url())

def update_note(section_id: str, note_id: str):
    state_name = request.args.get('state')
    # Sanitize IDs to remove any quotes
    def sanitize_id(idval):
        if not idval:
            return idval
        return str(idval).strip('"\'')

    clean_section_id = sanitize_id(section_id)
    clean_note_id = sanitize_id(note_id)
    print(f"🔍 [BACKEND DEBUG] update_note called with:")
    print(f"  section_id: {clean_section_id}")
    print(f"  note_id: {clean_note_id}")
    print(f"  FORM DATA:")
    for k in request.form.keys():
        print(f"    {k}: {request.form.get(k)}")
    print(f"  ARGS:")
    for k in request.args.keys():
        print(f"    {k}: {request.args.get(k)}")
    # Write to backend log for verification
    try:
        with open('logs/frontend_backend_debug.log', 'a', encoding='utf-8') as f:
            import datetime
            f.write(f"{datetime.datetime.now().isoformat()} | update_note | note_id={note_id} | tags={request.form.get('tags', '')} | categories={request.form.get('categories', '')}\n")
    except Exception as logerr:
        print(f"[ERROR] Could not write to debug log: {logerr}")
    _, note = content_processor.find_section_and_note(clean_section_id, clean_note_id)
    if note:
        new_title = request.form.get("noteTitle", note["noteTitle"])
        new_content = request.form.get("content", note["content"])
        # Sanitize content: remove Quill cursor artifacts and zero-width spaces
        import re
        new_content = re.sub(r'<span class="ql-cursor">.*?</span>', '', new_content)
        new_content = new_content.replace('\ufeff', '')
        tags_input = request.form.get("tags", "")
        tags = [t.strip() for t in tags_input.split(",") if t.strip()]
        categories_json = request.form.get("categories", "[]")
        try:
            categories = json.loads(categories_json)
            if not isinstance(categories, list):
                categories = []
        except Exception as e:
            print(f"[ERROR] Failed to parse categories from form: {e}")
            categories = []
        # Normalize categories to IDs (handle both IDs and names)
        tag_categories = core.document_state.get("tag_categories", [])
        cat_map = {c['name'].lower(): c for c in tag_categories}
        id_map = {c['id']: c for c in tag_categories}
        normalized_categories = []
        for cat in categories:
            if isinstance(cat, dict):
                cat_name = cat.get('name')
                cat_id = cat.get('id')
            else:
                cat_name = cat
                cat_id = cat
            # If it's a valid category ID, use it directly
            if cat_id in id_map:
                normalized_categories.append(cat_id)
            elif cat_name and cat_name.lower() in cat_map:
                normalized_categories.append(cat_map[cat_name.lower()]['id'])
        note["noteTitle"] = new_title
        note["content"] = new_content
        note["tags"] = tags
        note["categories"] = normalized_categories
        tag_manager.sync_known_tags()
        save_result = state_manager.save_state(state_name)
        print(f"🔍 DEBUG: Save state result: {save_result}")
        fresh_note = content_processor.find_section_and_note(section_id, note_id)[1]
        if fresh_note:
            print(f"🔍 DEBUG: After save - Note content: {fresh_note['content'][:200]}...")
        print(f"✅ Note {note_id} updated successfully - Content: {len(new_content)} chars, Tags: {tags}, Categories: {categories}")
    else:
        flash("Note not found.", "error")
        print(f"❌ Note not found: section_id={section_id}, note_id={note_id}")
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
    username = request.args.get('username') or request.json.get('username') or 'default_user'
    if not state_name:
        return jsonify({'success': False, 'message': 'Missing state'}), 400
    section, note = content_processor.find_section_and_note(section_id, note_id)
    if not note:
        return jsonify({'success': False, 'message': 'Note not found'}), 404
    # Toggle completed status in user config
    from py import user_config_manager
    completed = user_config_manager.toggle_note_completed(username, note_id)
    return jsonify({'success': True, 'completed': completed})

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
    # Debug: log all category IDs in the current state
    print(f"[DEBUG] All category IDs: {[c['id'] for c in core.document_state.get('tag_categories', [])]}", file=sys.stderr)
    print(f"[DEBUG] source_category_id: {source_category_id}, target_category_id: {target_category_id}", file=sys.stderr)


    # Special handling for 'all_tags' as source: treat as global tag list, not a category
    if source_category_id == 'all_tags':
        source_category_obj = None
    else:
        source_category_obj = find_category(source_category_id)
    target_category_obj = find_category(target_category_id)

    if not target_category_obj:
        print(f"[DEBUG] source_category_obj: {source_category_obj}, target_category_obj: {target_category_obj}", file=sys.stderr)
        return jsonify({"success": False, "message": "Category not found."})

    # Remove tag from its original category (if not from 'all_tags')
    if source_category_obj and dragged_tag_name in source_category_obj.get("tags", []):
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
    import os
    def debug_import_log(msg):
        log_path = os.path.join(os.path.dirname(__file__), '../logs/import_parser.log')
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(f"[import_html] {msg}\n")

    state_name = request.args.get('state')
    html_content = request.form.get("html_content")
    import_mode = request.form.get("import_mode", "overwrite")

    # --- NEW LOGGER: Log the full incoming payload from the frontend ---
    try:
        import_payload = {
            "state_name": state_name,
            "import_mode": import_mode,
            "html_content_len": len(html_content) if html_content else 0,
            "html_content_preview": html_content[:500] if html_content else '',
            "categories": request.form.get("categories"),
            "form_keys": list(request.form.keys()),
            "raw_form": {k: request.form.get(k) for k in request.form.keys()}
        }
        debug_import_log(f"[NEW_IMPORT] Payload received: {import_payload}")
    except Exception as e:
        debug_import_log(f"[NEW_IMPORT] Error logging payload: {e}")

    debug_import_log(f"Called import_html: state_name={state_name}, import_mode={import_mode}, html_content_len={len(html_content) if html_content else 0}")

    if not html_content or not html_content.strip():
        debug_import_log("No content provided to import.")
        flash("No content provided to import.", "warning")
        return redirect(get_redirect_url())

    # Accept categories from frontend if provided
    categories_json = request.form.get("categories")
    debug_import_log("Starting import_html execution.")
    new_sections, new_tags, parsed_categories = content_processor._parse_imported_html(html_content)
    debug_import_log(f"_parse_imported_html returned: sections={len(new_sections)}, tags={len(new_tags)}, categories={len(parsed_categories)}")
    debug_import_log(f"new_sections: {new_sections}")
    debug_import_log(f"new_tags: {new_tags}")
    debug_import_log(f"parsed_categories: {parsed_categories}")

    # Parse categories from frontend JSON if present
    frontend_categories = []
    if categories_json:
        try:
            raw_categories = json.loads(categories_json)
            # Only keep categories that have a valid name and at least one tag
            frontend_categories = [c for c in raw_categories if c.get('name') and c.get('tags') and len(c.get('tags')) > 0]
            debug_import_log(f"Received categories from frontend (filtered): {frontend_categories}")
        except Exception as e:
            debug_import_log(f"Failed to parse categories JSON: {e}")
    else:
        debug_import_log("No categories received from frontend.")

    # Merge frontend and parsed categories into backend state
    def merge_categories(existing, incoming):
        # Only create categories if incoming is non-empty
        if not incoming:
            return existing
        for cat in incoming:
            name = cat.get('name')
            tags = set(cat.get('tags', []))
            found = next((c for c in existing if c['name'].lower() == name.lower()), None)
            if found:
                found['tags'] = sorted(list(set(found.get('tags', [])).union(tags)), key=str.lower)
            else:
                existing.append({
                    'id': str(uuid.uuid4()),
                    'name': name,
                    'tags': sorted(list(tags), key=str.lower)
                })
        return existing

    # Helper: assign category tags to notes/sections
    def assign_category_tags(sections, categories):
        # categories: list of {name, tags, id}
        cat_map = {c['name'].lower(): c for c in categories}
        for section in sections:
            section_cats = section.get('categories', [])
            new_section_cats = []
            for cat in section_cats:
                cat_name = cat['name'] if isinstance(cat, dict) else cat
                cat_obj = cat_map.get(cat_name.lower())
                if cat_obj:
                    new_section_cats.append(cat_obj['id'])
                    # Add tags from category to section
                    section.setdefault('tags', [])
                    section['tags'].extend([t for t in cat_obj.get('tags', []) if t not in section['tags']])
                    # Add category name as a tag to section
                    if cat_obj['name'] not in section['tags']:
                        section['tags'].append(cat_obj['name'])
            section['categories'] = new_section_cats
            section['tags'] = sorted(list(set(section.get('tags', []))), key=str.lower)
            # For notes
            for note in section.get('notes', []):
                note_cats = note.get('categories', [])
                new_note_cats = []
                for cat in note_cats:
                    cat_name = cat['name'] if isinstance(cat, dict) else cat
                    cat_obj = cat_map.get(cat_name.lower())
                    if cat_obj:
                        new_note_cats.append(cat_obj['id'])
                        note.setdefault('tags', [])
                        note['tags'].extend([t for t in cat_obj.get('tags', []) if t not in note['tags']])
                        # Add category name as a tag to note
                        if cat_obj['name'] not in note['tags']:
                            note['tags'].append(cat_obj['name'])
                note['categories'] = new_note_cats
                note['tags'] = sorted(list(set(note.get('tags', []))), key=str.lower)
        return sections

    debug_import_log(f"Import mode: {import_mode}")
    if new_sections:
        # Always merge both frontend and parsed categories
        all_categories = parsed_categories
        if frontend_categories:
            all_categories = merge_categories(all_categories, frontend_categories)
        if import_mode == 'overwrite':
            debug_import_log("Overwrite mode: replacing sections, tags, and categories.")
            tag_cats = all_categories
            debug_import_log(f"Merged categories: {tag_cats}")
            new_sections = assign_category_tags(new_sections, tag_cats)
            debug_import_log(f"Sections after category tag assignment: {new_sections}")
            core.document_state['sections'] = new_sections
            # Ensure known_tags is always a set internally
            core.document_state['known_tags'] = set(new_tags).union({'All'})
            uncategorized = next((cat for cat in all_categories if cat['name'].lower() == 'uncategorized'), None)
            if uncategorized:
                for tag in core.document_state['known_tags']:
                    if tag not in uncategorized['tags']:
                        uncategorized['tags'].append(tag)
                uncategorized['tags'] = sorted(list(set(uncategorized['tags'])), key=str.lower)
            core.document_state['tag_categories'] = tag_cats
            flash("Content imported, overwriting previous data.", "success")
            debug_import_log("Overwrite mode: sections, tags, and categories replaced.")
        else: # aggregate mode
            debug_import_log("Aggregate mode: appending sections and merging categories.")
            tag_cats = core.document_state.setdefault('tag_categories', [])
            tag_cats = merge_categories(tag_cats, all_categories)
            debug_import_log(f"Merged categories: {tag_cats}")
            new_sections = assign_category_tags(new_sections, tag_cats)
            debug_import_log(f"Sections after category tag assignment: {new_sections}")
            core.document_state.setdefault('sections', []).extend(new_sections)
            core.document_state.setdefault('known_tags', set()).update(new_tags)
            # Ensure known_tags is a set
            if not isinstance(core.document_state['known_tags'], set):
                core.document_state['known_tags'] = set(core.document_state['known_tags'])
            tag_manager.sync_known_tags(list(new_tags))
            core.document_state['tag_categories'] = tag_cats
            flash("Content appended to the end of the document.", "success")
            debug_import_log("Aggregate mode: sections and categories appended.")
        tag_manager.cleanup_orphan_tags()
        state_manager.save_state(state_name)
        debug_import_log("State saved after import.")
    else:
        debug_import_log("No valid sections parsed from import.")
        flash("Could not parse any valid sections or notes from the import.", "warning")

    debug_import_log("Redirecting after import.")
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

# --- AND Tag Creation Endpoint ---
@app.route('/add_and_tag', methods=['POST'])
def add_and_tag():
    # Parse AND tag components from form
    components = []
    for i in range(0, 10):  # Support up to 10 components
        comp = request.form.get(f'andTagComponent_{i}')
        if comp:
            components.append(comp.strip())
    if len(components) < 2:
        return jsonify({'error': 'AND tag must have at least 2 components'}), 400
    and_tag = ' & '.join(components)
    # Load state file
    state_path = os.path.join('states', f"{request.args.get('state', 'Space_Exploration')}.json")
    # Use file lock if available, otherwise fallback to open()
    lock_path = state_path + '.lock'
    try:
        with FileLock(lock_path):
            with open(state_path, 'r+', encoding='utf-8') as f:
                state = json.load(f)
                # Ensure 'and_tags' exists
                if 'and_tags' not in state:
                    state['and_tags'] = []
                # Add if not present
                if and_tag not in state['and_tags']:
                    state['and_tags'].append(and_tag)
                f.seek(0)
                json.dump(state, f, indent=4)
                f.truncate()
    except Exception:
        # Fallback: no file lock, just open
        with open(state_path, 'r+', encoding='utf-8') as f:
            state = json.load(f)
            if 'and_tags' not in state:
                state['and_tags'] = []
            if and_tag not in state['and_tags']:
                state['and_tags'].append(and_tag)
            f.seek(0)
            json.dump(state, f, indent=4)
            f.truncate()
    return redirect(url_for('index', state=request.args.get('state', 'Space_Exploration')))

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
    """
    Reorder notes within a section based on a list of note IDs provided by the frontend.
    Expects JSON: {"note_ids": [...], "state": ...}
    """
    data = request.get_json()
    note_ids = data.get('note_ids')
    state_name = data.get('state')
    if not note_ids or not state_name:
        return jsonify({'success': False, 'message': 'Missing note_ids or state'}), 400

    # Load the requested state
    if not state_manager.load_state(state_name):
        last_error = getattr(state_manager, 'last_save_error', None)
        return jsonify({'success': False, 'message': 'State not found', 'error': last_error}), 404

    # Find the section by ID
    for section in core.document_state.get('sections', []):
        if section.get('id') == section_id:
            # Build a mapping of note ID to note object
            notes_by_id = {n['id']: n for n in section.get('notes', [])}
            # Rebuild the notes list in the requested order
            new_notes = [notes_by_id[nid] for nid in note_ids if nid in notes_by_id]
            # Optionally, append any notes not in the new order (shouldn't happen, but for safety)
            for note in section.get('notes', []):
                if note['id'] not in note_ids:
                    new_notes.append(note)
            section['notes'] = new_notes
            # Save the updated state
            ok = state_manager.save_state(state_name)
            if ok:
                return jsonify({'success': True})
            else:
                last_error = getattr(state_manager, 'last_save_error', None)
                return jsonify({'success': False, 'message': 'Failed to save state', 'error': last_error}), 500
    # Section not found
    return jsonify({'success': False, 'message': 'Section not found'}), 404

def import_clear():
    state_name = request.args.get('state') or request.json.get('state')
    if not state_name:
        return jsonify({'success': False, 'message': 'Missing state'}), 400
    if not state_manager.load_state(state_name):
        return jsonify({'success': False, 'message': 'State not found'}), 404
    core.document_state['sections'] = []
    core.document_state['known_tags'] = set(['All'])
    core.document_state['tag_categories'] = [{"id": str(uuid.uuid4()), "name": "Uncategorized", "tags": ["All"]}]
    state_manager.save_state(state_name)
    return jsonify({'success': True})

def import_add():
    import os
    import datetime
    state_name = request.args.get('state') or request.json.get('state')
    section = request.json.get('section')
    # Log what is received from frontend
    log_dir = os.path.join(os.path.dirname(__file__), '../logs')
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, 'import_add.log')
    timestamp = datetime.datetime.utcnow().isoformat()
    with open(log_path, 'a', encoding='utf-8') as f:
        f.write(f"[{timestamp}] IMPORT_ADD_RECEIVED: state={state_name}, section={section}\n")


    # Additional logging for categories and tags
    section_categories = section.get('categories', [])
    with open(log_path, 'a', encoding='utf-8') as f:
        f.write(f"[{timestamp}] Section categories: {section_categories}\n")
        for note in section.get('notes', []):
            note_categories = note.get('categories', [])
            f.write(f"[{timestamp}] Note id={note.get('id')} categories: {note_categories}\n")
            f.write(f"[{timestamp}] Note id={note.get('id')} tags: {note.get('tags', [])}\n")
        f.write(f"[{timestamp}] Section tags: {section.get('tags', [])}\n")
    if not state_name or not section:
        return jsonify({'success': False, 'message': 'Missing state or section'}), 400
    if not state_manager.load_state(state_name):
        return jsonify({'success': False, 'message': 'State not found'}), 404

    # Ensure tag_categories exists
    if 'tag_categories' not in core.document_state or not core.document_state['tag_categories']:
        core.document_state['tag_categories'] = [{"id": str(uuid.uuid4()), "name": "Uncategorized", "tags": ["All"]}]
    # Always use core.document_state['tag_categories'] for consistency
    tag_categories = core.document_state['tag_categories']

    def get_or_create_category(cat_name, tags):
        for cat in tag_categories:
            if cat['name'].lower() == cat_name.lower():
                # Merge tags into the category
                cat['tags'] = sorted(list(set(cat['tags']).union(tags)), key=str.lower)
                return cat
        new_cat = {
            "id": str(uuid.uuid4()),
            "name": cat_name,
            "tags": sorted(list(set(tags)), key=str.lower)
        }
        tag_categories.append(new_cat)
        return new_cat

    # Process section categories: collect IDs only
    section_category_ids = []
    for cat in section.get('categories', []):
        cat_name = cat['name'] if isinstance(cat, dict) else cat
        cat_tags = cat.get('tags', []) if isinstance(cat, dict) else []
        cat_obj = get_or_create_category(cat_name, cat_tags)
        section_category_ids.append(cat_obj['id'])
    section['categories'] = section_category_ids

    # Process note categories: collect IDs only
    for note in section.get('notes', []):
        note_category_ids = []
        for cat in note.get('categories', []):
            cat_name = cat['name'] if isinstance(cat, dict) else cat
            cat_tags = cat.get('tags', []) if isinstance(cat, dict) else []
            cat_obj = get_or_create_category(cat_name, cat_tags)
            note_category_ids.append(cat_obj['id'])
        note['categories'] = note_category_ids

    
    # Add section
    core.document_state.setdefault('sections', []).append(section)

    # Update known_tags
    tags = set(section.get('tags', []))
    for note in section.get('notes', []):
        tags.update(note.get('tags', []))
    # Ensure known_tags is always a set internally
    core.document_state.setdefault('known_tags', set())
    if isinstance(core.document_state['known_tags'], list):
        core.document_state['known_tags'] = set(core.document_state['known_tags'])
    core.document_state['known_tags'].update(tags)

    # Add tags not in any category to Uncategorized
    all_category_tags = set()
    for cat in tag_categories:
        all_category_tags.update(cat['tags'])

# Ensure all tags are in Uncategorized, even if they are in other categories
    uncategorized = next((cat for cat in core.document_state['tag_categories'] if cat['name'].lower() == 'uncategorized'), None)
    if uncategorized:
        # Add every tag in known_tags to Uncategorized, even if it's in another category
        for tag in core.document_state['known_tags']:
            if tag not in uncategorized['tags']:
                uncategorized['tags'].append(tag)
        uncategorized['tags'] = sorted(list(set(uncategorized['tags'])), key=str.lower)

    # --- ENSURE ALL TAGS ARE IN known_tags AND UNCATEGORIZED IF NEEDED ---

    # 1. Collect all tags from categories
    category_tags = set()
    for cat in core.document_state['tag_categories']:
        category_tags.update(cat['tags'])

    # 2. Collect all tags from sections and notes
    section_and_note_tags = set(section.get('tags', []))
    for note in section.get('notes', []):
        section_and_note_tags.update(note.get('tags', []))

    # 3. known_tags is the union of all
    all_tags = category_tags.union(section_and_note_tags)
    core.document_state['known_tags'] = set(all_tags)
    # Convert known_tags to sorted list for saving
    core.document_state['known_tags'] = sorted(list(core.document_state['known_tags']), key=str.lower)
    # Make sure Uncategorized contains ALL tags
    uncategorized = next((cat for cat in core.document_state['tag_categories'] if cat['name'].lower() == 'uncategorized'), None)
    if uncategorized:
        uncategorized['tags'] = sorted(list(set(core.document_state['known_tags'])), key=str.lower)

    state_manager.save_state(state_name)
    return jsonify({'success': True})

def expand_all():
    """Expand all sections and notes, and persist to user config."""
    from py import user_config_manager
    import py.core as core
    username = getattr(core, 'current_username', 'default_user')
    state_name = request.args.get('state') or request.json.get('state') or 'Default_State'
    # Update user config: clear collapsed_sections and collapsed_notes for this state
    config = user_config_manager.load_user_config(username)
    if state_name not in config:
        config[state_name] = {"completed_notes": [], "collapsed_sections": [], "collapsed_notes": []}
    config[state_name]["collapsed_sections"] = []
    config[state_name]["collapsed_notes"] = []
    user_config_manager.save_user_config(username, config)
    return jsonify({"success": True})

# Register route for expand_all
from flask import current_app
## Remove Flask route registration from this file. Route will be registered in app.py
