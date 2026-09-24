// @ts-check
// "Did you know?" chalk cards shown at the end of each unit in a guide
// (see personality.js). Keyed by guide slug; unit N shows fact (N-1) % length.
// Kept to well-established facts -- no statistics that go stale.

/** @type {Record<string, string[]>} */
export const FUN_FACTS = {
  "algebra1": [
    "The word \"algebra\" comes from the Arabic al-jabr, from a book by al-Khwarizmi written around 820 CE.",
    "The equals sign was invented in 1557 by Robert Recorde, who picked two parallel lines because \"no two things can be more equal.\"",
    "The letter x became the standard unknown after René Descartes used it in 1637.",
  ],
  "algebra2": [
    "Logarithms were published by John Napier in 1614 to make astronomers' multiplication faster.",
    "The number i (√−1) was once called \"imaginary\" as an insult by Descartes. It is now essential to electrical engineering.",
    "Compound interest led Jacob Bernoulli to discover the number e ≈ 2.718 in 1683.",
  ],
  "geometry": [
    "Euclid's Elements, written around 300 BCE, was used as a geometry textbook for over 2,000 years.",
    "The angles of a triangle add to 180° only on a flat surface; on a sphere they add to more.",
    "Honeybees build hexagonal cells because hexagons tile a plane using the least wall material.",
  ],
  "precalc": [
    "Radians make calculus formulas simpler: d/dx sin x = cos x only works when x is in radians.",
    "Euler's identity, e^(iπ) + 1 = 0, links five of the most important numbers in math.",
    "Polar coordinates were used by Isaac Newton to describe curves such as spirals.",
  ],
  "calculus": [
    "Newton and Leibniz invented calculus independently in the late 1600s, and argued for years over who was first.",
    "The dy/dx notation we use today is Leibniz's; Newton wrote a dot over the variable instead.",
    "Archimedes found the area of a parabolic segment around 250 BCE using an early version of limits.",
  ],
  "calc-ab": [
    "The Fundamental Theorem of Calculus shows that derivatives and integrals undo each other.",
    "The integral sign ∫ is a stretched-out S, for the Latin summa (sum).",
    "L'Hôpital's rule was actually worked out by Johann Bernoulli, who was paid by the Marquis de l'Hôpital.",
  ],
  "calc-bc": [
    "Taylor series let calculators compute sin, cos and eˣ using only addition and multiplication.",
    "The harmonic series 1 + 1/2 + 1/3 + … grows forever, but so slowly that it takes over 12,000 terms to pass 10.",
    "The series 1 − 1/3 + 1/5 − 1/7 + … adds up to π/4.",
  ],
  "statistics": [
    "The bell curve is also called the Gaussian curve, after Carl Friedrich Gauss.",
    "In a room of just 23 people, there's about a 50% chance two share a birthday.",
    "Florence Nightingale used statistical charts in the 1850s to convince the army to improve hospital sanitation.",
  ],
  "ap-stats": [
    "The t-distribution was published in 1908 by William Gosset under the pen name \"Student\" while he worked at the Guinness brewery.",
    "Correlation does not imply causation: ice cream sales and sunburns rise together because both follow hot weather.",
    "The term \"regression\" comes from Francis Galton's study of children's heights regressing toward the average.",
  ],
  "sat-math": [
    "The SAT's math section allows a calculator on every question.",
    "Plugging the answer choices back into the question is a legitimate and often fast strategy.",
    "Many SAT geometry formulas are printed on a reference sheet at the start of the section.",
  ],
  "act-prep": [
    "The ACT has no penalty for wrong answers, so never leave a question blank.",
    "The ACT was first given in 1959 as an alternative to the SAT.",
    "Pacing matters: skipping a hard question and returning later often saves points.",
  ],
  "physics": [
    "Light from the Sun takes about 8 minutes and 20 seconds to reach Earth.",
    "The kilogram was defined by a metal cylinder in France until 2019, when it was redefined using Planck's constant.",
    "Galileo showed that, without air resistance, a feather and a hammer fall at the same rate. Apollo 15 astronauts confirmed it on the Moon.",
  ],
  "ap-physics": [
    "Isaac Newton published his three laws of motion in the Principia in 1687.",
    "Astronauts on the ISS are weightless because they are constantly falling around Earth, not because gravity is gone.",
    "A spinning ice skater speeds up when pulling their arms in because angular momentum is conserved.",
  ],
  "chemistry": [
    "Dmitri Mendeleev left gaps in his 1869 periodic table and correctly predicted the elements that would fill them.",
    "Water expands when it freezes, which is why ice floats.",
    "A mole of anything contains about 6.022 × 10²³ particles, Avogadro's number.",
  ],
  "ap-chemistry": [
    "Catalysts speed up reactions without being used up; enzymes are the catalysts in your body.",
    "Gold is so unreactive that ancient gold artifacts are still shiny today.",
    "Le Chatelier's principle explains why removing a product pushes a reaction to make more of it.",
  ],
  "biology": [
    "Your body contains roughly 37 trillion cells.",
    "Mitochondria have their own DNA, a clue that they were once free-living bacteria.",
    "If you stretched out the DNA in one human cell, it would be about 2 meters long.",
  ],
  "ap-biology": [
    "Photosynthesis released the oxygen that makes up about 21% of Earth's atmosphere.",
    "The Krebs cycle is named after Hans Krebs, who won a Nobel Prize for it in 1953.",
    "Humans share about 99.9% of their DNA with each other.",
  ],
  "anatomy": [
    "The adult human body has 206 bones; babies are born with around 300 that later fuse.",
    "The smallest bone in the body, the stapes, is in your middle ear.",
    "Your heart beats roughly 100,000 times a day.",
  ],
  "earth-science": [
    "Earth is about 4.5 billion years old.",
    "The continents move about as fast as your fingernails grow.",
    "Mount Everest grows a few millimeters each year as the Indian plate pushes into Asia.",
  ],
  "environmental-science": [
    "The Amazon rainforest produces a large share of its own rainfall through transpiration.",
    "Wetlands act like sponges, soaking up floodwater and filtering pollutants.",
    "About 71% of Earth's surface is covered by water, but only a small fraction is fresh water.",
  ],
  "astronomy": [
    "A day on Venus is longer than its year.",
    "The Sun contains about 99.8% of the mass of the solar system.",
    "When you look at the Andromeda Galaxy, you see light that left it about 2.5 million years ago.",
  ],
  "computer-science": [
    "The first computer \"bug\" was a real moth found in the Harvard Mark II in 1947.",
    "Ada Lovelace wrote what is considered the first computer program in the 1840s.",
    "Binary uses only 0 and 1 because electronic circuits are easiest to build with two states: on and off.",
  ],
  "ap-csa": [
    "Java was released by Sun Microsystems in 1995.",
    "Array indexes start at 0 in Java because an index is an offset from the start of the array.",
    "Binary search can find an item among a million sorted items in about 20 steps.",
  ],
  "global-history": [
    "The Great Wall of China was built and rebuilt over many centuries by different dynasties.",
    "The printing press, developed by Gutenberg around 1440, helped spread the Protestant Reformation.",
    "The Silk Road carried ideas, religions and diseases as well as goods between Asia and Europe.",
  ],
  "ap-world": [
    "The Mongol Empire was the largest contiguous land empire in history.",
    "Paper was invented in China around the 2nd century CE.",
    "The Columbian Exchange brought potatoes to Europe and horses to the Americas.",
  ],
  "ap-euro": [
    "The Black Death killed roughly a third of Europe's population in the mid-1300s.",
    "The Peace of Westphalia in 1648 helped establish the idea of sovereign states.",
    "The Congress of Vienna redrew Europe's map after Napoleon's defeat in 1815.",
  ],
  "world-history": [
    "The Rosetta Stone let scholars decode Egyptian hieroglyphs because it repeats one text in three scripts.",
    "Ancient Rome's population may have passed one million people.",
    "The Magna Carta of 1215 limited the power of the English king.",
  ],
  "apush": [
    "The Declaration of Independence was adopted on July 4, 1776, but most delegates signed it on August 2.",
    "The Louisiana Purchase of 1803 roughly doubled the size of the United States.",
    "The Erie Canal, finished in 1825, connected the Great Lakes to New York City.",
  ],
  "us-history": [
    "The Lewis and Clark expedition set out in 1804 to explore the Louisiana Purchase.",
    "The transcontinental railroad was completed in 1869 at Promontory Summit, Utah.",
    "The 19th Amendment gave women the right to vote in 1920.",
  ],
  "us-government": [
    "The U.S. Constitution is the oldest written national constitution still in use.",
    "The first ten amendments, the Bill of Rights, were ratified in 1791.",
    "A presidential veto can be overridden by a two-thirds vote in both houses of Congress.",
  ],
  "ap-usgov": [
    "Marbury v. Madison (1803) established judicial review.",
    "The Federalist Papers were written by Hamilton, Madison and Jay to persuade New York to ratify the Constitution.",
    "Senators were chosen by state legislatures until the 17th Amendment in 1913.",
  ],
  "geography": [
    "Russia spans 11 time zones.",
    "The Nile and the Amazon are the two longest rivers in the world.",
    "Canada has the longest coastline of any country.",
  ],
  "ap-human-geography": [
    "More than half of the world's people now live in cities.",
    "The demographic transition model explains why birth and death rates fall as countries develop.",
    "Mandarin Chinese has the most native speakers of any language.",
  ],
  "art-history": [
    "The Mona Lisa is painted on a wooden poplar panel, not canvas.",
    "Michelangelo painted the Sistine Chapel ceiling between 1508 and 1512.",
    "Linear perspective was worked out by Renaissance artists such as Brunelleschi in the 1400s.",
  ],
  "english-9": [
    "Shakespeare is credited with the first recorded use of hundreds of English words, like \"lonely\" and \"swagger.\"",
    "The Odyssey was passed down orally for generations before it was written down.",
    "A sonnet has 14 lines.",
  ],
  "english-10": [
    "George Orwell's Animal Farm is an allegory of the Russian Revolution.",
    "The word \"pandemonium\" was coined by John Milton in Paradise Lost.",
    "Mary Shelley began writing Frankenstein when she was 18.",
  ],
  "ap-lang": [
    "Aristotle named the three rhetorical appeals: ethos, pathos and logos.",
    "Martin Luther King Jr.'s \"I Have a Dream\" speech uses anaphora, repeating the same phrase to open sentences.",
    "Good rhetorical analysis explains how a choice creates an effect, not just what the choice is.",
  ],
  "sat-reading": [
    "Every correct SAT reading answer can be supported with evidence from the passage.",
    "Reading the question before the passage helps you know what to look for.",
    "\"Most nearly means\" questions test meaning in context, not the dictionary's first definition.",
  ],
  "creative-writing": [
    "\"Show, don't tell\" means letting actions and details reveal feelings instead of naming them.",
    "Ernest Hemingway said he rewrote the ending of A Farewell to Arms 39 times.",
    "A haiku traditionally has three lines of 5, 7 and 5 syllables.",
  ],
  "journalism": [
    "The \"inverted pyramid\" puts the most important facts at the top of a news story.",
    "The five W's of reporting are who, what, when, where and why.",
    "The First Amendment protects freedom of the press in the United States.",
  ],
  "speech-debate": [
    "Lincoln's Gettysburg Address is only about 270 words long.",
    "In debate, refuting the opponent's strongest argument persuades more than attacking their weakest.",
    "Pausing on purpose makes a speaker sound more confident than filling silence with \"um.\"",
  ],
  "spanish-1": [
    "Spanish is the official language of 20 countries.",
    "The letter ñ developed from medieval scribes writing a small n over another n to save space.",
    "Spanish questions start with an upside-down ¿ so readers know a question is coming.",
  ],
  "spanish-2": [
    "Spanish has two verbs for \"to be\": ser for lasting traits and estar for states and locations.",
    "Many Spanish words come from Arabic, like almohada (pillow) and aceite (oil).",
    "The preterite and the imperfect both describe the past, but the imperfect sets the scene.",
  ],
  "spanish-3": [
    "The subjunctive mood expresses wishes, doubts and emotions.",
    "Don Quixote, published in 1605, is often called the first modern novel.",
    "Spanish is the second most spoken native language in the world.",
  ],
  "french-1": [
    "French is an official language on five continents.",
    "Roughly a third of English vocabulary comes from French.",
    "The cedilla in ç tells you to pronounce the c like an s.",
  ],
  "german-1": [
    "All German nouns are capitalized.",
    "German builds long compound words, like Handschuh (\"hand shoe\") for glove.",
    "German is the most widely spoken native language in the European Union.",
  ],
  "music-theory": [
    "An octave doubles a note's frequency: A4 is 440 Hz and A5 is 880 Hz.",
    "The major scale follows the pattern whole, whole, half, whole, whole, whole, half.",
    "Beethoven kept composing after losing his hearing, including his Ninth Symphony.",
  ],
  "economics": [
    "Adam Smith's The Wealth of Nations, published in 1776, is often called the start of modern economics.",
    "Opportunity cost is the value of the next-best option you give up.",
    "Inflation means each dollar buys a little less over time.",
  ],
  "ap-macro": [
    "GDP measures the total value of final goods and services produced in a country.",
    "The Federal Reserve was created in 1913.",
    "The multiplier effect means one dollar of new spending can raise GDP by more than a dollar.",
  ],
  "ap-micro": [
    "A price ceiling set below the market price causes a shortage.",
    "A Giffen good is a rare case where people buy more of something as its price rises.",
    "Firms maximize profit where marginal revenue equals marginal cost.",
  ],
  "psychology": [
    "Your brain uses about 20% of your body's energy while making up about 2% of its weight.",
    "Spacing out your study sessions helps you remember more than cramming.",
    "Testing yourself (retrieval practice) builds memory more than rereading.",
  ],
  "ap-psych": [
    "Ivan Pavlov discovered classical conditioning while studying digestion in dogs.",
    "The \"magical number seven\" describes how many items short-term memory can hold, give or take two.",
    "Neurons communicate across tiny gaps called synapses using chemicals called neurotransmitters.",
  ],
  "sociology": [
    "The term \"sociology\" was coined by Auguste Comte in the 1830s.",
    "Émile Durkheim showed that even suicide rates follow social patterns.",
    "Norms are unwritten rules that shape behavior without laws.",
  ],
  "health": [
    "Teenagers need about 8 to 10 hours of sleep a night.",
    "Washing your hands with soap for 20 seconds removes most germs.",
    "Regular exercise improves mood as well as fitness.",
  ],
  "study-skills": [
    "Explaining a topic out loud, as if teaching it, reveals gaps in what you know.",
    "Short, focused sessions with breaks beat long unfocused ones.",
    "Mixing different problem types while practicing (interleaving) improves test performance.",
  ],
};
