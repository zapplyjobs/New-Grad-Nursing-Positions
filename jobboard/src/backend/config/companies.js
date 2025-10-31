const fs = require("fs");
const path = require("path");

// Read selectors.json using fs
const selectorsPath = path.join(__dirname, "selectors.json");
const selectors = JSON.parse(fs.readFileSync(selectorsPath, "utf8"));

function getCompanies(searchQuery = "", pageNum = 1) {
  return {
intermountainHealth: {
  name: "Intermountain Health",
  baseUrl: "https://imh.wd108.myworkdayjobs.com",
  url: `https://imh.wd108.myworkdayjobs.com/IntermountainCareers?q=${encodeURIComponent(searchQuery)}`,
  selector: selectors.intermountainHealth
},
cleavelandClinic: {
  name: "Cleveland Clinic",
  baseUrl: "https://ccf.wd1.myworkdayjobs.com",
  url: `https://ccf.wd1.myworkdayjobs.com/ClevelandClinicCareers?q=${encodeURIComponent(searchQuery)}`,
  selector: selectors.cleavelandClinic
},
vanderbilt: {
  name: "Vanderbilt Health",
  baseUrl: "https://vumc.wd1.myworkdayjobs.com",
  url: `https://vumc.wd1.myworkdayjobs.com/vumccareers?q=${encodeURIComponent(searchQuery)}`,
  selector: selectors.vanderbilt
},
presbyterian: {
  name: "New York Presbyterian",
  baseUrl: "https://nyp.wd1.myworkdayjobs.com",
  url: `https://nyp.wd1.myworkdayjobs.com/nypcareers?q=${encodeURIComponent(searchQuery)}`,
  selector: selectors.presbyterian
},

stanfordhealthcare: {
  name: "Stanford Health Care",
  baseUrl: "https://stanfordhealthcare.wd5.myworkdayjobs.com",
  url: `https://stanfordhealthcare.wd5.myworkdayjobs.com/en-US/SHC_External_Career_Site?q=${encodeURIComponent(searchQuery)}`,
  selector: selectors.stanfordhealthcare
},
hshs:{
  name: "Hospital Sisters Health System",
  baseUrl: "https://hshs.wd1.myworkdayjobs.com",
  url: `https://hshs.wd1.myworkdayjobs.com/hshscareers?q=${encodeURIComponent(searchQuery)}`,
  selector: selectors.hshs
},
AlinaHealth:{
  name: "Allina Health",
  baseUrl: "https://allina.wd5.myworkdayjobs.com",
  url: `https://allina.wd5.myworkdayjobs.com/External?q=${encodeURIComponent(searchQuery)}`,
  selector: selectors.AlinaHealth

},
UniversityofRochesterMedicalCenter:{
  name: "University of Rochester Medical Center",
  baseUrl: "https://rochester.wd5.myworkdayjobs.com",
  url: `https://rochester.wd5.myworkdayjobs.com/UR_Nursing?q=${encodeURIComponent(searchQuery)}&locationCountry=bc33aa3152ec42d4995f4791a106ed09`,
  selector: selectors.UniversityofRochesterMedicalCenter
},
    EndeavorHealth:{
      name: "Endeavor Health",
      baseUrl: "https://nshs.wd1.myworkdayjobs.com",
      url: `https://nshs.wd1.myworkdayjobs.com/ns-eeh?q=${encodeURIComponent(searchQuery)}&locationCountry=bc33aa3152ec42d4995f4791a106ed09`,
      selector: selectors.EndeavorHealth
    },
    VCUHealth:{
      name: "VCU Health",
      baseUrl: "https://vcuhealth.wd1.myworkdayjobs.com",
      url: `https://vcuhealth.wd1.myworkdayjobs.com/VCUHealth_careers?q=${encodeURIComponent(searchQuery)}`,
      selector: selectors.VCUHealth
    }

  };
}

module.exports = { getCompanies };
