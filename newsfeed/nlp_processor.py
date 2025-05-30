from newspaper import Article, ArticleException
from django.core.exceptions import ObjectDoesNotExist

# Attempt to import Django models. This will only work if Django is set up.
try:
    from .models import NewsItem, EvaluationRule
    NEWS_ITEM_RATING_CHOICES = [choice[0] for choice in NewsItem.RATING_CHOICES]
except ImportError:
    print("Warning: Django models (NewsItem, EvaluationRule) could not be imported. Using dummy models.")
    print("Ensure Django settings are configured for full functionality.")

    NEWS_ITEM_RATING_CHOICES = ['S', 'A', 'B'] # Define directly for dummy

    class DummyBaseModel:
        _items_store = {}
        _next_id = 1

        def __init__(self, id=None, **kwargs):
            self.id = id if id is not None else self.__class__._next_id
            if id is None:
                self.__class__._next_id += 1
            
            for key, value in kwargs.items():
                setattr(self, key, value)

        def save(self):
            self.__class__._items_store[self.id] = self
            # print(f"Dummy save for {self.__class__.__name__} ID {self.id}")

        @classmethod
        def get_item(cls, item_id):
            return cls._items_store.get(item_id)
        
        @classmethod
        def filter_items(cls, **kwargs): # More generic filter
            results = []
            for item in cls._items_store.values():
                match = True
                for key, value in kwargs.items():
                    if not hasattr(item, key) or getattr(item, key) != value:
                        match = False
                        break
                if match:
                    results.append(item)
            return results

    class DummyNewsItem(DummyBaseModel):
        RATING_CHOICES = (('S', 'S级'), ('A', 'A级'), ('B', 'B级'))
        _items_store = {} # Separate store for NewsItem
        _next_id = 1

        def __init__(self, original_url=None, title="Untitled", content_summary="", evaluation_rating='B', evaluation_notes="", id=None):
            super().__init__(id=id, original_url=original_url, title=title, content_summary=content_summary, 
                             evaluation_rating=evaluation_rating, evaluation_notes=evaluation_notes)

        @classmethod
        def create_dummy_item(cls, **kwargs):
            item = cls(**kwargs)
            item.save()
            return item.id

    class DummyEvaluationRule(DummyBaseModel):
        RATING_CHOICES = (('S', 'S级'), ('A', 'A级'), ('B', 'B级'), (None, '无倾向'))
        _items_store = {} # Separate store for EvaluationRule
        _next_id = 1

        def __init__(self, keyword, priority_score_boost=0, target_rating=None, is_active=True, id=None):
            super().__init__(id=id, keyword=keyword, priority_score_boost=priority_score_boost, 
                             target_rating=target_rating, is_active=is_active)
        
        @classmethod
        def create_dummy_rule(cls, **kwargs):
            rule = cls(**kwargs)
            rule.save()
            return rule.id


    class ObjectsManagerMock:
        def __init__(self, model_cls):
            self.model_cls = model_cls

        def get(self, id):
            item = self.model_cls.get_item(id)
            if item is None:
                raise ObjectDoesNotExist(f"{self.model_cls.__name__} with id={id} does not exist.")
            return item
        
        def filter(self, **kwargs): # Mock filter
            return self.model_cls.filter_items(**kwargs)


    NewsItem = DummyNewsItem
    NewsItem.objects = ObjectsManagerMock(DummyNewsItem)
    EvaluationRule = DummyEvaluationRule
EvaluationRule.objects = ObjectsManagerMock(DummyEvaluationRule)


