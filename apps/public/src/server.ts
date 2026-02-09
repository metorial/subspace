async function main() {
  await import('./init');
  await import('./instrument');
  await import('./endpoints');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
