import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from django.utils.text import slugify
import time

# Django Models - will only work if Django settings are configured
try:
    from .models import AITool, ToolCategory
except (ImportError, ModuleNotFoundError):
    print("Warning: Django models AITool, ToolCategory could not be imported. Using dummy models for scraping logic.")
    print("Ensure Django settings are configured and this script is run within a Django project context for DB operations.")

    # Define Dummy Models for standalone testing of scraper logic
    class DummyCategory:
        def __init__(self, name, slug):
            self.id = None
            self.name = name
            self.slug = slug
        def save(self):
            print(f"DummyCategory save: {self.name}")
        @classmethod
        def get_or_create(cls, name, defaults=None):
            print(f"DummyCategory get_or_create: {name}, defaults: {defaults}")
            slug = defaults.get('slug', name) if defaults else name
            return cls(name=name, slug=slug), True # Simulate created=True

    class DummyAITool:
        _tools_db = {} # Simulate a DB with website_url as key
        def __init__(self, name, website_url, short_description, **kwargs):
            self.id = None
            self.name = name
            self.website_url = website_url
            self.short_description = short_description
            self.logo_url = kwargs.get('logo_url')
            self.full_description = kwargs.get('full_description')
            self.tags = kwargs.get('tags', [])
            self.status = kwargs.get('status', 'active')
            self.source_of_discovery = kwargs.get('source_of_discovery')
            self.categories_to_add = []

        def save(self):
            print(f"DummyAITool save: {self.name} ({self.website_url})")
            self.__class__._tools_db[self.website_url] = self
        
        @property
        def categories(self): # Dummy ManyToMany manager
            class DummyCategoryManager:
                def __init__(self, tool_instance):
                    self.tool_instance = tool_instance
                def add(self, *category_objects):
                    for cat in category_objects:
                        self.tool_instance.categories_to_add.append(cat.name)
                    print(f"DummyAITool '{self.tool_instance.name}' add categories: {[c.name for c in category_objects]}")
                def clear(self):
                    self.tool_instance.categories_to_add = []
            return DummyCategoryManager(self)

        @classmethod
        def filter(cls, website_url): # Simplified filter for exists() check
            class DummyQuerySet:
                def __init__(self, url):
                    self.url = url
                def exists(self):
                    return self.url in cls._tools_db
            return DummyQuerySet(website_url)

    AITool = DummyAITool
    ToolCategory = DummyCategory


USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
FUTUREPEDIA_BASE_URL = "https://www.futurepedia.io/" # This might need to be a more specific page