def process_news_item_content(news_item_id):
    """
    Fetches a NewsItem, downloads its content using newspaper3k,
    extracts text, generates a summary, and updates the NewsItem.
    """
    print(f"Processing NewsItem ID: {news_item_id}")
    try:
        news_item = NewsItem.objects.get(id=news_item_id)
    except ObjectDoesNotExist:
        print(f"Error: NewsItem with ID {news_item_id} does not exist.")
        return
    except Exception as e:
        print(f"An unexpected error occurred while fetching NewsItem ID {news_item_id}: {e}")
        return

    if not news_item.original_url:
        print(f"Error: NewsItem ID {news_item_id} (Title: '{getattr(news_item, 'title', 'N/A')}') has no original_url. Skipping.")
        return

    print(f"Processing URL: {news_item.original_url} for NewsItem: '{getattr(news_item, 'title', 'N/A')}'")
    article = Article(news_item.original_url)

    try:
        article.download()
        article.parse()
    except ArticleException as e:
        print(f"ArticleException during download/parse for {news_item.original_url}: {e}")
        return
    except Exception as e:
        print(f"Unexpected error during download/parse for {news_item.original_url}: {e}")
        return

    try:
        article.nlp()
    except ArticleException as e:
        print(f"ArticleException during NLP for {news_item.original_url}: {e}")
    except Exception as e:
        print(f"Unexpected error during NLP for {news_item.original_url}: {e}")
        if not article.summary and article.text:
             print("NLP failed, but text is available. Will use a snippet of text for summary.")
        else:
            return

    extracted_text = article.text
    generated_summary = article.summary
    updated = False

    if generated_summary:
        news_item.content_summary = generated_summary
        print(f"Successfully updated summary for '{getattr(news_item, 'title', 'N/A')}' using newspaper3k summary.")
        updated = True
    elif extracted_text:
        news_item.content_summary = extracted_text[:500] + "..." if len(extracted_text) > 500 else extracted_text
        print(f"Used snippet of extracted text for summary of '{getattr(news_item, 'title', 'N/A')}'.")
        updated = True
    else:
        print(f"No summary or text could be extracted for '{getattr(news_item, 'title', 'N/A')}'. Content summary not updated.")

    if updated:
        try:
            news_item.save()
            print(f"NewsItem ID {news_item_id} (Title: '{getattr(news_item, 'title', 'N/A')}') saved successfully after NLP.")
        except Exception as e:
            print(f"Error saving NewsItem ID {news_item_id} (Title: '{getattr(news_item, 'title', 'N/A')}') after NLP: {e}")


