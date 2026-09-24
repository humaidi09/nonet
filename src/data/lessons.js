// Learning Centre content. Each lesson pairs a short, accurate explanation with a
// small practice: an interactive single-technique board, a pencil-marks drill, or
// a read-through of a pattern. The copy is deliberately concise — enough to solve
// with, not a textbook. `practice` tells the Learn pages which drill to render.

export const LESSONS = [
  {
    id: 'scanning',
    title: 'Scanning',
    level: 'Beginner',
    minutes: 3,
    summary: 'Place a digit by ruling out rows, columns, and boxes — the first skill.',
    practice: 'single',
    body: [
      {
        h: 'Cross-hatch a box',
        p: 'Pick a digit and one 3x3 box. Any row or column that already contains that digit is closed to it, so mentally strike those lines through the box. If a single empty cell is left untouched, the digit must go there.',
      },
      {
        h: 'Sweep every box',
        p: 'Work one digit at a time across all nine boxes. Digits that already appear several times are the easiest to place, because more rows and columns are blocked and fewer cells survive.',
      },
      {
        h: 'Why it works',
        p: 'Each row, column, and box holds every digit exactly once. Scanning simply removes every square a digit is forbidden from until one lawful home remains.',
      },
    ],
  },
  {
    id: 'naked-single',
    title: 'Naked Single',
    level: 'Beginner',
    minutes: 3,
    summary: 'A cell where only a single digit can legally fit.',
    practice: 'single',
    body: [
      {
        h: 'One cell, one option',
        p: 'A naked single is an empty cell whose row, column, and box already show eight different digits between them. Only the ninth digit is left, so it is forced into that cell.',
      },
      {
        h: 'How to spot it',
        p: 'Choose a nearly full region and look at an empty cell inside it. List the digits visible in its row, column, and box. When that list reaches eight, the missing digit is your answer.',
      },
      {
        h: 'Place and repeat',
        p: 'Writing a naked single often creates more of them, because the digit you placed is now banned from its peers. Keep filling the easy cells before reaching for harder methods.',
      },
    ],
  },
  {
    id: 'hidden-single',
    title: 'Hidden Single',
    level: 'Beginner',
    minutes: 4,
    summary: 'A digit that has only one legal home in a row, column, or box.',
    practice: 'single',
    body: [
      {
        h: 'Hidden in plain sight',
        p: 'A hidden single is a digit that can go in just one cell of a unit, even when that cell still has other candidates. The cell is not down to one option — the digit is down to one place.',
      },
      {
        h: 'Search a unit at a time',
        p: 'Take one row, column, or box and one digit. Rule out every cell where that digit is blocked by a peer. If exactly one cell remains, the digit belongs there.',
      },
      {
        h: 'Naked versus hidden',
        p: 'A naked single is about the cell: only one digit fits it. A hidden single is about the digit: only one cell fits it. Together they solve most gentle puzzles.',
      },
      {
        h: 'The common miss',
        p: 'Hidden singles hide behind busy pencil marks, so they are easy to skip over. Scanning digit by digit within a unit brings them into view.',
      },
    ],
  },
  {
    id: 'notes',
    title: 'Pencil Marks',
    level: 'Beginner',
    minutes: 3,
    summary: 'Track candidates with pencil marks so patterns become visible.',
    practice: 'notes',
    body: [
      {
        h: 'What pencil marks are',
        p: 'Pencil marks, or candidates, are the tiny digits you jot in a cell to remember which numbers could still go there. They turn a tiring mental search into simple reading.',
      },
      {
        h: 'Keep them honest',
        p: 'Only mark a digit when it is truly legal — not already present in the cell row, column, or box. Each time you place a number, rub it out of the pencil marks of every peer.',
      },
      {
        h: 'Read the marks',
        p: 'With candidates in place the techniques become visual. A cell showing a single mark is a naked single; a digit that appears only once among a unit marks is a hidden single.',
      },
    ],
  },
  {
    id: 'pointing-pairs',
    title: 'Pointing Pairs',
    level: 'Intermediate',
    minutes: 5,
    summary: 'Candidates locked to one line inside a box clear that line elsewhere.',
    practice: 'read',
    body: [
      {
        h: 'Candidates that point',
        p: 'If, inside a single box, a digit can only go in cells that share one row or one column, then that digit is committed to that line within the box.',
      },
      {
        h: 'Make the elimination',
        p: 'Because the digit must land on that line inside this box, it cannot appear on the same line in the two neighbouring boxes. Erase the digit from those cells.',
      },
      {
        h: 'Where to look',
        p: 'Scan each box for a digit with only two or three candidates. When they line up in a single row or column, you have a pointing pair or triple and can clear that line beyond the box.',
      },
    ],
  },
  {
    id: 'box-line-reduction',
    title: 'Box/Line Reduction',
    level: 'Intermediate',
    minutes: 5,
    summary: 'A digit confined to one box within a line clears the rest of that box.',
    practice: 'read',
    body: [
      {
        h: 'The mirror of pointing',
        p: 'Box and line reduction runs the opposite way. If the only cells where a digit can go in a row or column all fall inside a single box, the digit must sit on that line within that box.',
      },
      {
        h: 'Make the elimination',
        p: 'Since the digit is now tied to that line inside the box, it cannot occupy any other cell in the box. Remove the candidate from the box other rows and columns.',
      },
      {
        h: 'Pointing versus reduction',
        p: 'A pointing pair uses a box to clear a line; box and line reduction uses a line to clear a box. Knowing both settles most intermediate grids.',
      },
    ],
  },
  {
    id: 'x-wing',
    title: 'X-Wing',
    level: 'Advanced',
    minutes: 6,
    summary: 'A four-corner rectangle across two lines that removes a candidate.',
    practice: 'read',
    body: [
      {
        h: 'The pattern',
        p: 'Find a digit that is a candidate in exactly two cells of one row, and in exactly two cells of another row, with both pairs lying in the same two columns. Those four cells mark the corners of a rectangle.',
      },
      {
        h: 'Why it eliminates',
        p: 'The digit must take opposite corners of the rectangle, one in each row. Whichever diagonal it chooses, both columns end up used. So the digit can be removed from every other cell in those two columns.',
      },
      {
        h: 'Rows or columns',
        p: 'The X-Wing works just as well with the roles swapped: two columns whose candidate is pinned to the same two rows let you clear the digit from those rows.',
      },
      {
        h: 'How to spot it',
        p: 'Turn on pencil marks and hunt for a digit with only two candidates in a line. Note its two columns, then look for a second line that pins the same digit to the very same columns.',
      },
    ],
  },
]

export const lessonById = (id) => LESSONS.find((l) => l.id === id)
