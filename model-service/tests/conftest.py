"""
conftest.py — pytest configuration for model-service tests.

Adds the model-service root directory to sys.path so that
`from pipeline.xxx import ...` and `from provider.xxx import ...`
work without installing the package.
"""
import sys
import os

# Ensure the model-service root is on sys.path.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
