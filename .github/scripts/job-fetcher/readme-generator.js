const fs = require("fs");
const companyCategory = require("./nursing.json");
const {
 companies,
 ALL_COMPANIES,
 getCompanyEmoji,
 getCompanyCareerUrl,
 formatTimeAgo,
 getExperienceLevel,
 getJobCategory,
 formatLocation,
 normalizeCompanyName,
} = require("./utils");



function generateJobTable(jobs) {
 console.log(
  `🔍 DEBUG: Starting generateJobTable with ${jobs.length} total jobs`
 );

 if (jobs.length === 0) {
  return `| Company | Role | Location | Apply Now | Age |
|---------|------|----------|-----------|-----|
| *No current openings* | *Check back tomorrow* | *-* | *-* | *-* |`;
 }

 // Create a map of lowercase company names to actual names for case-insensitive matching
 const companyNameMap = new Map();
 Object.entries(companyCategory).forEach(([categoryKey, category]) => {
  // Added safety check for category.companies to prevent iteration errors
  if (Array.isArray(category.companies)) {
   category.companies.forEach((company) => {
    companyNameMap.set(company.toLowerCase(), {
     name: company,
     category: categoryKey,
     categoryTitle: category.title,
    });
   });
  }
 });

 console.log(`🏢 DEBUG: Configured companies by category:`);
 Object.entries(companyCategory).forEach(([categoryKey, category]) => {
  console.log(
   ` ${category.emoji} ${category.title}: ${category.companies?.join(", ") || 'No companies configured'}`
  );
 });

 // Get unique companies from job data
 const uniqueJobCompanies = [...new Set(jobs.map((job) => job.employer_name))];
 console.log(
  `\n📊 DEBUG: Unique companies found in job data (${uniqueJobCompanies.length}):`,
  uniqueJobCompanies
 );

 // Group jobs by company - only include jobs from valid companies
 const jobsByCompany = {};
 const processedCompanies = new Set();
 const skippedCompanies = new Set();

 jobs.forEach((job) => {
  // Normalize company name first (e.g., 'HSHS' -> 'Hospital Sisters Health System')
  const normalizedCompanyName = normalizeCompanyName(job.employer_name);
  const employerNameLower = normalizedCompanyName.toLowerCase();
  const matchedCompany = companyNameMap.get(employerNameLower);

  // Only process jobs from companies in our category list
  if (matchedCompany) {
   console.log(
    `✅ MATCH: "${job.employer_name}" -> "${normalizedCompanyName}" in category "${matchedCompany.categoryTitle}" as "${matchedCompany.name}"`
   );
   processedCompanies.add(normalizedCompanyName);
   if (!jobsByCompany[matchedCompany.name]) {
    jobsByCompany[matchedCompany.name] = [];
   }
   jobsByCompany[matchedCompany.name].push(job);
  } else {
   // Debug: Check if this is a company name normalization issue
   console.log(`❌ NO MATCH: "${job.employer_name}" -> "${normalizedCompanyName}" (not found in nursing.json categories)`);
   console.log(`   Looking for: "${employerNameLower}"`);
   console.log(`   Available companies:`, [...companyNameMap.keys()]);
   skippedCompanies.add(job.employer_name);
  }
 });

 console.log(`\n✅ DEBUG: Companies INCLUDED (${processedCompanies.size}):`, [
  ...processedCompanies,
 ]);
 console.log(`\n❌ DEBUG: Companies SKIPPED (${skippedCompanies.size}):`, [
  ...skippedCompanies,
 ]);

 // New: Summarize configured companies that ended up with zero jobs after filtering
 console.log("\n📋 DEBUG: Category coverage summary (configured vs with jobs vs zero jobs)");
 Object.entries(companyCategory).forEach(([categoryKey, categoryData]) => {
  const configured = categoryData.companies || [];
  const withJobs = configured.filter((c) => jobsByCompany[c] && jobsByCompany[c].length > 0);
  const zeroJobs = configured.filter((c) => !withJobs.includes(c));
  console.log(
   ` 🗂️ ${categoryData.title}: configured=${configured.length}, withJobs=${withJobs.length}, zeroJobs=${zeroJobs.length}`
  );
  if (zeroJobs.length > 0) {
   console.log(`   ↪️ Configured but zero jobs:`, zeroJobs);
  }
 });

 // Log job counts by company
 console.log(`\n📈 DEBUG: Job counts by company:`);
 Object.entries(jobsByCompany).forEach(([company, jobs]) => {
  const companyInfo = companyNameMap.get(company.toLowerCase());
  console.log(
   ` ${company}: ${jobs.length} jobs (Category: ${
    companyInfo?.categoryTitle || "Unknown"
   })`
  );
 });

 let output = "";

 // Handle each category
 Object.entries(companyCategory).forEach(([categoryKey, categoryData]) => {
  // Filter companies that actually have jobs
  const companiesWithJobs = (categoryData.companies || []).filter(
   (company) => jobsByCompany[company] && jobsByCompany[company].length > 0
  );

  const companiesZeroJobs = (categoryData.companies || []).filter(
   (company) => !companiesWithJobs.includes(company)
  );

  console.log(
   `\n📦 DEBUG: Category "${categoryData.title}" configured companies:`,
   categoryData.companies || []
  );
  console.log(
   `📥 DEBUG: Category "${categoryData.title}" companies WITH jobs:`,
   companiesWithJobs
  );
  console.log(
   `📭 DEBUG: Category "${categoryData.title}" companies with ZERO jobs:`,
   companiesZeroJobs
  );

  if (companiesWithJobs.length > 0) {
   const totalJobs = companiesWithJobs.reduce(
    (sum, company) => sum + jobsByCompany[company].length,
    0
   );

   console.log(
    `\n📝 DEBUG: Processing category "${categoryData.title}" with ${companiesWithJobs.length} companies and ${totalJobs} total jobs:`
   );
   companiesWithJobs.forEach((company) => {
    console.log(` - ${company}: ${jobsByCompany[company].length} jobs`);
   });

   // Use singular/plural based on job count
   const positionText = totalJobs === 1 ? "position" : "positions";
   output += `### ${categoryData.emoji} **${categoryData.title}** (${totalJobs} ${positionText})\n\n`;

   // Handle ALL companies with their own sections (regardless of job count)
   companiesWithJobs.forEach((companyName) => {
    const companyJobs = jobsByCompany[companyName];
    const emoji = getCompanyEmoji(companyName);
    const positionText =
     companyJobs.length === 1 ? "position" : "positions";

    // Use collapsible details for companies with more than 15 jobs
    if (companyJobs.length > 15) {
     output += `<details>\n`;
     output += `<summary><h4>${emoji} <strong>${companyName}</strong> (${companyJobs.length} ${positionText})</h4></summary>\n\n`;
    } else {
     output += `#### ${emoji} **${companyName}** (${companyJobs.length} ${positionText})\n\n`;
    }

    output += `| Role | Location | Apply Now | Age |\n`;
    output += `|------|----------|-----------|-----|\n`;

    companyJobs.forEach((job) => {
     const role = job.job_title;
     const location = formatLocation(job.job_city, job.job_state);
     const posted = job.job_posted_at;
     const applyLink =
      job.job_apply_link || getCompanyCareerUrl(job.employer_name);

     let statusIndicator = "";
     const description = (job.job_description || "").toLowerCase();
     if (
      description.includes("no sponsorship") ||
      description.includes("us citizen")
     ) {
      statusIndicator = " 🇺🇸";
     }
     if (description.includes("remote")) {
      statusIndicator += " 🏠";
     }

     output += `| ${role}${statusIndicator} | ${location} | [<img src="./image.png" width="100" alt="Apply">](${applyLink}) | ${posted} |\n`;
    });

    if (companyJobs.length > 15) {
     output += `\n</details>\n\n`;
    } else {
     output += "\n";
    }
   });
  }
 });

 console.log(
  `\n🎉 DEBUG: Finished generating job table with ${
   Object.keys(jobsByCompany).length
  } companies processed`
 );
 return output;
}


