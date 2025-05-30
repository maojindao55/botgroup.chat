from django.test import TestCase
from django.utils import timezone
from unittest.mock import patch, MagicMock # For mocking feedparser
from datetime import datetime, timedelta
import time # For converting struct_time

from .models import NewsSource, NewsItem, EvaluationRule
from .nlp_processor import evaluate_news_item_rating # Assuming this function is importable
from .scrapers import scrape_active_news_sources # Assuming this function is importable

class NewsSourceAndItemModelTests(TestCase):
    def setUp(self):
        self.source1 = NewsSource.objects.create(
            name="Test News Source",
            url="http://testsource.com",
            feed_url="http://testsource.com/feed"
        )

    def test_news_source_creation(self):
        self.assertEqual(self.source1.name, "Test News Source")
        self.assertEqual(str(self.source1), "Test News Source")
        self.assertTrue(self.source1.is_active)
        self.assertIsNotNone(self.source1.created_at)
        self.assertIsNotNone(self.source1.updated_at)

    def test_news_item_creation(self):
        item1_published_time = timezone.now() - timedelta(days=1)
        item1 = NewsItem.objects.create(
            source=self.source1,
            title="Test News Item 1",
            original_url="http://testsource.com/newsitem1",
            content_summary="Summary of item 1.",
            published_at=item1_published_time
        )
        self.assertEqual(item1.source, self.source1)
        self.assertEqual(item1.title, "Test News Item 1")
        self.assertEqual(str(item1), "Test News Item 1") # Assuming __str__ returns title
        self.assertEqual(item1.evaluation_rating, 'B') # Default rating
        self.assertIsNone(item1.full_content_hash) # Default
        self.assertIsNotNone(item1.scraped_at)
        self.assertIsNotNone(item1.created_at)
        self.assertIsNotNone(item1.updated_at)

        # Test ordering (if Meta.ordering is set to '-published_at')
        item2_published_time = timezone.now()
        NewsItem.objects.create(
            source=self.source1,
            title="Test News Item 2 (Newer)",
            original_url="http://testsource.com/newsitem2",
            content_summary="Summary of item 2.",
            published_at=item2_published_time
        )
        all_items = NewsItem.objects.all()
        if NewsItem._meta.ordering == ['-published_at']:
            self.assertEqual(all_items.first().title, "Test News Item 2 (Newer)")
            self.assertEqual(all_items.last().title, "Test News Item 1")


class EvaluationRuleModelTests(TestCase):
    def test_evaluation_rule_creation(self):
        rule1 = EvaluationRule.objects.create(
            keyword="AI Impact",
            priority_score_boost=50,
            target_rating='A'
        )
        self.assertEqual(rule1.keyword, "AI Impact")
        self.assertEqual(str(rule1), "AI Impact") # Assuming __str__ returns keyword
        self.assertTrue(rule1.is_active)
        self.assertEqual(rule1.priority_score_boost, 50)
        self.assertEqual(rule1.target_rating, 'A')


