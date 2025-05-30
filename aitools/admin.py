from django.contrib import admin
from .models import ToolCategory, AITool

@admin.register(ToolCategory)
class ToolCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'created_at', 'updated_at')
    search_fields = ('name',)
    prepopulated_fields = {'slug': ('name',)}
    list_per_page = 25

@admin.register(AITool)
class AIToolAdmin(admin.ModelAdmin):
    list_display = (
        'name', 
        'website_url_link', # Using custom method for clickable link
        'status', 
        'get_categories_display', 
        'click_count', 
        'created_at', 
        'updated_at'
    )
    list_filter = ('status', 'categories')
    search_fields = ('name', 'website_url', 'short_description', 'tags__icontains') # For searching in JSONField tags
    filter_horizontal = ('categories',)
    list_per_page = 25
    
    fieldsets = (
        ('基本信息', {
            'fields': ('name', 'website_url', 'logo_url', 'status')
        }),
        ('描述', {
            'fields': ('short_description', 'full_description')
        }),
        ('分类与标签', {
            'fields': ('categories', 'tags')
        }),
        ('元数据', {
            'fields': ('source_of_discovery', 'last_verified_at', 'click_count')
        }),
    )
    
    readonly_fields = ('created_at', 'updated_at', 'click_count') # click_count might be managed elsewhere too

    def get_categories_display(self, obj):
        """
        Returns a comma-separated string of category names for the tool.
        """
        return ", ".join([category.name for category in obj.categories.all()])
    get_categories_display.short_description = 'Categories'

    def website_url_link(self, obj):
        """
        Returns the website_url as an HTML link.
        """
        from django.utils.html import format_html
        if obj.website_url:
            return format_html("<a href='{url}' target='_blank'>{url}</a>", url=obj.website_url)
        return "-"
    website_url_link.short_description = 'Website URL'
    website_url_link.admin_order_field = 'website_url' # Allows sorting by website_url column

# To search JSONField tags effectively, ensure your Django version and DB support it well.
# For older versions or specific DBs, custom search logic might be needed if 'tags__icontains' isn't effective.
# The 'tags__icontains' lookup for JSONField might behave differently based on DB backend (PostgreSQL is good).
# If tags is a list of strings, 'tags__contains' might be more appropriate if you want to match a whole tag.
# 'tags__icontains' would do a substring match within the JSON structure (e.g. part of a tag).
# If you stored tags as a simple string of comma-separated values, then 'tags__icontains' on CharField/TextField would be standard.
# For JSONField list of strings, to match any tag exactly:
# you might need a custom filter or iterate in Python if not too many records,
# or use more advanced DB-specific JSON operators if 'tags__contains=["video"]' (for exact element match) isn't supported directly in search_fields.
# For now, 'tags__icontains' is a general approach.