function generateArchivedSection(archivedJobs, stats) {
 if (archivedJobs.length === 0) {
  return "";
 }

 // The old FAANG logic that could crash is safely commented out or removed.

 const archivedJobTable = generateJobTable(archivedJobs);

 return `<details>
<summary><h2>📁 <strong>Archived Data Jobs – ${archivedJobs.length} (7+ days old)</strong> - Click to Expand</h2></summary>

Either still hiring or useful for research.

### **Archived Job Stats**

📁 **Total Jobs:** ${archivedJobs.length} positions
🏢 **Companies:** ${Object.keys(stats?.totalByCompany || {}).length} companies


${archivedJobTable}

</details>`;
}

async function generateReadme(currentJobs, archivedJobs = [], internshipData = null, stats = null) {
 const currentDate = new Date().toLocaleDateString("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
 });

 const totalCompanies = Object.keys(stats?.totalByCompany || {}).length;
 // The old FAANG logic that could crash is safely commented out or removed.

 const jobTable = generateJobTable(currentJobs);
 const archivedSection = generateArchivedSection(archivedJobs, stats);
 

 return `<div align="center">

<!-- Banner -->
<img src="jobboard/public/mega-zapply.png" alt="Zapply - New Grad Nursing Jobs" width="200">

<h3>💼 New Grad Nursing Jobs 2025-2026</h3>
<p><em>Real-time job opportunities from ${totalCompanies}</em></p>

<br>

<!-- Row 1: Job Stats (Custom Static Badges) -->
![Total Jobs](https://img.shields.io/badge/Total_Jobs-${currentJobs.length}-brightgreen?style=flat&logo=briefcase)
![Companies](https://img.shields.io/badge/Companies-${totalCompanies}-blue?style=flat&logo=building)
![Updated](https://img.shields.io/badge/Updated-Every_15_Minutes-orange?style=flat&logo=calendar)
![License](https://img.shields.io/badge/License-CC--BY--NC--4.0-purple?style=flat&logo=creativecommons)

<!-- Row 2: Repository Stats -->
![GitHub stars](https://img.shields.io/github/stars/zapplyjobs/New-Grad-Nursing-Jobs?style=flat&logo=github&color=yellow)
![GitHub forks](https://img.shields.io/github/forks/zapplyjobs/New-Grad-Nursing-Jobs?style=flat&logo=github&color=blue)
![Last commit](https://img.shields.io/github/last-commit/zapplyjobs/New-Grad-Nursing-Jobs?style=flat&color=red)
![Contributors](https://img.shields.io/github/contributors/zapplyjobs/New-Grad-Nursing-Jobs?style=flat&color=green)

<!-- Row 3: Workflow Health -->
![Update Jobs](https://img.shields.io/github/actions/workflow/status/zapplyjobs/New-Grad-Nursing-Jobs/update-jobs.yml?style=flat&label=job-updates&logo=github-actions&logoColor=white)

<!-- Row 4: Community & Links (for-the-badge style) -->
[![Browse Jobs](https://img.shields.io/badge/Browse_Jobs-Live_Site-FF6B35?style=for-the-badge&logo=rocket&logoColor=white)](https://new-grad-positions.vercel.app/)
[![Zapply](https://img.shields.io/badge/Zapply-Company_Site-4F46E5?style=for-the-badge&logo=zap&logoColor=white)](https://zapply-jobs.vercel.app/)
[![Discord](https://img.shields.io/badge/Discord-Join_Community-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/yKWw28q7Yq)
[![Reddit](https://img.shields.io/badge/Reddit-Join-FF4500?style=for-the-badge&logo=reddit&logoColor=white)](https://www.reddit.com/r/Zapply/)
[![Report Issue](https://img.shields.io/badge/Report_Issue-Bug_Tracker-yellow?style=for-the-badge&logo=github&logoColor=white)](https://github.com/zapplyjobs/New-Grad-Nursing-Jobs/issues)

<!-- Zapply extension badge - add when extension launches -->
<!-- [![Zapply Extension](https://img.shields.io/badge/Extension-Apply_Faster-4F46E5?style=for-the-badge&logo=chrome&logoColor=white)](https://zapply-extension-url) -->

</div>

---
 
 # 🏥 Healthcare & Nursing Jobs 2026 by Zapply

 **🚀 Real-time nursing, healthcare, and medical job listings from ${totalCompanies}+ top institutions like Mayo Clinic, Cleveland Clinic, and Johns Hopkins Medicine. Updated every 24 hours with ${currentJobs.length}+ fresh opportunities for new graduates in registered nursing, allied health, and pharma**.

**🎯 Includes roles across trusted organizations like Mass General Brigham, Kaiser Permanente, and NewYork-Presbyterian Hospital**.

**🛠 Help us grow! Add new jobs by submitting an issue! View contributing steps [here](CONTRIBUTING-GUIDE.md)**.

---
## **Join Community**

Connect with fellow job seekers, get career advice, share experiences, and stay updated on the latest opportunities. Join our community of developers and CS students navigating their career journey together!


<div align="center">
 <a href="https://discord.gg/yKWw28q7Yq" target="_blank">
  <img src="./discord-button.png" width="400" alt="Join Discord - Job Finder & Career Hub by Zapply">
 </a>
</div>


---
## 📊 **Live Stats**

- 🔥 **Current Positions:** ${currentJobs.length} hot healthcare and medical jobs
- 🏢 **Top Companies:** ${totalCompanies} elite tech including Mayo Clinic, CVS Health, Pfizer
- 📅 **Last Updated:** ${currentDate}
- 🤖 **Next Update:** Tomorrow at 9 AM UTC
- 📁 **Archived Healthcare Jobs:** ${archivedJobs.length} (older than 1 week)


---

## 🎯 **Fresh Nursing Job Listings 2026 (under 1 week)**

${generateJobTable(currentJobs)}

---
## **✨ Insights on the Repo**

### 🏢 **Top Companies**

#### ⭐ **Top Healthcare Systems** (${(() => {
 // Access the new category: top_healthcare_systems. Added defensive programming (optional chaining) to prevent crashes.
 const companiesList = companies?.top_healthcare_systems || [];
 const count = companiesList.filter(c => currentJobs.filter(job => job.employer_name === c.name).length > 0).length || 0;
 return `${count} ${count === 1 ? 'company' : 'companies'}`;
})()})
${companies?.top_healthcare_systems?.filter(c => currentJobs.filter(job => job.employer_name === c.name).length > 0).map((c, index) => {
 const totalJobs = currentJobs.filter(job => job.employer_name === c.name).length;
 const jobText = totalJobs === 1 ? 'position' : 'positions';
 if (index === 0) {
  return `${c.emoji} **[${c.name}](${c.career_url})** (${totalJobs} ${jobText})`;
 } else {
  return `${c.emoji} **[${c.name}](${c.career_url})** (${totalJobs})`;
 }
}).join(" • ") || "No companies available"}


#### 🎓 **Academic Medical Centers** (${(() => {
 // Access the new category: academic_medical_centers. Added defensive programming (optional chaining) to prevent crashes.
 const companiesList = companies?.academic_medical_centers || [];
 const count = companiesList.filter(c => currentJobs.filter(job => job.employer_name === c.name).length > 0).length || 0;
 return `${count} ${count === 1 ? 'company' : 'companies'}`;
})()})
${companies?.academic_medical_centers?.filter(c => currentJobs.filter(job => job.employer_name === c.name).length > 0).map((c, index) => {
 const totalJobs = currentJobs.filter(job => job.employer_name === c.name).length;
 const jobText = totalJobs === 1 ? 'position' : 'positions';
 if (index === 0) {
  return `${c.emoji} **[${c.name}](${c.career_url})** (${totalJobs} ${jobText})`;
 } else {
  return `${c.emoji} **[${c.name}](${c.career_url})** (${totalJobs})`;
 }
}).join(" • ") || "No companies available"}


#### 🔗 **Regional Health Networks** (${(() => {
 // Access the new category: regional_health_networks. Added defensive programming (optional chaining) to prevent crashes.
 const companiesList = companies?.regional_health_networks || [];
 const count = companiesList.filter(c => currentJobs.filter(job => job.employer_name === c.name).length > 0).length || 0;
 return `${count} ${count === 1 ? 'company' : 'companies'}`;
})()})
${companies?.regional_health_networks?.filter(c => currentJobs.filter(job => job.employer_name === c.name).length > 0).map((c, index) => {
 const totalJobs = currentJobs.filter(job => job.employer_name === c.name).length;
 const jobText = totalJobs === 1 ? 'position' : 'positions';
 if (index === 0) {
  return `${c.emoji} **[${c.name}](${c.career_url})** (${totalJobs} ${jobText})`;
 } else {
  return `${c.emoji} **[${c.name}](${c.career_url})** (${totalJobs})`;
 }
}).join(" • ") || "No companies available"}

---

### 📈 **Experience Breakdown**

| Level        | Count | Percentage | Top Companies           |
|---------------------|-------|------------|-----------------------------------|
| 🟢 Entry Level & New Grad | ${stats?.byLevel["Entry-Level"] || 0} | ${
  stats
   ? Math.round((stats.byLevel["Entry-Level"] / currentJobs.length) * 100)
   : 0
 }% | No or minimal experience |
| 🟡 Beginner & Early Career | ${stats?.byLevel["Mid-Level"] || 0} | ${
  stats
   ? Math.round((stats.byLevel["Mid-Level"] / currentJobs.length) * 100)
   : 0
 }% | 1-2 years of experience |
| 🔴 Manager     | ${stats?.byLevel["Senior"] || 0} | ${
  stats ? Math.round((stats.byLevel["Senior"] / currentJobs.length) * 100) : 0
 }% | 2+ years of experience |

---

### 🌍 **Top Locations**
${
 stats
  ? Object.entries(stats.byLocation)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([location, count]) => `- **${location}**: ${count} positions`)
    .join("\n")
  : ""
}

---

## 🔮 Why Nursing Grads Choose Our Job Board

✅ **100% Real Jobs:** ${currentJobs.length}+ verified hospital and pharma roles from ${totalCompanies} elite organizations.

✅ **Fresh Daily Updates:** Live company data refreshed every 24 hours automatically.

✅ **Entry-Level Focused:** Smart filtering for internships and entry-level roles.

✅ **Intern-to-FTE Pipeline:** Track internships that convert into full-time healthcare careers.

✅ **Direct Applications:** Skip recruiters – apply straight to company career pages.

✅ **Mobile-Optimized:** Perfect mobile experience for students between clinical shifts or class.

---

## 🚀 Job Hunt Tips That Actually Work

### 🔍 **Research Before Applying**
- **Find the hiring manager**: Search "[Company] [Team] engineering manager" on LinkedIn.
- **Check recent tech decisions**: Read their engineering blog for stack changes or new initiatives.
- **Verify visa requirements**: Look for 🇺🇸 indicator or "US persons only" in job description.
- [Use this 100% ATS-compliant and job-targeted resume template](https://docs.google.com/document/d/1EcP_vX-vTTblCe1hYSJn9apwrop0Df7h/export?format=docx)

### 📄 **Resume Best Practices**
- **Mirror their tech stack**: Copy exact keywords from job post (RN, medical assistant, health analyst)
- **Lead with business impact**: "Reduced churn by 12% through cohort analysis" > "Used Excel"
- **Show certifications**: "Mention BLS, CNA, or any state licensure prominently"
- [Read this informative guide on tweaking your resume](https://drive.google.com/uc?export=download&id=1H6ljywqVnxONdYUD304V1QRayYxr0D1e)

### 🎯 **Interview Best Practices**
- **Prepare patient care stories**: "How do you ensure model explainability in production?" shows real research
- **Highlight compliance**: "Improved forecast accuracy by 20% using time-series analysis"
- **Mention tools**: "As a daily Slack user, I've noticed..." proves genuine interest
- [Review this comprehensive interview guide on common behavioral, technical, and curveball questions](https://drive.google.com/uc?export=download&id=1MGRv7ANu9zEnnQJv4sstshsmc_Nj0Tl0)

---

## 📬 **Stay Updated**

- ⭐ **Star this repo** to bookmark and check daily.
- 👀 **Watch** to get notified of new data postings.
- 📱 **Bookmark on your phone** for quick job hunting.
- 🤝 **Become a contributor** and add new jobs! Visit our contributing guide [here](CONTRIBUTING-GUIDE.md).


---

${archivedSection}

---

🎯 **${currentJobs.length} current opportunities from ${totalCompanies} elite companies.**

**Found this helpful? Give it a ⭐ to support us!**

*Not affiliated with any companies listed. All applications redirect to official career pages.*

**Last Updated:** ${currentDate} • **Next Update:** Daily at 9 AM UTC`;
}

async function updateReadme(currentJobs, archivedJobs, internshipData, stats) {
 try {
  console.log("📝 Generating README content...");
  const readmeContent = await generateReadme(
   currentJobs,
   archivedJobs,
   internshipData,
   stats
  );
  fs.writeFileSync("README.md", readmeContent, "utf8");
  console.log(`✅ README.md updated with ${currentJobs.length} current jobs`);

  console.log("\n📊 Summary:");
  console.log(`- Total current: ${currentJobs.length}`);
  console.log(`- Archived:   ${archivedJobs.length}`);
  console.log(
   `- Companies:   ${Object.keys(stats?.totalByCompany || {}).length}`
  );
 } catch (err) {
  console.error("❌ Error updating README:", err);
  throw err;
 }
}

module.exports = {
 generateJobTable,
 generateArchivedSection,
 generateReadme,
 updateReadme,
};
