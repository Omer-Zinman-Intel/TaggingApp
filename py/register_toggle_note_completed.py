# Add a new URL rule for toggling note completion
from py import views

def register_toggle_note_completed(app):
    app.add_url_rule(
        "/note/toggle_completed/<section_id>/<note_id>",
        "toggle_note_completed",
        views.toggle_note_completed,
        methods=["POST"]
    )
