const puppeteer = require('puppeteer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  repos: [
    { owner: 'zapplyjobs', name: 'New-Grad-Jobs' },
    { owner: 'zapplyjobs', name: 'New-Grad-Hardware-Engineering' },
    { owner: 'zapplyjobs', name: 'New-Grad-Internships' },
    { owner: 'zapplyjobs', name: 'New-Grad-Software-Engineering-Jobs' },
    { owner: 'zapplyjobs', name: 'New-Grad-Data-Science-Jobs' },
    { owner: 'zapplyjobs', name: 'New-Grad-Nursing-Jobs' }
  ],
  
  keywords: [
    "new grad",
    "new grad jobs",
    "entry level jobs",
    "graduate jobs",
    "junior developer jobs",
    "college graduate positions",
    "hardware engineer new grad",
    "entry level hardware engineer",
    "new grad internships",
    "graduate internships",
    "entry level internships",
    "college internships",
    "software engineering new grad",
    "entry level software engineer",
    "junior software developer",
    "data science new grad",
    "entry level data scientist",
    "junior data analyst",
    "machine learning new grad",
    "nursing graduate jobs",
    "new grad nurse",
    "entry level nursing",
    "RN new grad"
  ],
  
  searchBaseUrl: 'https://github.com/search',
  maxPagesToCheck: 5,
  delayBetweenRequests: 3000,
  delayBetweenPages: 3000,
  concurrentBrowsers: 3,
  debugMode: true // Enable debug screenshots and logging
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function log(message, type = 'info', keywordId = '') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const icons = {
    'info': '📋',
    'success': '✅',
    'error': '❌',
    'search': '🔍',
    'rank': '📊',
    'file': '📁',
    'warning': '⚠️',
    'browser': '🌐',
    'debug': '🔧'
  };
  const icon = icons[type] || '📋';
  const prefix = keywordId ? `[${keywordId}]` : '';
  console.log(`[${timestamp}] ${icon} ${prefix} ${message}`);
}

// ============================================
// IMPROVED GITHUB SEARCH WITH MULTIPLE SELECTORS
// ============================================