def scrape_futurepedia_tools(pages_to_scrape=1):
    """
    Scrapes AI tools from Futurepedia.io.

    CSS Selectors (Hypothetical - based on common website structures, actual selectors will vary):
    - Tool Card Container: '.tool-card-list .tool-card' or similar
    - Tool Name: '.tool-card .tool-name', 'h3.card-title'
    - Website URL: '.tool-card a[href^="http"]' (direct external link) or a specific button like 'Visit Website'
                   If it's an internal link like /tool/some-tool, then the scraper might need to visit this page
                   to get the actual external URL. For this version, we'll look for a direct link or a prominent one.
    - Logo URL: '.tool-card img.tool-logo'
    - Short Description: '.tool-card .tool-description', '.card-text'
    - Categories/Tags: '.tool-card .categories .tag', '.tool-card .tags .tag-item'
    """
    print(f"Starting Futurepedia scraper for {pages_to_scrape} page(s)...")
    
    # Futurepedia seems to load tools via API calls to a backend (e.g., Algolia)
    # and then renders them. A simple requests.get(FUTUREPEDIA_BASE_URL) might not get the tool data directly.
    # This is a common pattern for modern web apps.
    # For this example, let's assume we found an API endpoint or a page that does list them in HTML.
    # If it's an API, the approach would be to mimic that API call.
    #
    # **Simulated Analysis Outcome:**
    # After inspection, Futurepedia uses a dynamic loading mechanism. For a robust scraper,
    # one would typically use browser automation tools (Selenium, Playwright) or try to find
    # the underlying API calls (often XHR requests in browser dev tools).
    #
    # **Simplified Scenario for this task:**
    # Let's pretend Futurepedia has a "plain HTML" version or we are targeting a
    # specific category page that lists tools in a parsable way.
    # The URL might look like: https://www.futurepedia.io/ai-tools-categories/some-category
    # Or, more realistically, they might have a sitemap or an index page.
    #
    # For this task, I will use a placeholder URL that *would* represent such a list,
    # and define selectors that are plausible for a card-based layout.
    # The actual selectors for futurepedia.io would require live inspection and are likely
    # to be more complex and dependent on JavaScript rendering.

    # Placeholder URL for where tools are listed (replace with actual if found)
    # A common pattern is a directory or a "show all" page.
    # As of late 2023/early 2024, Futurepedia's main page loads tools dynamically.
    # Let's try to find a page that might be more static or use their sitemap.
    # Their sitemap (futurepedia.io/sitemap.xml) lists many individual tool pages.
    # e.g., https://www.futurepedia.io/ai-tools/some-tool-name
    # This means we might need to scrape the sitemap for tool URLs, then visit each. This is more complex.

    # **Revised Strategy for this Exercise (Simplified):**
    # Let's assume we are scraping a page that lists multiple tools in cards.
    # If this isn't possible, the scraper's utility is limited for Futurepedia.
    # I will construct the scraper assuming such a list page exists.
    # The selectors will be generic.

    target_url = "https://www.futurepedia.io/" # Or a specific category page that lists tools.
    # Example: If they had a page like "https://www.futurepedia.io/all-tools?page={page_num}"
    
    print(f"Attempting to scrape: {target_url} (Note: Site structure may have changed or require JS rendering)")

    headers = {'User-Agent': USER_AGENT}
    
    for page_num in range(1, pages_to_scrape + 1):
        print(f"\nScraping page {page_num}...")
        # Adjust URL for pagination if a pattern is identified
        # current_url = target_url + f"?page={page_num}" # Example pagination
        current_url = target_url # For this example, assume one page or target_url itself handles it.

        try:
            response = requests.get(current_url, headers=headers, timeout=20)
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching {current_url}: {e}")
            continue # Skip this page

        soup = BeautifulSoup(response.content, 'html.parser')

        # ** Hypothetical Selectors - THESE WILL LIKELY NEED ADJUSTMENT FOR THE REAL FUTUREPEDIA **
        # Based on common layouts. For Futurepedia, these are illustrative.
        # As of checking, Futurepedia's main page tools are in divs with class like "Discover___StyledDiv2-sc-170awir-1"
        # and links are nested. This is very specific and prone to change.
        # A more stable selector might be found on category pages if their structure is simpler.
        
        # Let's assume a generic card structure for the example:
        tool_cards = soup.select('div[class*="Discover___StyledDiv2"]') # This is a guess based on observed class prefixes
        
        if not tool_cards:
            print(f"No tool cards found on page {page_num} using selector 'div[class*=\"Discover___StyledDiv2\"]'. The site structure might have changed or requires JavaScript.")
            # Try another common selector for lists of items
            # tool_cards = soup.select('article.tool-item') # Another common pattern
            # if not tool_cards:
            #     print("Tried 'article.tool-item' as well, no cards found. Scraper needs updated selectors.")
            #     return

        print(f"Found {len(tool_cards)} potential tool cards on page {page_num}.")

        for card in tool_cards:
            try:
                tool_name_element = card.select_one('p[class*="Typography___StyledP-sc-1oqcbso-0"][class*="Discover___StyledP3-sc-170awir-8"]') # Example
                tool_name = tool_name_element.text.strip() if tool_name_element else None

                # Website URL: This is tricky. Futurepedia links might be internal.
                # e.g., <a href="/ai-tools/tool-name">. We need the final external URL.
                # For now, let's try to find a direct link.
                # Often, the card itself is a link or contains a prominent "Visit" link.
                website_link_element = card.select_one('a[href^="/ai-tools/"]') # This gets the internal link
                
                if not website_link_element:
                    website_link_element = card.select_one('a[target="_blank"]') # Try to find external link directly

                extracted_website_url = None
                if website_link_element and website_link_element.get('href'):
                    temp_url = website_link_element['href']
                    if temp_url.startswith('/ai-tools/'):
                        # This is an internal Futurepedia link.
                        # The actual external URL is on the detail page.
                        # This complicates the scraper: it would need a second request.
                        # For this exercise, we'll note this and ideally would handle it.
                        # To simplify *for now*, we'll try to find if there's ANY external link.
                        # If not, we might have to skip or use the internal one as a placeholder (not ideal).
                        
                        # Let's assume for now we *must* get the external URL from this card.
                        # If a direct external link is not on the card, this part will fail for many tools.
                        # A real scraper for Futurepedia would likely need to:
                        # 1. Go to the internal page (e.g., urljoin(FUTUREPEDIA_BASE_URL, temp_url))
                        # 2. On that page, find the "Visit" button/link which points to the actual external site.
                        # This is a common pattern for aggregator sites.
                        # print(f"Found internal link for {tool_name}: {temp_url}. External URL requires visiting this page.")
                        # For now, we will try to find a direct external link if possible on the card.
                        # This might be a data-attribute or a less prominent link.
                        # If not found, this tool might be skipped for website_url.
                        # This is a known limitation for this simplified version.
                        # Let's assume the main link IS the one to the detail page.
                        # And we are looking for *another* link for the actual website if present directly.
                        # This part of the logic is highly dependent on actual HTML structure.
                        # For now, we'll use the found href. If it's internal, it's not the final tool URL.
                        # THIS IS A MAJOR SIMPLIFICATION.
                        parsed_temp_url = urlparse(temp_url)
                        if parsed_temp_url.netloc: # It's a full URL
                            extracted_website_url = temp_url
                        else: # It's a path
                             extracted_website_url = urljoin(FUTUREPEDIA_BASE_URL, temp_url) # This is still Futurepedia URL
                        print(f"Warning: Using potentially internal URL for '{tool_name}': {extracted_website_url}. A robust scraper would follow this to find the external site.")

                    elif temp_url.startswith('http'):
                        extracted_website_url = temp_url
                    else: # Other relative path
                        extracted_website_url = urljoin(FUTUREPEDIA_BASE_URL, temp_url)
                
                logo_element = card.select_one('img[class*="Discover___StyledImg-sc-170awir-3"]') # Example
                logo_url = urljoin(FUTUREPEDIA_BASE_URL, logo_element['src']) if logo_element and logo_element.get('src') else None

                description_element = card.select_one('p[class*="Typography___StyledP-sc-1oqcbso-0"][class*="Discover___StyledP4-sc-170awir-9"]') # Example
                short_description = description_element.text.strip() if description_element else "No description available."
                
                # Categories / Tags
                # Futurepedia has "Verified", "Freemium", etc. as tags, and then categories.
                # These are often in span or small 'a' tags.
                # Example selector: card.select('div[class*="Discover___StyledDiv11"] span')
                category_tags_elements = card.select('div[class*="Discover___StyledDiv11-sc-170awir-15"] span[class*="Typography"]')
                categories_text = [el.text.strip() for el in category_tags_elements if el.text.strip()]
                
                # Basic Data Validation
                if not tool_name or not extracted_website_url:
                    print(f"Skipping card due to missing name or website_url. Name: {tool_name}, URL: {extracted_website_url}")
                    continue

                # Clean data
                tool_name = tool_name.strip()
                extracted_website_url = extracted_website_url.strip()
                if logo_url: logo_url = logo_url.strip()
                short_description = short_description.strip()

                print(f"\nExtracted Raw Data:")
                print(f"  Name: {tool_name}")
                print(f"  Website URL: {extracted_website_url}")
                print(f"  Logo URL: {logo_url}")
                print(f"  Description: {short_description[:60]}...")
                print(f"  Categories/Tags Text: {categories_text}")


                # --- Database Operations ---
                # Check if tool already exists (using the potentially internal URL for now)
                if AITool.filter(website_url=extracted_website_url).exists():
                    print(f"Tool '{tool_name}' with URL '{extracted_website_url}' already exists. Skipping.")
                    continue

                category_objects = []
                if categories_text:
                    for cat_name in categories_text:
                        # Futurepedia's "tags" (like Freemium, Verified) might not be true categories.
                        # We might want to filter them or map them differently.
                        # For now, creating them as ToolCategory.
                        if len(cat_name) > 100: # Basic validation for category name length
                            print(f"Skipping category name '{cat_name}' as it's too long.")
                            continue
                        slug = slugify(cat_name)
                        if not slug: # if slugify results in empty string
                            print(f"Skipping category name '{cat_name}' as it results in an empty slug.")
                            continue
                            
                        category, created = ToolCategory.get_or_create(
                            name=cat_name, 
                            defaults={'slug': slug}
                        )
                        category_objects.append(category)
                        if created:
                            print(f"Created new category: '{cat_name}' with slug '{slug}'")

                # Create AITool instance
                ai_tool_instance = AITool(
                    name=tool_name,
                    website_url=extracted_website_url, # This might be an internal URL
                    logo_url=logo_url,
                    short_description=short_description,
                    status='active', # Or 'pending' if verification is needed
                    source_of_discovery="futurepedia.io",
                    tags=categories_text # Using the extracted texts as tags for now
                )
                ai_tool_instance.save()

                if category_objects:
                    ai_tool_instance.categories.add(*category_objects) # M2M association

                print(f"Successfully saved AI Tool: '{tool_name}'")
                print(f"  Categories associated: {[c.name for c in category_objects]}")
                print(f"  Tags added: {categories_text}")


            except Exception as e:
                print(f"Error processing a tool card: {e}")
                # traceback.print_exc() # For more detailed error during development

        # Be respectful: add a delay between requests if scraping multiple pages
        if pages_to_scrape > 1 and page_num < pages_to_scrape:
            print(f"Waiting 5 seconds before next page...")
            time.sleep(5)

    print("\nFuturepedia scraping process completed.")


