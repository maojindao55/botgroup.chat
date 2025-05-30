from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ToolCategoryViewSet, AIToolViewSet

router = DefaultRouter()
router.register(r'categories', ToolCategoryViewSet, basename='toolcategory')
router.register(r'tools', AIToolViewSet, basename='aitool')

# The API URLs are now determined automatically by the router.
urlpatterns = [
    path('', include(router.urls)),
]
