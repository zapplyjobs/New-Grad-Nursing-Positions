const puppeteer = require('puppeteer');

// Helper function to clean job titles
function cleanJobTitle(title) {
  if (!title) return title;
  return title
    .replace(/^(Senior|Staff|Principal|Lead|Jr|Junior)\s+/i, '')
    .replace(/\s+(I|II|III|IV|V|\d+)$/, '')
    .replace(/\s*-\s*(Remote|Hybrid|On-site).*$/i, '')
    .trim();
}

// Helper function to parse location
function parseLocation(locationText) {
  if (!locationText) {
    return { city: 'Unknown', state: 'US' };
  }
  const cleanLocation = locationText.replace(/\s+/g, ' ').trim();
  if (cleanLocation.includes(',')) {
    const parts = cleanLocation.split(',').map(p => p.trim());
    return { city: parts[0], state: parts[1] || 'US' };
  }
  return { city: cleanLocation, state: 'US' };
}

async function salesforceScraper(searchQuery, maxPages = 10) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-css',
      '--disable-images',
      '--disable-plugins',
      '--disable-extensions',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  });

  const page = await browser.newPage();
  
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.google.com/',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Cache-Control': 'no-cache'
  });

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.resourceType() === 'stylesheet' || req.resourceType() === 'image') {
      req.abort();
    } else {
      req.continue();
    }
  });
  
  const allJobs = [];
  const baseUrl = 'https://careers.salesforce.com/en/jobs/';

  try {
    console.log('Scraping Salesforce careers page...');
    
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      console.log(`\n--- Scraping Page ${pageNum} ---`);
      
      const searchUrl = `${baseUrl}?page=${pageNum}&search=${encodeURIComponent(searchQuery)}&country=United%20States%20of%20America&pagesize=20#results`;
      console.log(`Navigating to: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Wait for job cards to load
      try {
        await page.waitForSelector('div.card.card-job', { timeout: 30000 });
      } catch (error) {
        console.log(`No jobs found on page ${pageNum}, stopping...`);
        break;
      }
      
      // Scroll to bottom to ensure all jobs load
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for dynamic content
      
      // Check if job cards exist with debugging
      const hasJobCards = await page.$('div.card.card-job');
      console.log(`Page contains job cards: ${!!hasJobCards}`);
      
      // Get all job card elements
      const jobCards = await page.$$('div.card.card-job');
      console.log(`Found ${jobCards.length} job cards on page ${pageNum}`);
      
      if (jobCards.length === 0) {
        console.log(`No job cards on page ${pageNum}, stopping...`);
        break;
      }
      
      // Extract job data from each card
      for (let i = 0; i < jobCards.length; i++) {
        const card = jobCards[i];
        try {
          const jobData = await card.evaluate((node) => {
            // Extract job title from the stretched-link anchor
            const titleElement = node.querySelector('a.stretched-link.js-view-job');
            const title = titleElement ? titleElement.textContent.trim() : '';
            const jobLink = titleElement ? titleElement.getAttribute('href') : '';
            
            // Extract subtitle (department/team)
            const subtitleElement = node.querySelector('p.card-subtitle');
            const subtitle = subtitleElement ? subtitleElement.textContent.trim() : '';
            
            // Extract job ID from data-id attribute
            const jobActionsElement = node.querySelector('div.card-job-actions.js-job');
            const jobId = jobActionsElement ? jobActionsElement.getAttribute('data-id') : '';
            
            // Extract locations from the list-inline locations
            const locationElements = node.querySelectorAll('ul.list-inline.locations li.list-inline-item');
            const locations = Array.from(locationElements).map(el => el.textContent.trim()).filter(loc => loc);
            const primaryLocation = locations.length > 0 ? locations[0] : '';
            
            // Count total locations
            const locationCountElement = node.querySelector('span');
            const locationCountText = locationCountElement ? locationCountElement.textContent : '';
            const locationCount = locationCountText.includes('locations') ? 
              locationCountText.match(/(\d+)\s+locations/)?.[1] : locations.length.toString();
            
            return {
              title,
              subtitle,
              jobId,
              jobLink,
              locations,
              primaryLocation,
              locationCount,
              posted: 'Recently'
            };
          });
          
          if (!jobData || !jobData.title) continue;
          
          const { city, state } = parseLocation(jobData.primaryLocation);
          const applyLink = jobData.jobLink ? 
            (jobData.jobLink.startsWith('http') ? jobData.jobLink : `https://careers.salesforce.com${jobData.jobLink}`) : '';
          
          const formattedJob = {
            employer_name: 'Salesforce',
            job_title: cleanJobTitle(jobData.title),
            job_city: city,
            job_state: state,
            job_posted_at: jobData.posted,
            job_description: `${searchQuery} job for the role ${jobData.title} in ${jobData.subtitle}. Available in ${jobData.locationCount} location(s): ${jobData.locations.join(', ')}`,
            job_apply_link: applyLink,
        
          };
          
          allJobs.push(formattedJob);
          console.log(`✓ Scraped: ${jobData.title} in ${jobData.subtitle} at ${jobData.primaryLocation}`);
          
        } catch (error) {
          console.error(`Error extracting job data from card ${i}:`, error);
          continue;
        }
      }
    }
    
  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    await browser.close();
  }
  
  console.log(`\nScraping completed! Found ${allJobs.length} total jobs.`);
  return allJobs;
}

// Example usage
async function main() {
  try {
    const searchQuery = process.argv.slice(2).join(' ') || 'data science';
    const maxPagesArg = process.argv.find(arg => arg.startsWith('--max-pages='));
    const maxPages = maxPagesArg ? parseInt(maxPagesArg.split('=')[1]) : 10;
    
    console.log(`=== Scraping Salesforce Careers for: "${searchQuery}" with max ${maxPages} pages ===`);
    const jobs = await salesforceScraper(searchQuery, maxPages);
    console.log(`\n🎉 Salesforce Scraping completed! Found ${jobs.length} jobs for "${searchQuery}"`);
    
    if (jobs.length > 0) {
      console.log('\n📋 All Scraped Jobs:');
      console.log('='.repeat(80));
      
      jobs.forEach((job, index) => {
        console.log(`\n${index + 1}. ${job.job_title}`);
        console.log(`   Company: ${job.employer_name}`);
        console.log(`   Department: ${job.department}`);
        console.log(`   Location: ${job.job_city}, ${job.job_state}`);
        
        console.log(`   Posted: ${job.job_posted_at}`);
        console.log(`   Apply: ${job.job_apply_link}`);
     
      });
      
      console.log('\n' + '='.repeat(80));
      console.log(`📊 Summary: ${jobs.length} jobs found`);
      
      console.log('\n🔧 JSON Format (first 2 jobs):');
      console.log(JSON.stringify(jobs.slice(0, 2), null, 2));
    } else {
      console.log('❌ No jobs found for the search query.');
    }
    
  } catch (error) {
    console.error('Error in main:', error);
  }
}

// Export the scraper function
module.exports = salesforceScraper;

// Run if this file is executed directly
if (require.main === module) {
  main();
}
//data science