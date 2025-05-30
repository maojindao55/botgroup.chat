from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NewsItemViewSet

router = DefaultRouter()
router.register(r'newsitems', NewsItemViewSet, basename='newsitem')

# The API URLs are now determined automatically by the router.
urlpatterns = [
    path('', include(router.urls)),
]
