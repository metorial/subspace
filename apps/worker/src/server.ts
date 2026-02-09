async function main() {
  await import('./init');
  await import('./instrument');
  await import('./worker');
  await import('./connection');
  await import('./endpoints');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
