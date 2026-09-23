/**
 * MIND HACK – Master Question Database (Exact 50 Questions)
 * Curated for 50-Question Round 1 Brain Challenge
 * Structured into:
 *   - 🟢 Easy: Questions 1 to 15
 *   - 🟡 Medium: Questions 16 to 35
 *   - 🔴 Hard: Questions 36 to 50
 *
 * Each question has verified single correct answers with step-by-step logic explanations.
 */

const MIND_HACK_QUESTIONS = [
  // ==========================================
  // 🟢 EASY LEVEL (Questions 1 to 15)
  // ==========================================
  {
    id: 1,
    category: "Number & Pattern",
    categoryIcon: "fa-arrow-up-9-1",
    difficulty: "Easy",
    question: "Number Pattern:\nFind the next number in the sequence:\n\n2, 4, 8, 16, ?",
    options: ["24", "30", "32", "36"],
    correctIndex: 2,
    explanation: "Each number is multiplied by 2 (doubled): 2 × 2 = 4, 4 × 2 = 8, 8 × 2 = 16, 16 × 2 = 32."
  },
  {
    id: 2,
    category: "Number & Pattern",
    categoryIcon: "fa-arrow-up-9-1",
    difficulty: "Easy",
    question: "Number Pattern:\nFind the missing number:\n\n3, 6, 11, 18, 27, ?",
    options: ["36", "38", "40", "42"],
    correctIndex: 1,
    explanation: "The differences between consecutive numbers increase by 2: +3, +5, +7, +9, +11. Therefore, 27 + 11 = 38."
  },
  {
    id: 3,
    category: "Observation",
    categoryIcon: "fa-eye",
    difficulty: "Easy",
    question: "Odd One Out:\nWhich number is different from the rest?\n\n9, 16, 25, 36, 45, 64",
    options: ["16", "25", "45", "64"],
    correctIndex: 2,
    explanation: "All numbers except 45 are perfect squares: 9 (3²), 16 (4²), 25 (5²), 36 (6²), 64 (8²). 45 is not a perfect square."
  },
  {
    id: 4,
    category: "Hidden Message",
    categoryIcon: "fa-key",
    difficulty: "Easy",
    question: "Coding Pattern:\nIf CAT is coded as DBU, then DOG = ?",
    options: ["EPH", "EOG", "FPH", "DPH"],
    correctIndex: 0,
    explanation: "Each letter is shifted forward by 1: D (+1) → E, O (+1) → P, G (+1) → H. Hence, DOG = EPH."
  },
  {
    id: 5,
    category: "Hidden Message",
    categoryIcon: "fa-key",
    difficulty: "Easy",
    question: "Letter Pattern:\nWhat letter comes next in the sequence?\n\nA, C, E, G, ?",
    options: ["H", "I", "J", "K"],
    correctIndex: 1,
    explanation: "Every second letter in the alphabet (+2 step): A (+2) → C (+2) → E (+2) → G (+2) → I."
  },
  {
    id: 6,
    category: "Number & Pattern",
    categoryIcon: "fa-arrow-up-9-1",
    difficulty: "Easy",
    question: "Number Pattern:\nFind the next number:\n\n5, 10, 15, 20, ?",
    options: ["22", "24", "25", "30"],
    correctIndex: 2,
    explanation: "Arithmetic progression with a common difference of +5: 20 + 5 = 25."
  },
  {
    id: 7,
    category: "Logic Puzzles",
    categoryIcon: "fa-brain",
    difficulty: "Easy",
    question: "Simple Deductive Logic:\nIf all ROSES are FLOWERS and some FLOWERS are RED, which statement is definitely true?",
    options: ["All roses are red", "Some roses are red", "Roses are flowers", "No roses are red"],
    correctIndex: 2,
    explanation: "The direct premise states 'All roses are flowers', therefore 'Roses are flowers' is definitely true."
  },
  {
    id: 8,
    category: "Logic Puzzles",
    categoryIcon: "fa-clock",
    difficulty: "Easy",
    question: "Clock & Time:\nHow many minutes are there in 3 hours?",
    options: ["120", "150", "180", "200"],
    correctIndex: 2,
    explanation: "1 hour = 60 minutes. Therefore, 3 hours = 3 × 60 = 180 minutes."
  },
  {
    id: 9,
    category: "Logic Puzzles",
    categoryIcon: "fa-compass",
    difficulty: "Easy",
    question: "Direction Sense:\nYou walk 5 m north, then 5 m east. In which direction are you from your starting point?",
    options: ["North", "East", "North-East", "South-East"],
    correctIndex: 2,
    explanation: "Moving North (+y) and East (+x) places you in the North-East quadrant relative to the origin."
  },
  {
    id: 10,
    category: "Observation",
    categoryIcon: "fa-eye",
    difficulty: "Easy",
    question: "Odd One Out:\nWhich item does NOT belong in this group?",
    options: ["Apple", "Mango", "Carrot", "Banana"],
    correctIndex: 2,
    explanation: "Carrot is a root vegetable, whereas Apple, Mango, and Banana are fruits."
  },
  {
    id: 11,
    category: "Number & Pattern",
    categoryIcon: "fa-arrow-up-9-1",
    difficulty: "Easy",
    question: "Missing Number:\nFind the next term:\n\n10, 20, 40, 80, ?",
    options: ["100", "120", "140", "160"],
    correctIndex: 3,
    explanation: "Each term is multiplied by 2: 80 × 2 = 160."
  },
  {
    id: 12,
    category: "Hidden Message",
    categoryIcon: "fa-key",
    difficulty: "Easy",
    question: "Alphabet Coding:\nIf A = 1, B = 2, C = 3, ... what is the numerical sum for CAT?",
    options: ["21", "22", "24", "26"],
    correctIndex: 2,
    explanation: "Summing positional values: C (3) + A (1) + T (20) = 24."
  },
  {
    id: 13,
    category: "Logic Puzzles",
    categoryIcon: "fa-brain",
    difficulty: "Easy",
    question: "Simple Arrangement:\nA is taller than B. B is taller than C.\nWho is the shortest among them?",
    options: ["A", "B", "C", "Cannot determine"],
    correctIndex: 2,
    explanation: "Height ranking: A > B > C. Therefore, C is the shortest."
  },
  {
    id: 14,
    category: "Digital Logic",
    categoryIcon: "fa-microchip",
    difficulty: "Easy",
    question: "Basic Binary:\nWhat is the decimal equivalent of binary 101₂?",
    options: ["4", "5", "6", "7"],
    correctIndex: 1,
    explanation: "101₂ = (1 × 2²) + (0 × 2¹) + (1 × 2⁰) = 4 + 0 + 1 = 5."
  },
  {
    id: 15,
    category: "Number & Pattern",
    categoryIcon: "fa-arrow-up-9-1",
    difficulty: "Easy",
    question: "Number Pattern:\nFind the next number in this sequence:\n\n1, 4, 9, 16, ?",
    options: ["20", "24", "25", "30"],
    correctIndex: 2,
    explanation: "Sequence of consecutive squares: 1² = 1, 2² = 4, 3² = 9, 4² = 16, 5² = 25."
  },

  // ==========================================
  // 🟡 MEDIUM LEVEL (Questions 16 to 35)
  // ==========================================
  {
    id: 16,
    category: "Number & Pattern",
    categoryIcon: "fa-arrow-up-9-1",
    difficulty: "Medium",
    question: "Number Pattern:\nFind the next number:\n\n2, 6, 12, 20, 30, ?",
    options: ["40", "42", "44", "46"],
    correctIndex: 1,
    explanation: "The increments are +4, +6, +8, +10, +12. 30 + 12 = 42. (Or n(n+1): 6 × 7 = 42)."
  },
  {
    id: 17,
    category: "Number & Pattern",
    categoryIcon: "fa-arrow-up-9-1",
    difficulty: "Medium",
    question: "Number Pattern:\nFind the missing number:\n\n3, 8, 15, 24, 35, ?",
    options: ["46", "48", "50", "52"],
    correctIndex: 1,
    explanation: "The increments are +5, +7, +9, +11, +13. 35 + 13 = 48. (Or n² - 1: 7² - 1 = 48)."
  },
  {
    id: 18,
    category: "Number & Pattern",
    categoryIcon: "fa-arrow-up-9-1",
    difficulty: "Medium",
    question: "Number Pattern:\nFind the next number:\n\n1, 2, 6, 24, 120, ?",
    options: ["240", "360", "600", "720"],
    correctIndex: 3,
    explanation: "Factorial series / consecutive multipliers: ×2, ×3, ×4, ×5, ×6. 120 × 6 = 720."
  },
  {
    id: 19,
    category: "Hidden Message",
    categoryIcon: "fa-key",
    difficulty: "Medium",
    question: "Letter Pattern:\nFind the next pair in the series:\n\nAZ, BY, CX, DW, ?",
    options: ["EV", "EU", "FV", "EX"],
    correctIndex: 0,
    explanation: "First letter advances (+1: A, B, C, D, E), second letter reverses (-1: Z, Y, X, W, V). Next pair is EV."
  },
  {
    id: 20,
    category: "Hidden Message",
    categoryIcon: "fa-key",
    difficulty: "Medium",
    question: "Coding Logic:\nIf APPLE → BQQMF, then MANGO → ?",
    options: ["NBOHP", "NBNHP", "MBOHP", "NBPHP"],
    correctIndex: 0,
    explanation: "Each letter is incremented by 1: M→N, A→B, N→O, G→H, O→P = NBOHP."
  },
  {
    id: 21,
    category: "Number & Pattern",
    categoryIcon: "fa-table-cells",
    difficulty: "Medium",
    question: "Matrix Missing Number:\nFind the missing value (?):\n\nRow 1:  2   3   8\nRow 2:  3   4   15\nRow 3:  4   5   ?",
    options: ["20", "22", "24", "25"],
    correctIndex: 2,
    explanation: "Rule: (first × second) + first. (2 × 3) + 2 = 8; (3 × 4) + 3 = 15; (4 × 5) + 4 = 24."
  },
  {
    id: 22,
    category: "Logic Puzzles",
    categoryIcon: "fa-user-group",
    difficulty: "Medium",
    question: "Age Problem:\nA father is 3 times as old as his son. Their total combined age is 48. How old is the son?",
    options: ["10", "12", "14", "16"],
    correctIndex: 1,
    explanation: "Let son's age = s. Father's age = 3s. s + 3s = 48 → 4s = 48 → s = 12 years."
  },
  {
    id: 23,
    category: "Logic Puzzles",
    categoryIcon: "fa-compass",
    difficulty: "Medium",
    question: "Direction Sense:\nA person walks 10 m north, turns right and walks 10 m, then turns right and walks 10 m.\nWhere is the person relative to the starting point?",
    options: ["10 m East", "10 m West", "10 m North", "At the starting point"],
    correctIndex: 0,
    explanation: "From (0,0): North to (0,10) → East to (10,10) → South 10m to (10,0). The final point is exactly 10 m East of start."
  },
  {
    id: 24,
    category: "Logic Puzzles",
    categoryIcon: "fa-chair",
    difficulty: "Medium",
    question: "Seating Arrangement:\nA, B, C, and D sit in a row.\nA is to the left of B. C is to the right of B. D is at the extreme right.\nWho is in the second position from the left?",
    options: ["A", "B", "C", "D"],
    correctIndex: 1,
    explanation: "The left-to-right order is A, B, C, D. The person in the second position is B."
  },
  {
    id: 25,
    category: "Logic Puzzles",
    categoryIcon: "fa-clock",
    difficulty: "Medium",
    question: "Clock Angle:\nWhat is the exact angle between the hands of a clock at 3:00?",
    options: ["30°", "60°", "90°", "120°"],
    correctIndex: 2,
    explanation: "At 3:00, the minute hand points to 12 and the hour hand points to 3. Each hour mark is 30°: 3 × 30° = 90°."
  },
  {
    id: 26,
    category: "Number & Pattern",
    categoryIcon: "fa-arrow-up-9-1",
    difficulty: "Medium",
    question: "Missing Number:\nFind the next number in the progression:\n\n4, 9, 19, 39, ?",
    options: ["69", "79", "89", "99"],
    correctIndex: 1,
    explanation: "Rule: Multiply by 2 and add 1. 4×2+1=9, 9×2+1=19, 19×2+1=39, 39×2+1 = 79."
  },
  {
    id: 27,
    category: "Logic Puzzles",
    categoryIcon: "fa-calendar-days",
    difficulty: "Medium",
    question: "Logical Ordering:\nWhich day comes next in the sequence?\n\nMonday, Wednesday, Friday, ?",
    options: ["Saturday", "Sunday", "Monday", "Tuesday"],
    correctIndex: 1,
    explanation: "Skip one day (+2 days): Monday (+2) → Wednesday (+2) → Friday (+2) → Sunday."
  },
  {
    id: 28,
    category: "Digital Logic",
    categoryIcon: "fa-microchip",
    difficulty: "Medium",
    question: "Binary Conversion:\nWhat is the decimal value of binary 1101₂?",
    options: ["11", "12", "13", "14"],
    correctIndex: 2,
    explanation: "1101₂ = (1 × 2³) + (1 × 2²) + (0 × 2¹) + (1 × 2⁰) = 8 + 4 + 0 + 1 = 13."
  },
  {
    id: 29,
    category: "Digital Logic",
    categoryIcon: "fa-bolt",
    difficulty: "Medium",
    question: "Pattern Inference:\nIf 5 → 25, 6 → 36, and 7 → 49, what is 12 → ?",
    options: ["124", "144", "156", "169"],
    correctIndex: 1,
    explanation: "Function is f(n) = n². 12² = 144."
  },
  {
    id: 30,
    category: "Observation",
    categoryIcon: "fa-eye",
    difficulty: "Medium",
    question: "Odd One Out:\nWhich number does NOT belong?\n\n8, 27, 64, 81, 125",
    options: ["27", "64", "81", "125"],
    correctIndex: 2,
    explanation: "8 (2³), 27 (3³), 64 (4³), and 125 (5³) are all perfect cubes. 81 is not a perfect cube (it is 3⁴ or 9²)."
  },
  {
    id: 31,
    category: "Brain Teasers",
    categoryIcon: "fa-lightbulb",
    difficulty: "Medium",
    question: "Switch Logic Riddle:\nThere are 3 switches outside a closed room and 3 incandescent bulbs inside. You can enter the room only once. How can you uniquely identify which switch controls which bulb?",
    options: ["Turn all switches ON", "Use heat from a bulb", "Guess based on position", "It is impossible"],
    correctIndex: 1,
    explanation: "Turn switch 1 ON for several minutes, then turn it OFF. Turn switch 2 ON and enter immediately. The bulb that is lit = Switch 2; the bulb that is OFF but warm = Switch 1; the bulb that is OFF and cold = Switch 3."
  },
  {
    id: 32,
    category: "Brain Teasers",
    categoryIcon: "fa-puzzle-piece",
    difficulty: "Medium",
    question: "Number Puzzle:\nA secret number is doubled and then 6 is added. The result is 26. What was the original number?",
    options: ["8", "10", "12", "14"],
    correctIndex: 1,
    explanation: "2x + 6 = 26 → 2x = 20 → x = 10."
  },
  {
    id: 33,
    category: "Number & Pattern",
    categoryIcon: "fa-arrow-up-9-1",
    difficulty: "Medium",
    question: "Pattern Progression:\nFind the next number:\n\n11, 22, 44, 88, ?",
    options: ["144", "166", "176", "180"],
    correctIndex: 2,
    explanation: "Each number is multiplied by 2: 88 × 2 = 176."
  },
  {
    id: 34,
    category: "Brain Teasers",
    categoryIcon: "fa-computer",
    difficulty: "Medium",
    question: "Hardware Analogy:\nKeyboard : Typing :: Mouse : ?",
    options: ["Printing", "Clicking", "Display", "Storing"],
    correctIndex: 1,
    explanation: "A keyboard is used for typing; a mouse is used for clicking / pointing."
  },
  {
    id: 35,
    category: "Logic Puzzles",
    categoryIcon: "fa-gears",
    difficulty: "Medium",
    question: "Rate & Work Logic:\nIf 5 machines take 5 minutes to make 5 products, how long would 100 machines take to make 100 products?",
    options: ["5 minutes", "20 minutes", "50 minutes", "100 minutes"],
    correctIndex: 0,
    explanation: "Each machine takes 5 minutes to make 1 product. Working in parallel, 100 machines will produce 100 products in exactly 5 minutes."
  },

  // ==========================================
  // 🔴 HARD LEVEL (Questions 36 to 50)
  // ==========================================
  {
    id: 36,
    category: "Brain Teasers",
    categoryIcon: "fa-brain",
    difficulty: "Hard",
    question: "Look-and-Say Sequence:\nWhat is the next term in this sequence?\n\n1, 11, 21, 1211, 111221, ?",
    options: ["312211", "212211", "311221", "321121"],
    correctIndex: 0,
    explanation: "Read off digits of previous term: 111221 has 'three 1s (31), two 2s (22), one 1 (11)' → 312211."
  },
  {
    id: 37,
    category: "Number & Pattern",
    categoryIcon: "fa-arrow-up-9-1",
    difficulty: "Hard",
    question: "Number Pattern:\nFind the next number:\n\n2, 3, 5, 9, 17, ?",
    options: ["25", "31", "33", "35"],
    correctIndex: 2,
    explanation: "Rule: Multiply by 2 and subtract 1 (or add powers of 2: +1, +2, +4, +8, +16). 17 + 16 = 33."
  },
  {
    id: 38,
    category: "Brain Teasers",
    categoryIcon: "fa-puzzle-piece",
    difficulty: "Hard",
    question: "Cryptic Number Equation:\nIf:\n1 + 3 = 4\n2 + 4 = 10\n3 + 5 = 18\nThen what is:\n4 + 6 = ?",
    options: ["24", "26", "28", "30"],
    correctIndex: 2,
    explanation: "Rule: a + (a × b). 1 + (1 × 3) = 4; 2 + (2 × 4) = 10; 3 + (3 × 5) = 18; 4 + (4 × 6) = 28."
  },
  {
    id: 39,
    category: "Logic Puzzles",
    categoryIcon: "fa-door-open",
    difficulty: "Hard",
    question: "The Two Doors Paradox:\nOne guard always lies and one guard always tells the truth. One door leads to safety and the other to danger.\nWhat single question should you ask either guard to determine the safe door?",
    options: [
      "Which door is safe?",
      "Are you truthful?",
      "Which door would the other guard say is safe?",
      "Which guard is lying?"
    ],
    correctIndex: 2,
    explanation: "Both guards will point to the dangerous door. Therefore, you simply choose the opposite door to reach safety."
  },
  {
    id: 40,
    category: "Brain Teasers",
    categoryIcon: "fa-scale-balanced",
    difficulty: "Hard",
    question: "8-Ball Balance Weighing:\nThere are 8 identical-looking balls. Exactly one is heavier. You have a balance scale and only 2 weighings allowed.\nWhat is the maximum number of balls you must place on EACH side in the first weighing?",
    options: ["1", "2", "3", "4"],
    correctIndex: 2,
    explanation: "Weigh 3 vs 3 (leaving 2 aside). If balanced, weigh the remaining 2 against each other. If unbalanced, weigh 1 vs 1 from the heavier group of 3."
  },
  {
    id: 41,
    category: "Number & Pattern",
    categoryIcon: "fa-arrow-up-9-1",
    difficulty: "Hard",
    question: "Number Pattern:\nFind the next term in the geometric sequence:\n\n6, 12, 24, 48, 96, ?",
    options: ["144", "168", "192", "196"],
    correctIndex: 2,
    explanation: "Each term is doubled (×2): 96 × 2 = 192."
  },
  {
    id: 42,
    category: "Number & Pattern",
    categoryIcon: "fa-table-cells",
    difficulty: "Hard",
    question: "Matrix Puzzle:\nFind the missing value (?):\n\nRow 1:  2   4   16\nRow 2:  3   5   30\nRow 3:  4   6   ?",
    options: ["40", "48", "52", "60"],
    correctIndex: 1,
    explanation: "Rule: first × second × 2. (2 × 4 × 2 = 16); (3 × 5 × 2 = 30); (4 × 6 × 2 = 48)."
  },
  {
    id: 43,
    category: "Logic Puzzles",
    categoryIcon: "fa-user-clock",
    difficulty: "Hard",
    question: "Age Puzzle:\nFive years ago, A was twice as old as B. Five years from now, A will be 1.5 times as old as B.\nWhat is A's current age?",
    options: ["15", "20", "25", "30"],
    correctIndex: 2,
    explanation: "Let current ages be A and B. (A - 5) = 2(B - 5) → A = 2B - 5. (A + 5) = 1.5(B + 5) → 2B = 1.5B + 7.5 → 0.5B = 7.5 → B = 15. Thus, A = 2(15) - 5 = 25 years."
  },
  {
    id: 44,
    category: "Brain Teasers",
    categoryIcon: "fa-dice",
    difficulty: "Hard",
    question: "Probability & Pigeonhole Principle:\nA bag contains 3 red balls and 2 blue balls. In total darkness, what is the MINIMUM number of balls you must draw to guarantee having at least two balls of the same color?",
    options: ["2", "3", "4", "5"],
    correctIndex: 1,
    explanation: "Since there are only 2 distinct colors, by the Pigeonhole Principle, drawing 2 + 1 = 3 balls guarantees at least one matching color pair."
  },
  {
    id: 45,
    category: "Digital Logic",
    categoryIcon: "fa-microchip",
    difficulty: "Hard",
    question: "Boolean Algebra:\nGiven Boolean values A = 1 and B = 0, evaluate the Boolean expression:\n\n(A AND B) OR A",
    options: ["0", "1", "2", "Cannot determine"],
    correctIndex: 1,
    explanation: "(1 AND 0) = 0. Then (0 OR 1) = 1."
  },
  {
    id: 46,
    category: "Digital Logic",
    categoryIcon: "fa-network-wired",
    difficulty: "Hard",
    question: "Binary Challenge:\nWhat is the decimal equivalent of binary 101101₂?",
    options: ["43", "44", "45", "46"],
    correctIndex: 2,
    explanation: "101101₂ = 32 + 0 + 8 + 4 + 0 + 1 = 45."
  },
  {
    id: 47,
    category: "Digital Logic",
    categoryIcon: "fa-code",
    difficulty: "Hard",
    question: "Algorithm Execution:\nStart with the number 5.\nExecute sequentially:  +2  →  ×3  →  −4  →  ÷2\nWhat is the final result?",
    options: ["7", "8.5", "9", "10"],
    correctIndex: 1,
    explanation: "5 + 2 = 7;  7 × 3 = 21;  21 − 4 = 17;  17 ÷ 2 = 8.5."
  },
  {
    id: 48,
    category: "Observation",
    categoryIcon: "fa-calendar",
    difficulty: "Hard",
    question: "Hidden Sequence:\nWhat letter comes next in this sequence?\n\nJ, F, M, A, M, J, J, A, ?",
    options: ["S", "O", "N", "D"],
    correctIndex: 0,
    explanation: "Initial letters of the months in calendar order: January, February, March, April, May, June, July, August, September (S)."
  },
  {
    id: 49,
    category: "Brain Teasers",
    categoryIcon: "fa-otter",
    difficulty: "Hard",
    question: "Observation Trap:\nA farmer has 17 sheep. All but 9 run away.\nHow many sheep remain?",
    options: ["8", "9", "17", "0"],
    correctIndex: 1,
    explanation: "'All but 9 run away' means exactly 9 sheep remained."
  },
  {
    id: 50,
    category: "Brain Teasers",
    categoryIcon: "fa-trophy",
    difficulty: "Hard",
    question: "🏆 FINAL BOSS – The Mystery Number:\nA number satisfies all four conditions:\n1. Greater than 20 and less than 50\n2. Divisible by both 3 and 4\n3. The sum of its digits equals 9\n\nWhat is the number?",
    options: ["24", "30", "36", "48"],
    correctIndex: 2,
    explanation: "Multiples of 12 between 20 and 50 are 24, 36, and 48. Check digit sums: 2+4=6, 3+6=9, 4+8=12. The unique number is 36."
  }
];

// Ensure availability in both browser (window) and Node.js (module.exports) environments
if (typeof window !== 'undefined') {
  window.MIND_HACK_QUESTIONS = MIND_HACK_QUESTIONS;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MIND_HACK_QUESTIONS;
}
