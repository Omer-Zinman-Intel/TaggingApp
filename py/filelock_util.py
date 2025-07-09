# For cross-platform file locking
import os
import sys

if sys.platform == 'win32':
    def lock_file(f):
        pass
    def unlock_file(f):
        pass
else:
    import fcntl
    def lock_file(f):
        fcntl.flock(f, fcntl.LOCK_EX)
    def unlock_file(f):
        fcntl.flock(f, fcntl.LOCK_UN)
