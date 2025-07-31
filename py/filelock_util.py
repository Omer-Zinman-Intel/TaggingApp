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

from contextlib import contextmanager

@contextmanager
def open_locked(path, mode):
    f = open(path, mode)
    try:
        lock_file(f)
        yield f
    finally:
        unlock_file(f)
        f.close()

# Cross-platform FileLock context manager
class FileLock:
    def __init__(self, path):
        self.path = path
        self.file = None

    def __enter__(self):
        self.file = open(self.path, 'w')
        lock_file(self.file)
        return self.file

    def __exit__(self, exc_type, exc_val, exc_tb):
        unlock_file(self.file)
        self.file.close()
