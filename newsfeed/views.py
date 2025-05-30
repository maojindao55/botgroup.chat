from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, DateFilter
from .models import NewsItem
from .serializers import NewsItemSerializer

# Custom FilterSet for NewsItem to enable filtering by date part of published_at
class NewsItemFilter(FilterSet):
    published_at_date = DateFilter(field_name='published_at', lookup_expr='date', label='Published Date (YYYY-MM-DD)')
    # You can add other filters here if needed, for example:
    # title_contains = CharFilter(field_name='title', lookup_expr='icontains')

    class Meta:
        model = NewsItem
        fields = {
            'evaluation_rating': ['exact'], # e.g. /newsitems/?evaluation_rating=A
            # 'published_at': ['exact', 'gte', 'lte', 'year', 'month'], # Other date options
        }
        # Add published_at_date to the list of filterable fields
        # The 'fields' dict is for exact matches or predefined lookups.
        # Custom filters like DateFilter are declared explicitly.

class NewsItemViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows news items to be viewed.
    Supports filtering by evaluation_rating and published_at (date part).
    Supports ordering by published_at and evaluation_rating.
    """
    queryset = NewsItem.objects.all().select_related('source').order_by('-published_at')
    serializer_class = NewsItemSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    
    # Use the custom NewsItemFilter class
    filterset_class = NewsItemFilter 
    
    # Define fields available for filtering (besides those in NewsItemFilter)
    # filterset_fields is an alternative to filterset_class for simpler filters
    # filterset_fields = {
    #     'evaluation_rating': ['exact'],
    #     # 'published_at': ['date'], # This would use default DateFilter if not overridden
    # }

    ordering_fields = ['published_at', 'evaluation_rating', 'scraped_at']
    ordering = ['-published_at'] # Default ordering

    # Optional: Pagination settings (can also be set globally in settings.py)
    # from rest_framework.pagination import PageNumberPagination
    # class StandardResultsSetPagination(PageNumberPagination):
    #     page_size = 20
    #     page_size_query_param = 'page_size'
    #     max_page_size = 100
    # pagination_class = StandardResultsSetPagination
