# py/state_manager.py
import os
import json
import copy
import uuid
import re 
import py.core as core
import py.tag_manager as tag_manager # To call get_all_categorized_tags and cleanup_orphan_tags during state load

# --- State Management Functions ---

def get_available_states() -> list[str]:
    """Returns a sorted list of available state filenames (e.g., 'State_One.json')."""
    return sorted([f for f in os.listdir(core.STATES_DIR) if f.endswith('.json')])

def get_state_name_from_filename(filename: str) -> str:
    """Converts a filename ('My_State.json') to a state name ('My_State')."""
    return os.path.splitext(filename)[0]

def get_filename_from_state_name(state_name: str) -> str:
    """
    Sanitizes a user-provided state name into a valid filename.
    Example: 'My Awesome State!' -> 'My_Awesome_State.json'
    """
    sanitized_name = re.sub(r'[^a-zA-Z0-9_-]', '', state_name.replace(' ', '_'))
    return f"{sanitized_name}.json"

def save_state(state_name: str) -> bool:
    import time

    def retry_os_replace(src, dst, retries=5, delay=0.1):
        for i in range(retries):
            try:
                os.replace(src, dst)
                return
            except FileNotFoundError:
                # Temp file is gone, nothing to do
                print(f"Temp file {src} not found during replace.")
                return
            except PermissionError as e:
                if i == retries - 1:
                    raise
                time.sleep(delay)

    def retry_os_remove(path, retries=5, delay=0.1):
        for i in range(retries):
            try:
                os.remove(path)
                return
            except FileNotFoundError:
                # Already deleted, nothing to do
                return
            except PermissionError as e:
                if i == retries - 1:
                    raise
                time.sleep(delay)
    """
    Saves the current in-memory core.document_state to its JSON file atomically.
    It writes to a temporary file first and then replaces the original to prevent
    data corruption in case of an error during writing.
    Returns True on success, False on failure.
    """
    if not state_name:
        print("❌ Error: Attempted to save state with no name.")
        return False

    filename = get_filename_from_state_name(state_name)
    filepath = os.path.join(core.STATES_DIR, filename)
    temp_filepath = filepath + ".tmp"

    # Debug print statements removed for production

    # Create a serializable copy of the state, converting the 'known_tags' set to a list.
    state_to_save = copy.deepcopy(core.document_state)
    if 'known_tags' in state_to_save and isinstance(state_to_save['known_tags'], set):
        state_to_save['known_tags'] = sorted(list(state_to_save['known_tags']))
    
    # Ensure tags in categories are also lists for JSON serialization
    if 'tag_categories' in state_to_save:
        for category in state_to_save['tag_categories']:
            if isinstance(category.get('tags'), set): # Should already be lists, but just in case
                category['tags'] = sorted(list(category['tags']))

    try:
        import getpass
        print(f"Saving as user: {getpass.getuser()}, file: {filepath}")
        import py.filelock_util as filelock_util
        # Write with file lock
        with open(temp_filepath, 'w', encoding='utf-8') as f:
            filelock_util.lock_file(f)
            try:
                json.dump(state_to_save, f, indent=4)
            finally:
                filelock_util.unlock_file(f)
        # Atomically replace the old file with the new one (robust on Windows)
        retry_os_replace(temp_filepath, filepath)
        print(f"✅ State '{state_name}' saved successfully to {filepath}")
        # Verify the save by reading it back (with lock)
        with open(filepath, 'r', encoding='utf-8') as f:
            filelock_util.lock_file(f)
            try:
                verification_data = json.load(f)
                # Debug print statement removed for production
            finally:
                filelock_util.unlock_file(f)
        return True
    except Exception as e:
        print(f"❌ Error saving state '{state_name}': {e}")
        # Clean up the temporary file if it exists
        if os.path.exists(temp_filepath):
            retry_os_remove(temp_filepath)
        # Save error for frontend to display
        global last_save_error
        last_save_error = str(e)
        return False

def load_state(state_name: str) -> bool:
    """
    Loads a specific state from a JSON file into the global `document_state`.
    Returns True on success, False on failure (e.g., file not found, corrupt JSON).
    """
    filepath = os.path.join(core.STATES_DIR, get_filename_from_state_name(state_name))

    if not os.path.exists(filepath):
        return False

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            loaded_data = json.load(f)
            # Ensure 'known_tags' is a set for efficient operations.
            if 'known_tags' in loaded_data and isinstance(loaded_data['known_tags'], list):
                loaded_data['known_tags'] = set(loaded_data['known_tags'])
            
            # Initialize tag_categories if not present or empty
            if 'tag_categories' not in loaded_data or not loaded_data['tag_categories']:
                # Find or create the "Uncategorized" category
                uncategorized_category = None
                for cat in loaded_data.get('tag_categories', []):
                    if cat['name'].lower() == 'uncategorized':
                        uncategorized_category = cat
                        break
                if not uncategorized_category:
                    uncategorized_category = {"id": str(uuid.uuid4()), "name": "Uncategorized", "tags": []}
                    loaded_data.setdefault("tag_categories", []).insert(0, uncategorized_category)
                
                # Move all known tags to the Uncategorized category if they aren't already there
                if 'known_tags' in loaded_data:
                    for tag in list(loaded_data['known_tags']): # Iterate over a copy
                        if tag not in uncategorized_category['tags']:
                            uncategorized_category['tags'].append(tag)
                    uncategorized_category['tags'].sort(key=str.lower) # Sort them
            
            # Ensure tags within categories are unique and maintain list format
            for category in loaded_data.get('tag_categories', []):
                category['tags'] = list(dict.fromkeys(category.get('tags', [])))

            core.document_state.clear()
            core.document_state.update(loaded_data)
            
        # Sync tags to ensure only actually used tags are available
        tag_manager.sync_known_tags()
        
        return True
    except (json.JSONDecodeError, IOError) as e:
        print(f"Warning: Could not load or decode {filepath}. Error: {e}")
        return False

def create_default_state(state_name: str) -> None:
    """Creates and saves a new, blank state file with a default structure."""
    core.document_state.clear()
    core.document_state.update({
        "documentTitle": state_name,
        "sections": [],
        "known_tags": {"All"},  # 'All' is a special reserved tag.
        "tag_categories": [
            {"id": str(uuid.uuid4()), "name": "Uncategorized", "tags": ["All"]}
        ]
    })
    save_state(state_name)

