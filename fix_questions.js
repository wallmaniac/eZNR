const fs = require('fs');
const data = JSON.parse(fs.readFileSync('extracted_tests.json', 'utf8'));

// Manually fix ZNR Question 16
data.znr.forEach(q => {
  if (q.id === 16 && q.options.length > 3) {
    q.options = q.options.slice(0, 3);
  }
});

// Remove trailing non-questions
data.zop = data.zop.filter(q => q.id <= 25);
data.znr = data.znr.filter(q => q.id <= 20); // The ZNR test has 20 theory questions, actually the original has 21 theory questions? Let's keep up to the actual end.

fs.writeFileSync('src/app/dashboard/tests-zop-znr/defaultQuestions.js', 
  'export const zopQuestions = ' + JSON.stringify(data.zop, null, 2) + ';\n\n' +
  'export const znrQuestions = ' + JSON.stringify(data.znr, null, 2) + ';\n'
);
console.log("Written default questions to file.");
