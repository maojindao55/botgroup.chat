from celery import shared_task

# Assuming your project structure allows these imports
try:
    from .tool_scrapers import scrape_futurepedia_tools 
    # Import other scrapers here if you create them
    # from .tool_scrapers import scrape_another_tool_site 
except ImportError as e:
    print(f"Error importing aitools.tool_scrapers in tasks.py: {e}")
    # Define dummy functions if imports fail
    def scrape_futurepedia_tools(): print("Dummy scrape_futurepedia_tools called")
    # def scrape_another_tool_site(): print("Dummy scrape_another_tool_site called")


@shared_task(name="aitools.tasks.task_scrape_all_tools", bind=True, max_retries=2, default_retry_delay=300)
def task_scrape_all_tools(self):
    """
    Celery task to scrape AI tools from all configured sources.
    """
    print("Starting task: task_scrape_all_tools")
    all_successful = True
    errors = []

    try:
        print("Attempting to scrape Futurepedia...")
        scrape_futurepedia_tools() # Assuming this function handles its own internal errors gracefully
        print("Futurepedia scraping attempt complete.")
    except Exception as e:
        print(f"Error during scrape_futurepedia_tools: {e}")
        all_successful = False
        errors.append(f"Futurepedia: {str(e)}")
        # Depending on the error, you might want to retry the whole task_scrape_all_tools
        # For now, we'll just log and continue to other scrapers if any.
        # If a specific scraper is critical, you might raise self.retry(exc=e) here.

    # --- Add calls to other scrapers here ---
    # try:
    #     print("Attempting to scrape AnotherToolSite...")
    #     scrape_another_tool_site()
    #     print("AnotherToolSite scraping attempt complete.")
    # except Exception as e:
    #     print(f"Error during scrape_another_tool_site: {e}")
    #     all_successful = False
    #     errors.append(f"AnotherToolSite: {str(e)}")

    if not all_successful:
        # You could raise an error to make Celery record it as failed,
        # or retry the whole task if appropriate.
        # For now, just returning a summary.
        error_summary = "; ".join(errors)
        # raise self.retry(exc=Exception(f"Scraping failed for some sources: {error_summary}"))
        return f"Tool scraping completed with errors for some sources: {error_summary}"
        
    return "All tool scraping tasks completed successfully."

# You might also want tasks for:
# - Verifying existing tool website_urls (checking for 404s, redirects)
# - Processing newly added tools (e.g., fetching more details, screenshots, etc.)
# - Notifying admin about tools pending review.
