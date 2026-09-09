// Real articles for the seed tool, gathered from the public feeds of NASA,
// NPR, Al Jazeera and ScienceDaily on September 9, 2026. The headlines and
// quotations are the outlets' own words as printed in their feeds, never
// ours. The address on each is the page's own, with the feed tracking
// parameter removed. Used only by worker/src/wall/seed.ts.
//
// Every story here is real. What the seed invents is the rest: which wall
// date it lands on, who boosted it and when. The seed says so on every check
// row it writes.

import type { Tier } from "./allocator.js";

export interface SeedSource {
  url: string;
  headline: string;
  quotation: string;
  outlet: string;
  owner: string;
}

export interface SeedStory {
  /** The tier the sources earn: two owners is reported, video or an official release is seen directly. */
  kind: Tier;
  sources: SeedSource[];
}

export const SEED_STORIES: SeedStory[] = [
  {
    "kind": "reported",
    "sources": [
      {
        "url": "https://www.npr.org/2026/09/09/nx-s1-5962641/us-destroy-iranian-oil-tankers",
        "headline": "U.S. military says it destroyed 5 Iranian oil tankers after attacks on Navy warship",
        "quotation": "The U.S. military said it destroyed five Iranian oil tankers on Tuesday in response to the latest attacks on its warships and American targets in Jordan, the latest burst of back-and-forth strikes.",
        "outlet": "npr.org",
        "owner": "National Public Radio"
      },
      {
        "url": "https://www.aljazeera.com/news/2026/9/9/us-destroys-five-iranian-tankers-iran-retaliates-with-attacks-on-jordan-base",
        "headline": "US strikes 5 Iranian oil tankers; Tehran targets Jordan base, US warships",
        "quotation": "US military says it struck the five Iranian tankers after the IRGC targeted a US warship twice in two days.",
        "outlet": "aljazeera.com",
        "owner": "Al Jazeera Media Network"
      }
    ]
  },
  {
    "kind": "reported",
    "sources": [
      {
        "url": "https://www.npr.org/2026/09/08/g-s1-142302/up-first-newsletter-trumpapalooza-amazon-cargo-plane-crash-canada-tariffs",
        "headline": "GOP to host unusual midterm convention. And, Canada's retaliatory tariffs take effect",
        "quotation": "Republicans are aiming to get voters to turn out for the midterms with an unconventional convention. And, Canada's retaliatory tariffs on the U.S. went into effect at midnight.",
        "outlet": "npr.org",
        "owner": "National Public Radio"
      },
      {
        "url": "https://www.aljazeera.com/news/2026/9/9/energiser-or-circus-us-voters-weigh-in-on-trumps-midterm-convention",
        "headline": "'Energiser' or 'circus': US voters weigh in on Trump's midterm convention",
        "quotation": "The atypical event underscores the significance of Texas, long a Republican stronghold, in November's midterm elections.",
        "outlet": "aljazeera.com",
        "owner": "Al Jazeera Media Network"
      }
    ]
  },
  {
    "kind": "seen_direct",
    "sources": [
      {
        "url": "https://www.nasa.gov/news-release/nasa-adds-relativity-spaces-terran-r-to-launch-services-contract/",
        "headline": "NASA Adds Relativity Space's Terran R to Launch Services Contract",
        "quotation": "A NASA Launch Services (NLS) II contract has been awarded by the agency to Relativity Space Inc., and its Terran R launch service in accordance with the contract's on-ramp provision.",
        "outlet": "nasa.gov",
        "owner": "National Aeronautics and Space Administration, United States government"
      }
    ]
  },
  {
    "kind": "seen_direct",
    "sources": [
      {
        "url": "https://science.nasa.gov/missions/chandra/nasas-chandra-unveils-mysterious-x-ray-objects/",
        "headline": "NASA's Chandra Unveils Mysterious X-Ray Objects",
        "quotation": "Using NASA's Chandra X-ray Observatory, scientists have discovered a new class of objects behaving unlike any they have seen before.",
        "outlet": "science.nasa.gov",
        "owner": "National Aeronautics and Space Administration, United States government"
      }
    ]
  },
  {
    "kind": "seen_direct",
    "sources": [
      {
        "url": "https://www.nasa.gov/missions/jason-cs-sentinel-6/how-2-us-european-satellites-are-studying-hurricanes-during-el-nino/",
        "headline": "How 2 US, European Satellites Are Studying Hurricanes During El Niño",
        "quotation": "Last November, NASA and its European partners launched the Sentinel-6B satellite to improve hurricane forecasts, help protect infrastructure, and benefit commercial industries, including shipping.",
        "outlet": "nasa.gov",
        "owner": "National Aeronautics and Space Administration, United States government"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.aljazeera.com/news/2026/9/9/as-sdf-disband-in-syria-kurds-ponder-how-to-secure-their-rights",
        "headline": "As SDF disband in Syria, Kurds ponder how to secure their rights",
        "quotation": "As the Kurdish forces dissolve, experts express concern if their rights will be won through democratic means.",
        "outlet": "aljazeera.com",
        "owner": "Al Jazeera Media Network"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.aljazeera.com/news/2026/9/9/us-midterm-elections-key-takeaways-from-new-hampshire-primaries",
        "headline": "US midterm elections: Key takeaways from New Hampshire primaries",
        "quotation": "The GOP aims to gain a New England foothold as Democrats strive to retain the Senate seat.",
        "outlet": "aljazeera.com",
        "owner": "Al Jazeera Media Network"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.aljazeera.com/news/2026/9/9/why-us-iran-war-over-hormuz-is-threatening-the-gulfs-waters",
        "headline": "Why US-Iran war over Hormuz is threatening the Gulf's waters",
        "quotation": "US-Iran attacks on tankers around Hormuz are raising fears of devastating oil spills across the Gulf.",
        "outlet": "aljazeera.com",
        "owner": "Al Jazeera Media Network"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.aljazeera.com/features/2026/9/9/israels-war-leaves-lebanons-schools-balancing-students-and-the-displaced",
        "headline": "Israel's war leaves Lebanon's schools balancing students and the displaced",
        "quotation": "Schools in Lebanon are set to start on September 15, but many still host people displaced by Israel's war.",
        "outlet": "aljazeera.com",
        "owner": "Al Jazeera Media Network"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.aljazeera.com/sports/2026/9/9/jessica-pegula-beats-emma-navarro-to-set-up-sabalenka-semifinal-at-us-open",
        "headline": "Jessica Pegula beats Emma Navarro to set up Sabalenka semifinal at US Open",
        "quotation": "Pegula claims a 3-6, 6-4, 6-3 win over Navarro in an all-American quarterfinal and will face Sabalenka on Thursday.",
        "outlet": "aljazeera.com",
        "owner": "Al Jazeera Media Network"
      }
    ]
  },
  {
    "kind": "seen_direct",
    "sources": [
      {
        "url": "https://www.aljazeera.com/video/newsfeed/2026/9/9/600-year-old-tomb-of-pre-incan-chimu-kingdom-found-in-peru",
        "headline": "600-year-old tomb of pre-Incan Chimu kingdom found in Peru",
        "quotation": "Archaeologists in Peru have uncovered an almost intact Chimu funerary platform.",
        "outlet": "aljazeera.com",
        "owner": "Al Jazeera Media Network"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.aljazeera.com/news/2026/9/9/cluster-munitions-kill-wound-over-1000-globally-in-2025",
        "headline": "Cluster munitions kill, wound over 1,000 globally in 2025",
        "quotation": "The 1,063 global casualties in 2025 one of the highest annual tolls on record, a report has found.",
        "outlet": "aljazeera.com",
        "owner": "Al Jazeera Media Network"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.aljazeera.com/economy/2026/9/9/conflict-over-taiwan-would-be-disastrous-de-facto-us-ambassador-warns",
        "headline": "Conflict over Taiwan would be disastrous, de facto US ambassador warns",
        "quotation": "The United States remains Taiwan's main international backer and arms supplier despite lack of formal diplomatic ties.",
        "outlet": "aljazeera.com",
        "owner": "Al Jazeera Media Network"
      }
    ]
  },
  {
    "kind": "seen_direct",
    "sources": [
      {
        "url": "https://www.aljazeera.com/video/newsfeed/2026/9/9/cameraman-catches-the-moment-yemeni-government-forces-are-ambushed",
        "headline": "Cameraman catches the moment Yemeni government forces are ambushed",
        "quotation": "A suspected-Houthi roadside ambush of Yemeni government forces has been captured on camera.",
        "outlet": "aljazeera.com",
        "owner": "Al Jazeera Media Network"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.aljazeera.com/news/2026/9/9/gambian-leader-pledges-halt-to-rolling-blackouts-as-protests-turn-violent",
        "headline": "Gambian leader pledges halt to rolling blackouts as protests turn violent",
        "quotation": "Barrow pledges new power infrastructure, including a 24-megawatt plant, to tackle the worsening electricity crisis.",
        "outlet": "aljazeera.com",
        "owner": "Al Jazeera Media Network"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.aljazeera.com/news/2026/9/9/us-reading-scores-hit-near-25-year-low-in-latest-global-assessment",
        "headline": "US reading scores hit near-25-year low in latest global assessment",
        "quotation": "Scores among US 15-year-olds dropped 14 points from 2022, as the Trump administration pushes for 'school choice'.",
        "outlet": "aljazeera.com",
        "owner": "Al Jazeera Media Network"
      }
    ]
  },
  {
    "kind": "seen_direct",
    "sources": [
      {
        "url": "https://www.aljazeera.com/video/newsfeed/2026/9/9/aje-onl-nf_record-breaking-rain-disrupts-daily-life-in-nagoya-080926",
        "headline": "Record-breaking rain disrupts daily life in Nagoya, Japan",
        "quotation": "Record-breaking rainfall swamped the Japanese city of Nagoya dumping an all-time high of 105 mm of rain in a single hour",
        "outlet": "aljazeera.com",
        "owner": "Al Jazeera Media Network"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.aljazeera.com/news/2026/9/9/us-supreme-court-rejects-missouri-bid-to-reactivate-gop-backed-voting-map",
        "headline": "US Supreme Court rejects Missouri bid to reactivate GOP-backed voting map",
        "quotation": "A separate federal court ruling, however, contradicts the Supreme Court judgement, leaving the map up in the air.",
        "outlet": "aljazeera.com",
        "owner": "Al Jazeera Media Network"
      }
    ]
  },
  {
    "kind": "seen_direct",
    "sources": [
      {
        "url": "https://www.aljazeera.com/video/newsfeed/2026/9/9/yemens-saudi-backed-forces-strike-houthis-on-western-coast",
        "headline": "Yemen's Saudi-backed forces strike Houthis on western coast",
        "quotation": "Saudi-backed Yemeni government forces are intensifying their counteroffensive against the Houthis.",
        "outlet": "aljazeera.com",
        "owner": "Al Jazeera Media Network"
      }
    ]
  },
  {
    "kind": "seen_direct",
    "sources": [
      {
        "url": "https://www.aljazeera.com/video/newsfeed/2026/9/9/jordanian-air-defences-intercept-iranian-missile-barrage",
        "headline": "Jordanian air defences intercept Iranian missile barrage",
        "quotation": "Witnesses have captured the moment Jordanian air defence systems intercepted a barrage of Iranian ballistic missiles.",
        "outlet": "aljazeera.com",
        "owner": "Al Jazeera Media Network"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.aljazeera.com/news/2026/9/9/sharpeville-massacre-66-years-on-families-still-wait-for-justice",
        "headline": "Sharpeville massacre, 66 years on: Families still wait for justice",
        "quotation": "More than six decades after police opened fire on protesters, survivors and relatives are taking their fight to court.",
        "outlet": "aljazeera.com",
        "owner": "Al Jazeera Media Network"
      }
    ]
  },
  {
    "kind": "seen_direct",
    "sources": [
      {
        "url": "https://www.aljazeera.com/video/newsfeed/2026/9/9/aje-onl-nf_anti-afd-protesters-rally-in-after-election-win-080926",
        "headline": "Anti-AfD protesters rally in Cologne after far-right election win",
        "quotation": "Thousands of protesters rallied in Cologne against the AfD after the far-right group's election victory.",
        "outlet": "aljazeera.com",
        "owner": "Al Jazeera Media Network"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.aljazeera.com/news/2026/9/9/marco-rubio-says-us-seeks-more-economic-and-security-ties-in-latin-america",
        "headline": "Marco Rubio says US seeks more economic and security ties in Latin America",
        "quotation": "The US secretary of state visits Colombia, Ecuador and Peru in a bid to enhance cooperation with right-wing allies.",
        "outlet": "aljazeera.com",
        "owner": "Al Jazeera Media Network"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.aljazeera.com/news/2026/9/9/suspected-smugglers-on-trial-over-deadliest-migrant-tragedy-in-france",
        "headline": "Suspected smugglers on trial over deadliest migrant tragedy in France",
        "quotation": "Paris trial begins over deadly Channel tragedy, with 14 facing charges for manslaughter.",
        "outlet": "aljazeera.com",
        "owner": "Al Jazeera Media Network"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.aljazeera.com/news/2026/9/8/us-increases-pressure-on-iran-with-sanctions-targeting-aviation-sector",
        "headline": "US increases pressure on Iran with sanctions targeting aviation sector",
        "quotation": "Trump administration has sought to isolate Tehran through a raft of measures meant to squeeze the country's economy.",
        "outlet": "aljazeera.com",
        "owner": "Al Jazeera Media Network"
      }
    ]
  },
  {
    "kind": "seen_direct",
    "sources": [
      {
        "url": "https://www.aljazeera.com/video/newsfeed/2026/9/8/us-bombs-five-iranian-oil-tankers-after-its-navy-is-attacked",
        "headline": "US bombs five Iranian oil tankers after its navy is attacked",
        "quotation": "The US military has released video of its forces destroying what it says are five Iranian crude oil tankers.",
        "outlet": "aljazeera.com",
        "owner": "Al Jazeera Media Network"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.npr.org/2026/09/08/nx-s1-5955787/new-report-shows-the-economic-toll-of-ice-raids",
        "headline": "New report shows the economic toll of ICE raids",
        "quotation": "A new study shows the steep economic cost of 2025's ICE raids in Chicago. Fear kept many immigrants home, draining the area of more than $1.26 billion in lost retail, restaurant, and sales-tax revenue.",
        "outlet": "npr.org",
        "owner": "National Public Radio"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.npr.org/2026/09/08/nx-s1-5958636/kenya-immigration-foreign-xenophobia-africa",
        "headline": "Kenya's foreign trader crackdown sparks fear among migrant communities",
        "quotation": "Kenya's president orders a crackdown on foreigners running small businesses, amid accusations of xenophobia.",
        "outlet": "npr.org",
        "owner": "National Public Radio"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.npr.org/2026/09/08/g-s1-142311/australian-social-media-users-to-be-offered-choice-to-opt-out-of-algorithms",
        "headline": "Australian social media users to be offered choice to opt out of algorithms",
        "quotation": "A government statement said on Tuesday social media platforms would be required to send a notification to new and existing users offering them a choice over their default feed.",
        "outlet": "npr.org",
        "owner": "National Public Radio"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.npr.org/2026/09/08/nx-s1-5961044/uk-occcupied-west-bank-goods-israel",
        "headline": "U.K. accuses Israeli settlers of 'ethnic cleansing' in West Bank and bans their goods",
        "quotation": "France, Canada and other countries joined the U.K. in banning goods from Israeli settlements in the occupied West Bank. Israel said it would close the British Consulate among other measures.",
        "outlet": "npr.org",
        "owner": "National Public Radio"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.npr.org/2026/09/08/nx-s1-5955613/chrystia-freeland-canada-us-trade-war-tariffs",
        "headline": "Chrystia Freeland negotiated with Trump. Now she's watching a trade war unfold",
        "quotation": "Chrystia Freeland understands the U.S.-Canada relationship from her time at the negotiating table. Here's what she sees now.",
        "outlet": "npr.org",
        "owner": "National Public Radio"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.npr.org/sections/planet-money/2026/09/08/g-s1-142029/has-the-economy-gone-c-shaped",
        "headline": "Has the economy gone C-shaped?",
        "quotation": "A K means the rich and poor are pulling apart. A C supposedly means they're coming back together. We hear the case for both.",
        "outlet": "npr.org",
        "owner": "National Public Radio"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.npr.org/2026/09/08/g-s1-142296/houthi-attacks-saudi-arabia",
        "headline": "Houthi attacks on Saudi Arabia ignite fires at oil facilities and wound 73 people",
        "quotation": "The attacks come after weeks of escalating clashes between the Houthis and Saudi-backed government forces in Yemen, which shattered a four-year truce in the country's civil war.",
        "outlet": "npr.org",
        "owner": "National Public Radio"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260909005305.htm",
        "headline": "Scientists find a bone-building switch that could fight osteoporosis",
        "quotation": "An experimental compound called AP503 significantly strengthened bones in mice by activating GPR133, a receptor that boosts bone formation while slowing bone loss.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260909005217.htm",
        "headline": "Interstellar comet 3I/ATLAS is bursting with methanol",
        "quotation": "Interstellar comet 3I/ATLAS contains exceptionally high levels of methanol, suggesting it formed under conditions very different from those that shaped most comets in our solar system.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260909005212.htm",
        "headline": "Have we found alien life? Hundreds of scientists weigh in",
        "quotation": "Two major alien-life announcements in 2025 generated enormous excitement, but most astrobiologists remained unconvinced about biological molecules on K2-18b and mineral patterns in a Martian rock.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260909005155.htm",
        "headline": "Ozempic and Wegovy linked to nearly 40% fewer asthma attacks",
        "quotation": "Semaglutide, the drug found in Ozempic and Wegovy, was linked to nearly 40% fewer asthma attacks in a large real-world study and about 20% fewer COPD flare-ups.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260909005152.htm",
        "headline": "Devil's Arrows: Ancient builders hauled 55,000-pound stones 11 miles for Britain's tallest stone row",
        "quotation": "Britain's towering Devil's Arrows were built from 25-tonne stones hauled at least 18 kilometers from Brimham Rocks around 4,000 years ago, revealing astonishing prehistoric engineering.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260909005148.htm",
        "headline": "Chinese scientists find a hidden atomic structure that unlocks methane",
        "quotation": "Scientists found that a tiny atomic structure forming on nickel oxide during methane conversion is more effective than metallic nickel, enabling low-nickel catalysts to rival those with 10 times more metal.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260909005145.htm",
        "headline": "\"Parachute science\" is failing the tropics, home to more than 80% of insect species",
        "quotation": "Insects quietly hold much of the natural world together, yet conservation efforts overlook tropical regions where more than 80 percent of insect species live.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260907201609.htm",
        "headline": "Caffeine may flip an ancient cellular switch linked to slower aging",
        "quotation": "Scientists found that caffeine activates an ancient cellular energy system involved in stress resistance, DNA repair, and growth, potentially explaining its links to healthier aging.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260907201608.htm",
        "headline": "Geologists reveal the Americas collided millions of years earlier than thought",
        "quotation": "Volcanic rocks in Colombia reveal that major tectonic deformation between Central and South America had weakened by the late Miocene, suggesting intense collision occurred much earlier.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260907201605.htm",
        "headline": "Scientists discover a powerful new antivenom hidden in rattlesnake blood",
        "quotation": "Researchers discovered that combinations of toxin-blocking proteins in rattlesnake blood can powerfully neutralize venom from several dangerous snake species, proving about 10 times more potent than commercial antivenom.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260907201603.htm",
        "headline": "Giant new dinosaur discovered beneath construction site in Brazil",
        "quotation": "Scientists identified a giant new dinosaur from Brazil reaching about 20 meters long and lived 120 million years ago, with surprising evolutionary ties to a Spanish dinosaur.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260907201601.htm",
        "headline": "Ozempic and Wegovy may have an unexpected mental health benefit",
        "quotation": "Semaglutide use was linked to a 21% lower risk of psychiatric hospitalization in a large Swedish study of nearly 15,000 people with bipolar disorder, though other GLP-1 drugs showed no similar association.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260907201600.htm",
        "headline": "Dark energy debunked? Cosmic acceleration may be an illusion",
        "quotation": "Analysis of more than 1,700 supernovae questions whether the universe is really accelerating, with researchers finding signs that cosmic expansion may actually be slowing down.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260907201558.htm",
        "headline": "The American \"cheetah\" wasn't a cheetah at all",
        "quotation": "The extinct \"American cheetah\" was not really a cheetah but a puma relative with flexible lifestyle. Fossils from the Yukon suggest northern populations survived partly by eating fish.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260907201556.htm",
        "headline": "Astronomers detect ancient hydrogen signal that could help map the Universe",
        "quotation": "Astronomers detected an exceptionally faint hydrogen radio signal from billions of light-years away using South Africa's MeerKAT telescope, showing promise for creating larger 3D maps.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260907201554.htm",
        "headline": "Your personality may be more genetic than scientists realized",
        "quotation": "More than 1,200 genetic variants have been linked to the Big Five personality traits, with many also associated with health, longevity, careers, income, and everyday habits.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260907201552.htm",
        "headline": "Scientists observe Einstein's gravity in the quantum world for the first time",
        "quotation": "Physicists directly observed a long-predicted quantum effect of gravity using ultracold atoms, splitting an atom's quantum wave so one part was held while the other fell freely.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260906170149.htm",
        "headline": "Common dry-cleaning chemical linked to triple the risk of liver scarring",
        "quotation": "Tetrachloroethylene (PCE), commonly used in dry cleaning, was linked to three times higher likelihood of significant liver fibrosis, with risk climbing sharply as PCE levels increased.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260906170145.htm",
        "headline": "Doctors saved this rare monkey from amputation. Months later, she gave birth",
        "quotation": "A critically endangered roloway monkey gave birth months after surgeons performed an unusual operation that saved her foot from amputation, adding to a species numbering fewer than 2,000.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260906170142.htm",
        "headline": "Cancer cases could surge 67% worldwide by 2050",
        "quotation": "Cancer is becoming an even larger global health threat, with nearly 21 million people diagnosed in 2024. New estimates suggest cases could climb by 67% to 34 million by 2050.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260906170140.htm",
        "headline": "Scientists say love follows hidden mathematical rules",
        "quotation": "Researchers developed mathematical models treating romantic feelings as changing systems, revealing patterns in attraction, emotional reactions, conflict, and recovery between partners.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260906170138.htm",
        "headline": "A War of 1812 soldier buried his own arm. His real story is even stranger",
        "quotation": "A rediscovered memoir reveals War of 1812 veteran Shadrack Byfield was far more rebellious than history portrayed, battling chronic pain, poverty, authorities, and rivals at chapel.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260906170136.htm",
        "headline": "Scientists discover a hidden immune signal that helps spinal cords regrow",
        "quotation": "Researchers found that certain neutrophils release Il-4, which calms harmful inflammation and allows injured nerve fibers to grow again, potentially advancing spinal cord repair.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260906170134.htm",
        "headline": "Cialis linked to higher glaucoma risk in large study",
        "quotation": "A large study of nearly 74,000 men suggests long-term use of tadalafil (Cialis) may be linked to higher glaucoma risk, with men 22% more likely to develop the condition.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260906170132.htm",
        "headline": "Scientists find a way to slash computer memory energy use by orders of magnitude",
        "quotation": "Scientists devised a new way to switch magnetic computer memory using far less energy than today's technologies by mathematically optimizing the pulses used to flip digital bits.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260906170129.htm",
        "headline": "Your gut microbiome may be more contagious than scientists thought",
        "quotation": "Scientists found evidence that some gut bacterial populations can spread rapidly between people and across continents, suggesting microbiome transmissibility than previously thought.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260906170128.htm",
        "headline": "Antarctica gained a record 695 billion tons of ice. Scientists found the surprising reason",
        "quotation": "East Antarctica gained an astonishing 695 billion tons of ice between 2021 and 2023, as warming in the tropical ocean altered atmospheric circulation and funneled moisture.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260904000330.htm",
        "headline": "Popular brain supplement linked to shorter lifespan in men",
        "quotation": "A large study of more than 270,000 people linked higher blood levels of tyrosine to shorter lifespan in men, potentially reducing male life expectancy by nearly a year.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260904000328.htm",
        "headline": "A mysterious signal around Earth could be dark matter",
        "quotation": "Scientists used Earth's magnetic field and atmosphere as a planet-sized detector to search for lightweight dark matter forms, improving limits on ultralight axions.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260904000326.htm",
        "headline": "Scientists find breast cancer cells hiding behind protective \"shields\"",
        "quotation": "Researchers mapped breast tumors and uncovered hidden pockets of dormant cancer cells surrounded by immune cells and connective tissue that may act like protective shields.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260904000324.htm",
        "headline": "Scientists find a new weakness in treatment-resistant prostate cancer",
        "quotation": "Researchers found a potential way to attack prostate cancers that evade treatment by combining two types of drugs to reverse cellular identity changes and sharply slow tumor growth.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260904000320.htm",
        "headline": "A longer exhale may push your brain toward bolder decisions",
        "quotation": "Slow breathing with a prolonged exhale made people more willing to take risks by changing heart activity and increasing the brain's sensitivity to rewards.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260904000318.htm",
        "headline": "Indonesia's most dangerous fires are burning underground",
        "quotation": "Indonesia's dangerous peat fires are surging early in 2026 as strengthening El Niño and severe drought dry out wetlands that can burn underground for months, releasing fine particles.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260904000316.htm",
        "headline": "Giant Greenland iceberg slams into Joe Island and survives",
        "quotation": "A giant iceberg measuring more than 76 square kilometers broke from Greenland's Petermann Glacier in August 2026, marking the Arctic's largest glacier calving event since 2020.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260904000313.htm",
        "headline": "Dark matter detector finds a strange signal scientists can't yet explain",
        "quotation": "The LUX-ZEPLIN experiment detected a rare particle interaction that looks unusually difficult to explain as ordinary background noise and appeared where dark matter might exist.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260904000310.htm",
        "headline": "Life uses 4 DNA letters. Scientists just made 8 work",
        "quotation": "Researchers demonstrated that a key cellular enzyme can accurately read an eight-letter genetic alphabet, doubling the four letters used by all known life on Earth.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260904000308.htm",
        "headline": "Scientists reveal the hidden instructions that build the human brain",
        "quotation": "UCLA researchers discovered two powerful influences guiding human brain formation: how radial glia process glucose and physical contact with signals from the thalamus.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260903064251.htm",
        "headline": "Scientists discover a hidden problem with this popular sugar substitute",
        "quotation": "Sorbitol, a sugar alcohol in sugar-free candy and gum, may not be harmless as assumed. The body converts sorbitol into fructose in the liver, potentially triggering harmful effects.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260903064249.htm",
        "headline": "MIT scientists develop injectable \"mini livers\" that work inside the body",
        "quotation": "MIT engineers developed injectable \"mini livers\" to help support people whose failing livers can no longer perform essential functions by creating pockets of functioning tissue.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260903064246.htm",
        "headline": "This lifestyle program improved cognition 55% more than basic health advice",
        "quotation": "Older adults at risk of dementia improved their memory and thinking after following lifestyle programs combining exercise, healthy eating, cognitive training, and social engagement.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  },
  {
    "kind": "claimed",
    "sources": [
      {
        "url": "https://www.sciencedaily.com/releases/2026/09/260903064242.htm",
        "headline": "Scientists find a weak spot in one of the deadliest brain cancers",
        "quotation": "Researchers found a new way to weaken glioblastoma's defenses by blocking a protein called SET, restoring activity of an enzyme that tumors appear to suppress.",
        "outlet": "sciencedaily.com",
        "owner": "ScienceDaily"
      }
    ]
  }
];