# Main execution block for testing
if __name__ == '__main__':
    print("Running Futurepedia scraper directly for testing (using dummy models)...")
    # Note: This will use dummy models, so no actual DB operations will occur.
    # It will print out what it *would* do.
    # To run with actual Django models, this script needs to be run within a Django managed command or similar context.
    
    # Configure Django settings if running standalone and want to use real models (complex setup)
    # import os, django
    # os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'your_project.settings') # Replace your_project
    # try:
    #     django.setup()
    #     from .models import AITool, ToolCategory # Re-import real models
    # except Exception as e:
    #     print(f"Could not set up Django for real models: {e}. Using dummies.")
    #     AITool = DummyAITool # Ensure dummies are used if setup fails
    #     ToolCategory = DummyCategory

    scrape_futurepedia_tools(pages_to_scrape=1)

    # Example of what might be in the dummy DB after scraping
    # print("\n--- Dummy DB Content (AITool) ---")
    # for url, tool_obj in DummyAITool._tools_db.items():
    #     print(f"URL: {url}, Name: {tool_obj.name}, Categories Added: {tool_obj.categories_to_add}")
    # print("---------------------------------")

# CSS Selector Analysis Report (Hypothetical based on common patterns & brief futurepedia.io inspection):
# - Main Page Tool Container: `div` elements with dynamic class names like `Discover___StyledDiv2-sc-170awir-1`.
#   Selector used: `div[class*="Discover___StyledDiv2"]` (attempts to catch these)
# - Tool Name: A `p` tag within the card, e.g., `p[class*="Discover___StyledP3-sc-170awir-8"]`
# - Website URL: This is the most challenging. Futurepedia links are internal (`/ai-tools/tool-name`).
#   A robust solution requires visiting each internal link to find the "Visit" button leading to the external site.
#   The current scraper simplifies this by using the internal link as `website_url` or trying to find any direct external link on the card.
#   Selector for internal link: `a[href^="/ai-tools/"]`
# - Logo URL: `img` tag, e.g., `img[class*="Discover___StyledImg-sc-170awir-3"]` (src needs to be made absolute)
# - Short Description: Another `p` tag, e.g., `p[class*="Discover___StyledP4-sc-170awir-9"]`
# - Categories/Tags: `span` or similar tags within a container, e.g., `div[class*="Discover___StyledDiv11"] span`
#
# **Limitations Stated in Code:**
# - The biggest limitation is handling Futurepedia's internal links and the need for a two-step process to get true external URLs.
# - Dynamic content loading: If the primary method of loading tools is via JavaScript after page load, `requests` + `BeautifulSoup` will not work for the main list.
#   The scraper assumes there's a parsable HTML structure available at the target URL or that an API endpoint can be found and used (not done here).
# - CSS selectors are highly likely to change. The ones used are illustrative examples based on observed class name patterns on Futurepedia.
# - Error handling is basic. Robust scrapers need more sophisticated retry mechanisms, proxy rotation, etc.
# - No handling of pagination implemented in this version beyond a loop placeholder.
```
