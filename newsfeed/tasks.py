from celery import shared_task, group
from django.utils import timezone
from datetime import timedelta

# Assuming your project structure allows these imports
try:
    from .scrapers import scrape_active_news_sources
    from .nlp_processor import process_news_item_content, evaluate_news_item_rating
    from .models import NewsItem
except ImportError as e:
    # This might happen if tasks.py is not correctly recognized as part of the 'newsfeed' app
    # or if there's a circular dependency. Ensure your Django app structure is correct.
    print(f"Error importing newsfeed modules in tasks.py: {e}")
    # Define dummy functions if imports fail, so Celery can still load the tasks module
    def scrape_active_news_sources(): print("Dummy scrape_active_news_sources called")
    def process_news_item_content(item_id): print(f"Dummy process_news_item_content for {item_id}")
    def evaluate_news_item_rating(item_id): print(f"Dummy evaluate_news_item_rating for {item_id}")
    class NewsItem: # Dummy model
        objects = None 


@shared_task(name="newsfeed.tasks.task_process_single_news_item", bind=True, max_retries=3, default_retry_delay=60)
def task_process_single_news_item(self, news_item_id):
    """
    Celery task to process content and evaluate rating for a single news item.
    """
    print(f"Starting NLP processing for NewsItem ID: {news_item_id}")
    try:
        # Ensure NewsItem exists before processing
        item_exists = NewsItem.objects.filter(id=news_item_id).exists()
        if not item_exists:
            print(f"NewsItem ID {news_item_id} not found. Skipping processing.")
            return f"NewsItem ID {news_item_id} not found."

        process_news_item_content(news_item_id)
        print(f"NLP content processing complete for NewsItem ID: {news_item_id}")
        
        evaluate_news_item_rating(news_item_id)
        print(f"Rating evaluation complete for NewsItem ID: {news_item_id}")
        
        # Optionally, mark the item as processed
        # item = NewsItem.objects.get(id=news_item_id)
        # item.is_processed = True # Assuming an 'is_processed' field
        # item.processed_at = timezone.now()
        # item.save(update_fields=['is_processed', 'processed_at'])
        
        return f"Successfully processed NewsItem ID: {news_item_id}"
    except Exception as exc:
        print(f"Error processing NewsItem ID {news_item_id}: {exc}")
        # Retry the task if it's a potentially transient error
        # Celery's max_retries and default_retry_delay will handle this if bind=True and self.retry() is called.
        # Example: if isinstance(exc, SomeTransientHttpError):
        #    raise self.retry(exc=exc, countdown=int(default_retry_delay * (self.request.retries + 1)))
        raise self.retry(exc=exc) # Default retry behavior based on task decorator settings


@shared_task(name="newsfeed.tasks.task_scrape_and_process_news", bind=True)
def task_scrape_and_process_news(self):
    """
    Celery task to scrape active news sources and then trigger processing for new items.
    """
    print("Starting task: scrape_and_process_news")
    try:
        # --- Part 1: Scrape active news sources ---
        # This function should ideally return a list of IDs of newly created or updated news items,
        # or we need a way to identify them.
        scrape_active_news_sources() 
        print("News scraping complete.")

        # --- Part 2: Identify and process new/unprocessed news items ---
        # This logic depends on how `scrape_active_news_sources` works and how new items are identified.
        # Option A: If `scrape_active_news_sources` returns IDs of new items. (Not implemented in current scraper)
        # new_item_ids = scrape_active_news_sources() 

        # Option B: Query for items that need processing.
        # This requires a way to mark items as "processed" or identify them by other criteria.
        # For example, items scraped recently and without a full summary or evaluation notes.
        
        # Example: Process items scraped in the last N minutes that don't have evaluation notes yet.
        # This assumes `scraped_at` is set by the scraper and `evaluation_notes` is filled by processing.
        time_threshold = timezone.now() - timedelta(minutes=30) # Process items from last 30 mins
        
        # This condition needs to be robust. Using 'evaluation_notes' being empty is an example.
        # A dedicated 'is_processed' boolean field or 'status' field on NewsItem model is better.
        # If NewsItem model has `created_at` and we assume new items are those created recently:
        # items_to_process = NewsItem.objects.filter(created_at__gte=time_threshold, evaluation_notes__isnull=True)
        
        # For simplicity, let's assume we want to process items that were created very recently
        # and do not have evaluation_notes. This is a common heuristic.
        # A more robust way would be to have an 'is_processed_by_celery' flag.
        # For this example, let's assume new items have a default short summary or no evaluation_notes.
        # This is highly dependent on your model and scraper logic.
        
        # Let's refine: process items that have a placeholder summary or specific status.
        # Or, items created within a time window of this task run.
        # Most straightforward if `scrape_active_news_sources` can return the IDs of *newly added* items.
        # Since it doesn't, we'll fetch items that look "unprocessed".
        # This query is illustrative:
        unprocessed_items = NewsItem.objects.filter(
            evaluation_notes__isnull=True, # Primary condition for "unprocessed"
            created_at__gte=timezone.now() - timedelta(hours=1) # Only recently created ones
        ).order_by('-created_at')[:100] # Limit batch size

        print(f"Found {unprocessed_items.count()} news items to process.")

        if not unprocessed_items:
            print("No new unprocessed news items found to process.")
            return "Scraping complete. No new items to process."

        # --- Part 3: Dispatch processing tasks ---
        # Option 1: Synchronous processing (not recommended for many items)
        # for item in unprocessed_items:
        #     print(f"Synchronously processing item ID: {item.id}")
        #     process_news_item_content(item.id)
        #     evaluate_news_item_rating(item.id)

        # Option 2: Asynchronous processing using Celery tasks (Recommended)
        # Create a group of tasks to process them in parallel (if resources allow)
        processing_tasks = []
        for item in unprocessed_items:
            print(f"Dispatching task_process_single_news_item for item ID: {item.id}")
            processing_tasks.append(task_process_single_news_item.s(item.id))
        
        if processing_tasks:
            # Execute tasks in a group
            task_group = group(processing_tasks)
            group_result = task_group.apply_async()
            print(f"Dispatched a group of {len(processing_tasks)} processing tasks. Group ID: {group_result.id}")
            # You can save group_result.id to track the group if needed.
        
        return f"Scraping complete. Dispatched {len(unprocessed_items)} items for processing."

    except Exception as exc:
        print(f"Error in task_scrape_and_process_news: {exc}")
        # Retry the main task if it's a potentially transient error
        raise self.retry(exc=exc)


# Example of a more granular task if needed (already used above)
# @shared_task(name="newsfeed.tasks.task_nlp_content_processing")
# def task_nlp_content_processing(news_item_id):
#     print(f"Starting NLP content processing for NewsItem ID: {news_item_id}")
#     process_news_item_content(news_item_id)
#     return f"NLP content processing complete for NewsItem ID: {news_item_id}"

# @shared_task(name="newsfeed.tasks.task_rating_evaluation")
# def task_rating_evaluation(news_item_id):
#     print(f"Starting rating evaluation for NewsItem ID: {news_item_id}")
#     evaluate_news_item_rating(news_item_id)
#     return f"Rating evaluation complete for NewsItem ID: {news_item_id}"

# If using the granular tasks, task_scrape_and_process_news would chain them:
# from celery import chain
# for item in unprocessed_items:
#    task_chain = chain(
#        task_nlp_content_processing.s(item.id),
#        task_rating_evaluation.s(item.id)
#    )
#    task_chain.apply_async()
# This approach (using task_process_single_news_item which combines both steps) is simpler for now.