class NLPEvaluationTests(TestCase):
    def setUp(self):
        self.source = NewsSource.objects.create(name="EvalSource", url="http://evalsource.com")
        self.item_to_eval = NewsItem.objects.create(
            source=self.source,
            title="Initial Title for Evaluation",
            original_url="http://evalsource.com/item1",
            content_summary="Initial content summary for evaluation.",
            published_at=timezone.now()
        )
        # Default rating is 'B'

        # Rules
        self.rule_s_tier = EvaluationRule.objects.create(keyword="Super AI", priority_score_boost=200, target_rating='S')
        self.rule_a_tier_high_score = EvaluationRule.objects.create(keyword="Advanced AI", priority_score_boost=80, target_rating='A')
        self.rule_a_tier_low_score = EvaluationRule.objects.create(keyword="AI Research", priority_score_boost=30, target_rating='A') # Lower score, but still 'A'
        self.rule_b_tier_score_only = EvaluationRule.objects.create(keyword="General Tech", priority_score_boost=10) # No target_rating, score implies 'B'

    def test_evaluation_s_tier_by_targeted_rule(self):
        self.item_to_eval.title = "Article about Super AI breakthroughs"
        self.item_to_eval.content_summary = "This technology is amazing."
        self.item_to_eval.save()

        evaluate_news_item_rating(self.item_to_eval.id)
        self.item_to_eval.refresh_from_db()

        self.assertEqual(self.item_to_eval.evaluation_rating, 'S')
        self.assertIn("Keyword: 'Super AI'", self.item_to_eval.evaluation_notes)
        self.assertIn("High potential impact.", self.item_to_eval.evaluation_notes)

    def test_evaluation_a_tier_by_highest_score_targeted_rule(self):
        self.item_to_eval.title = "News on Advanced AI and also some AI Research"
        self.item_to_eval.content_summary = "Exploring new frontiers in Advanced AI and ongoing AI Research."
        self.item_to_eval.save()
        
        evaluate_news_item_rating(self.item_to_eval.id)
        self.item_to_eval.refresh_from_db()

        self.assertEqual(self.item_to_eval.evaluation_rating, 'A')
        self.assertIn("Keyword: 'Advanced AI'", self.item_to_eval.evaluation_notes)
        self.assertIn("Keyword: 'AI Research'", self.item_to_eval.evaluation_notes)
        self.assertIn("Moderate potential impact.", self.item_to_eval.evaluation_notes)
        # Check score part of notes if possible, e.g. "Initial score: 110" (80+30)

    def test_evaluation_a_tier_by_score_threshold(self):
        # Remove specific target_rating from rule_a_tier_high_score to test score threshold
        self.rule_a_tier_high_score.target_rating = None
        self.rule_a_tier_high_score.save()
        
        self.item_to_eval.title = "Advanced AI without specific rule target"
        self.item_to_eval.content_summary = "The content mentions Advanced AI multiple times."
        self.item_to_eval.save()

        evaluate_news_item_rating(self.item_to_eval.id)
        self.item_to_eval.refresh_from_db()
        
        # Score is 80 (from Advanced AI) + potentially 0 or other if other keywords match
        # Assuming 'Advanced AI' (80) is the only match from the high score rules
        self.assertEqual(self.item_to_eval.evaluation_rating, 'A')
        self.assertIn("Keyword: 'Advanced AI'", self.item_to_eval.evaluation_notes)
        self.assertIn("Initial score: 80", self.item_to_eval.evaluation_notes) # Check if score is reflected

    def test_evaluation_b_tier_no_matching_keywords(self):
        self.item_to_eval.title = "Standard Technology News"
        self.item_to_eval.content_summary = "This is a regular news piece."
        self.item_to_eval.save()

        evaluate_news_item_rating(self.item_to_eval.id)
        self.item_to_eval.refresh_from_db()

        self.assertEqual(self.item_to_eval.evaluation_rating, 'B')
        self.assertIn("No specific keywords matched", self.item_to_eval.evaluation_notes)

    def test_evaluation_b_tier_low_score_keyword(self):
        self.item_to_eval.title = "Article on General Tech"
        self.item_to_eval.content_summary = "Some new General Tech was released."
        self.item_to_eval.save()

        evaluate_news_item_rating(self.item_to_eval.id)
        self.item_to_eval.refresh_from_db()
        
        self.assertEqual(self.item_to_eval.evaluation_rating, 'B')
        self.assertIn("Keyword: 'General Tech'", self.item_to_eval.evaluation_notes)
        self.assertIn("Initial score: 10", self.item_to_eval.evaluation_notes)


