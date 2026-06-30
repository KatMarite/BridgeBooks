import sys
import os
try:
    filepath = sys.argv[1]
    with open(filepath, 'r') as f:
        content = f.read()
    content = content.replace('pick ', 'edit ', 1) # Edit the first commit in the sequence
    with open(filepath, 'w') as f:
        f.write(content)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
