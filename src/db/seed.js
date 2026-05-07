function runSeeds(db, seeds) {
  for (const seed of seeds) {
    seed.run(db);
  }
}

module.exports = { runSeeds };
