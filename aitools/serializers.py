from rest_framework import serializers
from .models import ToolCategory, AITool

class ToolCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ToolCategory
        fields = ['id', 'name', 'slug', 'description']

class AIToolSerializer(serializers.ModelSerializer):
    categories = ToolCategorySerializer(many=True, read_only=True)
    # For writable categories, you might use PrimaryKeyRelatedField:
    # categories_ids = serializers.PrimaryKeyRelatedField(
    #     queryset=ToolCategory.objects.all(), 
    #     source='categories', 
    #     many=True, 
    #     write_only=True
    # )

    class Meta:
        model = AITool
        fields = [
            'id', 
            'name', 
            'website_url', 
            'logo_url', 
            'short_description', 
            'full_description',
            'categories', # For read operations
            # 'categories_ids', # For write operations if using PrimaryKeyRelatedField
            'tags', 
            'status', 
            'click_count', 
            'created_at',
            'updated_at', # Added for completeness, can be removed if not needed
            'last_verified_at', # Added for completeness
            'source_of_discovery' # Added for completeness
        ]
        read_only_fields = ('click_count', 'created_at', 'updated_at')

        # If you need to make 'tags' (JSONField) more structured for input,
        # you could use a custom field or validate it in the view/serializer's validate_tags method.
        # For simple list of strings, default handling is often okay for reads.
        # For writes, client should send a valid JSON array of strings.
