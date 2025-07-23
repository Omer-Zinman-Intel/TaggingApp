# Copilot Instructions for TaggingApp

## Project Overview
TaggingApp is a Flask-based document management system with a modular frontend (vanilla JS, HTML, CSS) and backend (Python). It supports hierarchical sections/notes, advanced tagging, tag categories, and real-time logging. State is persisted in JSON files per document.

## Architecture & Data Flow
- **Frontend:**
  - `static/js/` contains modular JS for tag input (`tag-input-global.js`), modals (`modals.js`), drag/drop, editors, and logging.
  - `templates/index.html` is the main UI entry point.
  - Tag/category selection is managed by the global tag input system, which updates hidden form fields for backend submission.
- **Backend:**
  - `app.py` is the Flask entry point.
  - `py/views.py` handles routes and note/section updates.
  - State is stored in `states/*.json` (one per document), with file locking via `py/filelock_util.py`.
  - Logging is written to `logs/` (client and JS error logs).

## Key Patterns & Conventions
- **Tagging:**
  - Singular tags (OR logic) and AND tags (composite, &-joined, AND logic) are supported.
  - Tag categories are managed separately; tags and categories are always stored as arrays in note/section objects.
  - When editing notes, always initialize tag input with both tags and categories (see `modals.js` and `tag-input-global.js`).
- **State Management:**
  - All document state is in JSON files under `states/`. Each note/section has `tags`, `categories`, `completed`, and `collapsed` fields.
  - Use `py/filelock_util.py` for safe concurrent writes.
- **Logging:**
  - Use `appLogger` (frontend) and `/log` endpoint (backend) for all user actions, errors, and modal/component validation.
  - Logs are rotated daily and stored in structured JSON format.
- **Frontend Initialization:**
  - Always re-initialize tag input and modal event handlers when opening modals to ensure correct state.
  - Tag input system expects both tags and categories as arguments to `init()`.
- **Backend Parsing:**
  - Backend expects `tags` as a comma-separated string and `categories` as a JSON array in form submissions.
  - Always parse and validate these fields before updating state files.

## Developer Workflows
- **Run App:**
  - Start Flask server via `python app.py` (ensure dependencies installed).
- **Debugging:**
  - Use browser console for frontend logs unless action requires reload of the page. if it requires reload output to a file; check `logs/` for backend/client logs.
  - Use debug prints in `views.py` to trace received form data.
- **Testing:**
  - Manual testing via UI; inspect `states/*.json` for persisted changes.
- **Adding Features:**
  - Add new JS modules to `static/js/` and import in `index.html`.
  - Add new backend routes in `py/views.py`.

## Examples
- **Tag Input Initialization:**
  ```js
  window.tagInputs.note.init(["tag1", "tag2"], ["cat1", "cat2"]);
  ```
- **Note Object Format:**
  ```json
  {
    "id": "...",
    "noteTitle": "...",
    "tags": ["tag1", "tag2"],
    "categories": ["cat1", "cat2"],
    "completed": false,
    "collapsed": false
  }
  ```

## Key Files
- `static/js/tag-input-global.js`: Tag/category input logic
- `static/js/modals.js`: Modal and tag input initialization
- `py/views.py`: Flask routes and backend logic
- `states/*.json`: Document state
- `logs/`: Client and error logs

---
For unclear patterns or missing conventions, ask the user for clarification and update this file accordingly.

# General code of behavior
- Always ensure that the action does not conflict with existing tags or categories
- When asked to implement a feature, ensure it adheres to the existing architecture and data flow
- Don't ask for manual intervention unless absolutely necessary. Complete the task yourself based on the provided context
- Don't put import statements in the middle of a code block. Always place them at the top