async function searchAndRankRepos(page, keyword, keywordId) {
  const allRepos = [];
  let globalRank = 0;
  
  try {
    log(`Searching for keyword: "${keyword}"`, 'search', keywordId);
    
    for (let pageNum = 1; pageNum <= CONFIG.maxPagesToCheck; pageNum++) {
      const searchUrl = `${CONFIG.searchBaseUrl}?q=${encodeURIComponent(keyword)}&type=repositories&p=${pageNum}`;
      log(`Checking page ${pageNum}/${CONFIG.maxPagesToCheck}...`, 'info', keywordId);
      
      try {
        await page.goto(searchUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: 60000 
        });
        
        await sleep(CONFIG.delayBetweenPages);
        
        // Wait for page to fully load
        await page.waitForSelector('body', { timeout: 10000 });
        
        // Try multiple ways to detect results
        let foundResults = false;
        const selectors = [
          '[data-testid="results-list"]',
          '.repo-list',
          '[aria-label="Search results"]',
          'main',
          '#js-pjax-container'
        ];
        
        for (const selector of selectors) {
          try {
            await page.waitForSelector(selector, { timeout: 3000 });
            foundResults = true;
            break;
          } catch (e) {
            continue;
          }
        }
        
        if (!foundResults) {
          log(`Could not find results container on page ${pageNum}`, 'warning', keywordId);
          
          if (CONFIG.debugMode && pageNum === 1) {
            const debugDir = 'debug-screenshots';
            if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
            const screenshotPath = path.join(debugDir, `debug-${keywordId}-page${pageNum}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: true });
            log(`Debug screenshot saved: ${screenshotPath}`, 'debug', keywordId);
          }
        }
        
      } catch (error) {
        log(`Error loading page ${pageNum}: ${error.message}`, 'error', keywordId);
        break;
      }
      
      // Extract repos using multiple selector strategies
      const reposOnPage = await page.evaluate(() => {
        const results = [];
        const seenRepos = new Set();
        
        // Strategy 1: Find all links that look like repo links
        const allLinks = document.querySelectorAll('a[href^="/"]');
        
        allLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (!href) return;
          
          // Clean href and check if it's a repo link
          const cleanHref = href.split('?')[0].split('#')[0];
          const parts = cleanHref.split('/').filter(p => p);
          
          // Must have exactly 2 parts (owner/repo) and not be a special path
          if (parts.length === 2 && 
              !parts[0].startsWith('@') && 
              !['topics', 'search', 'orgs', 'settings', 'features'].includes(parts[0])) {
            
            const repoKey = `${parts[0]}/${parts[1]}`;
            
            // Avoid duplicates
            if (!seenRepos.has(repoKey)) {
              seenRepos.add(repoKey);
              
              // Try to determine if this is from the search results
              let isSearchResult = false;
              let parent = link.parentElement;
              let depth = 0;
              
              while (parent && depth < 10) {
                const classList = parent.classList ? Array.from(parent.classList) : [];
                const dataTestId = parent.getAttribute('data-testid') || '';
                
                if (dataTestId.includes('results') || 
                    classList.some(c => c.includes('repo') || c.includes('search') || c.includes('list'))) {
                  isSearchResult = true;
                  break;
                }
                parent = parent.parentElement;
                depth++;
              }
              
              if (isSearchResult || depth < 10) {
                results.push({
                  owner: parts[0],
                  name: parts[1],
                  fullName: repoKey
                });
              }
            }
          }
        });
        
        return results;
      });
      
      if (reposOnPage.length === 0) {
        log(`No repositories found on page ${pageNum}`, 'warning', keywordId);
        break;
      }
      
      // Add repos with ranking
      reposOnPage.forEach(repo => {
        globalRank++;
        allRepos.push({
          ...repo,
          rank: globalRank,
          page: pageNum
        });
      });
      
      log(`Found ${reposOnPage.length} repos on page ${pageNum} (total: ${globalRank})`, 'success', keywordId);
      
      // Debug: Show first few repos found
      if (CONFIG.debugMode && pageNum === 1) {
        const firstFive = reposOnPage.slice(0, 5).map(r => r.fullName).join(', ');
        log(`First repos: ${firstFive}`, 'debug', keywordId);
      }
      
      if (pageNum < CONFIG.maxPagesToCheck) {
        await sleep(1000);
      }
    }
    
    return allRepos;
    
  } catch (error) {
    log(`Error searching: ${error.message}`, 'error', keywordId);
    return [];
  }
}

function findRepoRankings(searchResults, targetRepos) {
  const rankings = {};
  
  targetRepos.forEach(targetRepo => {
    const found = searchResults.find(repo => 
      repo.owner.toLowerCase() === targetRepo.owner.toLowerCase() &&
      repo.name.toLowerCase() === targetRepo.name.toLowerCase()
    );
    
    if (found) {
      rankings[`${targetRepo.owner}/${targetRepo.name}`] = {
        rank: found.rank,
        page: found.page,
        display: `${found.rank} (Page ${found.page})`
      };
    } else {
      rankings[`${targetRepo.owner}/${targetRepo.name}`] = {
        rank: 'Not Found',
        page: '-',
        display: 'Not Found'
      };
    }
  });
  
  return rankings;
}

// ============================================
// CONCURRENT PROCESSING
// ============================================

async function processKeywordBatch(browser, keywords, startIndex) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  
  // Set extra HTTP headers to look more like a real browser
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
  });
  
  const results = [];
  
  for (let i = 0; i < keywords.length; i++) {
    const keyword = keywords[i];
    const keywordId = `K${(startIndex + i + 1).toString().padStart(2, '0')}`;
    
    log(`Processing keyword: "${keyword}"`, 'search', keywordId);
    
    const searchResults = await searchAndRankRepos(page, keyword, keywordId);
    
    if (searchResults.length === 0) {
      log(`No results found, skipping...`, 'warning', keywordId);
      // Still add row but with "Not Found" for all repos
      const row = [keyword];
      CONFIG.repos.forEach(() => {
        row.push('Not Found');
      });
      results.push(row);
      continue;
    }
    
    log(`Total repos found: ${searchResults.length}`, 'success', keywordId);
    
    const rankings = findRepoRankings(searchResults, CONFIG.repos);
    
    // Log rankings
    log(`Rankings for your repos:`, 'rank', keywordId);
    Object.entries(rankings).forEach(([repoName, data]) => {
      const shortName = repoName.split('/')[1];
      if (data.rank === 'Not Found') {
        log(`  ${shortName}: Not Found (searched ${searchResults.length} repos)`, 'warning', keywordId);
      } else {
        const rankDisplay = `#${data.rank.toString().padStart(2, '0')}`;
        const emoji = data.rank <= 5 ? '🏆' : data.rank <= 10 ? '🥈' : '📍';
        log(`  ${emoji} ${shortName}: ${rankDisplay} (Page ${data.page})`, 'success', keywordId);
      }
    });
    
    // Create row for Excel
    const row = [keyword];
    CONFIG.repos.forEach(repo => {
      const repoKey = `${repo.owner}/${repo.name}`;
      row.push(rankings[repoKey].display);
    });
    
    results.push(row);
    
    if (i < keywords.length - 1) {
      await sleep(CONFIG.delayBetweenRequests);
    }
  }
  
  await page.close();
  return results;
}

// ============================================
// EXCEL FUNCTIONS
// ============================================

function createOrUpdateExcelFile(newData, filename) {
  let wb;
  let ws;
  let existingData = [];
  
  if (fs.existsSync(filename)) {
    try {
      wb = XLSX.readFile(filename);
      ws = wb.Sheets[wb.SheetNames[0]];
      existingData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    } catch (error) {
      log(`Creating new file: ${error.message}`, 'warning');
      wb = XLSX.utils.book_new();
      existingData = [];
    }
  } else {
    wb = XLSX.utils.book_new();
  }
  
  const timestamp = new Date().toLocaleString('en-US', { 
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  
  const newSection = [];
  newSection.push([`📊 Run: ${timestamp}`]);
  
  const headers = ['Keyword', 'Jobs', 'Hardware-Engineering', 'Internships', 'Software-Engineering', 'Data-Science', 'Nursing'];
  newSection.push(headers);
  
  newSection.push(...newData);
  newSection.push([]);
  
  const finalData = [...newSection, ...existingData];
  
  ws = XLSX.utils.aoa_to_sheet(finalData);
  
  const range = XLSX.utils.decode_range(ws['!ref']);
  const colWidths = [];
  for (let col = range.s.c; col <= range.e.c; col++) {
    let maxWidth = 10;
    for (let row = range.s.r; row <= range.e.r; row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (ws[cellAddress] && ws[cellAddress].v) {
        const cellLength = String(ws[cellAddress].v).length;
        maxWidth = Math.max(maxWidth, cellLength);
      }
    }
    colWidths.push({ wch: Math.min(maxWidth + 2, 50) });
  }
  ws['!cols'] = colWidths;
  
  // Style timestamp header
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (ws[cellAddress]) {
      ws[cellAddress].s = {
        font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4472C4" } },
        alignment: { horizontal: "left", vertical: "center" }
      };
    }
  }
  
  // Style column headers
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 1, c: col });
    if (ws[cellAddress]) {
      ws[cellAddress].s = {
        font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "366092" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } }
        }
      };
    }
  }
  
  // Style data rows
  for (let row = 2; row < 2 + newData.length; row++) {
    const isEvenRow = (row - 2) % 2 === 0;
    const fillColor = isEvenRow ? "F2F2F2" : "FFFFFF";
    
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (ws[cellAddress]) {
        const cellValue = ws[cellAddress].v;
        let fontColor = "000000";
        let isBold = false;
        
        if (typeof cellValue === 'string' && col > 0) {
          const rankMatch = cellValue.match(/^(\d+)/);
          if (rankMatch) {
            const rank = parseInt(rankMatch[1]);
            if (rank <= 5) {
              fontColor = "006400";
              isBold = true;
            } else if (rank <= 10) {
              fontColor = "0066CC";
            }
          } else if (cellValue === "Not Found") {
            fontColor = "CC0000";
          }
        }
        
        ws[cellAddress].s = {
          font: { sz: 10, color: { rgb: fontColor }, bold: isBold },
          fill: { fgColor: { rgb: fillColor } },
          alignment: { 
            horizontal: col === 0 ? "left" : "center", 
            vertical: "center" 
          },
          border: {
            top: { style: "thin", color: { rgb: "CCCCCC" } },
            bottom: { style: "thin", color: { rgb: "CCCCCC" } },
            left: { style: "thin", color: { rgb: "CCCCCC" } },
            right: { style: "thin", color: { rgb: "CCCCCC" } }
          }
        };
      }
    }
  }
  
  ws['!freeze'] = { xSplit: 0, ySplit: 2 };
  
  if (wb.SheetNames.length === 0) {
    XLSX.utils.book_append_sheet(wb, ws, 'Rankings');
  } else {
    wb.Sheets[wb.SheetNames[0]] = ws;
  }
  
  XLSX.writeFile(wb, filename);
  log(`Updated: ${filename}`, 'file');
}