def evaluate_news_item_rating(news_item_id):
    """
    Evaluates a NewsItem's rating based on keywords from EvaluationRule entries.
    """
    print(f"\nEvaluating rating for NewsItem ID: {news_item_id}")
    try:
        news_item = NewsItem.objects.get(id=news_item_id)
    except ObjectDoesNotExist:
        print(f"Error: NewsItem with ID {news_item_id} does not exist for evaluation.")
        return None
    except Exception as e:
        print(f"An unexpected error occurred while fetching NewsItem ID {news_item_id} for evaluation: {e}")
        return None

    try:
        active_rules = EvaluationRule.objects.filter(is_active=True)
    except Exception as e:
        print(f"Error fetching active evaluation rules: {e}. Assuming no rules.")
        active_rules = []

    if not active_rules:
        print("No active evaluation rules found. Rating will be based on default logic or remain unchanged.")
    
    text_to_analyze = ((news_item.title or "") + " " + (news_item.content_summary or "")).lower()
    
    if not text_to_analyze.strip():
        print(f"NewsItem ID {news_item_id} has no title or summary for analysis. Cannot evaluate rating based on keywords.")
        # Optionally set a default note or leave as is
        news_item.evaluation_notes = "No content for keyword analysis."
        # news_item.save() # Save if you want to persist this note
        return news_item


    score = 0
    matched_rules_info = []
    highest_priority_target_rating = None
    highest_priority_score_for_rating = -1

    for rule in active_rules:
        if rule.keyword.lower() in text_to_analyze:
            print(f"Matched keyword '{rule.keyword}' (Rule ID: {rule.id})")
            score += rule.priority_score_boost
            rule_info = f"Keyword: '{rule.keyword}' (Boost: {rule.priority_score_boost}, Target: {rule.target_rating or 'N/A'})"
            matched_rules_info.append(rule_info)

            if rule.target_rating:
                # Prefer 'S' if any rule targets 'S'
                if rule.target_rating == 'S':
                    highest_priority_target_rating = 'S'
                    # No need to check score for 'S', it's top priority
                elif highest_priority_target_rating != 'S': # Don't override an 'S'
                    # For 'A' or 'B', consider the one from the rule with highest boost among those matched
                    if rule.priority_score_boost > highest_priority_score_for_rating :
                        highest_priority_target_rating = rule.target_rating
                        highest_priority_score_for_rating = rule.priority_score_boost
                    # If scores are equal, prefer A over B if current highest is B
                    elif rule.priority_score_boost == highest_priority_score_for_rating and \
                         rule.target_rating == 'A' and highest_priority_target_rating == 'B':
                        highest_priority_target_rating = 'A'


    determined_rating = news_item.evaluation_rating # Default to current rating

    if highest_priority_target_rating:
        determined_rating = highest_priority_target_rating
        print(f"Rating determined by rule targeting: '{determined_rating}'")
    else:
        # Fallback to score-based thresholds if no rule explicitly set the rating
        if score >= 100:
            determined_rating = 'S'
        elif score >= 50:
            determined_rating = 'A'
        elif score < 50 : # Only update if not S or A by score, and no rule targeted.
            # If it was already B, it remains B. If it was S/A from before, and score is low, it becomes B.
            determined_rating = 'B' 
        print(f"Rating determined by score ({score}): '{determined_rating}'")

    # Ensure rating is valid
    if determined_rating not in NEWS_ITEM_RATING_CHOICES:
        print(f"Warning: Determined rating '{determined_rating}' is not valid. Defaulting to 'B'.")
        determined_rating = 'B'

    generated_notes = f"Initial score: {score}. Matched rules: [{'; '.join(matched_rules_info)}]."
    if not matched_rules_info:
        generated_notes = "Initial score: 0. No specific keywords matched."
    
    if determined_rating == 'S':
        generated_notes += " High potential impact."
    elif determined_rating == 'A':
        generated_notes += " Moderate potential impact."

    news_item.evaluation_rating = determined_rating
    news_item.evaluation_notes = generated_notes
    
    try:
        news_item.save()
        print(f"Successfully evaluated and updated NewsItem ID {news_item_id}: Rating='{determined_rating}'. Notes: '{generated_notes}'")
    except Exception as e:
        print(f"Error saving NewsItem ID {news_item_id} after evaluation: {e}")

    return news_item