class ScraperTests(TestCase):
    def setUp(self):
        self.source = NewsSource.objects.create(
            name="Mocked Feed Source",
            url="http://mockedsource.com",
            feed_url="http://mockedsource.com/feed",
            is_active=True
        )
        # Inactive source for testing it's skipped
        NewsSource.objects.create(
            name="Inactive Source",
            url="http://inactivesource.com",
            feed_url="http://inactivesource.com/feed",
            is_active=False
        )

    @patch('newsfeed.scrapers.feedparser.parse') # Path to feedparser in the scrapers module
    def test_scrape_creates_news_items(self, mock_feedparser_parse):
        # Prepare mock feed data
        mock_entry1_time = timezone.now() - timedelta(hours=2)
        mock_entry1_struct_time = mock_entry1_time.timetuple() # feedparser uses struct_time

        mock_entry2_time = timezone.now() - timedelta(hours=1)
        mock_entry2_struct_time = mock_entry2_time.timetuple()

        mock_feed_data = {
            'bozo': 0, # 0 means well-formed
            'entries': [
                {
                    'title': 'Scraped Title 1',
                    'link': 'http://mockedsource.com/scraped_item1',
                    'summary': 'Summary for item 1.',
                    'published_parsed': mock_entry1_struct_time,
                },
                {
                    'title': 'Scraped Title 2',
                    'link': 'http://mockedsource.com/scraped_item2',
                    'summary': 'Summary for item 2.',
                    'published_parsed': mock_entry2_struct_time,
                },
                { # Entry without published_parsed, should use current time or skip based on scraper logic
                    'title': 'Scraped Title 3 (No Date)',
                    'link': 'http://mockedsource.com/scraped_item3',
                    'summary': 'Summary for item 3.',
                    'published_parsed': None, # No date
                }
            ]
        }
        # Configure the mock to return the mock_feed_data
        # Using MagicMock allows attribute access like feed.entries
        mock_feed_instance = MagicMock()
        mock_feed_instance.bozo = mock_feed_data['bozo']
        mock_feed_instance.entries = mock_feed_data['entries']
        mock_feedparser_parse.return_value = mock_feed_instance

        # Initial call to scraper
        scrape_active_news_sources()

        # Assertions
        self.assertEqual(NewsItem.objects.count(), 2) # Assuming item 3 (no date) is handled by defaulting to now() by scraper
        
        item1 = NewsItem.objects.get(original_url='http://mockedsource.com/scraped_item1')
        self.assertEqual(item1.title, 'Scraped Title 1')
        self.assertEqual(item1.source, self.source)
        # Compare datetimes carefully, ensuring timezone awareness matches if applicable
        # feedparser's published_parsed is timezone-naive struct_time. Scraper should make it aware.
        expected_published_dt1 = timezone.make_aware(datetime.fromtimestamp(time.mktime(mock_entry1_struct_time)), timezone.utc)
        self.assertAlmostEqual(item1.published_at, expected_published_dt1, delta=timedelta(seconds=1))


        item2 = NewsItem.objects.get(original_url='http://mockedsource.com/scraped_item2')
        self.assertEqual(item2.title, 'Scraped Title 2')

        item3 = NewsItem.objects.filter(original_url='http://mockedsource.com/scraped_item3').first()
        self.assertIsNotNone(item3, "Item 3 should be created with current time as published_at")
        # Check if its published_at is recent (close to now)
        self.assertTrue(timezone.now() - item3.published_at < timedelta(minutes=1))


        # Verify NewsSource last_scraped_at is updated
        self.source.refresh_from_db()
        self.assertIsNotNone(self.source.last_scraped_at)
        self.assertTrue(timezone.now() - self.source.last_scraped_at < timedelta(minutes=1))

        # Test de-duplication: Call scraper again, no new items should be created
        # Re-configure mock if it's consumed or stateful, though simple return_value should be fine.
        mock_feedparser_parse.return_value = mock_feed_instance # Ensure it's still returning the same mock
        
        scrape_active_news_sources()
        self.assertEqual(NewsItem.objects.count(), 2) # Still 2 items
        
        # Ensure inactive sources are not scraped
        mock_feedparser_parse.assert_called_once_with(self.source.feed_url)
        # or check call_args_list if multiple active sources were involved:
        # self.assertIn(self.source.feed_url, [call_args[0][0] for call_args in mock_feedparser_parse.call_args_list])


    @patch('newsfeed.scrapers.feedparser.parse')
    def test_scrape_handles_feedparser_bozo_exception(self, mock_feedparser_parse):
        mock_feed_instance = MagicMock()
        mock_feed_instance.bozo = 1 # Indicates a problem with the feed
        mock_feed_instance.bozo_exception = Exception("Malformed XML")
        mock_feed_instance.entries = [] # No entries due to error
        mock_feedparser_parse.return_value = mock_feed_instance

        scrape_active_news_sources()

        self.assertEqual(NewsItem.objects.count(), 0) # No items should be created
        self.source.refresh_from_db()
        self.assertIsNotNone(self.source.last_scraped_at) # last_scraped_at should still update

    @patch('newsfeed.scrapers.requests.get') # If scraper uses requests directly before feedparser
    @patch('newsfeed.scrapers.feedparser.parse')
    def test_scrape_handles_network_error(self, mock_feedparser_parse, mock_requests_get):
        # Simulate a requests.get() network error
        mock_requests_get.side_effect = requests.exceptions.RequestException("Network timeout")
        
        # Call the scraper function
        scrape_active_news_sources()
        
        # Assertions
        self.assertEqual(NewsItem.objects.count(), 0) # No items should be created
        mock_feedparser_parse.assert_not_called() # feedparser.parse should not be called if request fails
        
        self.source.refresh_from_db()
        # last_scraped_at might or might not be updated depending on where the error is handled in scraper.
        # Assuming it's updated even on failure to prevent constant retries on a bad source.
        self.assertIsNotNone(self.source.last_scraped_at)
```
