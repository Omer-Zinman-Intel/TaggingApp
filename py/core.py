# Core configuration and global state for TaggingApp
import os

# Configuration
STATES_DIR = "states"
SECRET_KEY = 'a-secure-secret-key-for-flash-messages'

# Ensure the directory for storing state files exists on startup
if not os.path.exists(STATES_DIR):
    os.makedirs(STATES_DIR)

# Global state - holds the currently loaded document state
document_state = {}
