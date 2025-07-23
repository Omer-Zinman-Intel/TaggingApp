from flask import request, jsonify
from py import user_config_manager
from py import core

def reset_completion_status():
    username = getattr(core, 'current_username', 'default_user')
    state_name = request.args.get('state') or request.json.get('state') or 'Default_State'
    config = user_config_manager.load_user_config(username)
    # Defensive: ensure state exists in config
    if state_name in config:
        config[state_name]["completed_notes"] = []
        user_config_manager.save_user_config(username, config)
    return jsonify({'success': True})
