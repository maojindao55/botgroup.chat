import feedparser
import requests
from bs4 import BeautifulSoup
from django.utils import timezone
import hashlib
from datetime import datetime
import pytz # Import pytz

# Attempt to import Django models. This will only work if Django is set up.
try:
    from .models import NewsSource, NewsItem
except ImportError:
    # This is a fallback for environments where Django settings are not configured yet.
    # For the purpose of this script, we'll define dummy models if the import fails.
    # In a real Django app, ensure settings are configured before running such scripts.
    print("Warning: Django models could not be imported. Using dummy models for NewsSource and NewsItem.")
    print("Ensure Django settings are configured and this script is run within a Django context for full functionality.")

    class DummyModel:
        objects = None # Placeholder for objects manager

    class NewsSource(DummyModel):
        def __init__(self, name, url, feed_url=None, is_active=True):
            self.name = name
            self.url = url
            self.feed_url = feed_url
            self.is_active = is_active
            self.last_scraped_at = None

        def save(self):
            print(f"Dummy save for NewsSource: {self.name}")

        @classmethod
        def filter(cls, **kwargs): # Basic filter mock
            print(f"Dummy NewsSource.objects.filter called with {kwargs}")
            # Simulate returning a list of sources for testing
            if kwargs.get('is_active') == True:
                 # These are example sources for testing the scraper logic without a DB
                return [
                    NewsSource(name="TechCrunch AI", feed_url="https://techcrunch.com/category/artificial-intelligence/feed/"),
                    NewsSource(name="Wired AI", feed_url="https://www.wired.com/feed/category/business/artificial-intelligence/latest/rss"),
                    NewsSource(name="MIT Tech Review AI", feed_url="https://www.technologyreview.com/c/artificial-intelligence/feed/"),
                    NewsSource(name="NonExistentFeed", feed_url="http://nonexistent.example.com/feed"),
                    NewsSource(name="HTML Source (No Feed)", url="http://example.com/news", feed_url=None)
                ]
            return []

    class NewsItem(DummyModel):
        def __init__(self, source, title, original_url, published_at, content_summary="", evaluation_rating='B', full_content_hash=None):
            self.source = source
            self.title = title
            self.original_url = original_url
            self.published_at = published_at
            self.content_summary = content_summary
            self.evaluation_rating = evaluation_rating
            self.full_content_hash = full_content_hash
            self.id = None # Simulate no ID until saved

        def save(self):
            self.id = 1 # Simulate saving by assigning an ID
            print(f"Dummy save for NewsItem: {self.title}")

        @classmethod
        def filter(cls, **kwargs): # Basic filter mock
            print(f"Dummy NewsItem.objects.filter called with {kwargs}")
            # Simulate that no item exists by default
            class QuerySetMock:
                def exists(self):
                    return False
            return QuerySetMock()


