# Add a new URL rule for toggling note completion
from py import views

def register_toggle_note_completed(app):
    from py import collapse_state
    app.add_url_rule(
        "/collapse_state",
        "set_collapsed",
        collapse_state.set_collapsed,
        methods=["POST"]
    )
    from py import reset_completion_status
    app.add_url_rule(
        "/reset_completion_status",
        "reset_completion_status",
        reset_completion_status.reset_completion_status,
        methods=["POST"]
    )
    app.add_url_rule(
        "/note/toggle_completed/<section_id>/<note_id>",
        "toggle_note_completed",
        views.toggle_note_completed,
        methods=["POST"]
    )
