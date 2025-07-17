from flask import request, jsonify, abort
from py import user_config_manager, core

def set_collapsed():
    username = getattr(core, 'current_username', 'default_user')
    config = user_config_manager.load_user_config(username)
    item_type = request.json.get('type')  # 'section' or 'note'
    item_id = request.json.get('id')
    collapsed = request.json.get('collapsed', True)
    state = request.args.get('state') or getattr(core, 'current_state_name', None)
    if item_type == 'note':
        if not state:
            abort(400, description='State is required for collapsed notes')
    if state not in config:
        config[state] = {"completed_notes": [], "collapsed_sections": [], "collapsed_notes": []}
    if item_type == 'section':
        arr = config[state].get('collapsed_sections', [])
        if collapsed and item_id not in arr:
            arr.append(item_id)
        elif not collapsed and item_id in arr:
            arr.remove(item_id)
        config[state]['collapsed_sections'] = arr
    elif item_type == 'note':
        notes = config[state].get('collapsed_notes', [])
        if collapsed and item_id not in notes:
            notes.append(item_id)
        elif not collapsed and item_id in notes:
            notes.remove(item_id)
        config[state]['collapsed_notes'] = notes
    user_config_manager.save_user_config(username, config)
    return jsonify({'success': True})
