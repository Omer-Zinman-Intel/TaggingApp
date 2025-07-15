import os
import json
import datetime
from flask import Flask, request, jsonify
from py import views
import py.core as core
import py.state_manager as state_manager

app = Flask(__name__)
app.secret_key = core.SECRET_KEY

# --- API endpoint for frontend logging fallback ---
@app.route('/api/log', methods=['POST'])
def api_log():
    try:
        data = request.get_json(force=True)
        event = data.get('event', 'UNKNOWN_EVENT')
        payload = data.get('data', {})
        # Compose log line
        now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_line = f"[{now}] [FRONTEND_LOG] {event}: {payload}\n"
        # Write to today's log file
        log_dir = os.path.join(os.path.dirname(__file__), 'logs')
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)
        log_file = os.path.join(log_dir, f'frontend_{datetime.datetime.now().strftime('%Y-%m-%d')}.log')
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(log_line)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Create logs directory if it doesn't exist
if not os.path.exists('logs'):
    os.makedirs('logs')

# JavaScript error logging endpoint
@app.route('/log_js_error', methods=['POST'])
def log_js_error():
    try:
        error_data = request.get_json()
        if error_data:
            # Create log filename based on date
            today = datetime.datetime.now().strftime('%Y-%m-%d')
            log_filename = f'logs/js_errors_{today}.log'
            
            # Write error to log file
            with open(log_filename, 'a', encoding='utf-8') as f:
                f.write(json.dumps(error_data) + '\n')
            
            return jsonify({'status': 'success'})
        else:
            return jsonify({'status': 'error', 'message': 'No data received'}), 400
    except Exception as e:
        print(f'Error logging JS error: {e}')
        return jsonify({'status': 'error', 'message': str(e)}), 500

# Minimal robust logging endpoint for browser logs
@app.route('/log', methods=['POST'])
def log_client_log():
    try:
        log_data = request.get_json()
        if log_data:
            today = datetime.datetime.now().strftime('%Y-%m-%d')
            log_filename = f'logs/client_{today}.log'
            with open(log_filename, 'a', encoding='utf-8') as f:
                f.write(json.dumps(log_data) + '\n')
            return jsonify({'status': 'success'})
        else:
            return jsonify({'status': 'error', 'message': 'No data received'}), 400
    except Exception as e:
        print(f'Error logging client log: {e}')
        return jsonify({'status': 'error', 'message': str(e)}), 500

# Register Jinja2 custom filter
app.jinja_env.filters['remove_case_insensitive'] = views.remove_case_insensitive_filter

# Attach routes using the functions from the views module
app.add_url_rule('/', 'index', views.index)
app.add_url_rule('/state/create', 'create_state', views.create_state, methods=["POST"])
app.add_url_rule('/state/rename', 'rename_state', views.rename_state, methods=["POST"])
app.add_url_rule('/state/delete', 'delete_state', views.delete_state, methods=["POST"])
app.add_url_rule("/update-title", 'update_title', views.update_title, methods=["POST"])
app.add_url_rule("/section/add", 'add_section', views.add_section, methods=["POST"])
app.add_url_rule("/section/update/<section_id>", 'update_section', views.update_section, methods=["POST"])
app.add_url_rule("/section/delete/<section_id>", 'delete_section', views.delete_section, methods=["POST"])
app.add_url_rule("/note/add/<section_id>", 'add_note', views.add_note, methods=["POST"])
app.add_url_rule("/note/update/<section_id>/<note_id>", 'update_note', views.update_note, methods=["POST"])
app.add_url_rule("/note/delete/<section_id>/<note_id>", 'delete_note', views.delete_note, methods=["POST"])
app.add_url_rule("/tags/add", 'add_global_tag', views.add_global_tag, methods=["POST"])
app.add_url_rule("/tags/rename", 'rename_global_tag', views.rename_global_tag, methods=["POST"])
app.add_url_rule("/tags/delete", 'delete_global_tag', views.delete_global_tag, methods=["POST"])
app.add_url_rule("/and-tags/add", 'add_and_tag', views.add_and_tag, methods=["POST"])
app.add_url_rule("/and-tags/update", 'update_and_tag', views.update_and_tag, methods=["POST"])
app.add_url_rule("/and-tags/delete", 'delete_and_tag', views.delete_and_tag, methods=["POST"])
app.add_url_rule("/category/add", 'add_category', views.add_category, methods=["POST"])
app.add_url_rule("/category/rename", 'rename_category', views.rename_category, methods=["POST"])
app.add_url_rule("/category/delete", 'delete_category', views.delete_category, methods=["POST"])
app.add_url_rule("/tag/move", 'move_tag', views.move_tag, methods=["POST"])
app.add_url_rule("/tag/remove_and_component", 'remove_and_tag_component', views.remove_and_tag_component, methods=["POST"])
app.add_url_rule("/tag/remove_globally", 'remove_tag_globally', views.remove_tag_globally, methods=["POST"])
app.add_url_rule("/tag/rename_globally", 'rename_tag_globally', views.rename_tag_globally, methods=["POST"])
app.add_url_rule("/import", 'import_html', views.import_html, methods=["POST"])
app.add_url_rule("/import/clear", 'import_clear', views.import_clear, methods=["POST"])
app.add_url_rule("/import/add", 'import_add', views.import_add, methods=["POST"])
app.add_url_rule('/section/reorder_notes/<section_id>', 'reorder_notes', views.reorder_notes, methods=["POST"])
app.add_url_rule('/note/toggle_completed/<section_id>/<note_id>', 'toggle_note_completed', views.toggle_note_completed, methods=["POST"])


# --- Initial State Loading and Main Execution ---
if __name__ == "__main__":
    if not state_manager.get_available_states():
        print("No states found. Creating a 'Default State' to begin.")
        state_manager.create_default_state("Default State")
    
    available_states = state_manager.get_available_states()
    if available_states:
        initial_state_name = state_manager.get_state_name_from_filename(available_states[0])
        state_manager.load_state(initial_state_name)
    
    app.run(debug=True, host='0.0.0.0')