import { seedProductionKnowledge, PRODUCTION_KNOWLEDGE_SEEDS } from '../src/modules/knowledge/productionSeeds.js';
import { inMemoryKnowledgeSources, inMemoryKnowledgeChunks } from '../src/modules/knowledge/knowledge.repository.js';

async function testSeeding() {
  console.log('=== AUDITING KNOWLEDGE SEEDING & CHUNKING ===');
  inMemoryKnowledgeSources.clear();
  inMemoryKnowledgeChunks.clear();
  
  const res = await seedProductionKnowledge(true);
  console.log(`Seeded sources: ${res.seededCount} | Skipped: ${res.skippedCount} | Total Chunks: ${res.totalChunks}`);
  console.log(`In-memory knowledge sources: ${inMemoryKnowledgeSources.size}`);
  console.log(`In-memory knowledge chunks: ${inMemoryKnowledgeChunks.size}`);

  let i = 1;
  for (const [chunkId, chunk] of inMemoryKnowledgeChunks.entries()) {
    console.log(`  [${i.toString().padStart(2, '0')}] ${chunkId} | ${chunk.headline} (${chunk.content.length} chars)`);
    i++;
  }

  // Verify idempotency
  const secondRun = await seedProductionKnowledge(false);
  console.log(`\nIdempotency check: Seeded: ${secondRun.seededCount}, Skipped: ${secondRun.skippedCount}, Total Chunks: ${secondRun.totalChunks}`);
  if (secondRun.skippedCount === 16 && secondRun.seededCount === 0 && inMemoryKnowledgeSources.size === 16 && inMemoryKnowledgeChunks.size === 32) {
    console.log('IDEMPOTENCY VERIFIED: 0 duplicates created on re-seed.');
    process.exit(0);
  } else {
    console.error('IDEMPOTENCY FAILED');
    process.exit(1);
  }
}

testSeeding();
