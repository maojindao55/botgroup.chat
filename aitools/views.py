from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import ToolCategory, AITool
from .serializers import ToolCategorySerializer, AIToolSerializer

class ToolCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows tool categories to be viewed.
    """
    queryset = ToolCategory.objects.all().order_by('name')
    serializer_class = ToolCategorySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'slug', 'description']
    ordering_fields = ['name', 'slug', 'created_at']


class AIToolViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows AI tools to be viewed.
    Supports filtering by category slug/id.
    Supports searching by name, short_description, and tags.
    Supports ordering by created_at, name, click_count.
    Includes an action to increment the click_count for a tool.
    """
    queryset = AITool.objects.filter(status='active').prefetch_related('categories').order_by('-created_at')
    serializer_class = AIToolSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]

    filterset_fields = {
        'categories': ['exact'],  # Allows filtering by category ID: /tools/?categories=1
        'categories__slug': ['exact'], # Allows filtering by category slug: /tools/?categories__slug=text-to-video
        'status': ['exact'], # Allows filtering by status: /tools/?status=active
    }
    
    search_fields = [
        'name', 
        'short_description', 
        'full_description', # Added full_description to search
        'tags' # Searching JSONField 'tags'. Effectiveness depends on DB and DRF version.
               # For PostgreSQL, 'tags__icontains' might be more flexible if tags are strings within JSON.
               # Default search for JSONField might convert it to string and search.
    ]
    ordering_fields = ['created_at', 'name', 'click_count', 'updated_at', 'last_verified_at']
    ordering = ['-created_at'] # Default ordering

    @action(detail=True, methods=['post'], url_path='increment-click')
    def increment_click_count(self, request, pk=None):
        """
        Increments the click_count for a specific AI Tool.
        """
        try:
            tool = self.get_object()
            tool.click_count += 1
            tool.save(update_fields=['click_count', 'updated_at']) # Efficiently update only specified fields
            return Response({'status': 'click count incremented', 'new_count': tool.click_count}, status=status.HTTP_200_OK)
        except AITool.DoesNotExist:
            return Response({'error': 'Tool not found.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            # Log the exception e
            return Response({'error': 'An unexpected error occurred.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Optional: Add a more specific filter class if complex filtering logic is needed for tags
    # For example, if you want to find tools that have *any* of a list of tags, or *all* of them.
    # class AIToolFilter(FilterSet):
    #     # ... custom filter logic ...
    #     class Meta:
    #         model = AITool
    #         fields = [...]
    # filterset_class = AIToolFilter
    
    # Note on prefetch_related('categories'): Added to optimize category access in serializer.
    # Note on save(update_fields): Used in action for better performance.
