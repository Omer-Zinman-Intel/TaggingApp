import os
import json
from py import filelock_util

USER_CONFIG_DIR = "user-config"


def get_user_config_path(username: str) -> str:
    """Returns the path to the user's config file."""
    if not os.path.exists(USER_CONFIG_DIR):
        os.makedirs(USER_CONFIG_DIR)
    return os.path.join(USER_CONFIG_DIR, f"{username}_config.json")


def load_user_config(username: str) -> dict:
    path = get_user_config_path(username)
    if not os.path.exists(path):
        return {"completed_notes": {}}
    with open(path, "r", encoding="utf-8") as f:
        filelock_util.lock_file(f)
        try:
            data = json.load(f)
        finally:
            filelock_util.unlock_file(f)
    if "completed_notes" not in data:
        data["completed_notes"] = {}
    return data


def save_user_config(username: str, config: dict):
    path = get_user_config_path(username)
    with open(path, "w", encoding="utf-8") as f:
        filelock_util.lock_file(f)
        try:
            json.dump(config, f, indent=2)
        finally:
            filelock_util.unlock_file(f)


def toggle_note_completed(username: str, note_id: str) -> bool:
    config = load_user_config(username)
    from flask import request
    state_name = request.args.get('state') or request.json.get('state') or 'Default_State'
    completed_notes_by_state = config.get("completed_notes", {})
    completed_notes = set(completed_notes_by_state.get(state_name, []))
    if note_id in completed_notes:
        completed_notes.remove(note_id)
        completed = False
    else:
        completed_notes.add(note_id)
        completed = True
    completed_notes_by_state[state_name] = list(completed_notes)
    config["completed_notes"] = completed_notes_by_state
    save_user_config(username, config)
    return completed


def is_note_completed(username: str, note_id: str) -> bool:
    config = load_user_config(username)
    from flask import request
    state_name = request.args.get('state') or request.json.get('state') or 'Default_State'
    completed_notes_by_state = config.get("completed_notes", {})
    return note_id in completed_notes_by_state.get(state_name, [])
