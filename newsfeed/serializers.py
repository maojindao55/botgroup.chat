from rest_framework import serializers
from .models import NewsSource, NewsItem

class NewsSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsSource
        fields = ['id', 'name', 'url', 'feed_url', 'is_active']

class NewsItemSerializer(serializers.ModelSerializer):
    # source = NewsSourceSerializer(read_only=True) 
    # Option 1: Nested serializer. Can be verbose.

    # source = serializers.StringRelatedField() 
    # Option 2: Uses __str__ method of NewsSource. Simple.

    source_name = serializers.ReadOnlyField(source='source.name')
    # Option 3: Expose specific field from related model. Clean for read-only.
    
    # To display human-readable choices for evaluation_rating:
    # rating_display = serializers.CharField(source='get_evaluation_rating_display', read_only=True)
    # This requires get_evaluation_rating_display() method on NewsItem model.
    # Alternatively, frontend can map 'A' to 'A级'. For now, returning the raw value.

    class Meta:
        model = NewsItem
        fields = [
            'id', 
            'title', 
            'original_url', 
            'content_summary', 
            'published_at', 
            'scraped_at',
            'evaluation_rating', 
            # 'rating_display', # if using SerializerMethodField or source for display
            'evaluation_notes', 
            'source_name', # Using source_name from Option 3
            # 'source', # if using Option 1 or 2
            'keywords', # Assuming keywords is a JSONField and DRF handles it.
            'updated_at'
        ]
        read_only_fields = ['scraped_at', 'updated_at']

    # If you want to provide the choices in the API schema (e.g. for Swagger/OpenAPI):
    # evaluation_rating = serializers.ChoiceField(choices=NewsItem.RATING_CHOICES)
    # However, this makes it writable. For read-only viewset, current approach is fine.
    # If writable, ensure the input 'S级' is converted back to 'S' if needed.
    # For ReadOnlyModelViewSet, direct field is fine.
    
    # Example for SerializerMethodField if needed for rating_display:
    # def get_rating_display(self, obj):
    #     return obj.get_evaluation_rating_display()