if __name__ == '__main__':
    print("\nRunning NLP processor (and evaluator) directly (for testing purposes)...")

    # --- Setup for process_news_item_content (from before) ---
    test_url_1 = "https://www.example.com" 
    test_url_2 = "https://www.wired.com/story/openai-ceo-sam-altman-the-aige/" 
    test_url_3 = "http://nonexistent.example.com/article"
    
    # Use the more complete DummyNewsItem for these tests
    item_id_1 = DummyNewsItem.create_dummy_item(original_url=test_url_1, title="Example Domain", content_summary="This is example.com content.", evaluation_rating='C') # Start with a non-standard rating
    item_id_2 = DummyNewsItem.create_dummy_item(original_url=test_url_2, title="OpenAI CEO Sam Altman", content_summary="AI is rapidly changing the world. OpenAI leads with new models.", evaluation_rating='B')
    item_id_3 = DummyNewsItem.create_dummy_item(original_url=test_url_3, title="Non Existent", content_summary="...", evaluation_rating='B')
    item_id_no_url = DummyNewsItem.create_dummy_item(original_url=None, title="No URL item", content_summary="empty", evaluation_rating='B')
    item_id_empty_content = DummyNewsItem.create_dummy_item(original_url="https://example.com/empty", title="", content_summary="", evaluation_rating='B')


    print(f"\n--- Test Case 1 (Content Processing): Generic URL ({test_url_1}) ---")
    process_news_item_content(item_id_1)
    # item1_after_nlp = NewsItem.objects.get(id=item_id_1)
    # print(f"Updated summary for item 1: '{item1_after_nlp.content_summary[:100]}...'")

    print(f"\n--- Test Case 2 (Content Processing): Real Article URL ({test_url_2}) ---")
    process_news_item_content(item_id_2)
    # item2_after_nlp = NewsItem.objects.get(id=item_id_2)
    # print(f"Updated summary for item 2: '{item2_after_nlp.content_summary[:100]}...'")
    
    # --- Setup for evaluate_news_item_rating ---
    print("\n--- Setting up Evaluation Rules for Testing ---")
    DummyEvaluationRule.create_dummy_rule(keyword="AI", priority_score_boost=60, target_rating='A', is_active=True)
    DummyEvaluationRule.create_dummy_rule(keyword="OpenAI", priority_score_boost=50, target_rating='S', is_active=True) # Higher score, specific target S
    DummyEvaluationRule.create_dummy_rule(keyword="Microsoft", priority_score_boost=30, target_rating='B', is_active=True)
    DummyEvaluationRule.create_dummy_rule(keyword="world changing", priority_score_boost=10, is_active=True) # No target rating
    DummyEvaluationRule.create_dummy_rule(keyword="inactive_keyword", priority_score_boost=100, is_active=False)
    
    print("\n--- Test Case A (Evaluation): Item with AI and OpenAI keywords (ID item_id_2) ---")
    # This item's summary was updated by process_news_item_content if successful
    # For dummy testing, let's ensure its summary is suitable for evaluation testing
    item_for_eval_A = NewsItem.objects.get(id=item_id_2)
    if "AI" not in item_for_eval_A.content_summary: # Ensure keywords are present for test
         item_for_eval_A.content_summary = "This article discusses OpenAI and the future of AI. It's potentially world changing."
         item_for_eval_A.title = "Focus on AI and OpenAI"
         item_for_eval_A.save()
    evaluate_news_item_rating(item_id_2)
    # itemA_after_eval = NewsItem.objects.get(id=item_id_2)
    # print(f"Item A - Rating: {itemA_after_eval.evaluation_rating}, Notes: {itemA_after_eval.evaluation_notes}")

    print("\n--- Test Case B (Evaluation): Item with only 'world changing' (ID item_id_1) ---")
    item_for_eval_B = NewsItem.objects.get(id=item_id_1)
    item_for_eval_B.content_summary = "This is a generic article about something world changing."
    item_for_eval_B.title = "Generic Topic"
    item_for_eval_B.save()
    evaluate_news_item_rating(item_id_1)
    # itemB_after_eval = NewsItem.objects.get(id=item_id_1)
    # print(f"Item B - Rating: {itemB_after_eval.evaluation_rating}, Notes: {itemB_after_eval.evaluation_notes}")

    print("\n--- Test Case C (Evaluation): Item with no relevant keywords ---")
    item_id_C = DummyNewsItem.create_dummy_item(original_url="https://example.com/other", title="Other News", content_summary="Just some regular news.", evaluation_rating='B')
    evaluate_news_item_rating(item_id_C)
    # itemC_after_eval = NewsItem.objects.get(id=item_id_C)
    # print(f"Item C - Rating: {itemC_after_eval.evaluation_rating}, Notes: {itemC_after_eval.evaluation_notes}")

    print("\n--- Test Case D (Evaluation): Item with empty content for analysis ---")
    evaluate_news_item_rating(item_id_empty_content)
    # itemD_after_eval = NewsItem.objects.get(id=item_id_empty_content)
    # print(f"Item D - Rating: {itemD_after_eval.evaluation_rating}, Notes: {itemD_after_eval.evaluation_notes}")
    
    print("\n--- Test Case E (Evaluation): Non-existent Item ID ---")
    evaluate_news_item_rating(99999)

    print("\nNLP processing and evaluation test completed.")
