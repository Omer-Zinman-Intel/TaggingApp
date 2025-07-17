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
        return {}
    with open(path, "r", encoding="utf-8") as f:
        filelock_util.lock_file(f)
        try:
            data = json.load(f)
        finally:
            filelock_util.unlock_file(f)
    # Migrate old schema if needed
    if "completed_notes" in data or "collapsed_sections" in data or "collapsed_notes" in data:
        # Old schema detected, migrate to new per-state schema
        migrated = {}
        # Try to get current state from request if possible
        from flask import request
        state_name = request.args.get('state') or request.json.get('state') or 'Default_State'
        migrated[state_name] = {
            "completed_notes": data.get("completed_notes", {}).get(state_name, []) if isinstance(data.get("completed_notes", {}), dict) else data.get("completed_notes", []),
            "collapsed_sections": data.get("collapsed_sections", []),
            "collapsed_notes": data.get("collapsed_notes", {}).get(state_name, []) if isinstance(data.get("collapsed_notes", {}), dict) else data.get("collapsed_notes", []),
        }
        data = migrated
        # Save migrated config
        save_user_config(username, data)
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
    if state_name not in config:
        config[state_name] = {"completed_notes": [], "collapsed_sections": [], "collapsed_notes": []}
    completed_notes = set(config[state_name].get("completed_notes", []))
    if note_id in completed_notes:
        completed_notes.remove(note_id)
        completed = False
    else:
        completed_notes.add(note_id)
        completed = True
    config[state_name]["completed_notes"] = list(completed_notes)
    save_user_config(username, config)
    return completed


def is_note_completed(username: str, note_id: str) -> bool:
    config = load_user_config(username)
    from flask import request
    state_name = request.args.get('state') or request.json.get('state') or 'Default_State'
    if state_name not in config:
        return False
    return note_id in config[state_name].get("completed_notes", [])
