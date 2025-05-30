from django.db import models

class NewsSource(models.Model):
    name = models.CharField(max_length=255, unique=True)
    url = models.URLField(unique=True)
    feed_url = models.URLField(null=True, blank=True)
    last_scraped_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class NewsItem(models.Model):
    RATING_CHOICES = (
        ('S', 'S级'),
        ('A', 'A级'),
        ('B', 'B级'),
    )

    source = models.ForeignKey('NewsSource', on_delete=models.CASCADE)
    title = models.CharField(max_length=500)
    original_url = models.URLField(unique=True)
    content_summary = models.TextField()
    full_content_hash = models.CharField(max_length=64, null=True, blank=True, unique=True)
    published_at = models.DateTimeField()
    scraped_at = models.DateTimeField(auto_now_add=True)
    evaluation_rating = models.CharField(max_length=1, choices=RATING_CHOICES, default='B')
    evaluation_notes = models.TextField(null=True, blank=True)
    keywords = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-published_at']

    def __str__(self):
        return self.title

class EvaluationRule(models.Model):
    RATING_CHOICES = (
        ('S', 'S级'),
        ('A', 'A级'),
        ('B', 'B级'),
        (None, '无倾向'),
    )

    keyword = models.CharField(max_length=100, unique=True)
    priority_score_boost = models.IntegerField(default=0)
    target_rating = models.CharField(max_length=1, choices=RATING_CHOICES, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.keyword
