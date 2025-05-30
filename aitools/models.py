from django.db import models
from django.utils.text import slugify # For slug generation if needed, though not explicitly requested for auto-generation here

class ToolCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    # If you want to auto-generate slug from name on save:
    # def save(self, *args, **kwargs):
    #     if not self.slug:
    #         self.slug = slugify(self.name)
    #     super().save(*args, **kwargs)

class AITool(models.Model):
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('pending', 'Pending Review'),
        ('inactive', 'Inactive'),
    )

    name = models.CharField(max_length=255)
    website_url = models.URLField(unique=True)
    logo_url = models.URLField(blank=True, null=True)
    short_description = models.CharField(max_length=500)
    full_description = models.TextField(blank=True, null=True)
    categories = models.ManyToManyField('ToolCategory', related_name='tools')
    tags = models.JSONField(blank=True, null=True) # Stores a list of strings
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')
    source_of_discovery = models.CharField(max_length=255, blank=True, null=True)
    last_verified_at = models.DateTimeField(blank=True, null=True)
    click_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    # Example method to add tags (if needed, or handle in forms/admin)
    # def add_tags(self, new_tags):
    #     if not isinstance(new_tags, list):
    #         new_tags = [tag.strip() for tag in new_tags.split(',')]
        
    #     if self.tags is None:
    #         self.tags = []
        
    #     for tag in new_tags:
    #         if tag not in self.tags:
    #             self.tags.append(tag)
    #     self.save()

    # Example method to get tags as string
    # def get_tags_display(self):
    #     if self.tags:
    #         return ", ".join(self.tags)
    #     return ""
