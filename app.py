# app.py
import os
from flask import Flask
import py.views as views
import py.config as config
import py.state_manager as state_manager

app = Flask(__name__)
app.secret_key = config.SECRET_KEY

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
app.add_url_rule("/tags/create", 'create_tag_from_editor', views.create_tag_from_editor, methods=["POST"])
app.add_url_rule("/tags/rename", 'rename_global_tag', views.rename_global_tag, methods=["POST"])
app.add_url_rule("/tags/delete", 'delete_global_tag', views.delete_global_tag, methods=["POST"])
app.add_url_rule("/category/add", 'add_category', views.add_category, methods=["POST"])
app.add_url_rule("/category/rename", 'rename_category', views.rename_category, methods=["POST"])
app.add_url_rule("/category/delete", 'delete_category', views.delete_category, methods=["POST"])
app.add_url_rule("/tag/move", 'move_tag', views.move_tag, methods=["POST"])
app.add_url_rule("/tag/remove_and_component", 'remove_and_tag_component', views.remove_and_tag_component, methods=["POST"])
app.add_url_rule("/tag/remove_globally", 'remove_tag_globally', views.remove_tag_globally, methods=["POST"])
app.add_url_rule("/tag/rename_globally", 'rename_tag_globally', views.rename_tag_globally, methods=["POST"])
app.add_url_rule("/import", 'import_html', views.import_html, methods=["POST"])


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