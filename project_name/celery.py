import os
from celery import Celery
from django.conf import settings # Import settings

# Set the default Django settings module for the 'celery' program.
# Replace 'project_name.settings' with your actual project's settings module path.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project_name.settings')

app = Celery('project_name') # Replace 'project_name' with your actual project name

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django app configs.
# This will automatically discover tasks in files named 'tasks.py' within your apps.
app.autodiscover_tasks() 

# Example debug task (optional)
@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')

# It's good practice to ensure tasks are discovered from all apps listed in INSTALLED_APPS
# by calling app.autodiscover_tasks(lambda: settings.INSTALLED_APPS)
# However, app.autodiscover_tasks() usually works if your tasks.py are correctly placed.
# For more explicit control if needed:
# app.autodiscover_tasks(packages=[
#     'newsfeed', # Assuming 'newsfeed.tasks' exists
#     'aitools',  # Assuming 'aitools.tasks' exists
#     # Add other apps with tasks here
# ])