// ============================================
// MAIN TRACKING FUNCTION
// ============================================

async function trackZapplyJobsRankings() {
  const startTime = Date.now();
  
  log('═'.repeat(70), 'info');
  log('ZAPPLY JOBS - REPOSITORY RANKING TRACKER', 'info');
  log('═'.repeat(70), 'info');
  log('', 'info');
  log(`📦 Repositories: ${CONFIG.repos.length}`, 'info');
  CONFIG.repos.forEach(repo => {
    log(`   • ${repo.owner}/${repo.name}`, 'info');
  });
  log('', 'info');
  log(`🔑 Keywords: ${CONFIG.keywords.length}`, 'info');
  log(`📄 Pages per keyword: ${CONFIG.maxPagesToCheck}`, 'info');
  log(`🌐 Concurrent browsers: ${CONFIG.concurrentBrowsers}`, 'browser');
  log(`🔧 Debug mode: ${CONFIG.debugMode ? 'ON' : 'OFF'}`, 'debug');
  log('', 'info');
  
  log(`🚀 Launching ${CONFIG.concurrentBrowsers} browser instances...`, 'browser');
  const browsers = await Promise.all(
    Array(CONFIG.concurrentBrowsers).fill(null).map(() =>
      puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080'
        ]
      })
    )
  );
  
  log(`✅ All browsers launched!`, 'success');
  log('', 'info');
  
  const keywordsPerBrowser = Math.ceil(CONFIG.keywords.length / CONFIG.concurrentBrowsers);
  const keywordBatches = [];
  
  for (let i = 0; i < CONFIG.concurrentBrowsers; i++) {
    const start = i * keywordsPerBrowser;
    const end = Math.min(start + keywordsPerBrowser, CONFIG.keywords.length);
    if (start < CONFIG.keywords.length) {
      keywordBatches.push({
        keywords: CONFIG.keywords.slice(start, end),
        startIndex: start
      });
    }
  }
  
  log('─'.repeat(70), 'info');
  log('🔍 STARTING CONCURRENT ANALYSIS', 'info');
  log('─'.repeat(70), 'info');
  keywordBatches.forEach((batch, idx) => {
    log(`Browser ${idx + 1}: ${batch.keywords.length} keywords`, 'browser');
  });
  log('', 'info');
  
  const batchPromises = keywordBatches.map((batch, idx) =>
    processKeywordBatch(browsers[idx], batch.keywords, batch.startIndex)
  );
  
  const batchResults = await Promise.all(batchPromises);
  
  log('', 'info');
  log('🔒 Closing browsers...', 'browser');
  await Promise.all(browsers.map(browser => browser.close()));
  
  const allResults = [];
  batchResults.forEach(batchResult => {
    allResults.push(...batchResult);
  });
  
  allResults.sort((a, b) => {
    return CONFIG.keywords.indexOf(a[0]) - CONFIG.keywords.indexOf(b[0]);
  });
  
  log('', 'info');
  log('─'.repeat(70), 'info');
  log('📊 SAVING RESULTS', 'info');
  log('─'.repeat(70), 'info');
  
  const outputDir = 'rankings-output';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const trackingFilename = path.join(outputDir, 'zapplyjobs-rankings-tracking.xlsx');
  createOrUpdateExcelFile(allResults, trackingFilename);
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  log('', 'info');
  log('═'.repeat(70), 'info');
  log('✅ TRACKING COMPLETED', 'success');
  log('═'.repeat(70), 'info');
  log('', 'info');
  log(`   ✓ Keywords processed: ${CONFIG.keywords.length}`, 'success');
  log(`   ✓ Repositories tracked: ${CONFIG.repos.length}`, 'success');
  log(`   ✓ Execution time: ${duration}s`, 'success');
  log(`   ✓ File: ${trackingFilename}`, 'file');
  log('', 'info');
  log('⏰ Next run in 10 minutes', 'info');
  log('', 'info');
}

// ============================================
// EXECUTION
// ============================================

if (require.main === module) {
  trackZapplyJobsRankings()
    .then(() => {
      log('🎉 Completed!', 'success');
      process.exit(0);
    })
    .catch((error) => {
      log(`💥 Error: ${error.message}`, 'error');
      console.error(error);
      process.exit(1);
    });
}

module.exports = { trackZapplyJobsRankings };