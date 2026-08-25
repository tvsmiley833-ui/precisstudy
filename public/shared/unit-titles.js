// @ts-check
/**
 * @typedef {Object} Unit
 * @property {number} id
 * @property {string} name
 */

/** @type {Unit[]} */
export const geometryUnits = [
  { id: 1, name: "Foundations: Points, Lines & Angles" },
  { id: 2, name: "Parallel Lines & Transversals" },
  { id: 3, name: "Triangles: Angles & Inequalities" },
  { id: 4, name: "Congruent Triangles & Proofs" },
  { id: 5, name: "Similarity & Proportions" },
  { id: 6, name: "Right Triangles & Trigonometry" },
  { id: 7, name: "Polygons & Quadrilaterals" },
  { id: 8, name: "Circles" },
  { id: 9, name: "Coordinate Geometry" },
  { id: 10, name: "Transformations & Constructions" },
  { id: 11, name: "3D Solids: Surface Area, Volume & Density" }
];

/** @type {Unit[]} */
export const algebra1Units = [
  { id: 1, name: "Solving Equations & Inequalities" },
  { id: 2, name: "Linear Functions & Graphing" },
  { id: 3, name: "Systems of Equations & Inequalities" },
  { id: 4, name: "Exponents & Polynomials" },
  { id: 5, name: "Factoring" },
  { id: 6, name: "Quadratic Equations & Functions" },
  { id: 7, name: "Radicals & Rational Exponents" },
  { id: 8, name: "Exponential Functions & Sequences" },
  { id: 9, name: "Statistics: Data & Distributions" },
  { id: 10, name: "Statistics: Regression & Correlation" },
  { id: 11, name: "Functions: Notation, Domain/Range & Transformations" }
];

/** @type {Unit[]} */
export const algebra2Units = [
  { id: 1, name: "Polynomial Functions & Operations" },
  { id: 2, name: "Rational Expressions & Equations" },
  { id: 3, name: "Radicals & Rational Exponents" },
  { id: 4, name: "Exponential & Logarithmic Functions" },
  { id: 5, name: "Sequences & Series" },
  { id: 6, name: "Trigonometric Functions & the Unit Circle" },
  { id: 7, name: "Trigonometric Graphs & Identities" },
  { id: 8, name: "Complex Numbers & Quadratics Revisited" },
  { id: 9, name: "Function Operations, Inverses & Transformations" },
  { id: 10, name: "Statistics: Sampling & Inference" },
  { id: 11, name: "Probability" }
];

/** @type {Unit[]} */
export const aplangUnits = [
  { id: 1, name: "The Rhetorical Situation" },
  { id: 2, name: "Rhetorical Appeals & Logical Fallacies" },
  { id: 3, name: "Rhetorical Devices & Figurative Language" },
  { id: 4, name: "Style: Diction, Syntax & Tone" },
  { id: 5, name: "Claims, Evidence & Commentary" },
  { id: 6, name: "Organization, Structure & Counterargument" },
  { id: 7, name: "The Synthesis Essay" }
];

/** @type {Unit[]} */
export const usGovernmentUnits = [
  { id: 1, name: "Foundations of American Democracy" },
  { id: 2, name: "The Constitution: Principles & Structure" },
  { id: 3, name: "Congress" },
  { id: 4, name: "The Presidency" },
  { id: 5, name: "The Judiciary" },
  { id: 6, name: "Civil Liberties & Civil Rights" },
  { id: 7, name: "Political Participation: Elections & Media" },
  { id: 8, name: "The Bureaucracy & Policy Making" }
];

/** @type {Record<string, Unit[]>} */
export const allSubjectUnits = {
  geometry: geometryUnits,
  algebra1: algebra1Units,
  algebra2: algebra2Units,
  "ap-lang": aplangUnits,
  "us-government": usGovernmentUnits
};
