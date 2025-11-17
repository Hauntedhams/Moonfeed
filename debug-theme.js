// Quick theme debug script
console.log('=== THEME DEBUG ===');
console.log('body classes:', document.body.className);
console.log('html classes:', document.documentElement.className);
console.log('data-theme:', document.documentElement.getAttribute('data-theme'));
console.log('body.classList.contains("dark-mode"):', document.body.classList.contains('dark-mode'));
console.log('body.classList.contains("light-mode"):', document.body.classList.contains('light-mode'));
console.log('documentElement.classList.contains("dark-mode"):', document.documentElement.classList.contains('dark-mode'));

// Check computed styles
const chartElement = document.querySelector('.twelve-data-chart');
if (chartElement) {
  const styles = window.getComputedStyle(chartElement);
  console.log('Chart background:', styles.getPropertyValue('background'));
  console.log('--chart-bg:', styles.getPropertyValue('--chart-bg'));
}