def scrape_active_news_sources():
    """
    Scrapes active news sources for new items, prioritizing RSS feeds.
    """
    try:
        active_sources = NewsSource.objects.filter(is_active=True)
    except Exception as e:
        print(f"Error accessing NewsSource.objects.filter: {e}")
        print("This might be due to Django settings not being configured or the script running outside a Django project context.")
        print("Attempting to use dummy sources for demonstration if NewsSource.objects was replaced by a mock.")
        if hasattr(NewsSource, 'filter') and callable(getattr(NewsSource, 'filter')): # Check if it's our mock
             active_sources = NewsSource.filter(is_active=True)
        else:
            print("Could not retrieve active sources. Aborting.")
            return

    if not active_sources:
        print("No active news sources found to scrape.")
        return

    for news_source in active_sources:
        print(f"\nScraping {news_source.name}...")

        if news_source.feed_url:
            try:
                print(f"Parsing RSS feed: {news_source.feed_url}")
                feed = feedparser.parse(news_source.feed_url)

                if feed.bozo:
                    # bozo is True if the feed is not well-formed XML
                    print(f"Warning: Feed for {news_source.name} may be malformed. Bozo bit set: {feed.bozo_exception}")


                for entry in feed.entries:
                    title = entry.get('title', 'No Title Provided')
                    link = entry.get('link')
                    summary = entry.get('summary') or entry.get('description', '')

                    if not link:
                        print(f"Skipping entry '{title}' for {news_source.name} due to missing link.")
                        continue

                    # Published date handling
                    published_parsed = entry.get('published_parsed') or entry.get('updated_parsed')
                    published_at = None

                    if published_parsed:
                        try:
                            # Convert struct_time to datetime object
                            dt_naive = datetime(*published_parsed[:6])
                            # Assume UTC if timezone info is missing from feed, then make it timezone-aware
                            # Django requires timezone-aware datetimes if USE_TZ=True
                            published_at = timezone.make_aware(dt_naive, timezone.utc if timezone.is_naive(dt_naive) else None)
                        except Exception as e:
                            print(f"Could not parse date for entry '{title}' from {news_source.name}. Error: {e}. Skipping.")
                            continue # Or use timezone.now() as fallback: published_at = timezone.now()
                    else:
                        print(f"No published date for entry '{title}' from {news_source.name}. Using current time.")
                        published_at = timezone.now() # Fallback to current time

                    # De-duplication check
                    try:
                        if NewsItem.objects.filter(original_url=link).exists():
                            print(f"News item '{title}' from {link} already exists. Skipping.")
                            continue
                    except Exception as e:
                        print(f"Error checking for existing NewsItem with URL {link}: {e}. Assuming it doesn't exist.")


                    # Create and save NewsItem
                    try:
                        # Simple hash for now (can be improved)
                        content_to_hash = title + link
                        item_hash = hashlib.sha256(content_to_hash.encode('utf-8')).hexdigest()

                        news_item = NewsItem(
                            source=news_source,
                            title=title,
                            original_url=link,
                            published_at=published_at,
                            content_summary=summary,
                            evaluation_rating='B', # Default rating
                            full_content_hash=item_hash
                        )
                        news_item.save()
                        print(f"Successfully saved: '{title}' from {news_source.name}")
                    except Exception as e:
                        print(f"Error saving news item '{title}' from {news_source.name}: {e}")

            except requests.exceptions.RequestException as e:
                print(f"Network error while fetching {news_source.feed_url}: {e}")
            except Exception as e:
                print(f"Error processing feed for {news_source.name} ({news_source.feed_url}): {e}")
        
        elif news_source.url: # Placeholder for HTML scraping
            print(f"HTML scraping for {news_source.name} ({news_source.url}) is not yet implemented.")
            # Future implementation:
            # try:
            #     response = requests.get(news_source.url, timeout=10)
            #     response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
            #     soup = BeautifulSoup(response.content, 'html.parser')
            #     # ... custom scraping logic for the site ...
            # except requests.exceptions.RequestException as e:
            #     print(f"Could not fetch HTML from {news_source.url}: {e}")
            # except Exception as e:
            #     print(f"Error parsing HTML for {news_source.name}: {e}")
        else:
            print(f"No feed_url or url provided for {news_source.name}. Skipping.")

        # Update last_scraped_at for the source
        try:
            news_source.last_scraped_at = timezone.now()
            news_source.save()
        except Exception as e:
            print(f"Error updating last_scraped_at for {news_source.name}: {e}")

    print("\nScraping process completed.")

if __name__ == '__main__':
    # This part is for testing the scraper directly.
    # It assumes Django settings are not fully configured, so models might be dummies.
    print("Running scraper directly (for testing purposes)...")
    
    # Mock Django's timezone.now() if Django is not fully set up
    if not hasattr(timezone, 'now'):
        timezone.now = lambda: pytz.utc.localize(datetime.utcnow())
        timezone.make_aware = lambda dt, tz: pytz.utc.localize(dt) if dt.tzinfo is None else dt
        timezone.is_naive = lambda dt: dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None

    # Mock Django's objects manager for dummy models if not present
    if not hasattr(NewsSource, 'objects') or NewsSource.objects is None:
        NewsSource.objects = NewsSource # Use class methods as stand-ins
    if not hasattr(NewsItem, 'objects') or NewsItem.objects is None:
        NewsItem.objects = NewsItem # Use class methods as stand-ins

    scrape_active_news_sources()

    print("\n--- Example of how to create NewsSource entries (run in Django shell) ---")
    print("from newsfeed.models import NewsSource")
    print("from django.utils import timezone")
    print("NewsSource.objects.create(name='TechCrunch AI', feed_url='https://techcrunch.com/category/artificial-intelligence/feed/', is_active=True)")
    print("NewsSource.objects.create(name='Wired AI', feed_url='https://www.wired.com/feed/category/business/artificial-intelligence/latest/rss', is_active=True)")
    print("NewsSource.objects.create(name='MIT Tech Review AI', feed_url='https://www.technologyreview.com/c/artificial-intelligence/feed/', is_active=True)")
    print("print(NewsSource.objects.all())")
    print("-----------------------------------------------------------------------------")
